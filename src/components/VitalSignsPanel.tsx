import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MetricRangeBar } from "@/components/MetricRangeBar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const vitalSigns = [
  { label: "FC", value: 130, min: 60, targetMin: 80, targetMax: 120, max: 140, unit: "bpm" },
  { label: "TAM", value: 70, min: 60, targetMin: 78, targetMax: 85, max: 100, unit: "mmHg" },
  { label: "FR", value: 25, min: 15, targetMin: 20, targetMax: 30, max: 35, unit: "/min" },
  { label: "T°", value: 37, min: 34, targetMin: 35, targetMax: 37, max: 39, unit: "°C" },
  { label: "SPO2", value: 95, min: 80, targetMin: 90, targetMax: 100, max: 100, unit: "%" },
];

const isInRange = (v: number, min: number, max: number) => v >= min && v <= max;

interface VitalSignsPanelProps {
  /** Whether the panel is expanded by default. True on Optistate, false elsewhere. */
  defaultOpen?: boolean;
}

export const VitalSignsPanel = ({ defaultOpen = false }: VitalSignsPanelProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const abnormalCount = vitalSigns.filter(
    (v) => !isInRange(v.value, v.targetMin, v.targetMax),
  ).length;

  return (
    <Card className="bg-card shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold tabular-nums shrink-0",
                  abnormalCount > 0
                    ? "bg-status-critical text-white"
                    : "bg-status-normal/10 text-status-normal",
                )}
                aria-label={`${abnormalCount} paramètre(s) hors cible`}
              >
                {abnormalCount}
              </div>
              <div className="text-left">
                <div className="text-base font-semibold text-foreground">Signes vitaux</div>
                <div className="text-xs text-muted-foreground">
                  {abnormalCount === 0
                    ? "Tous les paramètres dans les cibles"
                    : `${abnormalCount} paramètre${abnormalCount > 1 ? "s" : ""} hors cible`}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 border-t">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-8">
              {vitalSigns.map((vital, index) => {
                const inRange = isInRange(vital.value, vital.targetMin, vital.targetMax);
                const valueColor = inRange ? "text-muted-foreground" : "text-status-critical";
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {vital.label}
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <div className={`text-2xl sm:text-4xl font-bold ${valueColor}`}>
                        {vital.value}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{vital.unit}</div>
                    </div>
                    <MetricRangeBar
                      value={vital.value}
                      min={vital.min}
                      max={vital.max}
                      targetMin={vital.targetMin}
                      targetMax={vital.targetMax}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
