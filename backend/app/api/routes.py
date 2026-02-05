import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models import SimConfig, SimResults
from app.simulation.engine import AirportSimulation

router = APIRouter()

# Real-world delay per sim-minute tick (seconds).
# 120 sim-minutes * 0.05s = 6 seconds total playback.
STREAM_TICK_DELAY = 0.05
STREAM_STEP_SIZE = 1.0  # sim-minutes per tick


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/simulate", response_model=SimResults)
def simulate(config: SimConfig) -> SimResults:
    sim = AirportSimulation(config)
    return sim.run()


@router.websocket("/simulate/stream")
async def simulate_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        config = SimConfig(**data)

        sim = AirportSimulation(config)
        sim.setup()

        current = 0.0
        while current < config.sim_duration:
            next_time = min(current + STREAM_STEP_SIZE, config.sim_duration)
            sim.step(next_time)
            current = next_time

            snapshot = sim.snapshot()
            await websocket.send_json(snapshot)
            await asyncio.sleep(STREAM_TICK_DELAY)

        # Send final message
        final = sim.stats.compile()
        await websocket.send_json({"type": "done", **final.model_dump()})
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close(code=1011)
