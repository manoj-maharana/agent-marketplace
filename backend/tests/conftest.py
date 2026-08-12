import os
import pathlib

import pytest

TEST_DB_PATH = pathlib.Path(__file__).parent / "test_agentmarket.db"

# Must be set before `app` is imported anywhere, so isolate the test DB from dev.db.
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ.setdefault("AUTO_SEED", "true")
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "")
os.environ.setdefault("AZURE_OPENAI_API_KEY", "")
os.environ["AZURE_STORAGE_CONNECTION_STRING"] = ""


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_db():
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    yield
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
