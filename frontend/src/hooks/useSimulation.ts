import { useState, useCallback, useRef } from "react";
import type { SimConfig, SimResults, SavedScenario, RunwayConfig } from "@/types";
import { streamSimulation, type StreamTickData } from "@/api/client";

const defaultRunway: RunwayConfig = {
  number: "09",
  length: 3000,
  bearing: 90,
  mode: "landing",
  status: "available",
};

const defaultConfig: SimConfig = {
  runways: [
    { ...defaultRunway, number: "09", mode: "landing" },
    { ...defaultRunway, number: "27", mode: "takeoff", bearing: 270 },
  ],
  inbound_flow: 15,
  outbound_flow: 15,
  max_wait_time: 30,
  sim_duration: 120,
  closures: [],
  seed: null,
};

export function useSimulation() {
  const [config, setConfig] = useState<SimConfig>(defaultConfig);
  const [results, setResults] = useState<SimResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [simTime, setSimTime] = useState<number>(0);
  const [simDuration, setSimDuration] = useState<number>(0);
  const cancelRef = useRef<(() => void) | null>(null);

  const run = useCallback(() => {
    // Cancel any running stream
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSimTime(0);
    setSimDuration(config.sim_duration);

    const applyTick = (data: StreamTickData) => {
      setSimTime(data.sim_time);
      // Build a SimResults from the tick data (strip type/sim_time/sim_duration)
      const { type: _t, sim_time: _st, sim_duration: _sd, ...rest } = data;
      setResults(rest as SimResults);
    };

    const cancel = streamSimulation(
      config,
      applyTick,
      (data) => {
        applyTick(data);
        setLoading(false);
        cancelRef.current = null;
      },
      (errMsg) => {
        setError(errMsg);
        setLoading(false);
        cancelRef.current = null;
      },
    );
    cancelRef.current = cancel;
  }, [config]);

  const stop = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
      setLoading(false);
    }
  }, []);

  const saveScenario = useCallback(
    (name: string) => {
      if (!results) return;
      const scenario: SavedScenario = {
        id: crypto.randomUUID(),
        name,
        config: { ...config },
        results,
      };
      setScenarios((prev) => [...prev, scenario]);
    },
    [config, results],
  );

  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    config,
    setConfig,
    results,
    loading,
    error,
    run,
    stop,
    simTime,
    simDuration,
    scenarios,
    saveScenario,
    removeScenario,
  };
}
