import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { ScenarioCompare } from "@/components/ScenarioCompare";
import { useSimulation } from "@/hooks/useSimulation";
import { healthCheck } from "@/api/client";

function App() {
  const {
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
  } = useSimulation();
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    healthCheck().then(setBackendUp);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Compact header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-11 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-tight">Airport Simulation</h1>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-xs text-muted-foreground">CS261</span>
          </div>
          <div className="flex items-center gap-2">
            {backendUp === false && (
              <Badge variant="destructive" className="text-[10px] h-5">Backend Offline</Badge>
            )}
            {backendUp === true && (
              <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 text-emerald-600">
                <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {(error || backendUp === false) && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2">
          <p className="text-xs text-destructive">
            {error ?? (
              <>
                Backend not reachable at <code className="font-mono bg-destructive/10 rounded px-1">localhost:8000</code>.
                Run: <code className="font-mono bg-destructive/10 rounded px-1">uvicorn app.main:app --reload</code>
              </>
            )}
          </p>
        </div>
      )}

      {/* Main content — fills remaining height */}
      <Tabs defaultValue="simulator" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 border-b px-4 py-1.5">
          <TabsList className="h-8">
            <TabsTrigger value="simulator" className="text-xs h-6 px-3">Simulator</TabsTrigger>
            <TabsTrigger value="compare" className="text-xs h-6 px-3">
              Compare
              {scenarios.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[9px]">
                  {scenarios.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="simulator" className="flex-1 min-h-0 mt-0 p-0">
          <div className="h-full grid grid-cols-[minmax(340px,1fr)_minmax(400px,2fr)]">
            {/* Left: Config — independently scrollable */}
            <div className="border-r overflow-y-auto p-4">
              <ConfigPanel config={config} onChange={setConfig} onRun={run} onStop={stop} loading={loading} simTime={simTime} simDuration={simDuration} />
            </div>

            {/* Right: Results — independently scrollable */}
            <div className="overflow-y-auto p-4">
              {results ? (
                <ResultsDashboard results={results} onSave={saveScenario} simDuration={simDuration} loading={loading} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-muted-foreground text-sm">
                    Configure your airport and click <strong>Run Simulation</strong> to see results.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compare" className="flex-1 min-h-0 mt-0 p-0">
          <div className="h-full overflow-y-auto p-4">
            <ScenarioCompare scenarios={scenarios} onRemove={removeScenario} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
