export type RunwayMode = "landing" | "takeoff" | "mixed";
export type RunwayStatus = "available" | "inspection" | "snow" | "equipment_failure";
export type EmergencyStatus = "none" | "fuel" | "mechanical" | "passenger_health";

export interface RunwayConfig {
  number: string;
  length: number;
  bearing: number;
  mode: RunwayMode;
  status: RunwayStatus;
}

export interface RunwayClosure {
  runway_index: number;
  start_time: number;
  end_time: number;
  reason: RunwayStatus;
}

export interface SimConfig {
  runways: RunwayConfig[];
  inbound_flow: number;
  outbound_flow: number;
  max_wait_time: number;
  sim_duration: number;
  closures: RunwayClosure[];
  seed: number | null;
}

export interface AircraftLog {
  callsign: string;
  operator: string;
  origin: string;
  destination: string;
  direction: "inbound" | "outbound";
  scheduled_time: number;
  entry_time: number;
  exit_time: number | null;
  wait_time: number;
  delay: number;
  emergency: EmergencyStatus;
  fuel_at_entry: number;
  outcome: "landed" | "departed" | "diverted" | "cancelled";
}

export interface SimResults {
  total_departures: number;
  total_cancellations: number;
  max_takeoff_queue_size: number;
  avg_takeoff_wait: number;
  max_takeoff_delay: number;
  avg_takeoff_delay: number;
  total_arrivals: number;
  total_diversions: number;
  max_holding_size: number;
  avg_holding_time: number;
  max_arrival_delay: number;
  avg_arrival_delay: number;
  takeoff_queue_over_time: [number, number][];
  holding_size_over_time: [number, number][];
  landed_aircraft: AircraftLog[];
  departed_aircraft: AircraftLog[];
  diverted_aircraft: AircraftLog[];
  cancelled_aircraft: AircraftLog[];
}

export interface SavedScenario {
  id: string;
  name: string;
  config: SimConfig;
  results: SimResults;
}
