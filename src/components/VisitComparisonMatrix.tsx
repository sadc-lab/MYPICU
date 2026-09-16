import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { History, ArrowRight } from "lucide-react";

export interface VisitComparisonRow {
  label: string;
  target: string;
  status: "normal" | "warning" | "critical" | null;
  previousValue: number | null;
  currentValue: number;
  changed: boolean;
}

interface VisitComparisonMatrixProps {
  rows: VisitComparisonRow[];
  previousVisitAt: Date | null;
}

const STATUS_STYLES: Record<string, { row: string; badge: string; label: string }> = {
  critical: { row: "bg-status-critical-bg/40", badge: "bg-status-critical/15 text-status-critical border-status-critical/30", label: "Critique" },
  warning: { row: "bg-status-warning-bg/40", badge: "bg-status-warning/15 text-status-warning border-status-warning/30", label: "Alerte" },
  normal: { row: "", badge: "bg-status-normal/10 text-status-normal border-status-normal/30", label: "Normal" },
};

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "il y a moins d'1h";
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `il y a ${diffD}j`;
}

/**
 * Matrice de comparaison : ce qui a changé depuis la dernière fois que CE
 * clinicien a ouvert ce dossier — pour repérer en un coup d'œil ce qui
 * mérite attention avant de rescanner tout le module.
 */
export const VisitComparisonMatrix = ({ rows, previousVisitAt }: VisitComparisonMatrixProps) => {
  if (!previousVisitAt) return null;

  const changedRows = rows.filter((r) => r.changed);

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Depuis votre dernière visite</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Dernière consultation de ce dossier : {formatRelativeTime(previousVisitAt)}.
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {changedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun changement depuis votre dernière visite.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="font-medium px-2 py-1.5">Indicateur</th>
                  <th className="font-medium px-2 py-1.5">Cible</th>
                  <th className="font-medium px-2 py-1.5">Évolution</th>
                  <th className="font-medium px-2 py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {changedRows.map((row) => {
                  const style = STATUS_STYLES[row.status ?? "normal"];
                  return (
                    <tr key={row.label} className={cn("border-t", style.row)}>
                      <td className="px-2 py-2 font-medium text-foreground">{row.label}</td>
                      <td className="px-2 py-2 text-muted-foreground">{row.target}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <span className="text-muted-foreground">
                            {row.previousValue !== null ? row.previousValue : "—"}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                          <span className="font-semibold text-foreground">{row.currentValue}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", style.badge)}>
                          {style.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
