import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { tr } from '@/i18n';
import { term } from '@/i18n/terms';

export interface IndicatorPickerCandidate {
  module: string;
  moduleLabel: string;
  indicators: { label: string; unit?: string; target?: string }[];
}

interface IndicatorPickerProps {
  /** Tous les indicateurs connus par module, tel que défini dans l'app (peut être vide pour un module). */
  candidates: IndicatorPickerCandidate[];
  /** Clés "module|label" déjà affichées, exclues de la liste. */
  alreadyShown: Set<string>;
  onPick: (module: string, label: string) => void;
  triggerLabel?: string;
}

/**
 * Sélecteur réutilisable pour épingler un indicateur d'un autre module
 * dans une vue personnalisée. Autonome (pas de dépendance à Optistate)
 * pour pouvoir être réutilisé sur les pages d'organe plus tard.
 */
export const IndicatorPicker = ({
  candidates,
  alreadyShown,
  onPick,
  triggerLabel = tr("Ajouter un indicateur", "Add an indicator"),
}: IndicatorPickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={tr("Rechercher un indicateur…", "Search an indicator…")} />
          <CommandList>
            <CommandEmpty>{tr("Aucun indicateur trouvé.", "No indicator found.")}</CommandEmpty>
            {candidates.map((candidate) => {
              const available = candidate.indicators.filter(
                (ind) => !alreadyShown.has(`${candidate.module}|${ind.label}`),
              );
              return (
                <CommandGroup key={candidate.module} heading={candidate.moduleLabel}>
                  {candidate.indicators.length === 0 ? (
                    <CommandItem disabled value={`${candidate.module}-empty`}>
                      <span className="text-muted-foreground">{tr("Aucun indicateur disponible pour ce module", "No indicator available for this module")}</span>
                    </CommandItem>
                  ) : available.length === 0 ? (
                    <CommandItem disabled value={`${candidate.module}-all-shown`}>
                      <span className="text-muted-foreground">{tr("Tous déjà affichés", "All already shown")}</span>
                    </CommandItem>
                  ) : (
                    available.map((ind) => (
                      <CommandItem
                        key={`${candidate.module}-${ind.label}`}
                        value={`${candidate.moduleLabel} ${ind.label}`}
                        onSelect={() => {
                          onPick(candidate.module, ind.label);
                          setOpen(false);
                        }}
                      >
                        <span className="flex-1">{term(ind.label)}</span>
                        {(ind.target || ind.unit) && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {ind.target ?? ind.unit}
                          </span>
                        )}
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
