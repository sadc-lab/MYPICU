// Vue « Autorégulation cérébrale » : verdict en une phrase, plage
// d'autorégulation actuelle, puis pression, signal cérébral et indice dans le
// temps. Affichée dans le pop-up d'Optibrain ; même présentation que la vue du
// déploiement d'étude.
//
// Le calcul est celui du moteur partagé (autoregComputation.service), déjà
// utilisé par Optibrain et par la page d'import de l'étude : mêmes données en
// entrée, mêmes chiffres en sortie. La fenêtre d'autorégulation affichée sur le
// graphique est la fenêtre glissante (rollingOptimal) ; l'encadré du bas reprend
// la dernière estimation de cette même fenêtre, pour que les chiffres
// correspondent à la zone ombrée visible juste au-dessus.

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { AlertTriangle, Activity, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BRUSH_TOUCH_WIDTH, renderWideTouchTraveller } from "@/lib/chartBrushTraveller";
import { cn } from "@/lib/utils";
import { ChartZoomControls } from "@/components/ChartZoomControls";
import { TimeRangeBadge } from "@/components/TimeRangeBadge";
import { ChartTimeRangeContext, ChartTimeRangeProvider, type TimeRange } from "@/contexts/ChartTimeRangeContext";
import { Button } from "@/components/ui/button";
import { useSharedTimeWindow } from "@/hooks/useSharedTimeWindow";
import type { YAxisZoom } from "@/hooks/useYAxisZoom";
import {
  describeAnalysisReadiness,
  parseAny,
  rollingOptimal,
  runAnalysis,
  PRX_THRESHOLD,
  type AutoregResult,
  type OptimalTimePoint,
  type RawSample,
  type ReadinessError,
} from "@/services/autoregComputation.service";
import { isNirsBasedPatient } from "@/services/autoregulation.service";
import { niceScale, timeAxis } from "@/lib/chartAxes";
import { loadNirsSamples } from "@/services/nirsAutoregulation.service";
import { loadAutoregSourceFromVitals } from "@/services/monitorAutoregSource.service";
import { tr, dateLocale } from '@/i18n';

// Au-delà, recharts ralentit nettement sans rien apporter de lisible à l'écran.
const MAX_CHART_POINTS = 1500;

interface LoadedAnalysis {
  result: AutoregResult;
  rolling: OptimalTimePoint[];
  truncated: boolean;
}

type LoadState =
  | { status: "loading" }
  | { status: "empty"; error: ReadinessError }
  | { status: "error"; message: string }
  | { status: "ready"; analysis: LoadedAnalysis };

async function loadSamples(patientId: string): Promise<{ samples: RawSample[]; truncated: boolean }> {
  // Les patients suivis en NIRS ont un enregistrement brut rSO₂/PAM : la table
  // patient_vitals ne contient pas de canal rSO₂, donc pas de COx possible depuis
  // le moniteur. Les autres passent par PIC/PAM/PPC du moniteur (PRx).
  if (isNirsBasedPatient(patientId)) {
    return { samples: await loadNirsSamples(patientId), truncated: false };
  }
  const source = await loadAutoregSourceFromVitals(patientId);
  if (!source) return { samples: [], truncated: false };
  return { samples: parseAny(source.csv), truncated: source.truncated };
}

function downsample<T>(points: T[], max = MAX_CHART_POINTS): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

const r0 = (v: number) => Math.round(v);

const AXIS_TICK = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const Y_AXIS_WIDTH = 36;
const CHART_MARGIN = { top: 6, right: 28, bottom: 0, left: 0 };
const SYNC_ID = "cerebral-autoreg";


const tooltipTime = (t: unknown) => format(new Date(Number(t)), "dd/MM HH:mm", { locale: dateLocale() });

/**
 * patientId : patient de l'unité (moniteur, ou enregistrement NIRS livré).
 */
export function CerebralAutoregView({ patientId }: { patientId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadSamples(patientId)
      .then(({ samples, truncated }) => {
        if (cancelled) return;
        const readiness = describeAnalysisReadiness(samples);
        if (readiness) {
          setState({ status: "empty", error: readiness });
          return;
        }
        const result = runAnalysis(samples, 30, 5);
        const rolling = rollingOptimal(
          result.samples,
          Math.min(240, Math.floor(result.samples.length / 3)),
          30,
          5,
          result.mode,
        );
        setState({ status: "ready", analysis: { result, rolling, truncated } });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error("Autorégulation : chargement impossible", e);
        setState({ status: "error", message: e instanceof Error ? e.message : tr("Erreur inconnue", "Unknown error") });
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (state.status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr("Calcul de l'autorégulation…", 'Computing autoregulation…')}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-lg border border-status-critical/30 bg-status-critical/5 p-4 text-sm">
        {tr('Impossible de charger les données de ce patient :', "Unable to load this patient's data:")} {state.message}
      </div>
    );
  }
  if (state.status === "empty") {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{tr("Pas de données d'autorégulation pour ce patient.", 'No autoregulation data for this patient.')}</p>
        <p className="mt-1">{state.error.cause}</p>
      </div>
    );
  }
  return <AutoregContent analysis={state.analysis} />;
}

function AutoregContent({ analysis }: { analysis: LoadedAnalysis }) {
  const { result, rolling, truncated } = analysis;
  const isCox = result.mode === "cox";
  const pressureLabel = isCox ? tr("PAM", "MAP") : tr("PPC", "CPP");
  const indexLabel = isCox ? "COx" : "PRx";
  const signalLabel = isCox ? "rSO₂" : tr("PIC", "ICP");

  // Fenêtre glissante, indexée dans le temps, pour la zone ombrée.
  const windows = useMemo(
    () =>
      rolling.map((p) => ({
        t: new Date(p.time).getTime(),
        lower: p.lowerLimit,
        upper: p.upperLimit,
        optimum: p.optimalPPC,
      })),
    [rolling],
  );

  const allPoints = useMemo(() => {
    let w = 0;
    const points = result.samples.map((s) => {
      const t = s.time.getTime();
      // Dernière fenêtre calculée à ou avant cet instant (rendu en escalier).
      while (w + 1 < windows.length && windows[w + 1].t <= t) w++;
      const win = windows.length > 0 && windows[w].t <= t ? windows[w] : null;
      // Une fenêtre courte identifie souvent l'optimale sans les deux bornes :
      // chaque valeur est tracée dès qu'elle existe, la zone n'est ombrée que
      // lorsque les deux bornes sont connues.
      const hasBand = !!win && win.lower !== null && win.upper !== null && win.lower <= win.upper;
      return {
        t,
        pressure: isCox ? s.pam : s.ppc,
        signal: isCox ? s.nirs : s.pic,
        index: s.prx,
        lower: win?.lower ?? null,
        upper: win?.upper ?? null,
        optimum: win?.optimum ?? null,
        band: hasBand ? ([win!.lower, win!.upper] as [number, number]) : null,
      };
    });
    return points;
  }, [result.samples, windows, isCox]);

  // Toute la durée, sous-échantillonnée : sert de support aux poignées de
  // sélection de période (mode édition, bouton crayon).
  const fullSeries = useMemo(() => downsample(allPoints), [allPoints]);

  // Un seul crayon pour les trois graphiques : même mode édition, même facteur
  // d'échelle Y, et une seule barre de période (sous le dernier graphique).
  const [editing, setEditing] = useState(false);
  const [yFactor, setYFactor] = useState(1);
  const sharedZoom: YAxisZoom = {
    yDomain: [0, 1], // non utilisé par les boutons ; chaque graphique applique le facteur à sa propre échelle
    zoomIn: () => setYFactor((f) => Math.max(0.2, +(f * 0.8).toFixed(2))),
    zoomOut: () => setYFactor((f) => Math.min(5, +(f * 1.25).toFixed(2))),
    resetZoom: () => setYFactor(1),
    isZoomed: yFactor !== 1,
    canZoomIn: yFactor > 0.2,
    canZoomOut: yFactor < 5,
  };
  const chartState = { editing, yFactor, allPoints, fullSeries };

  const hasBand = allPoints.some((p) => p.band !== null || p.optimum !== null);

  // Dernière estimation fiable de la fenêtre glissante ; à défaut, l'analyse sur
  // tout l'enregistrement. La source est dite à l'écran.
  const latestWindow = [...rolling].reverse().find(
    (p) => p.lowerLimit !== null && p.upperLimit !== null && p.lowerLimit <= p.upperLimit,
  );
  const range =
    latestWindow
      ? {
          lower: latestWindow.lowerLimit as number,
          upper: latestWindow.upperLimit as number,
          optimum: latestWindow.optimalPPC,
          source: tr(
            `Plage : dernière estimation de l'analyse glissante (${tooltipTime(new Date(latestWindow.time).getTime())}).`,
            `Range: latest rolling-analysis estimate (${tooltipTime(new Date(latestWindow.time).getTime())}).`,
          ),
        }
      : result.lowerLimit !== null && result.upperLimit !== null
        ? {
            lower: result.lowerLimit,
            upper: result.upperLimit,
            optimum: result.optimalPPC,
            source: tr("Plage calculée sur l'ensemble de l'enregistrement.", "Range computed over the whole recording."),
          }
        : null;
  const optimum = range?.optimum ?? result.optimalPPC;

  const lastPressure = [...result.samples]
    .reverse()
    .map((s) => (isCox ? s.pam : s.ppc))
    .find((v): v is number => v !== null);

  // ---- 1. Verdict en une phrase, avant les graphiques ----
  const lastT = allPoints[allPoints.length - 1]?.t ?? 0;
  const recentIdx = finite(allPoints.filter((p) => p.t >= lastT - 30 * 60_000).map((p) => p.index));
  const recentIndex = recentIdx.length ? recentIdx.reduce((a, b) => a + b, 0) / recentIdx.length : null;
  const position =
    range && lastPressure !== undefined
      ? lastPressure < range.lower ? "below" : lastPressure > range.upper ? "above" : "inside"
      : null;
  const optText = optimum !== null ? tr(` ${pressureLabel} optimale estimée : ${r0(optimum)} mmHg.`, ` Estimated optimal ${pressureLabel}: ${r0(optimum)} mmHg.`) : "";
  const verdict: { tone: "normal" | "warning" | "critical" | "neutral"; headline: string; detail: string } = !result.plateauValid
    ? {
        tone: "critical",
        headline: tr("Autorégulation globalement altérée", "Autoregulation globally impaired"),
        detail: tr(
          `Le ${indexLabel} ne descend jamais sous ${PRX_THRESHOLD} : aucune ${pressureLabel} optimale n'est interprétable cliniquement.`,
          `${indexLabel} never drops below ${PRX_THRESHOLD}: no optimal ${pressureLabel} is clinically interpretable.`,
        ),
      }
    : position && range && lastPressure !== undefined
      ? {
          tone: position === "inside" ? "normal" : "warning",
          headline:
            position === "inside"
              ? tr(`${pressureLabel} actuelle ${r0(lastPressure)} mmHg : dans la plage d'autorégulation (${r0(range.lower)}–${r0(range.upper)} mmHg)`, `Current ${pressureLabel} ${r0(lastPressure)} mmHg: within the autoregulation range (${r0(range.lower)}–${r0(range.upper)} mmHg)`)
              : position === "below"
                ? tr(`${pressureLabel} actuelle ${r0(lastPressure)} mmHg : sous la plage d'autorégulation (${r0(range.lower)}–${r0(range.upper)} mmHg)`, `Current ${pressureLabel} ${r0(lastPressure)} mmHg: below the autoregulation range (${r0(range.lower)}–${r0(range.upper)} mmHg)`)
                : tr(`${pressureLabel} actuelle ${r0(lastPressure)} mmHg : au-dessus de la plage d'autorégulation (${r0(range.lower)}–${r0(range.upper)} mmHg)`, `Current ${pressureLabel} ${r0(lastPressure)} mmHg: above the autoregulation range (${r0(range.lower)}–${r0(range.upper)} mmHg)`),
          detail:
            (position === "below"
              ? tr("Risque d'hypoperfusion cérébrale.", "Risk of cerebral hypoperfusion.")
              : position === "above"
                ? tr("Risque d'hyperperfusion cérébrale.", "Risk of cerebral hyperperfusion.")
                : tr("Pression compatible avec une autorégulation efficace.", "Pressure consistent with effective autoregulation.")) + optText,
        }
      : {
          tone: "neutral",
          headline:
            optimum !== null
              ? tr(`${pressureLabel} optimale estimée : ${r0(optimum)} mmHg`, `Estimated optimal ${pressureLabel}: ${r0(optimum)} mmHg`)
              : tr("Plage d'autorégulation non identifiable", "Autoregulation range not identifiable"),
          detail: tr("Les limites LLA/ULA ne sont pas identifiables sur cet enregistrement.", "The LLA/ULA limits are not identifiable on this recording."),
        };
  const verdictTone = {
    normal: "border-status-normal/30 bg-status-normal/5 text-status-normal",
    warning: "border-status-warning/40 bg-status-warning/5 text-status-warning",
    critical: "border-status-critical/40 bg-status-critical/5 text-status-critical",
    neutral: "border-border bg-muted/40 text-foreground",
  }[verdict.tone];

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">{tr("Autorégulation cérébrale", "Cerebral autoregulation")}</h2>
        <p className="text-sm text-muted-foreground">
          {isCox ? tr("basée sur NIRS / PAM / COx", "based on NIRS / MAP / COx") : tr("basée sur PIC / PAM / PRx", "based on ICP / MAP / PRx")}
        </p>
      </header>

      {/* 1. Verdict */}
      <div className={cn("flex gap-3 rounded-lg border p-3 sm:p-4", verdictTone)}>
        {verdict.tone === "normal" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug sm:text-base">{verdict.headline}</p>
          <p className="text-xs text-foreground/80 sm:text-sm">{verdict.detail}</p>
          {recentIndex !== null && (
            <p className="text-xs text-foreground/80">
              {tr(
                `${indexLabel} récent (30 dernières minutes) : ${recentIndex.toFixed(2)} — autorégulation ${recentIndex < PRX_THRESHOLD ? "préservée" : "altérée"}.`,
                `Recent ${indexLabel} (last 30 minutes): ${recentIndex.toFixed(2)} — autoregulation ${recentIndex < PRX_THRESHOLD ? "preserved" : "impaired"}.`,
              )}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {tr("Aide à l'interprétation ; ne remplace pas le jugement clinique.", "Interpretation aid; does not replace clinical judgement.")}
          </p>
        </div>
      </div>

      {/* 2. Plage et pression actuelle, juste sous le verdict */}
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{tr(`${pressureLabel} observée et plage d'autorégulation`, `Observed ${pressureLabel} and autoregulation range`)}</h3>
        </div>
        {range ? (
          <>
            <RangeScale
              current={lastPressure ?? null}
              currentLabel={tr(`${pressureLabel} actuelle`, `Current ${pressureLabel}`)}
              lower={range.lower}
              upper={range.upper}
              optimum={optimum}
            />
            <p className="mt-3 text-sm">
              {tr("Plage d'autorégulation :", "Autoregulation range:")} <span className="font-semibold">{r0(range.lower)}–{r0(range.upper)} mmHg</span>.
              {optimum !== null && <> {tr(`${pressureLabel} optimale`, `Optimal ${pressureLabel}`)} {r0(optimum)} mmHg</>}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{range.source}</p>
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {tr("Plage d'autorégulation non identifiable sur cet enregistrement.", 'Autoregulation range not identifiable on this recording.')}
          </p>
        )}
      </section>

      {truncated && (
        <p className="text-xs text-status-warning">
          {tr("Enregistrement incomplet : toutes les données du moniteur n'ont pas pu être lues.", 'Incomplete recording: not all monitor data could be read.')}
        </p>
      )}

      {/* Graphiques : un seul crayon règle l'échelle (Y) et la période
          (poignées sous le dernier graphique) pour les trois. */}
      <ChartTimeRangeProvider>
      <div className="space-y-5">
        <ChartsToolbar
          fullSeries={fullSeries}
          editing={editing}
          setEditing={setEditing}
          yFactor={yFactor}
          setYFactor={setYFactor}
          zoom={sharedZoom}
        />
        {editing && <RangeNavigator fullSeries={fullSeries} />}

        {/* 1. Pression observée + plage d'autorégulation */}
        <TimeChart
          title={tr(`${pressureLabel} observée et plage d'autorégulation (zone ombrée)`, `Observed ${pressureLabel} and autoregulation range (shaded area)`)}
          unit="mmHg"
          height={224}
          {...chartState}
          yScale={pressureYScale}
          hint={tr(
            `Courbe bleue : ${pressureLabel} mesurée. Zone verte : plage d'autorégulation estimée par l'analyse glissante, entre la limite basse (LLA) et la limite haute (ULA). Idéalement, la ${pressureLabel} reste dans la zone verte, près de la ${pressureLabel} optimale.`,
            `Blue line: measured ${pressureLabel}. Green area: autoregulation range estimated by the rolling analysis, between the lower (LLA) and upper (ULA) limits. Ideally, ${pressureLabel} stays within the green area, close to the optimal ${pressureLabel}.`,
          )}
          legend={[
            { kind: "line", color: "hsl(var(--primary))", label: tr(`${pressureLabel} observée`, `Observed ${pressureLabel}`) },
            { kind: "area", color: "hsl(var(--status-normal))", label: tr("Plage d'autorégulation", "Autoregulation range") },
            { kind: "dashed", color: "hsl(var(--status-normal))", label: tr("Limites LLA / ULA", "LLA / ULA limits") },
            { kind: "thin", color: "hsl(var(--status-normal))", label: tr(`${pressureLabel} optimale`, `Optimal ${pressureLabel}`) },
          ]}
          note={tr(
            `La zone verte n'apparaît que lorsque les deux limites (LLA et ULA) sont identifiables par l'analyse glissante ; ailleurs, seule la ${pressureLabel} optimale est tracée.`,
            `The green area only appears when both limits (LLA and ULA) are identifiable by the rolling analysis; elsewhere, only the optimal ${pressureLabel} is drawn.`,
          )}
        >
          <Tooltip
            labelFormatter={tooltipTime}
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                const [lo, hi] = value.map(Number);
                return [`${r0(lo)}–${r0(hi)} mmHg`, String(name)];
              }
              return [`${r0(Number(value))} mmHg`, String(name)];
            }}
          />
          {hasBand ? (
            <>
              <Area type="stepAfter" dataKey="band" isRange fill="hsl(var(--status-normal))" fillOpacity={0.2}
                stroke="none" connectNulls={false} isAnimationActive={false} name={tr("Plage d'autorégulation", "Autoregulation range")} />
              <Line type="stepAfter" dataKey="lower" name="LLA" stroke="hsl(var(--status-normal))" strokeDasharray="4 3"
                strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="upper" name="ULA" stroke="hsl(var(--status-normal))" strokeDasharray="4 3"
                strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="optimum" name={tr(`${pressureLabel} optimale`, `Optimal ${pressureLabel}`)} stroke="hsl(var(--status-normal))"
                strokeWidth={1} dot={false} connectNulls={false} isAnimationActive={false} />
            </>
          ) : range ? (
            <>
              <ReferenceArea y1={range.lower} y2={range.upper} fill="hsl(var(--status-normal))" fillOpacity={0.2} />
              {optimum !== null && <ReferenceLine y={optimum} stroke="hsl(var(--status-normal))" strokeDasharray="4 3" />}
            </>
          ) : null}
          <Line type="monotone" dataKey="pressure" name={tr(`${pressureLabel} observée`, `Observed ${pressureLabel}`)} stroke="hsl(var(--primary))"
            strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
        </TimeChart>

        {/* 2. Signal cérébral */}
        <TimeChart
          title={isCox ? tr("rSO₂ · saturation régionale cérébrale en oxygène", "rSO₂ · regional cerebral oxygen saturation") : tr("PIC · pression intracrânienne", "ICP · intracranial pressure")}
          unit={isCox ? "%" : "mmHg"}
          height={144}
          {...chartState}
          yScale={signalYScale}
          hint={
            isCox
              ? tr("rSO₂ : oxygénation cérébrale mesurée par NIRS. C'est le signal comparé à la PAM pour calculer le COx.", "rSO₂: cerebral oxygenation measured by NIRS. This is the signal compared with MAP to compute COx.")
              : tr("PIC : pression intracrânienne. C'est le signal comparé à la PAM pour calculer le PRx.", "ICP: intracranial pressure. This is the signal compared with MAP to compute PRx.")
          }
          legend={[{ kind: "line", color: "hsl(var(--chart-2))", label: signalLabel }]}
        >
          <Tooltip labelFormatter={tooltipTime}
            formatter={(v: number) => [`${r0(Number(v))} ${isCox ? "%" : "mmHg"}`, signalLabel]} />
          <Line type="monotone" dataKey="signal" name={signalLabel} stroke="hsl(var(--chart-2))" strokeWidth={1.5}
            dot={false} connectNulls={false} isAnimationActive={false} />
        </TimeChart>

        {/* 3. Indice d'autorégulation dans le temps */}
        <TimeChart
          title={tr(`${indexLabel} · indice d'autorégulation (seuil ${PRX_THRESHOLD})`, `${indexLabel} · autoregulation index (threshold ${PRX_THRESHOLD})`)}
          height={160}
          {...chartState}
          yScale={indexYScale}
          hint={tr(
            `Corrélation glissante entre le signal cérébral et la PAM. Sous ${PRX_THRESHOLD} : autorégulation préservée (le cerveau compense les variations de pression). Au-dessus de ${PRX_THRESHOLD} (zone orange) : autorégulation altérée.`,
            `Rolling correlation between the cerebral signal and MAP. Below ${PRX_THRESHOLD}: autoregulation preserved (the brain compensates for pressure changes). Above ${PRX_THRESHOLD} (orange area): autoregulation impaired.`,
          )}
          legend={[
            { kind: "line", color: "hsl(var(--foreground))", label: indexLabel },
            { kind: "dashed", color: "hsl(var(--status-warning))", label: tr(`Seuil ${PRX_THRESHOLD}`, `Threshold ${PRX_THRESHOLD}`) },
            { kind: "area", color: "hsl(var(--status-warning))", label: tr("Autorégulation altérée", "Autoregulation impaired") },
          ]}
          yTickFormatter={(v: number) => (v === 0 ? "0" : v.toFixed(1))}
        >
          <ReferenceArea y1={PRX_THRESHOLD} y2={1} fill="hsl(var(--status-warning))" fillOpacity={0.08} />
          <ReferenceLine
            y={PRX_THRESHOLD}
            stroke="hsl(var(--status-warning))"
            strokeDasharray="4 3"
            label={{ value: String(PRX_THRESHOLD), position: "right", fontSize: 10, fill: "hsl(var(--status-warning))" }}
          />
          <Tooltip labelFormatter={tooltipTime} formatter={(v: number) => [Number(v).toFixed(2), indexLabel]} />
          <Line type="monotone" dataKey="index" name={indexLabel} stroke="hsl(var(--foreground))" strokeWidth={1.2}
            dot={false} connectNulls={false} isAnimationActive={false} />
        </TimeChart>
      </div>
      </ChartTimeRangeProvider>

    </div>
  );
}

interface ChartPoint {
  t: number;
  pressure: number | null;
  signal: number | null;
  index: number | null;
  lower: number | null;
  upper: number | null;
  optimum: number | null;
  band: [number, number] | null;
}

interface YScale {
  domain: [number, number];
  ticks?: number[];
}

const getT = (p: ChartPoint) => p.t;
const finite = (vals: Array<number | null>) => vals.filter((v): v is number => v !== null && Number.isFinite(v));

function pressureYScale(points: ChartPoint[]): YScale {
  const vals = finite(points.flatMap((p) => [p.pressure, p.lower, p.upper]));
  return vals.length ? niceScale(Math.min(...vals) - 2, Math.max(...vals) + 2) : niceScale(0, 100);
}
function signalYScale(points: ChartPoint[]): YScale {
  const vals = finite(points.map((p) => p.signal));
  return vals.length ? niceScale(Math.min(...vals) - 1, Math.max(...vals) + 1, 4) : niceScale(0, 100, 4);
}
function indexYScale(): YScale {
  return { domain: [-1, 1], ticks: [-1, -0.5, 0, 0.5, 1] };
}

/**
 * Barre au-dessus des graphiques. Hors édition : rappel de la période retenue
 * et crayon. En édition : période sélectionnée affichée en direct, échelle Y
 * (+/−), puis « Appliquer » pour garder ou « Annuler » pour revenir à l'état
 * d'avant l'édition.
 */
function ChartsToolbar({
  fullSeries,
  editing,
  setEditing,
  yFactor,
  setYFactor,
  zoom,
}: {
  fullSeries: ChartPoint[];
  editing: boolean;
  setEditing: (v: boolean) => void;
  yFactor: number;
  setYFactor: (v: number) => void;
  zoom: YAxisZoom;
}) {
  const shared = useContext(ChartTimeRangeContext);
  const win = useSharedTimeWindow(fullSeries, getT);
  const snapshot = useRef<{ range: TimeRange | null; isActive: boolean; yFactor: number } | null>(null);

  const fullStart = fullSeries[0]?.t ?? 0;
  const fullEnd = fullSeries[fullSeries.length - 1]?.t ?? fullStart;
  const start = win.isRangeSelected && win.rangeStart !== null ? win.rangeStart : fullStart;
  const end = win.isRangeSelected && win.rangeEnd !== null ? win.rangeEnd : fullEnd;

  const startEdit = () => {
    snapshot.current = { range: shared?.range ?? null, isActive: shared?.isActive ?? false, yFactor };
    setEditing(true);
  };
  const apply = () => {
    snapshot.current = null;
    setEditing(false);
  };
  const cancel = () => {
    const snap = snapshot.current;
    if (snap && shared) {
      shared.setRange(snap.range);
      shared.setIsActive(snap.isActive);
      setYFactor(snap.yFactor);
    }
    snapshot.current = null;
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-2 rounded-lg",
        editing && "border-2 border-primary/60 bg-primary/5 px-3 py-2",
      )}
    >
      {editing ? (
        <span className="text-xs">
          <span className="text-muted-foreground">{tr("Plage sélectionnée :", "Selected range:")} </span>
          <span className="font-semibold tabular-nums">{tooltipTime(start)} → {tooltipTime(end)}</span>
          {!win.isRangeSelected && <span className="text-muted-foreground"> ({tr("tout l'enregistrement", "whole recording")})</span>}
        </span>
      ) : (
        win.isRangeSelected && (
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tr("Période affichée :", "Displayed period:")}</span>
            <TimeRangeBadge rangeStart={win.rangeStart} rangeEnd={win.rangeEnd} onReset={win.resetRange} />
          </span>
        )
      )}
      <div className="ml-auto flex items-center gap-2">
        <ChartZoomControls zoom={zoom} isEditing={editing} onToggleEditing={editing ? apply : startEdit} />
        {editing && (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancel}>
              {tr("Annuler", "Cancel")}
            </Button>
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={apply}>
              {tr("Appliquer", "Apply")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Barre de sélection de période (mode édition) : tout l'enregistrement en
 * aperçu, poignées = période choisie. Les graphiques suivent en direct.
 */
function RangeNavigator({ fullSeries }: { fullSeries: ChartPoint[] }) {
  const win = useSharedTimeWindow(fullSeries, getT);
  if (fullSeries.length < 3) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground" style={{ paddingLeft: Y_AXIS_WIDTH + 8 }}>
        {tr("Déplacez les poignées pour choisir la période ; les graphiques se mettent à jour en direct.", "Move the handles to choose the period; the charts update live.")}
      </p>
      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {/* Montée à l'entrée en édition et démontée à la sortie : les poignées partent
              toujours de la période en cours, sans avoir à suivre une remise à zéro. */}
          <ComposedChart data={fullSeries} margin={{ top: 0, right: CHART_MARGIN.right, bottom: 0, left: Y_AXIS_WIDTH }}>
            <Brush
              dataKey="t"
              height={44}
              stroke="hsl(var(--primary))"
              fill="hsl(var(--background))"
              travellerWidth={BRUSH_TOUCH_WIDTH}
              traveller={renderWideTouchTraveller}
              tickFormatter={(t: number) => tooltipTime(t)}
              startIndex={win.startIndex}
              endIndex={win.endIndex}
              onChange={win.onBrushChange}
            >
              <ComposedChart data={fullSeries}>
                <Line type="monotone" dataKey="pressure" stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Graphique temporel avec le réglage commun aux graphiques de MyPICU : le
 * crayon passe en mode édition (échelle Y +/−, poignées de période sur toute
 * la durée). Hors édition, la période retenue est relue sur les points bruts
 * avant sous-échantillonnage, pour garder la résolution réelle du signal.
 */
function TimeChart({
  title,
  unit,
  height,
  allPoints,
  fullSeries,
  yScale,
  yTickFormatter,
  editing,
  yFactor,
  hint,
  legend,
  note,
  children,
}: {
  title: string;
  unit?: string;
  height: number;
  allPoints: ChartPoint[];
  fullSeries: ChartPoint[];
  yScale: (points: ChartPoint[]) => YScale;
  yTickFormatter?: (v: number) => string;
  editing: boolean;
  yFactor: number;
  hint?: string;
  legend?: LegendItem[];
  note?: string;
  children: ReactNode;
}) {
  const win = useSharedTimeWindow(fullSeries, getT);
  const fullStart = fullSeries[0]?.t ?? 0;
  const fullEnd = fullSeries[fullSeries.length - 1]?.t ?? fullStart;
  const rangeOn = win.isRangeSelected && win.rangeStart !== null && win.rangeEnd !== null;
  const start = rangeOn ? (win.rangeStart as number) : fullStart;
  const end = rangeOn ? (win.rangeEnd as number) : fullEnd;

  const zoomed = useMemo(
    () => (rangeOn ? downsample(allPoints.filter((p) => p.t >= start && p.t <= end)) : fullSeries),
    [rangeOn, allPoints, fullSeries, start, end],
  );
  // Y compris en mode édition : la période choisie s'affiche en direct.
  const data = zoomed;
  const scale = useMemo(() => yScale(data), [yScale, data]);
  const yDomain = useMemo((): [number, number] => {
    const [lo, hi] = scale.domain;
    if (yFactor === 1) return [lo, hi];
    const center = (lo + hi) / 2;
    const half = ((hi - lo) / 2) * yFactor;
    // Pas d'arrondi à l'entier : l'indice PRx/COx vit entre -1 et 1.
    const decimals = hi - lo <= 5 ? 2 : 0;
    return [Number((center - half).toFixed(decimals)), Number((center + half).toFixed(decimals))];
  }, [scale.domain, yFactor]);
  const xAxis = useMemo(() => timeAxis(start, end), [start, end]);

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        {/* L'unité est posée au-dessus de l'axe Y, dans la même largeur que ses graduations. */}
        <span className="shrink-0 text-right text-[10px] text-muted-foreground" style={{ width: Y_AXIS_WIDTH }}>
          {unit}
        </span>
        <p className="min-w-0 text-xs font-medium text-muted-foreground">{title}</p>
        {hint && <InfoHint text={hint} />}
      </div>
      {legend && <ChartLegend items={legend} />}
      <div className={cn("rounded-lg transition-colors", editing && "border-2 border-primary/60 bg-primary/5 p-2")}>
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={CHART_MARGIN} syncId={SYNC_ID}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="t"
                type="number"
                domain={xAxis.domain}
                ticks={xAxis.ticks}
                tickFormatter={xAxis.formatTick}
                tick={AXIS_TICK}
                stroke="hsl(var(--border))"
                tickLine={false}
                minTickGap={12}
                allowDataOverflow
              />
              <YAxis
                domain={yDomain}
                ticks={yFactor !== 1 ? undefined : scale.ticks}
                tickFormatter={yTickFormatter}
                tick={AXIS_TICK}
                width={Y_AXIS_WIDTH}
                axisLine={false}
                tickLine={false}
                allowDataOverflow
              />
              {children}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {note && <p className="mt-1 text-[11px] text-muted-foreground" style={{ paddingLeft: Y_AXIS_WIDTH + 8 }}>{note}</p>}
    </div>
  );
}

interface LegendItem {
  kind: "line" | "dashed" | "thin" | "area";
  color: string;
  label: string;
}

/** Légende toujours visible (pas seulement au survol, absent sur tablette). */
function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" style={{ paddingLeft: Y_AXIS_WIDTH + 8 }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "area" ? (
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: it.color, opacity: 0.3 }} />
          ) : (
            <svg width="16" height="8" aria-hidden>
              <line
                x1="0" y1="4" x2="16" y2="4"
                stroke={it.color}
                strokeWidth={it.kind === "thin" ? 1 : 2}
                strokeDasharray={it.kind === "dashed" ? "4 3" : undefined}
              />
            </svg>
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** ⓘ ouvert au clic ou au toucher (une infobulle au survol ne marche pas sur tablette). */
function InfoHint({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tr("Comment lire ce graphique", "How to read this chart")}
          className="shrink-0 rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}

// Échelle fixe 0–100 mmHg (élargie seulement si une valeur la dépasse), pour que
// les repères se lisent directement : plage grisée, optimum, valeur actuelle.
function RangeScale({
  current,
  currentLabel,
  lower,
  upper,
  optimum,
}: {
  current: number | null;
  currentLabel: string;
  lower: number;
  upper: number;
  optimum: number | null;
}) {
  const max = Math.max(100, Math.ceil((Math.max(upper, current ?? 0) + 5) / 10) * 10);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const inRange = current !== null && current >= lower && current <= upper;

  return (
    <div className="relative px-1 pb-6 pt-12">
      {current !== null && (
        <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pct(current) }}>
          <span className="text-[11px] font-medium leading-none text-primary">{currentLabel}</span>
          <span className={`mt-0.5 text-lg font-semibold leading-none tabular-nums ${inRange ? "text-primary" : "text-status-critical"}`}>
            {r0(current)}
            <span className="ml-0.5 text-xs font-normal opacity-70">mmHg</span>
          </span>
          <span className={`mt-0.5 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent ${inRange ? "border-t-primary" : "border-t-status-critical"}`} />
        </div>
      )}
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-muted-foreground/30"
          style={{ left: pct(lower), width: `calc(${pct(upper)} - ${pct(lower)})` }}
        />
        {optimum !== null && (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-status-normal"
            style={{ left: pct(optimum) }}
            title={tr("Optimale", "Optimal")}
          />
        )}
        {current !== null && (
          <div
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${inRange ? "bg-primary" : "bg-status-critical"}`}
            style={{ left: pct(current) }}
          />
        )}
      </div>
      {/* Repères sous la barre */}
      <div className="absolute inset-x-1 bottom-0 h-5 text-[11px] tabular-nums text-muted-foreground">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(lower) }}>{r0(lower)}</span>
        {optimum !== null && (
          <span className="absolute -translate-x-1/2 font-semibold text-status-normal" style={{ left: pct(optimum) }}>
            {r0(optimum)}
          </span>
        )}
        <span className="absolute -translate-x-1/2" style={{ left: pct(upper) }}>{r0(upper)}</span>
        <span className="absolute right-0">{max}</span>
      </div>
    </div>
  );
}
