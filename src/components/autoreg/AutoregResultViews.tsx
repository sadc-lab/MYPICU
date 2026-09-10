// Shared presentation of an autoregulation analysis, used by both the study page
// (/autoreg) and the Optibrain dashboard so the two screens read the same way for
// the same recording: same wording, same thresholds, same treatment of missing
// limits, same "reliable bin" convention on the curve.
//
// The numbers themselves come from a single engine (autoregComputation.service);
// these components only render an AutoregResult.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, HelpCircle, Target, TrendingDown } from 'lucide-react';
import {
  modeLabels,
  PRX_THRESHOLD,
  type AutoregResult,
  type CurvePoint,
  type OptimalTimePoint,
} from '@/services/autoregComputation.service';
import { useYAxisZoom } from '@/hooks/useYAxisZoom';
import { ChartZoomControls } from '@/components/ChartZoomControls';

const CURVE_Y_DOMAIN: [number, number] = [-0.4, 1];

export type ModeLabelSet = ReturnType<typeof modeLabels>;

const formatClockTime = (t: number) =>
  new Date(t).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

export interface RollingLimitFallback {
  value: number;
  time: string;
}

/**
 * Most recent non-null LLA / ULA in a rolling series.
 *
 * Whole-recording limits are frequently null — the pressure range simply never
 * crosses the threshold on both sides of the optimum — while shorter rolling
 * windows do find them. Both screens use this helper so they fall back to the
 * same value.
 */
function lastRollingLimits(rolling: OptimalTimePoint[]): {
  lower: RollingLimitFallback | null;
  upper: RollingLimitFallback | null;
} {
  let lower: RollingLimitFallback | null = null;
  let upper: RollingLimitFallback | null = null;
  for (const r of rolling) {
    if (r.lowerLimit !== null) lower = { value: r.lowerLimit, time: r.time };
    if (r.upperLimit !== null) upper = { value: r.upperLimit, time: r.time };
  }
  return { lower, upper };
}

// Focusable trigger so the explanation is also reachable by tap on mobile.
export const HintButton = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Aide : ${text}`}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[15rem] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const SummaryStat = ({
  label,
  value,
  unit,
  digits = 0,
  highlight = false,
  muted = false,
  hint,
  note,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits?: number;
  highlight?: boolean;
  muted?: boolean;
  hint?: string;
  /** Provenance caveat shown under the value (e.g. a rolling-window estimate). */
  note?: string;
}) => (
  <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/30' : muted ? 'bg-muted/40 border-dashed opacity-70' : 'bg-card'}`}>
    <div className="flex items-start justify-between gap-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint && <HintButton text={hint} />}
    </div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className={`text-2xl font-bold ${note ? 'text-muted-foreground' : highlight ? 'text-primary' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value !== null ? value.toFixed(digits) : '—'}
      </span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
    {note && <div className="mt-0.5 text-[10px] italic text-muted-foreground leading-tight">{note}</div>}
  </div>
);

/**
 * The four headline numbers: optimal pressure, LLA, ULA, index nadir.
 *
 * `rolling` is optional; when supplied, a null LLA/ULA falls back to the last
 * rolling-window estimate, labelled, rather than showing a dash.
 */
export const AutoregKpiRow = ({
  result,
  rolling = [],
}: {
  result: AutoregResult;
  rolling?: OptimalTimePoint[];
}) => {
  const labels = modeLabels(result.mode);
  const fallback = lastRollingLimits(rolling);
  const llaFallback = result.lowerLimit === null ? fallback.lower : null;
  const ulaFallback = result.upperLimit === null ? fallback.upper : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <SummaryStat
        label={labels.optimal}
        value={result.optimalPPC}
        unit="mmHg"
        highlight={result.plateauValid}
        muted={!result.plateauValid}
        hint={`Pression où ${labels.index} est minimal : la cible thérapeutique estimée.`}
      />
      <SummaryStat
        label="LLA"
        value={result.lowerLimit ?? llaFallback?.value ?? null}
        unit="mmHg"
        note={
          llaFallback
            ? `dernière fenêtre · ${formatClockTime(new Date(llaFallback.time).getTime())}`
            : undefined
        }
        hint={
          llaFallback
            ? `Aucune limite basse n'est identifiable sur l'ensemble de l'enregistrement : ${labels.index} ne repasse jamais au-dessus de ${PRX_THRESHOLD.toFixed(1)} sous l'optimum. La valeur affichée est la dernière estimation de l'analyse glissante, à titre indicatif.`
            : `Limite basse : sous cette pression, ${labels.index} repasse au-dessus de ${PRX_THRESHOLD.toFixed(1)} (autorégulation perdue).`
        }
      />
      <SummaryStat
        label="ULA"
        value={result.upperLimit ?? ulaFallback?.value ?? null}
        unit="mmHg"
        note={
          ulaFallback
            ? `dernière fenêtre · ${formatClockTime(new Date(ulaFallback.time).getTime())}`
            : undefined
        }
        hint={
          ulaFallback
            ? `Aucune limite haute n'est identifiable sur l'ensemble de l'enregistrement : ${labels.index} ne repasse jamais au-dessus de ${PRX_THRESHOLD.toFixed(1)} au-dessus de l'optimum. La valeur affichée est la dernière estimation de l'analyse glissante, à titre indicatif.`
            : `Limite haute : au-dessus de cette pression, ${labels.index} repasse au-dessus de ${PRX_THRESHOLD.toFixed(1)}.`
        }
      />
      <SummaryStat
        label={`${labels.index} minimum`}
        value={result.minPrx}
        unit=""
        digits={2}
        hint={`Meilleure valeur de ${labels.index} atteinte. En dessous de ${PRX_THRESHOLD.toFixed(1)}, l'autorégulation est considérée préservée.`}
      />
    </div>
  );
};

// Plain-language verdict: what the clinician should retain before reading any chart.
export const InterpretationBanner = ({
  result,
  rolling = [],
}: {
  result: AutoregResult;
  rolling?: OptimalTimePoint[];
}) => {
  const labels = modeLabels(result.mode);
  const hasRange = result.lowerLimit !== null && result.upperLimit !== null;
  const ok = result.plateauValid;
  const min = result.minPrx?.toFixed(2) ?? '—';
  const fallback = lastRollingLimits(rolling);
  const rollingLimitsShown = Boolean(
    (result.lowerLimit === null && fallback.lower) ||
    (result.upperLimit === null && fallback.upper),
  );

  const headline = !ok
    ? "Aucun plateau d'autorégulation fiable"
    : hasRange
      ? `Cible ${labels.pressure} : ${result.lowerLimit}–${result.upperLimit} mmHg`
      : `${labels.optimal} estimée : ${result.optimalPPC ?? '—'} mmHg`;

  const detail = !ok ? (
    <>
      {labels.index} reste au-dessus du seuil de {PRX_THRESHOLD.toFixed(1)} sur toute la plage
      (minimum {min}) : l'autorégulation semble <strong>globalement altérée</strong>. La{' '}
      {labels.optimal.toLowerCase()} affichée ci-dessous correspond seulement au bin le moins altéré
      et n'est <strong>pas cliniquement interprétable</strong>.
    </>
  ) : hasRange ? (
    <>
      Autorégulation préservée ({labels.index} &lt; {PRX_THRESHOLD.toFixed(1)}) entre{' '}
      {result.lowerLimit} et {result.upperLimit} mmHg, optimum à{' '}
      <strong>{result.optimalPPC} mmHg</strong> ({labels.index} = {min}). Maintenir la{' '}
      {labels.pressure} dans cette plage.
    </>
  ) : (
    <>
      Autorégulation préservée autour de <strong>{result.optimalPPC} mmHg</strong> ({labels.index} ={' '}
      {min}), mais les limites LLA/ULA ne sont pas identifiables sur l'ensemble de l'enregistrement :
      la plage de {labels.pressure} enregistrée ne franchit pas le seuil de part et d'autre de
      l'optimum.
      {rollingLimitsShown
        ? " Les tuiles LLA/ULA montrent la dernière estimation de l'analyse glissante, à titre indicatif."
        : ''}
    </>
  );

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        ok ? 'border-primary/30 bg-primary/5' : 'border-destructive/40 bg-destructive/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <Target className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-lg sm:text-xl font-bold leading-tight ${
              ok ? 'text-primary' : 'text-destructive'
            }`}
          >
            {headline}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{detail}</p>
        </div>
      </div>
      {ok && hasRange && <TargetRangeBar result={result} labels={labels} />}
    </div>
  );
};

// Positions LLA / optimum / ULA on the pressure range actually recorded, so the
// target window can be read at a glance instead of from three separate numbers.
const TargetRangeBar = ({
  result,
  labels,
}: {
  result: AutoregResult;
  labels: ModeLabelSet;
}) => {
  const min = result.curve[0]?.ppc;
  const max = result.curve[result.curve.length - 1]?.ppc;
  if (min === undefined || max === undefined || max <= min) return null;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const left = pct(result.lowerLimit as number);
  const right = pct(result.upperLimit as number);

  return (
    <div className="mt-4 pt-4 border-t border-primary/20">
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-success/30 border border-success/60"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }}
        />
        {result.optimalPPC !== null && (
          <div
            className="absolute -top-1.5 h-6 w-[3px] rounded-full bg-primary"
            style={{ left: `${pct(result.optimalPPC)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{min} mmHg</span>
        <span className="text-center">
          <span className="font-medium text-primary">{labels.pressure}opt {result.optimalPPC}</span>
          {' · '}plage {result.lowerLimit}–{result.upperLimit} mmHg
        </span>
        <span>{max} mmHg</span>
      </div>
    </div>
  );
};

// Signal-quality diagnostics: tells the reader how much to trust the numbers above.
export const QualityPanel = ({ result }: { result: AutoregResult }) => {
  const labels = modeLabels(result.mode);
  if (result.usableSamples <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Analyse restaurée depuis la base : les indicateurs de qualité du signal ne sont disponibles
        qu'après un nouvel import du fichier brut.
      </p>
    );
  }

  const tone = (v: number, good: number, warn: number, invert = false) => {
    const ok = invert ? v <= good : v >= good;
    const mid = invert ? v <= warn : v >= warn;
    return ok ? 'good' : mid ? 'warn' : 'bad';
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qualité du signal et interprétation
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QualityStat
          label="Données exploitables"
          value={`${result.pctUsable} %`}
          sub={`${result.usableSamples} échantillons`}
          tone={tone(result.pctUsable, 90, 70)}
          hint={`Part des paires ${labels.index}/${labels.pressure} comprises dans la fenêtre physiologique 20–150 mmHg. Le reste est écarté comme artefact (rinçage, débranchement).`}
        />
        <QualityStat
          label={`${labels.index} moyen`}
          value={result.meanIndex?.toFixed(2) ?? '—'}
          sub={`seuil ${PRX_THRESHOLD.toFixed(1)}`}
          tone={result.meanIndex === null ? 'neutral' : tone(result.meanIndex, 0.3, 0.5, true)}
          hint={`Moyenne de ${labels.index} sur toute la période exploitable, toutes pressions confondues.`}
        />
        <QualityStat
          label="Temps altéré"
          value={`${result.pctImpaired} %`}
          sub={`${labels.index} > ${PRX_THRESHOLD.toFixed(1)}`}
          tone={tone(result.pctImpaired, 20, 50, true)}
          hint={`Proportion du temps exploitable passée au-dessus du seuil d'altération. Un pourcentage élevé indique une autorégulation défaillante sur une grande partie de l'enregistrement.`}
        />
        <QualityStat
          label="Bins fiables"
          value={String(result.robustBins)}
          sub={`sur ${result.curve.length} bins`}
          tone={tone(result.robustBins, 5, 3)}
          hint="Nombre de paliers de pression contenant au moins 2 % des données. Seuls ces paliers servent au calcul de l'optimum et des limites."
        />
      </div>
    </div>
  );
};

const QualityStat = ({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  hint: string;
}) => {
  const toneClass =
    tone === 'good'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-warning'
        : tone === 'bad'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
        <HintButton text={hint} />
      </div>
      <div className={`text-lg font-bold leading-tight ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
};

// Filled dot = bin retained for the fit; hollow grey dot = too few samples.
const CurveDot = (props: { cx?: number; cy?: number; payload?: CurvePoint }) => {
  const { cx, cy, payload } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
  return payload?.robust === false ? (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill="hsl(var(--background))"
      stroke="hsl(var(--muted-foreground))"
      strokeWidth={1.5}
      strokeOpacity={0.6}
    />
  ) : (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth={1}
    />
  );
};

const CurveTooltip = ({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurvePoint }>;
  labels: ModeLabelSet;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const good = p.prx < PRX_THRESHOLD;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-semibold text-foreground">
        {labels.pressure} {p.ppc} mmHg
      </p>
      <p className="text-muted-foreground">
        {labels.index} moyen : <span className="font-medium text-foreground">{p.prx.toFixed(2)}</span>
      </p>
      <p className="text-muted-foreground">{p.count} échantillons</p>
      {p.robust === false ? (
        <p className="text-muted-foreground italic">Peu de données — exclu du calcul</p>
      ) : (
        <p className={good ? 'text-success' : 'text-destructive'}>
          {good ? 'Autorégulation préservée' : 'Autorégulation altérée'}
        </p>
      )}
    </div>
  );
};

const ChartLegend = ({ labels, result }: { labels: ModeLabelSet; result: AutoregResult }) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="4" fill="hsl(var(--primary))" />
      </svg>
      Bin fiable (retenu pour le calcul)
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="3.5" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />
      </svg>
      Peu de données (&lt; 2 %) — exclu
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden>
        <line x1="0" y1="6" x2="16" y2="6" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
      Seuil {labels.index} = {PRX_THRESHOLD.toFixed(1)}
    </span>
    {result.lowerLimit !== null && result.upperLimit !== null && (
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-sm bg-success/25 border border-success/50" aria-hidden />
        Plage autorégulée (LLA–ULA)
      </span>
    )}
  </div>
);

/** The U-curve itself, without the surrounding card. */
export const AutoregCurveChart = ({
  result,
  height = 360,
}: {
  result: AutoregResult;
  height?: number;
}) => {
  const labels = modeLabels(result.mode);
  const zoom = useYAxisZoom(CURVE_Y_DOMAIN);
  const [isEditing, setIsEditing] = useState(false);
  return (
    <>
      <ChartZoomControls
        zoom={zoom}
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((v) => !v)}
        className="mb-2"
      />
      <div
        className={cn(
          "rounded-lg transition-colors",
          isEditing && "border-2 border-primary/60 bg-primary/5 p-2",
        )}
      >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={result.curve} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="ppc"
              type="number"
              domain={['dataMin - 2', 'dataMax + 2']}
              label={{ value: `${labels.pressure} (mmHg)`, position: 'insideBottom', offset: -5 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={zoom.yDomain}
              label={{ value: labels.index, angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            {result.lowerLimit !== null && result.upperLimit !== null && (
              <ReferenceArea
                x1={result.lowerLimit}
                x2={result.upperLimit}
                fill="hsl(var(--success))"
                fillOpacity={0.1}
                label={{
                  value: 'Plage autorégulée',
                  position: 'insideTop',
                  fontSize: 11,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
            )}
            <ReferenceLine
              y={PRX_THRESHOLD}
              stroke="hsl(var(--destructive))"
              strokeDasharray="5 4"
              label={{
                value: `Seuil ${PRX_THRESHOLD.toFixed(1)}`,
                position: 'right',
                fontSize: 10,
                fill: 'hsl(var(--destructive))',
              }}
            />
            {result.lowerLimit !== null && (
              <ReferenceLine x={result.lowerLimit} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                label={{ value: 'LLA', position: 'insideBottomLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            )}
            {result.upperLimit !== null && (
              <ReferenceLine x={result.upperLimit} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                label={{ value: 'ULA', position: 'insideBottomRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            )}
            <RechartsTooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
              content={<CurveTooltip labels={labels} />}
            />
            <Line
              type="monotone" isAnimationActive={false}
              dataKey="prx"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={<CurveDot />}
              activeDot={{ r: 6 }}
              name={`${labels.index} moyen`}
            />
            {result.optimalPPC !== null && result.minPrx !== null && (
              <ReferenceDot
                x={result.optimalPPC}
                y={result.minPrx}
                r={7}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth={2}
                label={{ value: `${labels.pressure}opt`, position: 'top', fontSize: 11 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      <ChartLegend labels={labels} result={result} />
    </>
  );
};

/** The curve wrapped in the titled card used on the study page. */
export const AutoregCurveCard = ({
  result,
  id,
  height,
}: {
  result: AutoregResult;
  id?: string;
  height?: number;
}) => {
  const labels = modeLabels(result.mode);
  return (
    <Card id={id} data-pdf-title={`Courbe d'autorégulation · ${labels.index} vs ${labels.pressure}`}>
      <CardHeader>
        <CardTitle>Courbe d'autorégulation · {labels.index} vs {labels.pressure}</CardTitle>
        <CardDescription>
          Le creux de la courbe donne la {labels.optimal.toLowerCase()}. Sous la ligne de seuil
          ({labels.index} &lt; {PRX_THRESHOLD.toFixed(1)}), l'autorégulation est préservée
          {result.lowerLimit !== null && result.upperLimit !== null
            ? ' ; la bande colorée est la plage LLA–ULA à viser.'
            : '.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AutoregCurveChart result={result} height={height} />
      </CardContent>
    </Card>
  );
};
