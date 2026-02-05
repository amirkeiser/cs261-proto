import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SimResults, AircraftLog } from "@/types";

interface Props {
  results: SimResults;
  onSave: (name: string) => void;
  simDuration: number;
  loading: boolean;
}

export function ResultsDashboard({ results, onSave, simDuration, loading }: Props) {
  const r = results;

  const allAircraft: AircraftLog[] = [
    ...r.landed_aircraft,
    ...r.departed_aircraft,
    ...r.diverted_aircraft,
    ...r.cancelled_aircraft,
  ];
  const emergencyCount = allAircraft.filter((a) => a.emergency !== "none").length;

  const chartData = r.holding_size_over_time.map(([time, holding], i) => ({
    time: Math.round(time),
    holding,
    takeoff: r.takeoff_queue_over_time[i]?.[1] ?? 0,
  }));

  const handleSave = () => {
    const name = prompt("Name this scenario:");
    if (name) onSave(name);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight">Results</h2>
        <Button variant="secondary" size="sm" onClick={handleSave} disabled={loading} className="h-7 text-xs">
          {loading ? "Simulating..." : "Save Scenario"}
        </Button>
      </div>

      {/* Summary cards — single row */}
      <div className="grid grid-cols-5 gap-2">
        <SummaryCard label="Landed" value={r.total_arrivals} variant="success" />
        <SummaryCard label="Departed" value={r.total_departures} variant="info" />
        <SummaryCard label="Emergency" value={emergencyCount} variant="emergency" />
        <SummaryCard label="Diverted" value={r.total_diversions} variant="warning" />
        <SummaryCard label="Cancelled" value={r.total_cancellations} variant="danger" />
      </div>

      {/* Metrics — side by side, compact */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardHeader className="px-3 py-1.5">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Arrivals</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="space-y-0.5 text-xs">
              <MetricLine label="Max holding" value={r.max_holding_size} />
              <MetricLine label="Avg hold time" value={`${r.avg_holding_time.toFixed(1)}m`} />
              <MetricLine label="Max delay" value={`${r.max_arrival_delay.toFixed(1)}m`} />
              <MetricLine label="Avg delay" value={`${r.avg_arrival_delay.toFixed(1)}m`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-3 py-1.5">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Departures</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2 pt-0">
            <div className="space-y-0.5 text-xs">
              <MetricLine label="Max queue" value={r.max_takeoff_queue_size} />
              <MetricLine label="Avg wait" value={`${r.avg_takeoff_wait.toFixed(1)}m`} />
              <MetricLine label="Max delay" value={`${r.max_takeoff_delay.toFixed(1)}m`} />
              <MetricLine label="Avg delay" value={`${r.avg_takeoff_delay.toFixed(1)}m`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="px-3 py-1.5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Queue Sizes Over Time</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2 pt-0">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                type="number"
                domain={[0, simDuration]}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                width={30}
                domain={[0, (max: number) => Math.max(5, Math.ceil(max * 1.2))]}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="stepAfter" dataKey="holding" stroke="hsl(40, 96%, 53%)" name="Holding" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="takeoff" stroke="hsl(217, 91%, 60%)" name="Take-off" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Aircraft logs */}
      <Card>
        <CardHeader className="px-3 py-1.5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aircraft Log ({allAircraft.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2 pt-0">
          <div className="max-h-48 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-6 text-[10px] px-2">Callsign</TableHead>
                  <TableHead className="h-6 text-[10px] px-2">Dir</TableHead>
                  <TableHead className="h-6 text-[10px] px-2">Emerg.</TableHead>
                  <TableHead className="h-6 text-[10px] px-2">Outcome</TableHead>
                  <TableHead className="h-6 text-[10px] px-2 text-right">Wait</TableHead>
                  <TableHead className="h-6 text-[10px] px-2 text-right">Delay</TableHead>
                  <TableHead className="h-6 text-[10px] px-2 text-right">Fuel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAircraft
                  .sort((a, b) => a.entry_time - b.entry_time)
                  .map((a, i) => (
                    <TableRow key={i} className={a.emergency !== "none" ? "bg-purple-50/50" : ""}>
                      <TableCell className="py-1 px-2 font-mono text-[11px]">{a.callsign}</TableCell>
                      <TableCell className="py-1 px-2 text-[11px]">{a.direction === "inbound" ? "In" : "Out"}</TableCell>
                      <TableCell className="py-1 px-2"><EmergencyBadge status={a.emergency} /></TableCell>
                      <TableCell className="py-1 px-2"><OutcomeBadge outcome={a.outcome} /></TableCell>
                      <TableCell className="py-1 px-2 text-[11px] text-right font-mono">{a.wait_time.toFixed(1)}</TableCell>
                      <TableCell className="py-1 px-2 text-[11px] text-right font-mono">{a.delay.toFixed(1)}</TableCell>
                      <TableCell className="py-1 px-2 text-[11px] text-right font-mono">{a.fuel_at_entry.toFixed(0)}m</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

const variantStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  emergency: "border-purple-200 bg-purple-50 text-purple-700",
};

function SummaryCard({ label, value, variant }: { label: string; value: number; variant: keyof typeof variantStyles }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${variantStyles[variant]}`}>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] font-medium">{label}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function EmergencyBadge({ status }: { status: string }) {
  if (status === "none") return <span className="text-muted-foreground/30 text-[10px]">-</span>;
  const config: Record<string, { label: string; variant: "destructive" | "secondary" }> = {
    fuel: { label: "Fuel", variant: "destructive" },
    mechanical: { label: "Mech", variant: "destructive" },
    passenger_health: { label: "Med", variant: "secondary" },
  };
  const c = config[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant} className="text-[9px] h-4 px-1 py-0">{c.label}</Badge>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    landed: "default",
    departed: "secondary",
    diverted: "outline",
    cancelled: "destructive",
  };
  return <Badge variant={variants[outcome] ?? "outline"} className="text-[9px] h-4 px-1 py-0 capitalize">{outcome}</Badge>;
}
