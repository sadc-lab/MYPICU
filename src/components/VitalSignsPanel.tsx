import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { MetricRangeBar } from "@/components/MetricRangeBar";
import { cn } from "@/lib/utils";
import { KpiCircle } from "@/components/KpiCircle";
import { getLatestValue, type PatientFileData } from "@/services/patientFileData.service";

/**
 * Therapeutic windows are clinical protocol constants, not patient data.
 * Only the measured value is read from the cache; a parameter with no
 * observation is reported as unmeasured rather than filled with a constant.
 */
const VITAL_TARGETS = [
  { key: "Variable_FC", label: "FC", targetMin: 80, targetMax: 120, min: 40, max: 180, unit: "bpm", digits: 0 },
  { key: "Variable_PAM", label: "TAM", targetMin: 65, targetMax: 85, min: 40, max: 120, unit: "mmHg", digits: 0 },
  { key: "Variable_FR", label: "FR", targetMin: 20, targetMax: 30, min: 8, max: 60, unit: "/min", digits: 0 },
  { key: "Variable_temperature", label: "T°", targetMin: 36, targetMax: 37.5, min: 33, max: 41, unit: "°C", digits: 1 },
  { key: "Variable_SPO2", label: "SPO2", targetMin: 92, targetMax: 100, min: 80, max: 100, unit: "%", digits: 0 },
] as const;

const isInRange = (v: number, min: number, max: number) => v >= min && v <= max;

interface VitalSignsPanelProps {
  /** Whether the panel is expanded by default. True on Optistate, false elsewhere. */
  defaultOpen?: boolean;
  /** Cached vitals for the selected patient, or null when nothing is cached. */
  patientFileData?: PatientFileData | null;
}

export const VitalSignsPanel = ({ defaultOpen = false, patientFileData = null }: VitalSignsPanelProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const vitals = VITAL_TARGETS.map((target) => ({
    ...target,
    observed: patientFileData ? getLatestValue(patientFileData, target.key)?.value : undefined,
  }));
  const measured = vitals.filter((v) => v.observed !== undefined);
  const abnormalCount = measured.filter((v) => !isInRange(v.observed!, v.targetMin, v.targetMax)).length;

  const summary = (() => {
    if (measured.length === 0) return "Aucune mesure disponible";
    if (abnormalCount === 0) return "Tous les paramètres mesurés dans les cibles";
    return `${abnormalCount} paramètre${abnormalCount > 1 ? "s" : ""} hors cible`;
  })();

  return (
    <Card className="bg-card shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <KpiCircle count={abnormalCount} groupLabel="Signes vitaux" />
              <div className="text-left">
                <div className="text-base font-semibold text-foreground">Signes vitaux</div>
                <div className="text-xs text-muted-foreground">{summary}</div>
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
              {vitals.map((vital) => {
                const unmeasured = vital.observed === undefined;
                const inRange = !unmeasured && isInRange(vital.observed!, vital.targetMin, vital.targetMax);
                const valueColor = unmeasured
                  ? "text-muted-foreground/50"
                  : inRange
                  ? "text-muted-foreground"
                  : "text-status-critical";
                return (
                  <div key={vital.key} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {vital.label}
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <div className={cn("text-2xl sm:text-4xl font-bold", valueColor)}>
                        {unmeasured ? "—" : vital.observed!.toFixed(vital.digits)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{vital.unit}</div>
                    </div>
                    {unmeasured ? (
                      <div className="w-full text-[10px] text-muted-foreground/70 text-center pt-4">
                        non mesuré
                      </div>
                    ) : (
                      <MetricRangeBar
                        value={vital.observed!}
                        min={vital.min}
                        max={vital.max}
                        targetMin={vital.targetMin}
                        targetMax={vital.targetMax}
                      />
                    )}
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