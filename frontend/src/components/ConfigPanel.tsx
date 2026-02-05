import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RunwayEditor } from "./RunwayEditor";
import type { SimConfig, RunwayConfig, RunwayClosure, RunwayStatus } from "@/types";

interface Props {
  config: SimConfig;
  onChange: (config: SimConfig) => void;
  onRun: () => void;
  onStop: () => void;
  loading: boolean;
  simTime: number;
  simDuration: number;
}

const CLOSURE_REASONS: { value: RunwayStatus; label: string }[] = [
  { value: "inspection", label: "Inspection" },
  { value: "snow", label: "Snow" },
  { value: "equipment_failure", label: "Equipment" },
];

export function ConfigPanel({ config, onChange, onRun, onStop, loading, simTime, simDuration }: Props) {
  const update = (fields: Partial<SimConfig>) =>
    onChange({ ...config, ...fields });

  const updateRunway = (index: number, runway: RunwayConfig) => {
    const runways = [...config.runways];
    runways[index] = runway;
    update({ runways });
  };

  const addRunway = () => {
    if (config.runways.length >= 10) return;
    update({
      runways: [
        ...config.runways,
        { number: String(config.runways.length + 1).padStart(2, "0"), length: 3000, bearing: 90, mode: "mixed", status: "available" },
      ],
    });
  };

  const removeRunway = (index: number) => {
    if (config.runways.length <= 1) return;
    const runways = config.runways.filter((_, i) => i !== index);
    const closures = config.closures.filter((c) => c.runway_index < runways.length);
    update({ runways, closures });
  };

  const addClosure = () => {
    update({
      closures: [
        ...config.closures,
        { runway_index: 0, start_time: 30, end_time: 60, reason: "inspection" },
      ],
    });
  };

  const updateClosure = (index: number, closure: RunwayClosure) => {
    const closures = [...config.closures];
    closures[index] = closure;
    update({ closures });
  };

  const removeClosure = (index: number) => {
    update({ closures: config.closures.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      {/* Run / Stop button with progress */}
      {loading ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={onStop} className="flex-1">
              Stop
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {Math.round(simTime)} / {simDuration} min
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${simDuration > 0 ? (simTime / simDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
      ) : (
        <Button onClick={onRun} className="w-full">
          Run Simulation
        </Button>
      )}

      {/* Simulation Parameters */}
      <Card>
        <CardHeader className="px-3 py-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0">
          <div className="grid grid-cols-3 gap-2">
            <FieldCompact label="Inbound/hr" value={config.inbound_flow} onChange={(v) => update({ inbound_flow: v })} min={0} max={120} />
            <FieldCompact label="Outbound/hr" value={config.outbound_flow} onChange={(v) => update({ outbound_flow: v })} min={0} max={120} />
            <FieldCompact label="Duration" value={config.sim_duration} onChange={(v) => update({ sim_duration: v })} min={1} />
            <FieldCompact label="Max Wait" value={config.max_wait_time} onChange={(v) => update({ max_wait_time: v })} min={1} />
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Seed</Label>
              <Input
                type="number"
                value={config.seed ?? ""}
                onChange={(e) => update({ seed: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="Random"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runways */}
      <Card>
        <CardHeader className="px-3 py-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Runways ({config.runways.length})
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={addRunway} disabled={config.runways.length >= 10} className="h-6 px-2 text-xs">
              + Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 space-y-2">
          {config.runways.map((rw, i) => (
            <RunwayEditor key={i} runway={rw} index={i} onChange={updateRunway} onRemove={removeRunway} />
          ))}
        </CardContent>
      </Card>

      {/* Scheduled Closures */}
      <Card>
        <CardHeader className="px-3 py-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closures</CardTitle>
            <Button size="sm" variant="ghost" onClick={addClosure} className="h-6 px-2 text-xs">
              + Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 space-y-2">
          {config.closures.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic text-center py-1">None</p>
          )}
          {config.closures.map((cl, i) => (
            <div key={i} className="flex items-end gap-1.5 bg-muted/50 rounded-md p-2">
              <div className="space-y-0.5 flex-1">
                <Label className="text-[10px] text-muted-foreground">Rwy</Label>
                <Select value={String(cl.runway_index)} onValueChange={(v) => updateClosure(i, { ...cl, runway_index: Number(v) })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {config.runways.map((_, ri) => (
                      <SelectItem key={ri} value={String(ri)}>#{ri + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 flex-1">
                <Label className="text-[10px] text-muted-foreground">Start</Label>
                <Input type="number" value={cl.start_time} onChange={(e) => updateClosure(i, { ...cl, start_time: Number(e.target.value) })} className="h-7 text-xs" min={0} />
              </div>
              <div className="space-y-0.5 flex-1">
                <Label className="text-[10px] text-muted-foreground">End</Label>
                <Input type="number" value={cl.end_time} onChange={(e) => updateClosure(i, { ...cl, end_time: Number(e.target.value) })} className="h-7 text-xs" min={0} />
              </div>
              <div className="space-y-0.5 flex-1">
                <Label className="text-[10px] text-muted-foreground">Why</Label>
                <Select value={cl.reason} onValueChange={(v) => updateClosure(i, { ...cl, reason: v as RunwayStatus })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLOSURE_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeClosure(i)} className="text-destructive hover:text-destructive h-7 w-7 p-0 shrink-0">
                x
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FieldCompact({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} className="h-7 text-xs" />
    </div>
  );
}
