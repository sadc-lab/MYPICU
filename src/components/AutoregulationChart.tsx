import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Brush,
} from "recharts";
import {
  loadAutoregulationData,
  hasAutoregulationData,
  getOptimalPPCTimeSeries,
  getAutoregulationCurveData,
  isNirsBasedPatient,
} from "@/services/autoregulation.service";
import {
  loadNirsSamples,
  buildNirsAutoregulationCurve,
  getCurrentNirsValues,
  getNirsTimeSeriesWithDynamicLimits,
} from "@/services/nirsAutoregulation.service";
import {
  runAnalysis,
  rollingOptimal,
  type AutoregResult,
  type OptimalTimePoint,
} from "@/services/autoregComputation.service";
import {
  AutoregCurveCard,
  AutoregKpiRow,
  InterpretationBanner,
  QualityPanel,
} from "@/components/autoreg/AutoregResultViews";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useYAxisZoom } from "@/hooks/useYAxisZoom";
import { useSharedTimeWindow } from "@/hooks/useSharedTimeWindow";
import { ChartZoomControls } from "@/components/ChartZoomControls";
import { BRUSH_TOUCH_WIDTH, renderWideTouchTraveller } from "@/lib/chartBrushTraveller";

interface AutoregulationChartProps {
  patientId: string;
  currentPPC?: number | null;
  currentPAM?: number | null;
  pamMin?: number | null;
  pamMax?: number | null;
  windowMinutes?: number;
  /** Global time range from page - syncs with chart selector */
  timeRange?: TimeWindowValue;
  /** Callback when time range changes - syncs back to page */
  onTimeRangeChange?: (value: TimeWindowValue) => void;
  /** Optional props for footer display */
  optimalPPC?: number | null;
  lowerLimit?: number | null;
  upperLimit?: number | null;
  hasData?: boolean;
  isNirsBased?: boolean;
}

// Time series data point for the chart
interface TimeSeriesPoint {
  timestamp: string;
  time: number;
  ppc: number | null;
  pam: number | null;
  lowerLimit: number | null;  // LLA - varies over time
  upperLimit: number | null;  // ULA - varies over time
}

import { TimeWindowSelector, TimeWindowValue, timeWindowToHours, hoursToTimeWindow } from "@/components/ui/TimeWindowSelector";

export function AutoregulationChart({
  patientId,
  currentPPC,
  currentPAM: propCurrentPAM,
  pamMin: propPamMin,
  pamMax: propPamMax,
  windowMinutes = 30,
  timeRange: externalTimeRange,
  onTimeRangeChange,
  optimalPPC: propOptimalPPC,
  lowerLimit: propLowerLimit,
  upperLimit: propUpperLimit,
  hasData: propHasData,
  isNirsBased: propIsNirsBased,
}: AutoregulationChartProps) {
  const [loading, setLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [optimalValue, setOptimalValue] = useState<number | null>(null);
  const [lowerLimit, setLowerLimit] = useState<number | null>(null);
  const [internalWindow, setInternalWindow] = useState<TimeWindowValue>("24h");
  const [upperLimit, setUpperLimit] = useState<number | null>(null);
  const [isNirsBased, setIsNirsBased] = useState(false);
  
  // Use external timeRange if provided, otherwise use internal state
  // Filter out "stay" as it's not supported for autoregulation chart
  const selectedWindow: TimeWindowValue = externalTimeRange && externalTimeRange !== "stay" 
    ? externalTimeRange 
    : internalWindow;
  
  const handleWindowChange = (value: TimeWindowValue) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(value);
    } else {
      setInternalWindow(value);
    }
  };
  
  // NIRS-specific state
  const [nirsCurrentPAM, setNirsCurrentPAM] = useState<number | null>(null);
  const [nirsPamMin, setNirsPamMin] = useState<number | null>(null);
  const [nirsPamMax, setNirsPamMax] = useState<number | null>(null);

  // Full analysis from the shared engine, so this dashboard view can render the
  // same interpretation banner, KPI tiles, quality panel and U-curve as the study
  // page instead of a second, differently-worded presentation of the same data.
  const [analysis, setAnalysis] = useState<AutoregResult | null>(null);
  const [rolling, setRolling] = useState<OptimalTimePoint[]>([]);

  const hasAutoData = hasAutoregulationData(patientId);
  
  // Use NIRS values if available, otherwise use props
  const currentPAM = isNirsBased && nirsCurrentPAM !== null ? nirsCurrentPAM : propCurrentPAM;
  const pamMin = isNirsBased && nirsPamMin !== null ? nirsPamMin : propPamMin;
  const pamMax = isNirsBased && nirsPamMax !== null ? nirsPamMax : propPamMax;
  
  // Use props for footer values if provided, otherwise use local state
  const displayOptimalPPC = propOptimalPPC ?? optimalValue;
  const displayLowerLimit = propLowerLimit ?? lowerLimit;
  const displayUpperLimit = propUpperLimit ?? upperLimit;
  const displayIsNirsBased = propIsNirsBased ?? isNirsBased;

  useEffect(() => {
    if (!hasAutoData) {
      setTimeSeriesData([]);
      setAnalysis(null);
      setRolling([]);
      return;
    }

    const isNirs = isNirsBasedPatient(patientId);
    setIsNirsBased(isNirs);
    setLoading(true);
    // Cleared up front: a stale analysis from the previous patient must never
    // remain on screen while the new one loads.
    setAnalysis(null);
    setRolling([]);

    if (isNirs) {
      // Load NIRS-based autoregulation data with dynamic limits.
      // `windowMinutes` is not passed on: the COx window is expressed in samples
      // and fixed to the study page's value, so both screens agree. That prop
      // still selects the PRx column width on the invasive path below.
      loadNirsSamples(patientId)
        .then((samples) => {
          if (samples && samples.length > 0) {
            // Get autoregulation curve for overall values
            const curveResult = buildNirsAutoregulationCurve(samples);
            setOptimalValue(curveResult.optimalPAM);
            setLowerLimit(curveResult.lowerLimit);
            setUpperLimit(curveResult.upperLimit);

            // Same call the study page makes, for the shared result views.
            const fullAnalysis = runAnalysis(samples, 30, 5);
            setAnalysis(fullAnalysis);
            setRolling(
              rollingOptimal(
                fullAnalysis.samples,
                Math.min(240, Math.floor(fullAnalysis.samples.length / 3)),
                30,
                5,
                fullAnalysis.mode,
              ),
            );

            // Get current values from the measured rSO₂/PAM pairs
            const currentValues = getCurrentNirsValues(
              samples
                .filter((s) => s.nirs !== null && s.pam !== null)
                .map((s) => ({ timestamp: s.time.toISOString(), nirs: s.nirs, pam: s.pam })),
            );
            setNirsCurrentPAM(currentValues.currentPAM);
            setNirsPamMin(currentValues.pamMin);
            setNirsPamMax(currentValues.pamMax);

            // Get time series with DYNAMIC LLA/ULA limits
            const hours = timeWindowToHours(selectedWindow) || 6;
            const dynamicTimeSeries = getNirsTimeSeriesWithDynamicLimits(
              samples,
              undefined,
              4, // lookback hours for limit calculation
              hours // output hours
            );
            
            const timeSeries: TimeSeriesPoint[] = dynamicTimeSeries.map((point) => ({
              timestamp: point.timestamp,
              time: point.time,
              ppc: point.nirs, // Use NIRS as PPC equivalent for display
              pam: point.pam,
              lowerLimit: point.lowerLimit, // Dynamic LLA
              upperLimit: point.upperLimit, // Dynamic ULA
            }));
            
            setTimeSeriesData(timeSeries);
          }
        })
        .catch((err) => {
          console.error("Failed to load NIRS autoregulation data:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // Load PRx-based autoregulation data
      loadAutoregulationData(patientId)
        .then((data) => {
          if (data) {
            // Get curve data for limits
            const curveResult = getAutoregulationCurveData(data, windowMinutes, 5);
            setOptimalValue(curveResult.optimalPPC);
            setLowerLimit(curveResult.lowerLimit);
            setUpperLimit(curveResult.upperLimit);
            
            // Get time series with time-varying LLA/ULA
            const hours = timeWindowToHours(selectedWindow) || 6;
            const timeSeriesRaw = getOptimalPPCTimeSeries(data, windowMinutes, 4, hours);
            const timeSeries: TimeSeriesPoint[] = timeSeriesRaw.map((point) => ({
              timestamp: point.horodate,
              time: new Date(point.horodate).getTime(),
              ppc: point.ppc,
              pam: point.pam,
              lowerLimit: point.lowerLimit,  // Time-varying LLA
              upperLimit: point.upperLimit,  // Time-varying ULA
            }));
            
            setTimeSeriesData(timeSeries);
          }
        })
        .catch((err) => {
          console.error("Failed to load autoregulation data:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [patientId, windowMinutes, selectedWindow, hasAutoData]);

  // Labels based on data type
  const targetLabel = isNirsBased ? "PAM optimale" : "PPC Optimale";

  // Sélection d'une plage de temps par glisser-déposer (Brush), partagée
  // avec les autres graphiques du module quand un ChartTimeRangeProvider
  // les entoure. L'échelle Y se recalcule sur cette plage visible plutôt
  // que sur tout l'historique.
  const { visibleData, startIndex, endIndex, onBrushChange, isRangeSelected, resetRange } =
    useSharedTimeWindow(timeSeriesData, (d) => d.time);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate Y axis domain - includes time-varying limits, from the visible range only
  const autoYDomain = useMemo((): [number, number] => {
    if (visibleData.length === 0) {
      return [40, 80];
    }

    const allValues: number[] = [];

    for (const d of visibleData) {
      if (d.ppc !== null) allValues.push(d.ppc);
      if (d.pam !== null) allValues.push(d.pam);
      if (d.lowerLimit !== null) allValues.push(d.lowerLimit);
      if (d.upperLimit !== null) allValues.push(d.upperLimit);
    }

    if (allValues.length === 0) return [40, 80];

    const minDomain = Math.min(...allValues);
    const maxDomain = Math.max(...allValues);

    return [
      Math.floor(minDomain / 5) * 5 - 5,
      Math.ceil(maxDomain / 5) * 5 + 5,
    ];
  }, [visibleData]);

  const zoom = useYAxisZoom(autoYDomain);
  const { yDomain } = zoom;

  // Résumé de la zone sélectionnée — première étape avant de pouvoir poser
  // une question précise sur cette zone : au moins voir ce qu'elle contient.
  const selectionSummary = useMemo(() => {
    if (!isRangeSelected || visibleData.length === 0) return null;
    const ppcValues = visibleData.map((d) => d.ppc).filter((v): v is number => v !== null);
    const pamValues = visibleData.map((d) => d.pam).filter((v): v is number => v !== null);
    const inZoneCount = visibleData.filter(
      (d) => d.ppc !== null && d.lowerLimit !== null && d.upperLimit !== null && d.ppc >= d.lowerLimit && d.ppc <= d.upperLimit,
    ).length;
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    return {
      from: format(new Date(visibleData[0].time), "HH:mm", { locale: fr }),
      to: format(new Date(visibleData[visibleData.length - 1].time), "HH:mm", { locale: fr }),
      avgPpc: avg(ppcValues),
      avgPam: avg(pamValues),
      pctInZone: ppcValues.length ? Math.round((inZoneCount / visibleData.length) * 100) : null,
    };
  }, [isRangeSelected, visibleData]);

  // Format X axis time
  const formatXAxis = (time: number) => {
    return format(new Date(time), "HH:mm", { locale: fr });
  };

  if (!hasAutoData) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>Pas de données d'autorégulation disponibles pour ce patient</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (timeSeriesData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>Données insuffisantes pour construire le graphique d'autorégulation</p>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg min-w-[180px]">
          <p className="text-[11px] text-muted-foreground mb-1.5 border-b border-border pb-1.5">
            {format(new Date(data.timestamp), "dd/MM HH:mm", { locale: fr })}
          </p>
          <div className="space-y-1">
            {data.ppc !== null && (
              <div className="flex justify-between items-center gap-3 text-[11px]">
                <span className="text-muted-foreground">{isNirsBased ? "NIRS" : "PPC"} :</span>
                <span className="font-medium text-status-critical">
                  {Math.round(data.ppc)} {isNirsBased ? "%" : "mmHg"}
                </span>
              </div>
            )}
            {data.pam !== null && (
              <div className="flex justify-between items-center gap-3 text-[11px]">
                <span className="text-muted-foreground">PAM :</span>
                <span className="font-medium text-foreground">{Math.round(data.pam)} mmHg</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">

      {/* Shared with the study page: same verdict, same KPI tiles, same quality
          readout, same U-curve. Only available when a full analysis could be
          computed from the raw signal (COx path). */}
      {analysis && (
        <div className="space-y-4">
          <InterpretationBanner result={analysis} rolling={rolling} />
          <AutoregKpiRow result={analysis} rolling={rolling} />
          <QualityPanel result={analysis} />
          <AutoregCurveCard result={analysis} height={260} />
        </div>
      )}

      {/* Main Time Series Chart */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {selectionSummary ? (
          <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
            <span className="font-medium text-foreground">
              {selectionSummary.from} – {selectionSummary.to}
            </span>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">
              {isNirsBased ? "NIRS" : "PPC"} moy. <span className="font-medium text-foreground">{selectionSummary.avgPpc ?? "--"}</span>
            </span>
            <span className="text-muted-foreground">
              PAM moy. <span className="font-medium text-foreground">{selectionSummary.avgPam ?? "--"}</span>
            </span>
            {selectionSummary.pctInZone !== null && (
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{selectionSummary.pctInZone}%</span> dans la zone
              </span>
            )}
            <button
              type="button"
              onClick={resetRange}
              title="Effacer la sélection"
              aria-label="Effacer la sélection"
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        ) : isEditing ? (
          <p className="text-[11px] text-muted-foreground italic">
            Glissez sur l'axe du temps ci-dessous pour sélectionner une période précise.
          </p>
        ) : (
          <span />
        )}
        <ChartZoomControls zoom={zoom} isEditing={isEditing} onToggleEditing={() => setIsEditing((v) => !v)} />
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="optimalZoneGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--status-normal))" stopOpacity={0.2} />
                <stop offset="50%" stopColor="hsl(var(--status-normal))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--status-normal))" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11 }}
              className="fill-foreground"
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11 }}
              className="fill-foreground"
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value) => `${value}`}
              width={40}
            />
            
            <Tooltip content={<CustomTooltip />} />

            {/* Dynamic shaded zone between LLA and ULA */}
            <Area
              type="monotone"
              dataKey="upperLimit"
              stroke="none"
              fill="url(#optimalZoneGradient)"
              fillOpacity={1}
              connectNulls
              name="Zone optimale"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lowerLimit"
              stroke="none"
              fill="hsl(var(--background))"
              fillOpacity={1}
              connectNulls
              isAnimationActive={false}
            />

            {/* Dynamic LLA line - varies over time */}
            <Line
              type="monotone"
              dataKey="lowerLimit"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              name="LLA"
            />

            {/* Dynamic ULA line - varies over time */}
            <Line
              type="monotone"
              dataKey="upperLimit"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              name="ULA"
            />

            {/* PAM Line - Secondary data */}
            <Line
              type="monotone"
              dataKey="pam"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              name="PAM"
            />

            {/* PPC/NIRS Line - Main data */}
            <Line
              type="monotone"
              dataKey="ppc"
              stroke="hsl(var(--status-critical))"
              strokeWidth={2}
              dot={false}
              connectNulls
              name={isNirsBased ? "NIRS" : "PPC"}
            />

            {/* Sélection d'une plage de temps par glisser-déposer — visible
                seulement en mode édition (icône crayon) */}
            {isEditing && (
              <Brush
                dataKey="time"
                height={24}
                stroke="hsl(var(--primary))"
                travellerWidth={BRUSH_TOUCH_WIDTH}
                traveller={renderWideTouchTraveller}
                tickFormatter={formatXAxis}
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={onBrushChange}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics Footer - Status and Results */}
      {(displayOptimalPPC !== undefined || displayLowerLimit !== undefined) && (
        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {/* Statut PAM */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Statut :</span>
              <span className={`font-semibold ${
                currentPAM !== null && displayLowerLimit !== null && displayUpperLimit !== null
                  ? currentPAM >= displayLowerLimit && currentPAM <= displayUpperLimit
                    ? "text-status-normal"
                    : currentPAM < displayLowerLimit
                      ? "text-status-critical"
                      : "text-status-warning"
                  : "text-muted-foreground"
              }`}>
                {currentPAM !== null && displayLowerLimit !== null && displayUpperLimit !== null
                  ? currentPAM >= displayLowerLimit && currentPAM <= displayUpperLimit
                    ? "✓ Dans la zone"
                    : currentPAM < displayLowerLimit
                      ? "↓ Sous LLA"
                      : "↑ Au-dessus ULA"
                  : "--"}
              </span>
            </div>
            <span className="text-border">|</span>
            {/* PAM/PPC actuelle */}
            <div>
              <span className="text-muted-foreground">{displayIsNirsBased ? "PAM" : "PPC"} actuelle :</span>{" "}
              <span className="font-semibold text-foreground">
                {displayIsNirsBased 
                  ? (currentPAM !== null ? `${Math.round(currentPAM)} mmHg` : "--")
                  : (currentPPC !== null ? `${Math.round(currentPPC)} mmHg` : "--")
                }
              </span>
            </div>
            <span className="text-border">|</span>
            {/* PAM/PPC optimale */}
            <div>
              <span className="text-muted-foreground">{displayIsNirsBased ? "PAM" : "PPC"} optimale :</span>{" "}
              <span className="font-semibold text-foreground">
                {displayOptimalPPC !== null 
                  ? `${Math.round(displayOptimalPPC)} mmHg`
                  : "--"
                }
              </span>
            </div>
            <span className="text-border">|</span>
            {/* Zone */}
            <div>
              <span className="text-muted-foreground">Zone :</span>{" "}
              <span className="font-semibold text-foreground">
                {displayLowerLimit !== null && displayUpperLimit !== null
                  ? `${Math.round(displayLowerLimit)} - ${Math.round(displayUpperLimit)} mmHg`
                  : displayIsNirsBased ? "--" : "60 - 70 mmHg"
                }
              </span>
            </div>
          </div>
        </div>
      )}


      {/* Legend - at the bottom */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-status-critical" />
          <span>{displayIsNirsBased ? "NIRS" : "PPC"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-muted-foreground" />
          <span>PAM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-dashed border-t-2 border-muted-foreground" style={{ borderStyle: 'dashed' }} />
          <span>Limites (LLA/ULA)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-status-normal/20 border border-status-normal/40" />
          <span>Zone optimale</span>
        </div>
      </div>
    </div>
  );
}