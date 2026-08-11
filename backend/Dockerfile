# Production image for the FastAPI backend. Portable across Azure App
# Service (Linux containers), Render, Railway, and Fly.io - all inject a
# $PORT env var (or you set WEBSITES_PORT=8000 on Azure App Service if it
# doesn't), which the CMD below respects.
FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg / building wheels; removed from the final layer via
# a single RUN so they don't bloat the image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# AUTO_SEED defaults to true (see app/config.py) - first boot against a fresh
# Postgres database creates tables and loads the marketplace content
# automatically. Safe to leave on: seed() no-ops once categories exist.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
