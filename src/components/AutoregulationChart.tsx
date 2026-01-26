import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  loadAutoregulationData,
  hasAutoregulationData,
  getOptimalPPCTimeSeries,
  getAutoregulationCurveData,
  isNirsBasedPatient,
} from "@/services/autoregulation.service";
import {
  loadNirsData,
  buildNirsAutoregulationCurve,
  getCurrentNirsValues,
  NirsDataPoint,
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
}

// Time series data point for the chart
interface TimeSeriesPoint {
  timestamp: string;
  time: number;
  ppc: number | null;
  pam: number | null;
}

// Available time windows
const TIME_WINDOWS = [
  { value: 3, label: "3h" },
  { value: 6, label: "6h" },
  { value: 12, label: "12h" },
  { value: 24, label: "24h" },
];

export function AutoregulationChart({
  patientId,
  currentPPC,
  currentPAM: propCurrentPAM,
  pamMin: propPamMin,
  pamMax: propPamMax,
  windowMinutes = 30,
}: AutoregulationChartProps) {
  const [loading, setLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [optimalValue, setOptimalValue] = useState<number | null>(null);
  const [lowerLimit, setLowerLimit] = useState<number | null>(null);
  const [selectedHours, setSelectedHours] = useState(6);
  const [upperLimit, setUpperLimit] = useState<number | null>(null);
  const [isNirsBased, setIsNirsBased] = useState(false);
  
  // NIRS-specific state
  const [nirsCurrentPAM, setNirsCurrentPAM] = useState<number | null>(null);
  const [nirsPamMin, setNirsPamMin] = useState<number | null>(null);
  const [nirsPamMax, setNirsPamMax] = useState<number | null>(null);

  const hasData = hasAutoregulationData(patientId);
  
  // Use NIRS values if available, otherwise use props
  const currentPAM = isNirsBased && nirsCurrentPAM !== null ? nirsCurrentPAM : propCurrentPAM;
  const pamMin = isNirsBased && nirsPamMin !== null ? nirsPamMin : propPamMin;
  const pamMax = isNirsBased && nirsPamMax !== null ? nirsPamMax : propPamMax;

  useEffect(() => {
    if (!hasData) {
      setTimeSeriesData([]);
      return;
    }

    const isNirs = isNirsBasedPatient(patientId);
    setIsNirsBased(isNirs);
    setLoading(true);

    if (isNirs) {
      // Load NIRS-based autoregulation data
      loadNirsData(patientId)
        .then((data) => {
          if (data && data.length > 0) {
            // Get autoregulation curve for limits
            const curveResult = buildNirsAutoregulationCurve(data, windowMinutes, 5);
            setOptimalValue(curveResult.optimalPAM);
            setLowerLimit(curveResult.lowerLimit);
            setUpperLimit(curveResult.upperLimit);
            
            // Get current values
            const currentValues = getCurrentNirsValues(data);
            setNirsCurrentPAM(currentValues.currentPAM);
            setNirsPamMin(currentValues.pamMin);
            setNirsPamMax(currentValues.pamMax);
            
            // Build time series from raw NIRS data
            const now = new Date();
            const cutoffTime = now.getTime() - selectedHours * 60 * 60 * 1000;
            
            // Find latest timestamp and calculate offset
            let latestTime = 0;
            for (const point of data) {
              const time = new Date(point.timestamp).getTime();
              if (time > latestTime) latestTime = time;
            }
            const timeOffset = now.getTime() - latestTime;
            
            const timeSeries: TimeSeriesPoint[] = data
              .filter((point: NirsDataPoint) => {
                const time = new Date(point.timestamp).getTime() + timeOffset;
                return time >= cutoffTime && point.pam !== null;
              })
              .map((point: NirsDataPoint) => {
                const originalTime = new Date(point.timestamp).getTime();
                const normalizedTime = originalTime + timeOffset;
                return {
                  timestamp: new Date(normalizedTime).toISOString(),
                  time: normalizedTime,
                  ppc: point.nirs, // Use NIRS as PPC equivalent for display
                  pam: point.pam,
                };
              })
              .sort((a: TimeSeriesPoint, b: TimeSeriesPoint) => a.time - b.time);
            
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
            
            // Get time series
            const timeSeriesRaw = getOptimalPPCTimeSeries(data, windowMinutes, 4, selectedHours);
            const timeSeries: TimeSeriesPoint[] = timeSeriesRaw.map((point) => ({
              timestamp: point.horodate,
              time: new Date(point.horodate).getTime(),
              ppc: point.ppc,
              pam: point.pam,
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
  }, [patientId, windowMinutes, selectedHours, hasData]);

  // Labels based on data type
  const targetLabel = isNirsBased ? "PAM optimale" : "PPC Optimale";

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (timeSeriesData.length === 0) {
      return [40, 80];
    }

    const ppcValues = timeSeriesData
      .map((d) => d.ppc)
      .filter((v): v is number => v !== null);
    
    if (ppcValues.length === 0) return [40, 80];

    const minVal = Math.min(...ppcValues);
    const maxVal = Math.max(...ppcValues);
    
    // Include limits in domain calculation
    const allValues = [...ppcValues];
    if (lowerLimit !== null) allValues.push(lowerLimit);
    if (upperLimit !== null) allValues.push(upperLimit);
    
    const minDomain = Math.min(...allValues);
    const maxDomain = Math.max(...allValues);

    return [
      Math.floor(minDomain / 5) * 5 - 5,
      Math.ceil(maxDomain / 5) * 5 + 5,
    ];
  }, [timeSeriesData, lowerLimit, upperLimit]);

  // Format X axis time
  const formatXAxis = (time: number) => {
    return format(new Date(time), "HH:mm", { locale: fr });
  };

  if (!hasData) {
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
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">
            {format(new Date(data.timestamp), "dd/MM HH:mm", { locale: fr })}
          </p>
          {data.ppc !== null && (
            <p className="font-medium text-status-critical">
              {isNirsBased ? "NIRS" : "PPC"}: {Math.round(data.ppc)} {isNirsBased ? "%" : "mmHg"}
            </p>
          )}
          {data.pam !== null && (
            <p className="text-sm text-muted-foreground">
              PAM: {Math.round(data.pam)} mmHg
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Time window selector and legend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Fenêtre :</span>
          <div className="flex bg-muted rounded-lg p-1">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                onClick={() => setSelectedHours(tw.value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedHours === tw.value
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-status-critical" />
            <span>{isNirsBased ? "NIRS" : "PPC"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-muted-foreground border-dashed border-t-2 border-muted-foreground" style={{ borderStyle: 'dashed' }} />
            <span>Limites (LLA/ULA)</span>
          </div>
        </div>
      </div>

      {/* Main Time Series Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
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

            {/* Optimal zone shading between LLA and ULA */}
            {lowerLimit !== null && upperLimit !== null && (
              <ReferenceArea
                y1={lowerLimit}
                y2={upperLimit}
                fill="hsl(var(--status-normal))"
                fillOpacity={0.1}
              />
            )}

            {/* Upper limit line (ULA) */}
            {upperLimit !== null && (
              <ReferenceLine
                y={upperLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            )}

            {/* Lower limit line (LLA) */}
            {lowerLimit !== null && (
              <ReferenceLine
                y={lowerLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            )}

            {/* Optimal value line */}
            {optimalValue !== null && (
              <ReferenceLine
                y={optimalValue}
                stroke="hsl(var(--status-normal))"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

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
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Y-axis label */}
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium">{isNirsBased ? "NIRS (%)" : "PPC"}</span>
        <span className="text-muted-foreground">{selectedHours} heures</span>
      </div>

      {/* Legend with limits and status indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        {/* Status indicator */}
        <div className={`rounded-lg p-3 col-span-2 sm:col-span-1 ${
          currentPAM !== null && lowerLimit !== null && upperLimit !== null
            ? currentPAM >= lowerLimit && currentPAM <= upperLimit
              ? "bg-status-normal/20 border border-status-normal"
              : currentPAM < lowerLimit
                ? "bg-status-critical/20 border border-status-critical"
                : "bg-status-warning/20 border border-status-warning"
            : "bg-muted/50"
        }`}>
          <p className="text-muted-foreground text-xs">Statut PAM</p>
          <p className={`font-semibold text-sm ${
            currentPAM !== null && lowerLimit !== null && upperLimit !== null
              ? currentPAM >= lowerLimit && currentPAM <= upperLimit
                ? "text-status-normal"
                : currentPAM < lowerLimit
                  ? "text-status-critical"
                  : "text-status-warning"
              : ""
          }`}>
            {currentPAM !== null && lowerLimit !== null && upperLimit !== null
              ? currentPAM >= lowerLimit && currentPAM <= upperLimit
                ? "✓ Dans la zone"
                : currentPAM < lowerLimit
                  ? "↓ Sous LLA"
                  : "↑ Au-dessus ULA"
              : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">{targetLabel}</p>
          <p className="font-semibold text-lg">
            {optimalValue !== null ? `${optimalValue} mmHg` : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">LLA (limite basse)</p>
          <p className="font-semibold text-lg">
            {lowerLimit !== null ? `${lowerLimit} mmHg` : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">ULA (limite haute)</p>
          <p className="font-semibold text-lg">
            {upperLimit !== null ? `${upperLimit} mmHg` : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">PAM actuelle</p>
          <p className="font-semibold text-lg">
            {currentPAM !== null ? `${Math.round(currentPAM)} mmHg` : "--"}
          </p>
        </div>
      </div>

      {/* Interpretation guide */}
      <div className="text-xs text-muted-foreground border-t border-border pt-3 space-y-1">
        <p>
          <span className="font-medium">Interprétation :</span> La{" "}
          <span className="text-status-critical font-medium">ligne rouge</span> montre l'évolution 
          de la {isNirsBased ? "NIRS" : "PPC"} au cours du temps. Les{" "}
          <span className="text-muted-foreground font-medium">lignes pointillées grises</span> représentent 
          les limites d'autorégulation (LLA/ULA).
        </p>
        <p>
          La <span className="text-status-normal font-medium">zone verte</span> représente la plage
          où l'autorégulation cérébrale est optimale.
        </p>
      </div>
    </div>
  );
}