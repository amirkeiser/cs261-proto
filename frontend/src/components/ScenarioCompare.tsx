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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SavedScenario } from "@/types";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(0, 84%, 60%)", "hsl(142, 71%, 45%)", "hsl(40, 96%, 53%)", "hsl(262, 83%, 58%)", "hsl(330, 81%, 60%)"];

interface Props {
  scenarios: SavedScenario[];
  onRemove: (id: string) => void;
}

export function ScenarioCompare({ scenarios, onRemove }: Props) {
  if (scenarios.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-medium">No saved scenarios yet.</p>
          <p className="text-sm mt-1">
            Run a simulation and click "Save Scenario" to compare configurations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxLen = Math.max(...scenarios.map((s) => s.results.holding_size_over_time.length));
  const holdingChartData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number> = {
      time: scenarios[0].results.holding_size_over_time[i]?.[0] ?? i,
    };
    scenarios.forEach((s, si) => {
      point[`holding_${si}`] = s.results.holding_size_over_time[i]?.[1] ?? 0;
    });
    return point;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Scenario Comparison</h2>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Metric</TableHead>
                  {scenarios.map((s, i) => (
                    <TableHead key={s.id} className="text-right text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {s.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(s.id)}
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                        >
                          x
                        </Button>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <CompareRow label="Total Landed" values={scenarios.map((s) => s.results.total_arrivals)} />
                <CompareRow label="Total Departed" values={scenarios.map((s) => s.results.total_departures)} />
                <CompareRow label="Diversions" values={scenarios.map((s) => s.results.total_diversions)} />
                <CompareRow label="Cancellations" values={scenarios.map((s) => s.results.total_cancellations)} />
                <CompareRow label="Max Holding Size" values={scenarios.map((s) => s.results.max_holding_size)} />
                <CompareRow label="Avg Hold Time" values={scenarios.map((s) => s.results.avg_holding_time)} suffix=" min" />
                <CompareRow label="Max Arrival Delay" values={scenarios.map((s) => s.results.max_arrival_delay)} suffix=" min" />
                <CompareRow label="Avg Arrival Delay" values={scenarios.map((s) => s.results.avg_arrival_delay)} suffix=" min" />
                <CompareRow label="Max Queue Size" values={scenarios.map((s) => s.results.max_takeoff_queue_size)} />
                <CompareRow label="Avg Takeoff Wait" values={scenarios.map((s) => s.results.avg_takeoff_wait)} suffix=" min" />
                <CompareRow label="Max Dep. Delay" values={scenarios.map((s) => s.results.max_takeoff_delay)} suffix=" min" />
                <CompareRow label="Avg Dep. Delay" values={scenarios.map((s) => s.results.avg_takeoff_delay)} suffix=" min" />
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {scenarios.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Holding Pattern Size — Overlay</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={holdingChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} label={{ value: "Time (min)", position: "insideBottom", offset: -5, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {scenarios.map((s, i) => (
                  <Line
                    key={s.id}
                    type="stepAfter"
                    dataKey={`holding_${i}`}
                    stroke={COLORS[i % COLORS.length]}
                    name={s.name}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompareRow({ label, values, suffix = "" }: { label: string; values: number[]; suffix?: string }) {
  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">{label}</TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className="text-right font-mono text-sm tabular-nums">
          {typeof v === "number" && !Number.isInteger(v) ? v.toFixed(1) : v}
          {suffix}
        </TableCell>
      ))}
    </TableRow>
  );
}
