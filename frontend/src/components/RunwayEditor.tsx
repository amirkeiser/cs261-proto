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
import { Badge } from "@/components/ui/badge";
import type { RunwayConfig, RunwayMode, RunwayStatus } from "@/types";

const MODES: { value: RunwayMode; label: string }[] = [
  { value: "landing", label: "Landing" },
  { value: "takeoff", label: "Take-off" },
  { value: "mixed", label: "Mixed" },
];

const STATUSES: { value: RunwayStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "inspection", label: "Inspection" },
  { value: "snow", label: "Snow" },
  { value: "equipment_failure", label: "Equipment Failure" },
];

const modeBadgeVariant: Record<RunwayMode, "default" | "secondary" | "outline"> = {
  landing: "default",
  takeoff: "secondary",
  mixed: "outline",
};

interface Props {
  runway: RunwayConfig;
  index: number;
  onChange: (index: number, runway: RunwayConfig) => void;
  onRemove: (index: number) => void;
}

export function RunwayEditor({ runway, index, onChange, onRemove }: Props) {
  const update = (fields: Partial<RunwayConfig>) =>
    onChange(index, { ...runway, ...fields });

  return (
    <div className="bg-muted/50 rounded-md p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs">{runway.number}</span>
          <Badge variant={modeBadgeVariant[runway.mode]} className="text-[10px] h-4 px-1.5">{runway.mode}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="text-destructive hover:text-destructive h-5 px-1 text-[10px]">
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">No.</Label>
          <Input value={runway.number} onChange={(e) => update({ number: e.target.value })} maxLength={3} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Mode</Label>
          <Select value={runway.mode} onValueChange={(v) => update({ mode: v as RunwayMode })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Length</Label>
          <Input type="number" value={runway.length} onChange={(e) => update({ length: Number(e.target.value) })} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Bearing</Label>
          <Input type="number" value={runway.bearing} onChange={(e) => update({ bearing: Number(e.target.value) })} className="h-7 text-xs" />
        </div>
      </div>
    </div>
  );
}
