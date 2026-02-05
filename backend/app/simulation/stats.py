from __future__ import annotations

from app.models import AircraftLog, SimResults


class StatisticsCollector:
    """Records simulation events and compiles them into SimResults."""

    def __init__(self) -> None:
        self._landed: list[AircraftLog] = []
        self._departed: list[AircraftLog] = []
        self._diverted: list[AircraftLog] = []
        self._cancelled: list[AircraftLog] = []

        # Time-series snapshots: (sim_time, queue_size)
        self._holding_snapshots: list[list[float]] = []
        self._takeoff_snapshots: list[list[float]] = []

        # Live counters for queue sizes (updated by engine)
        self.current_holding_size: int = 0
        self.current_takeoff_queue_size: int = 0

    # -- recording methods --

    def record_landing(self, log: AircraftLog) -> None:
        self._landed.append(log)

    def record_departure(self, log: AircraftLog) -> None:
        self._departed.append(log)

    def record_diversion(self, log: AircraftLog) -> None:
        self._diverted.append(log)

    def record_cancellation(self, log: AircraftLog) -> None:
        self._cancelled.append(log)

    def snapshot_queues(self, sim_time: float) -> None:
        self._holding_snapshots.append([sim_time, self.current_holding_size])
        self._takeoff_snapshots.append([sim_time, self.current_takeoff_queue_size])

    # -- compile --

    def compile(self) -> SimResults:
        # Arrival metrics
        landed_waits = [a.wait_time for a in self._landed]
        landed_delays = [a.delay for a in self._landed]
        holding_sizes = [int(s[1]) for s in self._holding_snapshots]

        # Departure metrics
        departed_waits = [a.wait_time for a in self._departed]
        departed_delays = [a.delay for a in self._departed]
        takeoff_sizes = [int(s[1]) for s in self._takeoff_snapshots]

        return SimResults(
            # Departures
            total_departures=len(self._departed),
            total_cancellations=len(self._cancelled),
            max_takeoff_queue_size=max(takeoff_sizes, default=0),
            avg_takeoff_wait=_avg(departed_waits),
            max_takeoff_delay=max(departed_delays, default=0.0),
            avg_takeoff_delay=_avg(departed_delays),
            # Arrivals
            total_arrivals=len(self._landed),
            total_diversions=len(self._diverted),
            max_holding_size=max(holding_sizes, default=0),
            avg_holding_time=_avg(landed_waits),
            max_arrival_delay=max(landed_delays, default=0.0),
            avg_arrival_delay=_avg(landed_delays),
            # Time series
            takeoff_queue_over_time=self._takeoff_snapshots,
            holding_size_over_time=self._holding_snapshots,
            # Logs
            landed_aircraft=self._landed,
            departed_aircraft=self._departed,
            diverted_aircraft=self._diverted,
            cancelled_aircraft=self._cancelled,
        )


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0
