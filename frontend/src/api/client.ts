import type { SimConfig, SimResults } from "@/types";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

export async function runSimulation(config: SimConfig): Promise<SimResults> {
  const resp = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Simulation failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}

export type StreamTickData = SimResults & {
  type: "tick" | "done";
  sim_time: number;
  sim_duration: number;
};

export function streamSimulation(
  config: SimConfig,
  onTick: (data: StreamTickData) => void,
  onDone: (data: StreamTickData) => void,
  onError: (err: string) => void,
): () => void {
  const ws = new WebSocket(`${WS_BASE}/simulate/stream`);

  ws.onopen = () => {
    ws.send(JSON.stringify(config));
  };

  ws.onmessage = (event) => {
    const data: StreamTickData = JSON.parse(event.data);
    if (data.type === "done") {
      onDone(data);
    } else {
      onTick(data);
    }
  };

  ws.onerror = () => {
    onError("WebSocket connection failed");
  };

  ws.onclose = (event) => {
    if (event.code === 1011) {
      onError("Simulation error on server");
    }
  };

  // Return a cancel function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
