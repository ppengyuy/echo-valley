from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "up"


def test_register_login_flow():
    username = f"test_{uuid4().hex[:8]}"
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={"username": username, "password": "secret123"},
        )
        assert register.status_code == 201
        token = register.json()["data"]["access_token"]
        assert token

        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me.status_code == 200
        assert me.json()["data"]["user"]["username"] == username

        login = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "secret123"},
        )
        assert login.status_code == 200
        assert login.json()["data"]["access_token"]
