# Airport Simulation — Implementation Plan

## Project Understanding

This is an **airport simulation system** for a fictional international airport group (via Dorset Software). The goal is a discrete-event simulator that models aircraft arrivals and departures through configurable runway setups, generating throughput statistics to help airport managers evaluate operational decisions.

### Core Requirements (in priority order from the spec)

| Priority | Feature | Key Outputs |
|----------|---------|-------------|
| **P1** | Departures on dedicated take-off runway | Max queue size, avg wait time, max/avg delay |
| **P2** | Arrivals on dedicated landing runway + holding pattern | Max holding size, avg hold time, max/avg delay |
| **P3** | Mixed-use runways & multi-runway configs | Same metrics across configurations |
| **P4** | Runway closures | Cancellations based on configurable max wait (default 30min) |
| **P5** | Fuel modelling in holding pattern | Number of diversions |

### Key Domain Rules

- **Holding pattern**: Priority queue — emergencies first, then FIFO
- **Take-off queue**: Strict FIFO
- **Runway exclusivity**: Only 1 aircraft on a runway at any time
- **Arrival/departure timing**: Normally distributed around scheduled time (σ = 5 min)
- **Fuel**: Uniform(20, 60) minutes on entry; must land or divert before 10 min remaining; constant burn rate
- **Zones are discrete**: Aircraft exist only in holding pattern, take-off queue, or runway zone — instant transitions between them

### Optional Features (value-adds)

1. Additional statistics (variance, percentiles, range)
2. Real-time animated simulation
3. Visual/graphical representation (radar-like view)
4. Statistical event modelling (auto-generated emergencies/failures)

---

## Tech Stack

| Layer | Choice | Justification |
|-------|--------|---------------|
| **Language** | **Python 3.11+** | Universal in CS programs, rich ecosystem for simulation & stats, rapid prototyping. SimPy is the gold-standard discrete-event simulation library. |
| **Simulation Engine** | **SimPy** | Purpose-built for discrete-event simulation in Python. Provides process-based simulation with shared resources (perfect for runways). Eliminates need to write our own event loop. Well-documented, battle-tested. |
| **Statistics** | **NumPy / SciPy** | `scipy.stats.norm` for arrival/departure time offsets, `numpy.random.uniform` for fuel. NumPy for fast metric computation. |
| **Frontend** | **React + TypeScript** | Interactive dashboard for configuration, real-time display, and results comparison. Component model maps cleanly to the UI panels (config, simulation view, stats). Far richer UX than Streamlit for the optional visual representation feature. |
| **API** | **FastAPI + WebSockets** | FastAPI is the fastest Python web framework, has native WebSocket support (critical for real-time sim updates), auto-generates OpenAPI docs, and has excellent type validation via Pydantic. |
| **Visualization** | **Recharts (charts) + custom Canvas/SVG (radar view)** | Recharts for statistical charts; HTML5 Canvas for the optional real-time airport visualization. |
| **Testing** | **pytest + React Testing Library** | pytest is the Python standard; hypothesis for property-based testing of simulation invariants. |

### Why not Streamlit?

Streamlit is fast to prototype but fundamentally limited: it reruns the entire script on interaction, making real-time simulation display clunky. It also constrains layout and can't support WebSocket-driven live updates or side-by-side scenario comparison naturally. The team of 6 can parallelize frontend/backend work with a proper React+FastAPI split.

### Why not a custom event loop instead of SimPy?

SimPy handles resource contention (runways), process scheduling, and time management out of the box. Writing a custom event loop is error-prone and wastes time on solved problems. SimPy's `Resource` maps directly to runways, and its `Process` model maps to aircraft lifecycles.

---

## Architecture

```
┌─────────────────── Frontend (React) ───────────────────┐
│  ConfigPanel  │  SimulationView  │  StatsDashboard     │
│  - Runways    │  - Live aircraft  │  - Queue metrics   │
│  - Flow rates │  - Queue states   │  - Delay charts    │
│  - Controls   │  - Runway status  │  - Scenario compare│
└───────┬───────────────┬──────────────────┬─────────────┘
        │ REST          │ WebSocket        │ REST
┌───────┴───────────────┴──────────────────┴─────────────┐
│                    FastAPI Server                        │
│  POST /sim/configure    WS /sim/stream                  │
│  POST /sim/run          POST /sim/runway/{id}/status    │
│  GET  /sim/results      POST /sim/runway/{id}/mode      │
└───────────────────────┬────────────────────────────────┘
                        │
┌───────────────────────┴────────────────────────────────┐
│              Simulation Engine (SimPy)                   │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ AircraftGen  │  │ HoldingStack │  │ TakeoffQueue  │ │
│  │ (arrivals &  │  │ (priority Q) │  │ (FIFO)        │ │
│  │  departures) │  │              │  │               │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                │                   │         │
│  ┌──────┴────────────────┴───────────────────┴───────┐ │
│  │              RunwayManager                         │ │
│  │  - Resource pool (1 per runway)                    │ │
│  │  - Mode: Landing | TakeOff | Mixed                 │ │
│  │  - Status: Available | Inspection | Snow | Failure │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────┴───────────────────────────┐ │
│  │           StatisticsCollector                      │ │
│  │  - Per-run metrics (max, avg, variance, etc.)      │ │
│  │  - Event log for replay                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Core Simulation Model Design

### Aircraft Lifecycle (Arrival)

1. `AircraftGenerator` spawns inbound aircraft at times drawn from `N(scheduled_time, σ=5min)`
2. Aircraft enters `HoldingStack` with fuel drawn from `U(20, 60)` minutes
3. Each tick, fuel decreases; if fuel < 10min → **divert** (removed from sim, logged)
4. When a landing-capable runway is free, highest-priority aircraft (emergency > FIFO) is pulled from the stack
5. Aircraft occupies runway for a fixed landing duration, then exits the simulation

### Aircraft Lifecycle (Departure)

1. `AircraftGenerator` spawns outbound aircraft at times drawn from `N(scheduled_time, σ=5min)`
2. Aircraft enters `TakeoffQueue` (FIFO)
3. If wait time exceeds configurable max (default 30min) → **cancel** (removed, logged)
4. When a take-off-capable runway is free, front-of-queue aircraft proceeds
5. Aircraft occupies runway for a fixed take-off duration, then exits

### Mixed-Mode Runway

The runway alternates or shares capacity between landing and take-off. Implementation: a SimPy `Resource(capacity=1)` that both arrival and departure processes compete for, with a configurable duty cycle or fair-share policy.

### Runway Closure

User sets operational status to non-Available. The SimPy resource is "seized" (made unavailable). Aircraft in queues accumulate; cancellations/diversions trigger based on thresholds. When reopened, normal processing resumes.

---

## Key Data Models (Pydantic)

```python
class Aircraft:
    callsign: str
    operator: str
    origin: str
    destination: str
    scheduled_time: float        # minutes from sim start
    actual_time: float | None    # when actually processed
    altitude: float              # metres above ground
    ground_speed: float          # knots
    fuel_remaining: float        # minutes
    emergency: EmergencyStatus   # None | Fuel | Mechanical | PassengerHealth
    direction: Literal["inbound", "outbound"]

class Runway:
    number: str                  # two-digit
    length: float                # metres
    bearing: float               # degrees
    mode: Literal["landing", "takeoff", "mixed"]
    status: Literal["available", "inspection", "snow", "equipment_failure"]

class SimConfig:
    num_runways: int             # 1-10
    runway_configs: list[Runway]
    inbound_flow: float          # aircraft per hour
    outbound_flow: float         # aircraft per hour
    max_wait_time: float         # minutes (default 30)
    sim_duration: float          # minutes
```

---

## Development Phases

Given the deadline of **March 16** for code + video, and **Feb 9** for reports:

### Phase 0 — Reports (now → Feb 9)

- Requirements Analysis Report (5 pages)
- Planning & Design Document (10 pages)
- This plan feeds directly into both documents

### Phase 1 — Core Engine (Feb 10 → Feb 21) [~11 days]

- Aircraft, Runway, Queue data models
- SimPy-based simulation engine for P1 (departures) and P2 (arrivals) on single dedicated runways
- Statistics collector: max/avg queue size, wait time, delay
- Unit tests for all simulation invariants (no two aircraft on a runway simultaneously, fuel never goes below 0 without diversion, etc.)

### Phase 2 — Extended Simulation (Feb 22 → Mar 1) [~7 days]

- P3: Mixed-mode runways and multi-runway configurations
- P4: Runway closure events, cancellation logic
- P5: Fuel burn modelling, diversion logic
- Integration tests for combined scenarios

### Phase 3 — API + Frontend (Mar 2 → Mar 10) [~8 days]

- FastAPI endpoints for configuration, run, results
- WebSocket for real-time simulation streaming
- React dashboard: config panel, live queue view, statistics display
- Scenario comparison (run multiple configs, compare side by side)

### Phase 4 — Polish + Video (Mar 11 → Mar 16) [~5 days]

- Optional features (visual radar view, statistical event generation)
- Bug fixes, edge case handling
- Record 5-minute video showcasing all features
- Code cleanup and submission

---

## Key Design Justifications

1. **Discrete-event simulation over fixed time-step**: The spec describes events (aircraft arriving, runway becoming free) not continuous physics. SimPy's event-driven model is more efficient and accurate — we don't waste cycles on ticks where nothing happens.

2. **Priority queue for holding pattern**: The spec explicitly states emergency aircraft land first, then FIFO. A heap-based priority queue with `(priority, arrival_order)` tuples gives O(log n) insertion and extraction.

3. **SimPy Resources for runways**: A `Resource(capacity=1)` naturally enforces the "only 1 aircraft on a runway at any time" constraint. For mixed mode, both arrival and departure processes request the same resource.

4. **Separation of simulation engine from API/UI**: The engine runs independently and can be used headlessly (for batch runs, testing, CI). The API layer wraps it for web access. This enables parallel development and makes testing straightforward.

5. **WebSocket for real-time updates**: The optional real-time display requires pushing state updates from the server. REST polling would be wasteful and laggy. WebSockets give sub-second updates for smooth animation.

6. **Normal distribution truncation**: The spec says arrival/departure times are normally distributed around scheduled time (σ=5min). We should truncate to avoid absurd values (e.g., arriving 30+ minutes early). A truncated normal at ±3σ (±15min) is reasonable.

7. **Configurable simulation duration**: The spec's "Considerations" section asks "how long do you need to run to ensure averages are accurate?" We should allow configurable duration and potentially run multiple replications for confidence intervals.
