import { useNavigate, useSearchParams } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, AlertTriangle } from "lucide-react";
import { useTourNavigation } from "@/hooks/useTourNavigation";
import type { Patient } from "@/utils/patientData";

interface TourProgressBarProps {
  /** Identifiant du patient courant (ex: "#8749"). */
  currentPatientId: string;
  /** Page actuellement consultée — préservée lors de la navigation. */
  currentPage: "optistate" | "optibrain" | "optiheart" | "optilungs" | "optirenal" | "optigastro";
}

/** Détermine si un patient nécessite une attention immédiate. */
const isPatientCritical = (p: Patient): boolean => {
  if (p.priority === "high") return true;
  if ((p.pelodScore ?? 0) >= 20) return true;
  const scores = [p.brainScore, p.heartScore, p.lungsScore, p.kidneyScore];
  return scores.some((s) => (s ?? 0) >= 3);
};

const isPatientWarning = (p: Patient): boolean => {
  if ((p.pelodScore ?? 0) >= 12) return true;
  const scores = [p.brainScore, p.heartScore, p.lungsScore, p.kidneyScore];
  return scores.some((s) => (s ?? 0) >= 2);
};

export const TourProgressBar = ({ currentPatientId, currentPage }: TourProgressBarProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeTour, getVisitStatus } = useTourNavigation();

  if (!activeTour || activeTour.length === 0) return null;

  const currentIndex = activeTour.findIndex((p) => p.id === currentPatientId);
  const visitedCount = activeTour.filter((p) => {
    const status = getVisitStatus(p.id);
    return status === "Confirmed" || status === "Leaving";
  }).length;
  const progressPct = (visitedCount / activeTour.length) * 100;

  const goToPatient = (patientId: string) => {
    const timeRange = searchParams.get("timeRange");
    const params = new URLSearchParams();
    params.set("patient", patientId);
    if (timeRange) params.set("timeRange", timeRange);
    navigate(`/${currentPage}?${params.toString()}`);
  };

  return (
    <div className="bg-card border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wide">
              Tournée en cours
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {visitedCount} / {activeTour.length} patients
            </span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(progressPct)}%
          </span>
        </div>

        {/* Barre + pastilles */}
        <div className="relative">
          {/* Rail de fond */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-muted rounded-full" />
          {/* Progression */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary/70 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />

          {/* Pastilles */}
          <div className="relative flex items-center justify-between gap-1">
            {activeTour.map((p, idx) => {
              const isCurrent = p.id === currentPatientId;
              const status = getVisitStatus(p.id);
              const visited = status === "Confirmed" || status === "Leaving";
              const critical = isPatientCritical(p);
              const warning = !critical && isPatientWarning(p);

              // Couleur de la pastille
              let dotClass = "bg-card border-2 border-muted-foreground/40 text-muted-foreground";
              if (critical) {
                dotClass = "bg-status-critical border-2 border-status-critical text-white";
              } else if (warning) {
                dotClass = "bg-status-warning border-2 border-status-warning text-white";
              } else if (visited) {
                dotClass = "bg-primary border-2 border-primary text-primary-foreground";
              }
              if (isCurrent) {
                dotClass += " ring-2 ring-primary ring-offset-2 ring-offset-card scale-110";
              }

              const roomLabel = `#${p.picuId.replace(/\D/g, "").padStart(2, "0")}`;
              const tooltipState = critical
                ? "État critique"
                : warning
                  ? "À surveiller"
                  : visited
                    ? "Visité"
                    : "À visiter";

              return (
                <Tooltip key={p.id} delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => goToPatient(p.id)}
                      aria-label={`${roomLabel} ${p.name} — ${tooltipState}`}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`relative z-10 h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold tabular-nums shrink-0 transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${dotClass}`}
                    >
                      {critical ? (
                        <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                      ) : visited && !warning ? (
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-xs">
                        {roomLabel} · {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{p.diagnosis}</p>
                      <p
                        className={`text-xs font-medium ${
                          critical
                            ? "text-status-critical"
                            : warning
                              ? "text-status-warning"
                              : visited
                                ? "text-status-normal"
                                : "text-muted-foreground"
                        }`}
                      >
                        {tooltipState}
                        {isCurrent ? " · patient courant" : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground italic">
                        Cliquez pour ouvrir le dossier
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
