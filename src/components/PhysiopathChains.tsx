import { Activity, Blocks, X } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import kidneyIcon from '@/assets/kidney-icon.svg';
import intestineIcon from '@/assets/intestine-icon.svg';
import { HeartIcon } from '@/components/icons/HeartIcon';

export type ModuleKey =
  | 'optibrain'
  | 'optiheart'
  | 'optilungs'
  | 'optirenal'
  | 'optigastro';

interface FailingIndicator {
  label: string;
  module: ModuleKey;
  status: string;
  trend?: string;
  value: string | number;
  unit?: string;
}

interface PhysiopathChainsProps {
  /** All currently-failing indicators across modules, with their module key. */
  failingIndicators: FailingIndicator[];
  onModuleClick?: (module: ModuleKey) => void;
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  optibrain: 'Cerveau',
  optiheart: 'Cœur',
  optilungs: 'Poumons',
  optirenal: 'Rénal',
  optigastro: 'Gastro',
};

const MODULE_DOT: Record<ModuleKey, string> = {
  optibrain: 'bg-red-500',
  optiheart: 'bg-rose-500',
  optilungs: 'bg-orange-500',
  optirenal: 'bg-amber-500',
  optigastro: 'bg-yellow-500',
};

const ModuleIcon = ({ module }: { module: ModuleKey }) => {
  const cls = 'h-4 w-4';
  if (module === 'optiheart') return <HeartIcon className={cn(cls, 'text-status-critical')} />;
  const src =
    module === 'optibrain'
      ? brainIcon
      : module === 'optilungs'
        ? lungsIcon
        : module === 'optirenal'
          ? kidneyIcon
          : intestineIcon;
  return <img src={src} alt="" className={cls} />;
};

export const PhysiopathChains = ({
  failingIndicators,
  onModuleClick,
}: PhysiopathChainsProps) => {
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set());

  const toggleModule = (m: ModuleKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  return (
    <Card className="shadow-sm border-primary/30">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Blocks className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Assembler les modules
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionnez au moins 2 modules pour voir tous les indicateurs hors cible
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="text-xs text-muted-foreground">
              Cliquez sur les modules à assembler
            </div>
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={clearSelection}
              >
                <X className="h-3 w-3" /> Réinitialiser
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODULE_LABEL) as ModuleKey[]).map((m) => {
              const isOn = selected.has(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleModule(m)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all',
                    'shadow-[inset_0_-3px_0_0_rgba(0,0,0,0.08)]',
                    isOn
                      ? 'bg-primary/15 border-primary text-foreground ring-1 ring-primary'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ModuleIcon module={m} />
                  {MODULE_LABEL[m]}
                </button>
              );
            })}
          </div>

          {selected.size >= 2 && (() => {
            const problematic = failingIndicators.filter((f) => selected.has(f.module));
            const byModule = new Map<ModuleKey, typeof problematic>();
            problematic.forEach((f) => {
              const arr = byModule.get(f.module) ?? [];
              arr.push(f);
              byModule.set(f.module, arr);
            });
            return (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-status-critical" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Indicateurs problématiques ({problematic.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {selected.size} modules assemblés
                    </span>
                  </div>
                  {problematic.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Aucun indicateur hors cible dans les modules sélectionnés.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {Array.from(byModule.entries()).map(([mod, items]) => (
                        <div key={mod}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={cn('h-2 w-2 rounded-full', MODULE_DOT[mod])} />
                            <button
                              type="button"
                              onClick={() => onModuleClick?.(mod)}
                              className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors"
                            >
                              {MODULE_LABEL[mod]}
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              ({items.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-3.5">
                            {items.map((ind, i) => {
                              const critical = ind.status === 'critical';
                              return (
                                <span
                                  key={`${ind.label}-${i}`}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px]',
                                    critical
                                      ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                                      : 'bg-status-warning/10 text-status-warning border-status-warning/30',
                                  )}
                                >
                                  <span className="font-medium">{ind.label}</span>
                                  <span className="tabular-nums opacity-80">
                                    {ind.value}
                                    {ind.unit ? ` ${ind.unit}` : ''}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </CardContent>
    </Card>
  );
};
