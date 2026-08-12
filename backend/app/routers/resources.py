import mimetypes
import uuid

from azure.core.exceptions import ResourceNotFoundError
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.framework.resource_processing import process_resource
from app.models import Agent, Resource, ResourceAgent
from app.schemas import ResourceAttachRequest, ResourceOut
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


def _out(resource: Resource) -> ResourceOut:
    return ResourceOut(
        id=resource.id,
        filename=resource.filename,
        content_type=resource.content_type,
        size_bytes=resource.size_bytes,
        is_processed=resource.is_processed,
        processing_error=resource.processing_error,
        chunk_count=len(resource.chunks),
        attached_agent_ids=[link.agent_id for link in resource.agent_links],
        created_at=resource.created_at,
    )


@router.get("", response_model=list[ResourceOut])
async def list_resources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Resource).order_by(Resource.created_at.desc()))
    return [_out(r) for r in result.scalars().unique().all()]


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

    # Extract + chunk + embed right away, independent of which agent(s) this
    # ends up attached to (attaching is just a join row - see /attach below).
    # Not fatal if it fails (unsupported format, embeddings not configured):
    # the resource still uploaded fine and stays downloadable either way.
    await process_resource(db, resource)
    await db.refresh(resource, attribute_names=["chunks", "agent_links"])
    return _out(resource)


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


@router.post("/{resource_id}/attach", response_model=ResourceOut)
async def attach_resource(resource_id: int, payload: ResourceAttachRequest, db: AsyncSession = Depends(get_db)):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if not await db.get(Agent, payload.agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")

    existing = await db.get(ResourceAgent, (resource_id, payload.agent_id))
    if not existing:
        db.add(ResourceAgent(resource_id=resource_id, agent_id=payload.agent_id))
        await db.commit()
        await db.refresh(resource, attribute_names=["chunks", "agent_links"])
    return _out(resource)


@router.delete("/{resource_id}/attach/{agent_id}", response_model=ResourceOut)
async def detach_resource(resource_id: int, agent_id: int, db: AsyncSession = Depends(get_db)):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    link = await db.get(ResourceAgent, (resource_id, agent_id))
    if link:
        await db.delete(link)
        await db.commit()
        await db.refresh(resource, attribute_names=["chunks", "agent_links"])
    return _out(resource)


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
