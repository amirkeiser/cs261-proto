from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class EmergencyStatus(str, Enum):
    NONE = "none"
    FUEL = "fuel"
    MECHANICAL = "mechanical"
    PASSENGER_HEALTH = "passenger_health"


class RunwayMode(str, Enum):
    LANDING = "landing"
    TAKEOFF = "takeoff"
    MIXED = "mixed"


class RunwayStatus(str, Enum):
    AVAILABLE = "available"
    INSPECTION = "inspection"
    SNOW = "snow"
    EQUIPMENT_FAILURE = "equipment_failure"


class Aircraft(BaseModel):
    callsign: str
    operator: str
    origin: str
    destination: str
    scheduled_time: float  # minutes from sim start
    actual_time: float | None = None  # when actually processed
    altitude: float = 0.0  # metres above ground
    ground_speed: float = 250.0  # knots
    fuel_remaining: float = 40.0  # minutes of fuel
    emergency: EmergencyStatus = EmergencyStatus.NONE
    direction: Literal["inbound", "outbound"] = "inbound"


class RunwayConfig(BaseModel):
    number: str = "01"  # two-digit runway number
    length: float = 3000.0  # metres
    bearing: float = 90.0  # degrees
    mode: RunwayMode = RunwayMode.LANDING
    status: RunwayStatus = RunwayStatus.AVAILABLE


class RunwayClosure(BaseModel):
    runway_index: int  # index into SimConfig.runways
    start_time: float  # minutes into simulation
    end_time: float  # minutes into simulation
    reason: RunwayStatus = RunwayStatus.INSPECTION


class SimConfig(BaseModel):
    runways: list[RunwayConfig] = Field(default_factory=lambda: [RunwayConfig()])
    inbound_flow: float = 15.0  # aircraft per hour
    outbound_flow: float = 15.0  # aircraft per hour
    max_wait_time: float = 30.0  # minutes before cancellation
    sim_duration: float = 120.0  # minutes
    closures: list[RunwayClosure] = Field(default_factory=list)
    seed: int | None = None  # for reproducibility


class AircraftLog(BaseModel):
    callsign: str
    operator: str
    origin: str
    destination: str
    direction: Literal["inbound", "outbound"]
    scheduled_time: float
    entry_time: float  # when entered queue/holding
    exit_time: float | None = None  # when processed or removed
    wait_time: float = 0.0
    delay: float = 0.0  # actual - scheduled
    emergency: EmergencyStatus = EmergencyStatus.NONE
    fuel_at_entry: float = 0.0
    outcome: Literal["landed", "departed", "diverted", "cancelled"] = "landed"


class SimResults(BaseModel):
    # Departures
    total_departures: int = 0
    total_cancellations: int = 0
    max_takeoff_queue_size: int = 0
    avg_takeoff_wait: float = 0.0
    max_takeoff_delay: float = 0.0
    avg_takeoff_delay: float = 0.0
    # Arrivals
    total_arrivals: int = 0
    total_diversions: int = 0
    max_holding_size: int = 0
    avg_holding_time: float = 0.0
    max_arrival_delay: float = 0.0
    avg_arrival_delay: float = 0.0
    # Time series for charts: list of [time, size] pairs
    takeoff_queue_over_time: list[list[float]] = Field(default_factory=list)
    holding_size_over_time: list[list[float]] = Field(default_factory=list)
    # Per-aircraft logs
    landed_aircraft: list[AircraftLog] = Field(default_factory=list)
    departed_aircraft: list[AircraftLog] = Field(default_factory=list)
    diverted_aircraft: list[AircraftLog] = Field(default_factory=list)
    cancelled_aircraft: list[AircraftLog] = Field(default_factory=list)
