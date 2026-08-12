from azure.storage.blob.aio import BlobServiceClient

from app.config import get_settings


class BlobStorageNotConfigured(Exception):
    pass


def _container_client():
    settings = get_settings()
    if not settings.blob_storage_configured:
        raise BlobStorageNotConfigured(
            "Azure Blob Storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING in "
            "backend/.env, then restart the server."
        )
    service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    return service, service.get_container_client(settings.azure_storage_container)


async def upload_blob(blob_name: str, data: bytes, content_type: str) -> None:
    from azure.storage.blob import ContentSettings

    service, container = _container_client()
    async with service:
        await container.upload_blob(
            blob_name, data, overwrite=True, content_settings=ContentSettings(content_type=content_type)
        )


async def download_blob(blob_name: str) -> bytes:
    service, container = _container_client()
    async with service:
        stream = await container.download_blob(blob_name)
        return await stream.readall()


async def delete_blob(blob_name: str) -> None:
    service, container = _container_client()
    async with service:
        await container.delete_blob(blob_name)
