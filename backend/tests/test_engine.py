import pytest
from app.models import (
    EmergencyStatus,
    RunwayConfig,
    RunwayClosure,
    RunwayMode,
    RunwayStatus,
    SimConfig,
)
from app.simulation.engine import AirportSimulation


def _run(config: SimConfig):
    return AirportSimulation(config).run()


# -- Basic operation --


class TestDedicatedRunways:
    """P1 & P2: single dedicated landing and takeoff runways."""

    def test_all_aircraft_processed(self):
        config = SimConfig(
            runways=[
                RunwayConfig(mode=RunwayMode.LANDING),
                RunwayConfig(mode=RunwayMode.TAKEOFF),
            ],
            inbound_flow=10, outbound_flow=10,
            sim_duration=60, seed=1,
        )
        r = _run(config)
        assert r.total_arrivals > 0
        assert r.total_departures > 0
        assert r.total_diversions == 0
        assert r.total_cancellations == 0

    def test_metrics_are_nonnegative(self):
        config = SimConfig(
            runways=[
                RunwayConfig(mode=RunwayMode.LANDING),
                RunwayConfig(mode=RunwayMode.TAKEOFF),
            ],
            inbound_flow=15, outbound_flow=15,
            sim_duration=120, seed=42,
        )
        r = _run(config)
        assert r.avg_holding_time >= 0
        assert r.avg_takeoff_wait >= 0
        assert r.max_holding_size >= 0
        assert r.max_takeoff_queue_size >= 0


class TestNoRunwayForDirection:
    """No landing runway → all arrivals diverted. No takeoff → all cancelled."""

    def test_no_landing_runway(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.TAKEOFF)],
            inbound_flow=10, outbound_flow=10,
            sim_duration=30, seed=1,
        )
        r = _run(config)
        assert r.total_arrivals == 0
        assert r.total_diversions > 0

    def test_no_takeoff_runway(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.LANDING)],
            inbound_flow=10, outbound_flow=10,
            sim_duration=30, seed=1,
        )
        r = _run(config)
        assert r.total_departures == 0
        assert r.total_cancellations > 0


# -- P3: Mixed mode --


class TestMixedMode:
    def test_mixed_runway_handles_both(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.MIXED)],
            inbound_flow=10, outbound_flow=10,
            sim_duration=60, seed=42,
        )
        r = _run(config)
        assert r.total_arrivals > 0
        assert r.total_departures > 0

    def test_mixed_has_higher_queues_than_dedicated(self):
        """Mixed single runway should have longer waits than 2 dedicated."""
        mixed = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.MIXED)],
            inbound_flow=15, outbound_flow=15,
            sim_duration=120, seed=42,
        )
        dedicated = SimConfig(
            runways=[
                RunwayConfig(mode=RunwayMode.LANDING),
                RunwayConfig(mode=RunwayMode.TAKEOFF),
            ],
            inbound_flow=15, outbound_flow=15,
            sim_duration=120, seed=42,
        )
        r_mixed = _run(mixed)
        r_ded = _run(dedicated)
        # Mixed should have more pressure (higher avg waits or more diversions/cancellations)
        mixed_total_issues = r_mixed.total_diversions + r_mixed.total_cancellations
        ded_total_issues = r_ded.total_diversions + r_ded.total_cancellations
        mixed_total_wait = r_mixed.avg_holding_time + r_mixed.avg_takeoff_wait
        ded_total_wait = r_ded.avg_holding_time + r_ded.avg_takeoff_wait
        assert mixed_total_wait >= ded_total_wait or mixed_total_issues >= ded_total_issues


# -- P4: Runway closures --


class TestRunwayClosures:
    def test_closure_increases_cancellations(self):
        base = SimConfig(
            runways=[
                RunwayConfig(mode=RunwayMode.LANDING),
                RunwayConfig(mode=RunwayMode.TAKEOFF),
            ],
            inbound_flow=15, outbound_flow=15,
            sim_duration=120, seed=42,
        )
        with_closure = base.model_copy(
            update={
                "closures": [
                    RunwayClosure(runway_index=1, start_time=30, end_time=60,
                                  reason=RunwayStatus.INSPECTION)
                ]
            }
        )
        r_base = _run(base)
        r_closed = _run(with_closure)
        # Closure should cause more cancellations or at least higher queue
        assert (
            r_closed.total_cancellations >= r_base.total_cancellations
            or r_closed.max_takeoff_queue_size > r_base.max_takeoff_queue_size
        )

    def test_closure_of_landing_runway_increases_diversions(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.LANDING)],
            inbound_flow=15, outbound_flow=0,
            sim_duration=120, seed=42,
            closures=[
                RunwayClosure(runway_index=0, start_time=20, end_time=80,
                              reason=RunwayStatus.SNOW)
            ],
        )
        r = _run(config)
        assert r.total_diversions > 0


# -- P5: Fuel modelling --


class TestFuelDiversions:
    def test_high_traffic_causes_diversions(self):
        """With very high inbound flow and 1 runway, some must divert on fuel."""
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.LANDING)],
            inbound_flow=60,  # 1 per minute, runway takes 2 min each
            outbound_flow=0,
            sim_duration=120, seed=42,
        )
        r = _run(config)
        # Many aircraft waiting → some will run out of fuel
        assert r.total_diversions > 0

    def test_low_traffic_no_diversions(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.LANDING)],
            inbound_flow=5,
            outbound_flow=0,
            sim_duration=60, seed=42,
        )
        r = _run(config)
        assert r.total_diversions == 0


# -- Determinism --


class TestDeterminism:
    def test_same_seed_same_results(self):
        config = SimConfig(
            runways=[
                RunwayConfig(mode=RunwayMode.LANDING),
                RunwayConfig(mode=RunwayMode.TAKEOFF),
            ],
            inbound_flow=15, outbound_flow=15,
            sim_duration=60, seed=123,
        )
        r1 = _run(config)
        r2 = _run(config)
        assert r1.total_arrivals == r2.total_arrivals
        assert r1.total_departures == r2.total_departures
        assert r1.total_diversions == r2.total_diversions
        assert r1.total_cancellations == r2.total_cancellations
        assert r1.avg_holding_time == r2.avg_holding_time


# -- Edge cases --


class TestEdgeCases:
    def test_zero_flow(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.MIXED)],
            inbound_flow=0, outbound_flow=0,
            sim_duration=30, seed=1,
        )
        r = _run(config)
        assert r.total_arrivals == 0
        assert r.total_departures == 0

    def test_time_series_generated(self):
        config = SimConfig(
            runways=[RunwayConfig(mode=RunwayMode.MIXED)],
            inbound_flow=10, outbound_flow=10,
            sim_duration=60, seed=1,
        )
        r = _run(config)
        assert len(r.holding_size_over_time) > 0
        assert len(r.takeoff_queue_over_time) > 0
