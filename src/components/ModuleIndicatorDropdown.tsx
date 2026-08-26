import { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ModuleIndicatorDropdownProps {
  moduleLabel: string;
  icon: ReactNode;
  /** Tous les indicateurs connus pour ce module (peut être vide). */
  indicators: { label: string; unit?: string; target?: string }[];
  /** Labels déjà affichés pour ce module, exclus de la liste. */
  alreadyShown: Set<string>;
  onPick: (label: string) => void;
}

/**
 * Dropdown d'ajout d'indicateur scopé à un seul module — une instance par
 * organe dans "Systèmes en alerte", au lieu d'un unique sélecteur global
 * qui mélangeait tous les modules.
 */
export const ModuleIndicatorDropdown = ({
  moduleLabel,
  icon,
  indicators,
  alreadyShown,
  onPick,
}: ModuleIndicatorDropdownProps) => {
  const available = indicators.filter((ind) => !alreadyShown.has(ind.label));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1 shrink-0"
          title={`Ajouter un indicateur ${moduleLabel}`}
          aria-label={`Ajouter un indicateur ${moduleLabel}`}
        >
          <span className="flex items-center justify-center h-5 w-5 shrink-0">{icon}</span>
          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{moduleLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {indicators.length === 0 ? (
          <DropdownMenuItem disabled>Aucun indicateur disponible pour ce module</DropdownMenuItem>
        ) : available.length === 0 ? (
          <DropdownMenuItem disabled>Tous déjà affichés</DropdownMenuItem>
        ) : (
          available.map((ind) => (
            <DropdownMenuItem key={ind.label} onSelect={() => onPick(ind.label)}>
              <span className="flex-1">{ind.label}</span>
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
