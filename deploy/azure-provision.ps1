<#
.SYNOPSIS
  Provisions the backend on Azure Container Apps: a resource group, a
  Container Apps environment, a Container App (placeholder image - the
  GitHub Actions workflow deploys the real one), and all its environment
  variables wired up.

  Why Container Apps and not classic App Service: on a brand-new / free-
  trial Azure subscription, App Service (every tier, including Free/F1) and
  Azure Database for PostgreSQL Flexible Server both fail with "Operation
  cannot be completed without additional quota" / "location is restricted"
  - your default quota for VM-backed compute is 0 until you add a payment
  method or get a quota increase approved (Portal only, no CLI/API path for
  that). Container Apps is consumption-based (a different quota family) and
  worked out of the box on a fresh free-trial subscription when this was
  tested. It also has a real free monthly grant (~180K vCPU-seconds /
  360K GiB-seconds / 2M requests). Note: this subscription also only allows
  ONE Container Apps environment total (subscription-wide, not per-region)
  - if you need to recreate it, delete the old one first and wait for it to
  fully clear (can take several minutes; occasionally gets stuck - if so,
  delete and recreate the whole resource group instead of waiting further).

  Database, three options via -DbMode:
    sqlite   (default) SQLite on an Azure Files volume mounted into the
             container at /data. Genuinely free (no separate DB resource
             billed beyond pennies of file storage), zero code changes.
             Caveat: SQLite on a network filesystem (SMB, which is what
             Azure Files is) is officially outside SQLite's supported
             configurations - locking semantics aren't fully guaranteed the
             way they are on local disk. -MaxReplicas is hardcoded to 1
             specifically to avoid concurrent multi-writer corruption; for
             a single-user app with a single replica this is a widely used
             pattern in practice, but it is not Azure's own managed-DB
             durability guarantee. Migrate to -DbMode postgres or external
             if this ever needs to be more than a personal deployment.
    external Point at an already-existing external Postgres (e.g. a free
             Neon project) via -DatabaseUrl. Real client-server DB, no
             locking caveat, but not literally "on Azure."
    postgres Create an Azure Database for PostgreSQL Flexible Server.
             Needs your subscription's PostgreSQL quota approved first
             (see the note above) - will fail with "location is restricted"
             otherwise.

  Run this once. It does NOT deploy your code - that happens afterwards via
  the "Deploy backend to Azure Container Apps" GitHub Actions workflow,
  once you've added the secrets this script prints at the end.

.PREREQUISITES
  - Azure CLI installed:  winget install Microsoft.AzureCLI  (then reopen the terminal)
  - Logged in:             az login
  - An Azure subscription with permission to create resources

.EXAMPLE
  cd deploy
  ./azure-provision.ps1 -AppName "agent-marketplace-manoj"

  AppName must be globally unique within your region - it becomes the
  Container App name and part of its auto-generated FQDN
  (https://<AppName>.<random>.<region>.azurecontainerapps.io).

.EXAMPLE
  # External Postgres (e.g. Neon) instead of SQLite:
  ./azure-provision.ps1 -AppName "agent-marketplace-manoj" -DbMode external `
    -DatabaseUrl "postgresql+asyncpg://user:pass@ep-xxx.neon.tech/neondb"
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$AppName,

  [string]$ResourceGroup = "agent-marketplace-rg",
  [string]$Location = "eastus",
  # Where the Container Apps environment + app actually get created.
  # Defaults to $Location, but can differ - e.g. if the resource group
  # already exists in one region while a resource type is restricted there
  # on your subscription (common on brand-new subscriptions).
  [string]$ResourceLocation = "",

  [ValidateSet("sqlite", "external", "postgres")]
  [string]$DbMode = "sqlite",

  [string]$DbAdminUser = "dbadmin",
  [string]$DbSkuName = "Standard_B1ms",
  [string]$DbVersion = "16",
  [string]$DbAdminPassword = "",

  # Full postgresql+asyncpg://... connection string to an already-existing
  # Postgres instance (e.g. Neon, Supabase). Required when -DbMode external.
  [string]$DatabaseUrl = "",

  [string]$Cpu = "0.5",
  [string]$Memory = "1.0Gi",
  # 0 = scale to zero when idle (true $0 compute cost, but the first
  # request after idle takes a few seconds to cold-start). 1 = always warm,
  # no cold starts, uses more of the free monthly grant.
  [int]$MinReplicas = 0
)

# Deliberately NOT "Stop": az writes routine informational lines to stderr,
# and PowerShell wraps every stderr line from a native exe in a terminating
# ErrorRecord under ErrorActionPreference=Stop even when the command exits
# 0. Real failures are caught explicitly below via $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"

function Invoke-Az {
  param([Parameter(ValueFromRemainingArguments = $true)]$Args)
  & az @Args
  if ($LASTEXITCODE -ne 0) {
    throw "az $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Assert-AzCli {
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "Azure CLI not found. Install it first:" -ForegroundColor Red
    Write-Host "  winget install Microsoft.AzureCLI" -ForegroundColor Yellow
    Write-Host "then reopen this terminal and run 'az login'." -ForegroundColor Yellow
    exit 1
  }
  $account = az account show 2>$null | ConvertFrom-Json
  if (-not $account) {
    Write-Host "Not logged in to Azure. Run 'az login' first, then re-run this script." -ForegroundColor Red
    exit 1
  }
  Write-Host "Using Azure subscription: $($account.name) ($($account.id))" -ForegroundColor Cyan
  return $account
}

function New-RandomPassword {
  $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#%^*"
  $rand = New-Object System.Random
  -join (1..24 | ForEach-Object { $chars[$rand.Next(0, $chars.Length)] })
}

if ($DbMode -eq "external" -and [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  Write-Host "-DbMode external requires -DatabaseUrl (e.g. a free Neon connection string)." -ForegroundColor Red
  exit 1
}

$account = Assert-AzCli

if ([string]::IsNullOrWhiteSpace($ResourceLocation)) {
  $ResourceLocation = $Location
}

$envName = "$AppName-env"

Write-Host "`n==> Registering Microsoft.App + Microsoft.OperationalInsights (Container Apps needs both)" -ForegroundColor Cyan
Invoke-Az provider register --namespace Microsoft.App
Invoke-Az provider register --namespace Microsoft.OperationalInsights

Write-Host "==> Resource group: $ResourceGroup ($Location)" -ForegroundColor Cyan
Invoke-Az group create --name $ResourceGroup --location $Location --output none

if ($DbMode -eq "postgres") {
  if ([string]::IsNullOrWhiteSpace($DbAdminPassword)) {
    $DbAdminPassword = New-RandomPassword
    $generatedPassword = $true
  }
  $dbServerName = "$AppName-db"
  $dbName = "agentmarket"
  Write-Host "==> Postgres Flexible Server: $dbServerName in $ResourceLocation (this takes a few minutes)" -ForegroundColor Cyan
  Invoke-Az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $dbServerName `
    --location $ResourceLocation `
    --admin-user $DbAdminUser `
    --admin-password $DbAdminPassword `
    --sku-name $DbSkuName `
    --tier Burstable `
    --storage-size 32 `
    --version $DbVersion `
    --public-access 0.0.0.0 `
    --yes `
    --output none

  Invoke-Az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $dbServerName `
    --database-name $dbName `
    --output none

  $dbHost = "$dbServerName.postgres.database.azure.com"
  $databaseUrl = "postgresql+asyncpg://${DbAdminUser}:${DbAdminPassword}@${dbHost}:5432/${dbName}"
  $dbSsl = "true"
} elseif ($DbMode -eq "external") {
  Write-Host "==> Using external Postgres (no Azure DB resource created)" -ForegroundColor Cyan
  $databaseUrl = $DatabaseUrl
  $dbHost = ([Uri]($DatabaseUrl -replace '^postgresql\+asyncpg://', 'http://')).Host
  $dbSsl = "true"
} else {
  $storageAccountName = (($AppName -replace '[^a-zA-Z0-9]', '').ToLower())
  if ($storageAccountName.Length -gt 24) { $storageAccountName = $storageAccountName.Substring(0, 24) }
  $fileShareName = "sqlitedata"
  $storageLinkName = "sqlite-storage"
  Write-Host "==> Storage account for SQLite volume: $storageAccountName" -ForegroundColor Cyan
  Invoke-Az storage account create `
    --name $storageAccountName --resource-group $ResourceGroup `
    --location $ResourceLocation --sku Standard_LRS --output none
  $storageKey = az storage account keys list --resource-group $ResourceGroup --account-name $storageAccountName --query "[0].value" -o tsv
  Invoke-Az storage share create --name $fileShareName --account-name $storageAccountName --account-key $storageKey --output none

  $databaseUrl = "sqlite+aiosqlite:////data/dev.db"
  $dbHost = "SQLite on Azure Files ($storageAccountName/$fileShareName, mounted at /data)"
  $dbSsl = "false"
}

Write-Host "==> Container Apps environment: $envName in $ResourceLocation" -ForegroundColor Cyan
Invoke-Az containerapp env create `
  --name $envName `
  --resource-group $ResourceGroup `
  --location $ResourceLocation `
  --output none

if ($DbMode -eq "sqlite") {
  Write-Host "==> Linking SQLite storage to the environment" -ForegroundColor Cyan
  Invoke-Az containerapp env storage set `
    --resource-group $ResourceGroup --name $envName `
    --storage-name $storageLinkName `
    --azure-file-account-name $storageAccountName `
    --azure-file-account-key $storageKey `
    --azure-file-share-name $fileShareName `
    --access-mode ReadWrite `
    --output none
}

Write-Host "==> Container App: $AppName (placeholder image - the GitHub Actions workflow deploys the real one)" -ForegroundColor Cyan
Invoke-Az containerapp create `
  --name $AppName `
  --resource-group $ResourceGroup `
  --environment $envName `
  --image "mcr.microsoft.com/k8se/quickstart:latest" `
  --target-port 8000 `
  --ingress external `
  --min-replicas $MinReplicas `
  --max-replicas 1 `
  --cpu $Cpu `
  --memory $Memory `
  --env-vars `
    "DATABASE_URL=$databaseUrl" `
    "DATABASE_SSL=$dbSsl" `
    "AZURE_OPENAI_ENDPOINT=" `
    "AZURE_OPENAI_API_KEY=" `
    "AZURE_OPENAI_API_VERSION=2024-10-21" `
    "AZURE_OPENAI_DEPLOYMENT=gpt-4o" `
    "AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small" `
    'CORS_ORIGINS=["http://localhost:5173"]' `
  --output none

if ($DbMode -eq "sqlite") {
  # Volume mounts aren't reliably settable via containerapp create's plain
  # flags - add them with a follow-up YAML update instead, mirroring the
  # container config that create just applied.
  Write-Host "==> Attaching the SQLite volume mount at /data" -ForegroundColor Cyan
  $updateYaml = @"
properties:
  template:
    containers:
    - image: mcr.microsoft.com/k8se/quickstart:latest
      name: $AppName
      resources:
        cpu: $Cpu
        memory: $Memory
      env:
      - name: DATABASE_URL
        value: $databaseUrl
      - name: DATABASE_SSL
        value: "false"
      volumeMounts:
      - volumeName: sqlite-vol
        mountPath: /data
    scale:
      minReplicas: $MinReplicas
      maxReplicas: 1
    volumes:
    - name: sqlite-vol
      storageType: AzureFile
      storageName: $storageLinkName
"@
  $updateYamlPath = Join-Path $PSScriptRoot "containerapp-volume.generated.yaml"
  $updateYaml | Out-File -FilePath $updateYamlPath -Encoding utf8
  Invoke-Az containerapp update --name $AppName --resource-group $ResourceGroup --yaml $updateYamlPath --output none
  Remove-Item $updateYamlPath -ErrorAction SilentlyContinue
}

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host "`n==> Creating a deploy service principal (resource-group-scoped) for GitHub Actions" -ForegroundColor Cyan
$spName = "$AppName-deploy"
$scope = "/subscriptions/$($account.id)/resourceGroups/$ResourceGroup"
$sp = az ad sp create-for-rbac --name $spName --role Contributor --scopes $scope 2>$null | ConvertFrom-Json
if (-not $sp) {
  throw "Failed to create the deploy service principal - check you have permission to create Azure AD app registrations."
}
$azureCredentialsJson = @{
  clientId       = $sp.appId
  clientSecret   = $sp.password
  subscriptionId = $account.id
  tenantId       = $sp.tenant
} | ConvertTo-Json -Compress

$credsPath = Join-Path $PSScriptRoot "azure-credentials.json"
$azureCredentialsJson | Out-File -FilePath $credsPath -Encoding utf8

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " Done. Backend URL:  https://$fqdn" -ForegroundColor Green
Write-Host " DB:                 $dbHost" -ForegroundColor Green
if ($DbMode -eq "postgres" -and $generatedPassword) {
  Write-Host " DB admin password:  $DbAdminPassword   <- save this now, shown only once" -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. GitHub repo -> Settings -> Secrets and variables -> Actions, add:"
Write-Host "     AZURE_CONTAINERAPP_NAME  = $AppName"
Write-Host "     AZURE_RESOURCE_GROUP     = $ResourceGroup"
Write-Host "     AZURE_CREDENTIALS        = contents of $credsPath"
Write-Host "   Then DELETE $credsPath locally - it's a live credential, don't leave it on disk or commit it."
Write-Host "2. Azure Portal -> Container Apps -> '$AppName' -> Containers -> Environment variables, fill in:"
Write-Host "     AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY (from your Azure OpenAI resource)"
Write-Host "3. GitHub -> Actions -> 'Deploy backend to Azure Container Apps' -> Run workflow."
Write-Host "4. After pushing the image once, make the GHCR package public (repo -> Packages ->"
Write-Host "   agent-marketplace-backend -> Package settings -> Change visibility), otherwise"
Write-Host "   Container Apps can't pull a private image without extra registry credentials."
Write-Host "5. Once your Vercel frontend URL exists, update CORS_ORIGINS (Container App -> Containers"
Write-Host "   -> Environment variables) to include it, e.g. [`"https://your-app.vercel.app`"]."
Write-Host "6. Verify: https://$fqdn/health should return"
Write-Host '   {"status":"ok","azure_openai_configured":true}  (false until step 2 is done)'
