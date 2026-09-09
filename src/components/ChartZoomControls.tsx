import { useEffect, useState } from "react";
import { Pencil, ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YAxisZoom } from "@/hooks/useYAxisZoom";

interface ChartZoomControlsProps {
  zoom: YAxisZoom;
  isEditing: boolean;
  onToggleEditing: () => void;
  className?: string;
  /** Masque l'icône crayon quand un bouton "Modifier" plus visible existe déjà ailleurs sur la page pour ce même graphique. */
  hideToggle?: boolean;
}

// Un seul indice, une seule fois, tous graphiques confondus — pas la peine
// de le répéter à chaque graphique une fois que le geste est connu.
const HINT_SEEN_KEY = "mypicu_chart_edit_hint_seen";
const HINT_DURATION_MS = 3000;

/**
 * Icône crayon : repliée, un graphique ne montre rien de plus qu'un
 * graphique — cliquer signale explicitement "je modifie la vue" et déplie
 * les contrôles d'échelle Y (le glisser-déposer sur l'axe du temps, quand
 * le graphique en a un, se règle séparément via son propre <Brush>, mais
 * suit le même `isEditing`).
 */
export const ChartZoomControls = ({ zoom, isEditing, onToggleEditing, className, hideToggle = false }: ChartZoomControlsProps) => {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (hideToggle) return;
    let alreadySeen = true;
    try {
      alreadySeen = localStorage.getItem(HINT_SEEN_KEY) === "1";
    } catch {
      // Stockage indisponible (navigation privée, etc.) : pas d'indice, sans bloquer l'affichage normal.
    }
    if (alreadySeen) return;

    setShowHint(true);
    const timer = setTimeout(() => {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_SEEN_KEY, "1");
      } catch {
        // Rien à faire si le stockage est indisponible — l'indice réapparaîtra simplement la prochaine fois.
      }
    }, HINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
  <div className={cn("flex items-center justify-end gap-1", className)}>
    {isEditing && (
      <>
        <button
          type="button"
          onClick={zoom.zoomOut}
          disabled={!zoom.canZoomOut}
          title="Réduire l'échelle"
          aria-label="Réduire l'échelle"
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoom.zoomIn}
          disabled={!zoom.canZoomIn}
          title="Agrandir l'échelle"
          aria-label="Agrandir l'échelle"
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={zoom.resetZoom}
          disabled={!zoom.isZoomed}
          title="Réinitialiser l'échelle (auto)"
          aria-label="Réinitialiser l'échelle"
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </>
    )}
    {!hideToggle && (
      <div className="relative">
        {showHint && !isEditing && (
          <div
            role="status"
            className="absolute -top-9 right-0 whitespace-nowrap rounded-md bg-foreground text-background text-[11px] px-2 py-1 shadow-md animate-in fade-in slide-in-from-bottom-1 z-10"
          >
            Modifier l'échelle ou la période
          </div>
        )}
        <button
          type="button"
          onClick={onToggleEditing}
          title={isEditing ? "Terminer la modification" : "Modifier l'échelle du graphique"}
          aria-label={isEditing ? "Terminer la modification" : "Modifier l'échelle du graphique"}
          aria-pressed={isEditing}
          className={cn(
            "p-1.5 rounded-md border transition-colors",
            isEditing
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
      </div>
    )}
  </div>
  );
};
