import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { TimeWindowValue, timeWindowToHours } from "@/components/ui/TimeWindowSelector";
import {
  loadPatientFileData,
  hasPatientFileData,
  getTimeSeriesForRange,
  PatientFileData,
} from "@/services/patientFileData.service";

// Neurological state types
type NeuroState = "controlled" | "htic" | "htic_ischemia";

interface NeuroEvent {
  timestamp: number;
  state: NeuroState;
}

interface ChartDataPoint {
  time: number;
  timestamp: string;
  pic: number | null;
  pam: number | null;
  neuroState: NeuroState | null;
  isTransition: boolean;
}

interface UnifiedBrainChartProps {
  patientId: string;
  timeRange: TimeWindowValue;
  currentPIC?: number | null;
  currentPAM?: number | null;
  optimalPAM?: number | null;
  lowerLimit?: number | null;
  upperLimit?: number | null;
}

// Custom shape for neurological state transitions
const NeuroTransitionShape = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload?.isTransition || !cx || !cy) return null;
  
  const state = payload.neuroState;
  const size = 8;
  
  // Colors based on state
  const colors: Record<NeuroState, string> = {
    controlled: "hsl(var(--muted-foreground))",
    htic: "hsl(var(--status-warning))",
    htic_ischemia: "hsl(var(--status-critical))",
  };
  
  const color = colors[state as NeuroState] || colors.controlled;
  
  if (state === "htic") {
    // Triangle for HTIC
    return (
      <polygon
        points={`${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  } else if (state === "htic_ischemia") {
    // X/Cross for HTIC with ischemia
    return (
      <g>
        <line
          x1={cx - size}
          y1={cy - size}
          x2={cx + size}
          y2={cy + size}
          stroke={color}
          strokeWidth={3}
        />
        <line
          x1={cx + size}
          y1={cy - size}
          x2={cx - size}
          y2={cy + size}
          stroke={color}
          strokeWidth={3}
        />
      </g>
    );
  } else {
    // Circle for Controlled
    return (
      <circle
        cx={cx}
        cy={cy}
        r={size}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    );
  }
};

export function UnifiedBrainChart({
  patientId,
  timeRange,
  currentPIC,
  currentPAM,
  optimalPAM,
  lowerLimit,
  upperLimit,
}: UnifiedBrainChartProps) {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [neuroZones, setNeuroZones] = useState<{ start: number; end: number; state: NeuroState }[]>([]);
  const [patientData, setPatientData] = useState<PatientFileData | null>(null);

  const hasData = hasPatientFileData(patientId);

  useEffect(() => {
    if (!hasData) {
      setChartData([]);
      return;
    }

    setLoading(true);
    loadPatientFileData(patientId)
      .then((data) => {
        if (data) {
          setPatientData(data);
          
          // Get time series data for the selected range
          const hours = timeWindowToHours(timeRange) || 24;
          const picSeries = getTimeSeriesForRange(data, "Variable_PIC", hours);
          const pamSeries = getTimeSeriesForRange(data, "Variable_PAM", hours);
          
          // Merge PIC and PAM data by timestamp
          const timeMap = new Map<number, ChartDataPoint>();
          
          for (const point of picSeries) {
            const time = new Date(point.charttime).getTime();
            timeMap.set(time, {
              time,
              timestamp: point.charttime,
              pic: point.valeur,
              pam: null,
              neuroState: null,
              isTransition: false,
            });
          }
          
          for (const point of pamSeries) {
            const time = new Date(point.charttime).getTime();
            const existing = timeMap.get(time);
            if (existing) {
              existing.pam = point.valeur;
            } else {
              timeMap.set(time, {
                time,
                timestamp: point.charttime,
                pic: null,
                pam: point.valeur,
                neuroState: null,
                isTransition: false,
              });
            }
          }
          
          // Sort by time
          const sortedData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
          
          // Generate simulated neurological states based on PIC values
          // In real implementation, this would come from actual data
          const neuroEvents: NeuroEvent[] = [];
          let currentState: NeuroState = "controlled";
          
          for (const point of sortedData) {
            if (point.pic !== null) {
              let newState: NeuroState = "controlled";
              if (point.pic >= 25) {
                newState = "htic_ischemia";
              } else if (point.pic >= 20) {
                newState = "htic";
              }
              
              if (newState !== currentState) {
                neuroEvents.push({ timestamp: point.time, state: newState });
                point.neuroState = newState;
                point.isTransition = true;
                currentState = newState;
              } else {
                point.neuroState = currentState;
              }
            }
          }
          
          // Build neuro zones for background coloring
          const zones: { start: number; end: number; state: NeuroState }[] = [];
          if (sortedData.length > 0 && neuroEvents.length > 0) {
            let zoneStart = sortedData[0].time;
            let zoneState: NeuroState = "controlled";
            
            for (const event of neuroEvents) {
              if (event.timestamp > zoneStart) {
                zones.push({ start: zoneStart, end: event.timestamp, state: zoneState });
              }
              zoneStart = event.timestamp;
              zoneState = event.state;
            }
            
            // Add final zone
            if (sortedData.length > 0) {
              zones.push({ start: zoneStart, end: sortedData[sortedData.length - 1].time, state: zoneState });
            }
          } else if (sortedData.length > 0) {
            // No transitions, single zone
            zones.push({
              start: sortedData[0].time,
              end: sortedData[sortedData.length - 1].time,
              state: "controlled",
            });
          }
          
          setNeuroZones(zones);
          setChartData(sortedData);
        }
      })
      .catch((err) => {
        console.error("Failed to load patient data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [patientId, timeRange, hasData]);

  // Calculate Y axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const allValues: number[] = [];
    for (const d of chartData) {
      if (d.pic !== null) allValues.push(d.pic);
      if (d.pam !== null) allValues.push(d.pam);
    }
    
    if (lowerLimit) allValues.push(lowerLimit);
    if (upperLimit) allValues.push(upperLimit);

    if (allValues.length === 0) return [0, 100];

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);

    return [
      Math.floor(minVal / 10) * 10 - 10,
      Math.ceil(maxVal / 10) * 10 + 10,
    ];
  }, [chartData, lowerLimit, upperLimit]);

  // Format X axis time
  const formatXAxis = (time: number) => {
    return format(new Date(time), "HH:mm", { locale: fr });
  };

  // Get zone color
  const getZoneColor = (state: NeuroState) => {
    switch (state) {
      case "htic_ischemia":
        return "hsl(var(--status-critical) / 0.15)";
      case "htic":
        return "hsl(var(--status-warning) / 0.15)";
      default:
        return "hsl(var(--muted) / 0.3)";
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const stateLabels: Record<NeuroState, string> = {
        controlled: "Contrôlé",
        htic: "HTIC",
        htic_ischemia: "HTIC + Ischémie",
      };
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-2">
            {format(new Date(data.timestamp), "dd/MM HH:mm", { locale: fr })}
          </p>
          {data.pic !== null && (
            <p className="font-medium text-status-warning">
              PIC: {Math.round(data.pic)} mmHg
            </p>
          )}
          {data.pam !== null && (
            <p className="font-medium text-status-critical">
              PAM: {Math.round(data.pam)} mmHg
            </p>
          )}
          {data.neuroState && (
            <p className="text-sm text-muted-foreground mt-1">
              État: {stateLabels[data.neuroState as NeuroState]}
              {data.isTransition && " (transition)"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!hasData) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        <p>Pas de données disponibles pour ce patient</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        <p>Données insuffisantes pour construire le graphique</p>
      </div>
    );
  }

  // Filter data for transition markers
  const transitionData = chartData.filter(d => d.isTransition);

  return (
    <div className="space-y-4">
      {/* Main Unified Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <defs>
              <linearGradient id="optimalZoneGradientUnified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--status-normal))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--status-normal))" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            {/* Background zones for neurological states */}
            {neuroZones.map((zone, idx) => (
              <ReferenceArea
                key={idx}
                x1={zone.start}
                x2={zone.end}
                y1={yDomain[0]}
                y2={yDomain[1]}
                fill={getZoneColor(zone.state)}
                fillOpacity={1}
              />
            ))}

            {/* Optimal PAM zone if available */}
            {lowerLimit && upperLimit && (
              <ReferenceArea
                y1={lowerLimit}
                y2={upperLimit}
                fill="url(#optimalZoneGradientUnified)"
                fillOpacity={1}
              />
            )}

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
              label={{ value: "mmHg", angle: -90, position: "insideLeft", fontSize: 11 }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* LLA/ULA reference lines */}
            {lowerLimit && (
              <ReferenceLine
                y={lowerLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
            )}
            {upperLimit && (
              <ReferenceLine
                y={upperLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
            )}

            {/* PIC Line */}
            <Line
              type="monotone"
              dataKey="pic"
              stroke="hsl(var(--status-warning))"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="PIC"
            />

            {/* PAM Line */}
            <Line
              type="monotone"
              dataKey="pam"
              stroke="hsl(var(--status-critical))"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="PAM"
            />

            {/* Neurological state transition markers */}
            <Scatter
              data={transitionData}
              dataKey="pic"
              shape={<NeuroTransitionShape />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer with current values */}
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">PIC actuelle :</span>{" "}
            <span className="font-semibold text-foreground">
              {currentPIC !== null && currentPIC !== undefined ? `${Math.round(currentPIC)} mmHg` : "--"}
            </span>
          </div>
          <span className="text-border">|</span>
          <div>
            <span className="text-muted-foreground">PAM actuelle :</span>{" "}
            <span className="font-semibold text-foreground">
              {currentPAM !== null && currentPAM !== undefined ? `${Math.round(currentPAM)} mmHg` : "--"}
            </span>
          </div>
          {optimalPAM && (
            <>
              <span className="text-border">|</span>
              <div>
                <span className="text-muted-foreground">PAM optimale :</span>{" "}
                <span className="font-semibold text-foreground">{Math.round(optimalPAM)} mmHg</span>
              </div>
            </>
          )}
          {lowerLimit && upperLimit && (
            <>
              <span className="text-border">|</span>
              <div>
                <span className="text-muted-foreground">Zone :</span>{" "}
                <span className="font-semibold text-foreground">
                  {Math.round(lowerLimit)} - {Math.round(upperLimit)} mmHg
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-status-warning" />
          <span>PIC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-status-critical" />
          <span>PAM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-dashed border-t-2 border-muted-foreground" style={{ borderStyle: 'dashed' }} />
          <span>Limites (LLA/ULA)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4" fill="hsl(var(--muted-foreground))" />
          </svg>
          <span>Contrôlé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <polygon points="6,1 1,11 11,11" fill="hsl(var(--status-warning))" />
          </svg>
          <span>HTIC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="hsl(var(--status-critical))" strokeWidth="2" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="hsl(var(--status-critical))" strokeWidth="2" />
          </svg>
          <span>HTIC + Ischémie</span>
        </div>
      </div>

      {/* Interpretation */}
      <div className="text-xs text-muted-foreground">
        <p>
          <span className="font-medium">Interprétation :</span> Les{" "}
          <span className="text-status-warning font-medium">courbes orange</span> et{" "}
          <span className="text-status-critical font-medium">rouge</span> montrent l'évolution 
          de la PIC et PAM. Les zones colorées en arrière-plan indiquent l'état neurologique. 
          Les symboles marquent les changements d'état.
        </p>
      </div>
    </div>
  );
}
