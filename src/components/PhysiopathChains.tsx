import { ArrowRight, Activity, Network, Blocks, Link2, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface ChainIndicator {
  /** Label as it appears in the failing indicator list (case-insensitive match prefix). */
  label: string;
  /** Module the indicator belongs to. */
  module: ModuleKey;
  /** Direction of derangement to look for: 'high', 'low', or 'any'. */
  direction?: 'high' | 'low' | 'any';
}

interface PhysiopathChainDef {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning';
  steps: ChainIndicator[];
}

/**
 * Physiopathological chains: groups of indicators across different organ
 * systems that, when simultaneously deranged, point to a single underlying
 * mechanism. Displayed only when ≥2 indicators of the chain are out of target.
 */
const CHAINS: PhysiopathChainDef[] = [
  {
    id: 'cerebral-hypoperfusion',
    name: 'Hypoperfusion cérébrale',
    description:
      'Baisse de la pression motrice cérébrale par insuffisance hémodynamique systémique avec retentissement intracrânien.',
    severity: 'critical',
    steps: [
      { label: 'TAM', module: 'optiheart', direction: 'low' },
      { label: 'PAM', module: 'optiheart', direction: 'low' },
      { label: 'PPC', module: 'optibrain', direction: 'low' },
      { label: 'PIC', module: 'optibrain', direction: 'high' },
    ],
  },
  {
    id: 'hypercapnic-htic',
    name: 'HTIC hypercapnique',
    description:
      'Hypercapnie entraînant vasodilatation cérébrale et augmentation de la PIC.',
    severity: 'critical',
    steps: [
      { label: 'PaCO2', module: 'optilungs', direction: 'high' },
      { label: 'PIC', module: 'optibrain', direction: 'high' },
      { label: 'PPC', module: 'optibrain', direction: 'low' },
    ],
  },
  {
    id: 'hypoxemic-cascade',
    name: 'Cascade hypoxémique',
    description:
      'Hypoxémie compromettant l\'oxygénation cérébrale et la fonction myocardique.',
    severity: 'critical',
    steps: [
      { label: 'SpO2', module: 'optilungs', direction: 'low' },
      { label: 'PaO2', module: 'optilungs', direction: 'low' },
      { label: 'rSO2', module: 'optibrain', direction: 'low' },
      { label: 'Cardiac', module: 'optiheart', direction: 'low' },
    ],
  },
  {
    id: 'low-output-syndrome',
    name: 'Syndrome de bas débit',
    description:
      'Bas débit cardiaque avec retentissement multiviscéral (perfusion rénale, cérébrale).',
    severity: 'warning',
    steps: [
      { label: 'Cardiac', module: 'optiheart', direction: 'low' },
      { label: 'TAM', module: 'optiheart', direction: 'low' },
      { label: 'Lactate', module: 'optiheart', direction: 'high' },
      { label: 'Diurèse', module: 'optirenal', direction: 'low' },
    ],
  },
];

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

/** Match a chain step against the actually-failing indicators. */
function matchStep(step: ChainIndicator, failing: FailingIndicator[]) {
  return failing.find(
    (f) =>
      f.module === step.module &&
      f.label.toLowerCase().startsWith(step.label.toLowerCase()),
  );
}

export const PhysiopathChains = ({
  failingIndicators,
  onModuleClick,
}: PhysiopathChainsProps) => {
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

  const allChainsMatched = CHAINS.map((chain) => {
    const matched = chain.steps
      .map((step) => ({ step, indicator: matchStep(step, failingIndicators) }))
      .filter((m) => m.indicator);
    return { chain, matched };
  });

  const activeChains = allChainsMatched.filter((c) => c.matched.length >= 2);

  // Lego view: chains whose steps are contained within the selected modules
  const legoChains = useMemo(() => {
    if (selected.size < 2) return [];
    return allChainsMatched.filter(({ chain, matched }) => {
      if (matched.length < 2) return false;
      // At least 2 matched steps must belong to selected modules, and each
      // selected module used must actually contribute.
      const usedModules = new Set(
        matched
          .filter((m) => selected.has(m.step.module))
          .map((m) => m.step.module),
      );
      return usedModules.size >= 2;
    });
  }, [selected, failingIndicators]);

  // Shared indicators = indicators (by normalized label) referenced by ≥2
  // selected modules across the chain catalog or the failing list.
  const sharedIndicators = useMemo(() => {
    if (selected.size < 2) return [];
    const byLabel = new Map<
      string,
      { label: string; modules: Set<ModuleKey>; failingIn: Set<ModuleKey> }
    >();
    const push = (label: string, module: ModuleKey, failing: boolean) => {
      if (!selected.has(module)) return;
      const key = label.toLowerCase();
      const entry =
        byLabel.get(key) ??
        { label, modules: new Set<ModuleKey>(), failingIn: new Set<ModuleKey>() };
      entry.modules.add(module);
      if (failing) entry.failingIn.add(module);
      byLabel.set(key, entry);
    };
    CHAINS.forEach((c) => c.steps.forEach((s) => push(s.label, s.module, false)));
    failingIndicators.forEach((f) => push(f.label, f.module, true));
    return Array.from(byLabel.values())
      .filter((e) => e.modules.size >= 2)
      .sort((a, b) => b.failingIn.size - a.failingIn.size);
  }, [selected, failingIndicators]);

  if (activeChains.length === 0 && selected.size === 0) return null;

  return (
    <Card className="shadow-sm border-status-warning/30">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-status-warning/10 flex items-center justify-center">
              <Network className="h-4 w-4 text-status-warning" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Chaînes physiopathologiques actives
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Indicateurs hors cible interconnectés suggérant un mécanisme
                commun
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-status-warning/10 text-status-warning border-status-warning/30 gap-1.5"
          >
            <Activity className="h-3 w-3" />
            {activeChains.length} chaîne{activeChains.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        {/* ==== LEGO BUILDER ==== */}
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Blocks className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Vue Lego — assembler les modules
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sélectionnez au moins 2 modules pour révéler les indicateurs
                  partagés et les interrelations
                </p>
              </div>
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

          {selected.size >= 2 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {/* Shared indicators */}
              <div className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Indicateurs partagés ({sharedIndicators.length})
                  </span>
                </div>
                {sharedIndicators.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Aucun indicateur commun entre ces modules.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {sharedIndicators.map((ind) => {
                      const failing = ind.failingIn.size > 0;
                      return (
                        <li
                          key={ind.label}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                failing ? 'bg-status-critical' : 'bg-muted-foreground/40',
                              )}
                            />
                            <span
                              className={cn(
                                'font-medium',
                                failing ? 'text-status-critical' : 'text-foreground',
                              )}
                            >
                              {ind.label}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            {Array.from(ind.modules).map((mm) => (
                              <span
                                key={mm}
                                title={MODULE_LABEL[mm]}
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  MODULE_DOT[mm],
                                  !ind.failingIn.has(mm) && 'opacity-40',
                                )}
                              />
                            ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Interrelations (chains restricted to selection) */}
              <div className="rounded-md border bg-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Network className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Interrelations ({legoChains.length})
                  </span>
                </div>
                {legoChains.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Aucune interrelation active reliant ces modules.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {legoChains.map(({ chain, matched }) => (
                      <li key={chain.id} className="text-xs">
                        <span className="font-medium text-foreground">
                          {chain.name}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          — {matched.length}/{chain.steps.length} indicateurs
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ==== Existing auto-detected chains ==== */}

            {activeChains.map(({ chain, matched }) => {
              const accentBadge =
                chain.severity === 'critical'
                  ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                  : 'bg-status-warning/10 text-status-warning border-status-warning/30';

              return (
                <div
                  key={chain.id}
                  className="relative rounded-lg border bg-card overflow-hidden"
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-foreground">
                            {chain.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-2 py-0', accentBadge)}
                          >
                            {matched.length}/{chain.steps.length} indicateurs
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug max-w-3xl">
                          {chain.description}
                        </p>
                      </div>
                    </div>

                    {/* Chain visualization */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {chain.steps.map((step, idx) => {
                        const match = matched.find(
                          (m) => m.step === step,
                        )?.indicator;
                        const isActive = !!match;
                        const isLast = idx === chain.steps.length - 1;

                        const node = (
                          <button
                            type="button"
                            disabled={!isActive || !onModuleClick}
                            onClick={() =>
                              isActive && onModuleClick?.(step.module)
                            }
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-all',
                              isActive
                                ? 'bg-card border-foreground/20 hover:border-foreground/40 hover:bg-muted/50 cursor-pointer'
                                : 'bg-muted/30 border-dashed border-border/50 opacity-50',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full shrink-0',
                                isActive
                                  ? MODULE_DOT[step.module]
                                  : 'bg-muted-foreground/30',
                              )}
                            />
                            <span
                              className={cn(
                                'font-medium',
                                isActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground line-through decoration-dotted',
                              )}
                            >
                              {step.label}
                            </span>
                            {step.direction === 'high' && (
                              <span
                                className={cn(
                                  'text-[10px] font-bold',
                                  isActive ? 'text-status-critical' : 'text-muted-foreground',
                                )}
                              >
                                ↑
                              </span>
                            )}
                            {step.direction === 'low' && (
                              <span
                                className={cn(
                                  'text-[10px] font-bold',
                                  isActive ? 'text-status-critical' : 'text-muted-foreground',
                                )}
                              >
                                ↓
                              </span>
                            )}
                          </button>
                        );

                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            {isActive && match ? (
                              <Tooltip>
                                <TooltipTrigger asChild>{node}</TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <div className="font-semibold mb-0.5">
                                    {match.label} — {MODULE_LABEL[step.module]}
                                  </div>
                                  <div className="text-muted-foreground">
                                    Valeur : {match.value}
                                    {match.unit ? ` ${match.unit}` : ''}
                                  </div>
                                  {onModuleClick && (
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                      Cliquer pour ouvrir le module
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>{node}</TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Pas (encore) hors cible chez ce patient
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!isLast && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
