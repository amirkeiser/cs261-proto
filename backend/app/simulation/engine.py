from __future__ import annotations

import simpy
import numpy as np

from app.models import (
    Aircraft,
    AircraftLog,
    EmergencyStatus,
    RunwayClosure,
    RunwayConfig,
    RunwayMode,
    RunwayStatus,
    SimConfig,
    SimResults,
)
from app.simulation.stats import StatisticsCollector

# Constant durations (minutes)
LANDING_DURATION = 2.0
TAKEOFF_DURATION = 2.0
SAMPLE_INTERVAL = 1.0  # snapshot queue sizes every 1 sim-minute

# Arrival/departure time standard deviation (minutes)
TIME_STDDEV = 5.0
# Truncate normal distribution at ±3σ
TIME_TRUNCATE = 15.0

# Emergency probabilities for inbound aircraft
EMERGENCY_MECHANICAL_PROB = 0.01  # 1%
EMERGENCY_PASSENGER_PROB = 0.01  # 1%
EMERGENCY_FUEL_PROB = 0.005  # 0.5% (on top of natural fuel depletion)

# Fuel bounds (minutes)
FUEL_MIN = 20.0
FUEL_MAX = 60.0
FUEL_RESERVE = 10.0  # must divert before reaching this


class SimRunway:
    """Wraps a SimPy PriorityResource representing a single runway."""

    def __init__(self, env: simpy.Environment, config: RunwayConfig) -> None:
        self.env = env
        self.config = config
        self.resource = simpy.PriorityResource(env, capacity=1)


class AirportSimulation:
    """Discrete-event airport simulation using SimPy."""

    def __init__(self, config: SimConfig) -> None:
        self.config = config
        self.rng = np.random.default_rng(config.seed)
        self.env = simpy.Environment()
        self.stats = StatisticsCollector()

        self.runways = [SimRunway(self.env, rc) for rc in config.runways]

        # Track current queue sizes for stats snapshots
        self._holding_count = 0
        self._takeoff_count = 0

        # Monotonic counters for FIFO ordering within same priority
        self._arrival_order = 0
        self._departure_order = 0

    def setup(self) -> None:
        """Register all SimPy processes. Call once before stepping."""
        if self.config.inbound_flow > 0:
            self.env.process(self._generate_arrivals())
        if self.config.outbound_flow > 0:
            self.env.process(self._generate_departures())
        for closure in self.config.closures:
            self.env.process(self._closure_process(closure))
        self.env.process(self._sample_queues())

    def step(self, until: float) -> None:
        """Advance the simulation to the given time."""
        self.env.run(until=until)

    def snapshot(self) -> dict:
        """Return a lightweight snapshot of current state for streaming."""
        results = self.stats.compile()
        return {
            "type": "tick",
            "sim_time": round(self.env.now, 1),
            "sim_duration": self.config.sim_duration,
            **results.model_dump(),
        }

    def run(self) -> SimResults:
        """Run the full simulation and return compiled results."""
        self.setup()
        self.step(self.config.sim_duration)
        return self.stats.compile()

    # -- Aircraft generators --

    def _generate_arrivals(self) -> simpy.Process:
        interval = 60.0 / self.config.inbound_flow  # minutes between aircraft
        scheduled = 0.0
        while True:
            # Actual arrival offset by N(0, σ=5), truncated
            offset = float(self.rng.normal(0, TIME_STDDEV))
            offset = max(-TIME_TRUNCATE, min(TIME_TRUNCATE, offset))
            actual_entry = max(0.0, scheduled + offset)

            # Wait until actual entry time
            wait = actual_entry - self.env.now
            if wait > 0:
                yield self.env.timeout(wait)

            aircraft = self._make_aircraft(scheduled, "inbound")
            self.env.process(self._arrival_process(aircraft, scheduled))

            scheduled += interval

    def _generate_departures(self) -> simpy.Process:
        interval = 60.0 / self.config.outbound_flow
        scheduled = 0.0
        while True:
            offset = float(self.rng.normal(0, TIME_STDDEV))
            offset = max(-TIME_TRUNCATE, min(TIME_TRUNCATE, offset))
            actual_entry = max(0.0, scheduled + offset)

            wait = actual_entry - self.env.now
            if wait > 0:
                yield self.env.timeout(wait)

            aircraft = self._make_aircraft(scheduled, "outbound")
            self.env.process(self._departure_process(aircraft, scheduled))

            scheduled += interval

    # -- Core processes --

    def _arrival_process(
        self, aircraft: Aircraft, scheduled_time: float
    ) -> simpy.Process:
        entry_time = self.env.now
        self._holding_count += 1
        self._arrival_order += 1
        order = self._arrival_order

        # Find a landing-capable runway
        runway = self._find_runway(RunwayMode.LANDING)
        if runway is None:
            # No runway available at all — immediate diversion
            self._holding_count -= 1
            self.stats.record_diversion(
                self._make_log(aircraft, scheduled_time, entry_time, "diverted")
            )
            return

        # Priority: 0 for emergency, 1 for normal. Order breaks ties (FIFO).
        priority = 0 if aircraft.emergency != EmergencyStatus.NONE else 1
        req = runway.resource.request(priority=(priority, order))

        # Time until fuel hits reserve
        fuel_timeout = self.env.timeout(aircraft.fuel_remaining - FUEL_RESERVE)

        # Race: runway grant vs fuel depletion
        result = yield req | fuel_timeout

        if req in result:
            # Got the runway — land
            self._holding_count -= 1
            yield self.env.timeout(LANDING_DURATION)
            runway.resource.release(req)

            wait = self.env.now - entry_time - LANDING_DURATION
            delay = self.env.now - LANDING_DURATION - scheduled_time
            log = self._make_log(
                aircraft, scheduled_time, entry_time, "landed",
                exit_time=self.env.now, wait_time=wait, delay=delay,
            )
            self.stats.record_landing(log)
        else:
            # Fuel ran out — divert
            self._holding_count -= 1
            if not req.triggered:
                req.cancel()
            else:
                runway.resource.release(req)

            log = self._make_log(
                aircraft, scheduled_time, entry_time, "diverted",
                exit_time=self.env.now,
                wait_time=self.env.now - entry_time,
            )
            self.stats.record_diversion(log)

    def _departure_process(
        self, aircraft: Aircraft, scheduled_time: float
    ) -> simpy.Process:
        entry_time = self.env.now
        self._takeoff_count += 1
        self._departure_order += 1
        order = self._departure_order

        runway = self._find_runway(RunwayMode.TAKEOFF)
        if runway is None:
            self._takeoff_count -= 1
            self.stats.record_cancellation(
                self._make_log(aircraft, scheduled_time, entry_time, "cancelled")
            )
            return

        # All departures have same priority (FIFO via order)
        req = runway.resource.request(priority=(1, order))
        max_wait_timeout = self.env.timeout(self.config.max_wait_time)

        result = yield req | max_wait_timeout

        if req in result:
            self._takeoff_count -= 1
            yield self.env.timeout(TAKEOFF_DURATION)
            runway.resource.release(req)

            wait = self.env.now - entry_time - TAKEOFF_DURATION
            delay = self.env.now - TAKEOFF_DURATION - scheduled_time
            log = self._make_log(
                aircraft, scheduled_time, entry_time, "departed",
                exit_time=self.env.now, wait_time=wait, delay=delay,
            )
            self.stats.record_departure(log)
        else:
            self._takeoff_count -= 1
            if not req.triggered:
                req.cancel()
            else:
                runway.resource.release(req)

            log = self._make_log(
                aircraft, scheduled_time, entry_time, "cancelled",
                exit_time=self.env.now,
                wait_time=self.env.now - entry_time,
            )
            self.stats.record_cancellation(log)

    def _closure_process(self, closure: RunwayClosure) -> simpy.Process:
        """Seize a runway at start_time, release at end_time."""
        yield self.env.timeout(closure.start_time)

        runway = self.runways[closure.runway_index]
        # Priority -1 = highest: will be next after current aircraft finishes
        req = runway.resource.request(priority=(-1, 0))
        yield req

        duration = closure.end_time - closure.start_time
        yield self.env.timeout(duration)
        runway.resource.release(req)

    def _sample_queues(self) -> simpy.Process:
        """Periodically snapshot queue sizes for time-series charts."""
        while True:
            self.stats.current_holding_size = self._holding_count
            self.stats.current_takeoff_queue_size = self._takeoff_count
            self.stats.snapshot_queues(self.env.now)
            yield self.env.timeout(SAMPLE_INTERVAL)

    # -- Helpers --

    def _find_runway(self, needed_mode: RunwayMode) -> SimRunway | None:
        """Find a runway that supports the needed mode.

        Landing needs mode=LANDING or MIXED.
        Takeoff needs mode=TAKEOFF or MIXED.
        Picks the runway with the shortest queue (fewest waiting requests).
        """
        candidates = []
        for rw in self.runways:
            if rw.config.status != RunwayStatus.AVAILABLE:
                continue
            if needed_mode == RunwayMode.LANDING:
                if rw.config.mode in (RunwayMode.LANDING, RunwayMode.MIXED):
                    candidates.append(rw)
            elif needed_mode == RunwayMode.TAKEOFF:
                if rw.config.mode in (RunwayMode.TAKEOFF, RunwayMode.MIXED):
                    candidates.append(rw)
        if not candidates:
            return None
        # Pick runway with fewest queued requests
        return min(candidates, key=lambda r: len(r.resource.queue))

    def _make_aircraft(
        self, scheduled_time: float, direction: str
    ) -> Aircraft:
        fuel = float(self.rng.uniform(FUEL_MIN, FUEL_MAX))
        callsign = f"{'ARR' if direction == 'inbound' else 'DEP'}{self._arrival_order if direction == 'inbound' else self._departure_order:04d}"

        # Roll for emergency status on inbound aircraft
        emergency = EmergencyStatus.NONE
        if direction == "inbound":
            roll = float(self.rng.random())
            if roll < EMERGENCY_MECHANICAL_PROB:
                emergency = EmergencyStatus.MECHANICAL
            elif roll < EMERGENCY_MECHANICAL_PROB + EMERGENCY_PASSENGER_PROB:
                emergency = EmergencyStatus.PASSENGER_HEALTH
            elif roll < EMERGENCY_MECHANICAL_PROB + EMERGENCY_PASSENGER_PROB + EMERGENCY_FUEL_PROB:
                emergency = EmergencyStatus.FUEL
                # Fuel emergencies also come in with critically low fuel
                fuel = float(self.rng.uniform(FUEL_RESERVE + 1, FUEL_RESERVE + 10))

        return Aircraft(
            callsign=callsign,
            operator="SIM-AIR",
            origin="ORIG" if direction == "inbound" else "HERE",
            destination="HERE" if direction == "inbound" else "DEST",
            scheduled_time=scheduled_time,
            fuel_remaining=fuel,
            emergency=emergency,
            direction=direction,
        )

    @staticmethod
    def _make_log(
        aircraft: Aircraft,
        scheduled_time: float,
        entry_time: float,
        outcome: str,
        exit_time: float | None = None,
        wait_time: float = 0.0,
        delay: float = 0.0,
    ) -> AircraftLog:
        return AircraftLog(
            callsign=aircraft.callsign,
            operator=aircraft.operator,
            origin=aircraft.origin,
            destination=aircraft.destination,
            direction=aircraft.direction,
            scheduled_time=scheduled_time,
            entry_time=entry_time,
            exit_time=exit_time,
            wait_time=max(0.0, wait_time),
            delay=delay,
            emergency=aircraft.emergency,
            fuel_at_entry=aircraft.fuel_remaining,
            outcome=outcome,
        )
