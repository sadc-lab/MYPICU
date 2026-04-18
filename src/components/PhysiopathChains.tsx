import { ArrowRight, Activity, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const activeChains = CHAINS.map((chain) => {
    const matched = chain.steps
      .map((step) => ({ step, indicator: matchStep(step, failingIndicators) }))
      .filter((m) => m.indicator);
    return { chain, matched };
  }).filter((c) => c.matched.length >= 2);

  if (activeChains.length === 0) return null;

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
      <CardContent className="pt-5">
        <TooltipProvider delayDuration={200}>
          <div className="space-y-4">
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
