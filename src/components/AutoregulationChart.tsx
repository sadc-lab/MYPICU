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
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
      return;
    }

    const isNirs = isNirsBasedPatient(patientId);
    setIsNirsBased(isNirs);
    setLoading(true);

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

  // Calculate Y axis domain - includes time-varying limits
  const yDomain = useMemo(() => {
    if (timeSeriesData.length === 0) {
      return [40, 80];
    }

    const allValues: number[] = [];
    
    for (const d of timeSeriesData) {
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
  }, [timeSeriesData]);

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

      {/* Main Time Series Chart */}
      <div className="h-56 w-full">
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