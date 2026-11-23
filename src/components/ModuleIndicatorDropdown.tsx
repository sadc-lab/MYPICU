import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tr } from '@/i18n';
import { term } from '@/i18n/terms';

interface ModuleIndicatorDropdownProps {
  moduleLabel: string;
  /** Tous les indicateurs connus pour ce module (peut être vide). */
  indicators: { label: string; unit?: string; target?: string }[];
  /** Labels déjà affichés pour ce module, exclus de la liste. */
  alreadyShown: Set<string>;
  onPick: (label: string) => void;
}

/**
 * Dropdown d'ajout d'indicateur scopé à un seul module — pensé pour être
 * accolé directement à la pastille du module (pas de bordure/fond propre,
 * le conteneur parent fournit l'unité visuelle des deux combinés).
 */
export const ModuleIndicatorDropdown = ({
  moduleLabel,
  indicators,
  alreadyShown,
  onPick,
}: ModuleIndicatorDropdownProps) => {
  const available = indicators.filter((ind) => !alreadyShown.has(ind.label));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center h-full px-2 hover:bg-foreground/10 transition-colors shrink-0"
          title={tr(`Ajouter un indicateur ${moduleLabel}`, `Add a ${moduleLabel} indicator`)}
          aria-label={tr(`Ajouter un indicateur ${moduleLabel}`, `Add a ${moduleLabel} indicator`)}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{moduleLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {indicators.length === 0 ? (
          <DropdownMenuItem disabled>{tr("Aucun indicateur disponible pour ce module", "No indicator available for this module")}</DropdownMenuItem>
        ) : available.length === 0 ? (
          <DropdownMenuItem disabled>{tr("Tous déjà affichés", "All already shown")}</DropdownMenuItem>
        ) : (
          available.map((ind) => (
            <DropdownMenuItem key={ind.label} onSelect={() => onPick(ind.label)}>
              <span className="flex-1">{term(ind.label)}</span>
              {(ind.target || ind.unit) && (
                <span className="text-xs text-muted-foreground ml-2">{ind.target ?? ind.unit}</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
