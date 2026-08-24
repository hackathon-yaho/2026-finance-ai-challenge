import os

os.environ.setdefault("INTERNAL_TOKEN", "test-token")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    from app.main import app

    return TestClient(app, raise_server_exceptions=False)


AUTH = {"X-Internal-Token": "test-token"}
