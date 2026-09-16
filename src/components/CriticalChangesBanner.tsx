import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VisitComparisonRow } from "@/components/VisitComparisonMatrix";

interface CriticalChangesBannerProps {
  rows: VisitComparisonRow[];
  previousVisitAt: Date | null;
  onSelect?: (label: string) => void;
}

const TONE_STYLES: Record<"critical" | "warning", { card: string; badge: string; label: string }> = {
  critical: {
    card: "border-status-critical/40 bg-status-critical-bg/30",
    badge: "bg-status-critical/15 text-status-critical border-status-critical/30",
    label: "Critique",
  },
  warning: {
    card: "border-status-warning/40 bg-status-warning-bg/30",
    badge: "bg-status-warning/15 text-status-warning border-status-warning/30",
    label: "Alerte",
  },
};

// Ne lit que la borne réellement franchie dans la cible ("< N" ou "> N" ou
// "A-B"), pas d'estimation — sert uniquement à expliquer le dépassement.
function parseThreshold(target: string): { min: number | null; max: number | null } {
  const cleaned = target.replace(/[^\d.\-<>\s]/g, " ").trim();
  const rangeMatch = cleaned.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  const ltMatch = cleaned.match(/<\s*(-?\d+(?:\.\d+)?)/);
  if (ltMatch) return { min: null, max: parseFloat(ltMatch[1]) };
  const gtMatch = cleaned.match(/>\s*(-?\d+(?:\.\d+)?)/);
  if (gtMatch) return { min: parseFloat(gtMatch[1]), max: null };
  return { min: null, max: null };
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return Math.round(v).toString();
  if (abs >= 10) return (Math.round(v * 10) / 10).toString();
  return (Math.round(v * 100) / 100).toString();
}

function describeDeviation(row: VisitComparisonRow): string | null {
  const { min, max } = parseThreshold(row.target);
  if (max !== null && row.currentValue > max) {
    return `dépasse la cible (${row.target}) de ${formatValue(row.currentValue - max)}`;
  }
  if (min !== null && row.currentValue < min) {
    return `sous la cible (${row.target}) de ${formatValue(min - row.currentValue)}`;
  }
  return null;
}

/**
 * Bandeau "pourquoi ça a changé" — même logique qu'un relevé de facturation
 * qui explique une hausse ligne par ligne : ne montre que les valeurs
 * critiques/en alerte qui ont changé depuis la dernière visite de ce
 * clinicien, avec la raison (cible franchie, de combien).
 */
export const CriticalChangesBanner = ({ rows, previousVisitAt, onSelect }: CriticalChangesBannerProps) => {
  if (!previousVisitAt) return null;

  const flagged = rows
    .filter((r) => r.changed && (r.status === "critical" || r.status === "warning"))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "critical" ? -1 : 1));

  if (flagged.length === 0) return null;

  const criticalCount = flagged.filter((r) => r.status === "critical").length;
  const warningCount = flagged.length - criticalCount;
  const headline = [
    criticalCount > 0 ? `${criticalCount} valeur${criticalCount > 1 ? "s" : ""} critique${criticalCount > 1 ? "s" : ""}` : null,
    warningCount > 0 ? `${warningCount} en alerte` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Card className="border-status-critical/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-critical shrink-0" />
          <CardTitle className="text-base font-semibold">{headline} depuis votre dernière visite</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {flagged.map((row) => {
          const tone = TONE_STYLES[row.status as "critical" | "warning"];
          const reason = describeDeviation(row);
          return (
            <div
              key={row.label}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={onSelect ? () => onSelect(row.label) : undefined}
              onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect(row.label); } : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
                tone.card,
                onSelect && "cursor-pointer hover:brightness-95 transition-[filter]",
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{row.label}</div>
                {reason && <div className="text-xs text-muted-foreground truncate">{reason}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  {row.previousValue !== null ? formatValue(row.previousValue) : "—"}
                  <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatValue(row.currentValue)}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", tone.badge)}>
                  {tone.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
