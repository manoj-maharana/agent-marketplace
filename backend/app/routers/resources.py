import mimetypes
import uuid

from azure.core.exceptions import ResourceNotFoundError
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Resource
from app.schemas import ResourceOut
from app.services.blob_storage import BlobStorageNotConfigured, delete_blob, download_blob, upload_blob

router = APIRouter(prefix="/api/resources", tags=["resources"])

ALLOWED_EXTENSIONS = (
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".md",
    ".txt",
    ".csv",
)


@router.get("", response_model=list[ResourceOut])
async def list_resources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Resource).order_by(Resource.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ResourceOut, status_code=201)
async def upload_resource(file: UploadFile, db: AsyncSession = Depends(get_db)):
    filename = file.filename or "untitled"
    if not filename.lower().endswith(ALLOWED_EXTENSIONS):
        allowed = ", ".join(ALLOWED_EXTENSIONS)
        raise HTTPException(status_code=400, detail=f"Unsupported file type - allowed: {allowed}")

    data = await file.read()
    content_type = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    blob_name = f"{uuid.uuid4().hex}-{filename}"

    try:
        await upload_blob(blob_name, data, content_type)
    except BlobStorageNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    resource = Resource(
        filename=filename, content_type=content_type, size_bytes=len(data), blob_name=blob_name
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource


@router.get("/{resource_id}/download")
async def download_resource(resource_id: int, db: AsyncSession = Depends(get_db)):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    try:
        data = await download_blob(resource.blob_name)
    except BlobStorageNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=data,
        media_type=resource.content_type,
        headers={"Content-Disposition": f'attachment; filename="{resource.filename}"'},
    )


@router.delete("/{resource_id}", status_code=204)
async def delete_resource(resource_id: int, db: AsyncSession = Depends(get_db)):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    try:
        await delete_blob(resource.blob_name)
    except BlobStorageNotConfigured as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ResourceNotFoundError:
        pass  # already gone from storage - still clear the DB row below

    await db.delete(resource)
    await db.commit()
