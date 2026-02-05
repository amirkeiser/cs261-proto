from fastapi.testclient import TestClient

from app.main import app
from app.models import RunwayConfig, RunwayMode, SimConfig

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_simulate_returns_results():
    config = SimConfig(
        runways=[
            RunwayConfig(mode=RunwayMode.LANDING),
            RunwayConfig(mode=RunwayMode.TAKEOFF),
        ],
        inbound_flow=10, outbound_flow=10,
        sim_duration=30, seed=42,
    )
    resp = client.post("/simulate", json=config.model_dump())
    assert resp.status_code == 200
    data = resp.json()
    assert "total_arrivals" in data
    assert "total_departures" in data
    assert data["total_arrivals"] > 0


def test_simulate_with_closure():
    config = {
        "runways": [
            {"mode": "landing"},
            {"mode": "takeoff"},
        ],
        "inbound_flow": 15,
        "outbound_flow": 15,
        "sim_duration": 60,
        "seed": 42,
        "closures": [
            {"runway_index": 1, "start_time": 10, "end_time": 30, "reason": "inspection"}
        ],
    }
    resp = client.post("/simulate", json=config)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_cancellations"] >= 0


def test_simulate_invalid_config():
    resp = client.post("/simulate", json={"runways": "bad"})
    assert resp.status_code == 422
