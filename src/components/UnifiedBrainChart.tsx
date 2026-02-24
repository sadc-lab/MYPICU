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
  nirsReliability?: number | null;
  autoregulationScore?: number | null; // PRx or COx
  isNirsBased?: boolean;
  selectedIndicators?: string[]; // Filter which curves to show
}

// Time Distribution Bar Component
interface TimeDistributionBarProps {
  neuroZones: { start: number; end: number; state: NeuroState }[];
}

const TimeDistributionBar = ({ neuroZones }: TimeDistributionBarProps) => {
  const distribution = useMemo(() => {
    if (neuroZones.length === 0) return { 
      controlled: { percentage: 0, durationMs: 0 }, 
      htic: { percentage: 0, durationMs: 0 }, 
      htic_ischemia: { percentage: 0, durationMs: 0 }, 
      total: 0 
    };

    const totals: Record<NeuroState, number> = {
      controlled: 0,
      htic: 0,
      htic_ischemia: 0,
    };

    let totalDuration = 0;
    for (const zone of neuroZones) {
      const duration = zone.end - zone.start;
      totals[zone.state] += duration;
      totalDuration += duration;
    }

    return {
      controlled: { 
        percentage: totalDuration > 0 ? (totals.controlled / totalDuration) * 100 : 0,
        durationMs: totals.controlled,
      },
      htic: { 
        percentage: totalDuration > 0 ? (totals.htic / totalDuration) * 100 : 0,
        durationMs: totals.htic,
      },
      htic_ischemia: { 
        percentage: totalDuration > 0 ? (totals.htic_ischemia / totalDuration) * 100 : 0,
        durationMs: totals.htic_ischemia,
      },
      total: totalDuration,
    };
  }, [neuroZones]);

  // Format duration in hours and minutes
  const formatDuration = (ms: number): string => {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}min`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h${minutes.toString().padStart(2, '0')}`;
    }
  };

  if (neuroZones.length === 0) return null;

  const stateConfig: Record<NeuroState, { label: string; color: string; symbol: React.ReactNode }> = {
    controlled: {
      label: "Contrôlé",
      color: "bg-muted-foreground",
      symbol: (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="4" fill="currentColor" />
        </svg>
      ),
    },
    htic: {
      label: "HTIC",
      color: "bg-status-warning",
      symbol: (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <polygon points="5,0.5 0.5,9.5 9.5,9.5" fill="currentColor" />
        </svg>
      ),
    },
    htic_ischemia: {
      label: "HTIC + Ischémie",
      color: "bg-status-critical",
      symbol: (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
  };

  const states: NeuroState[] = ["controlled", "htic", "htic_ischemia"];

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground font-medium">Répartition du temps par état neurologique</div>
      
      {/* Horizontal stacked bar */}
      <div className="h-6 w-full flex rounded-md overflow-hidden">
        {states.map((state) => {
          const { percentage } = distribution[state];
          if (percentage === 0) return null;
          return (
            <div
              key={state}
              className={`${stateConfig[state].color} flex items-center justify-center transition-all`}
              style={{ width: `${percentage}%` }}
            >
              {percentage >= 10 && (
                <span className="text-xs font-medium text-white drop-shadow-sm">
                  {Math.round(percentage)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend with percentages and durations */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        {states.map((state) => {
          const config = stateConfig[state];
          const { percentage, durationMs } = distribution[state];
          return (
            <div key={state} className="flex items-center gap-1.5">
              <span className={`${config.color.replace('bg-', 'text-')}`}>
                {config.symbol}
              </span>
              <span className="text-foreground">{config.label}</span>
              <span className="text-muted-foreground">
                {formatDuration(durationMs)} ({Math.round(percentage)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


const NeuroTransitionShape = (props: any) => {
  const { cx, payload } = props;
  if (!payload?.isTransition || !cx) return null;
  
  const state = payload.neuroState;
  
  // Colors based on state
  const colors: Record<NeuroState, string> = {
    controlled: "hsl(var(--muted-foreground))",
    htic: "hsl(var(--status-warning))",
    htic_ischemia: "hsl(var(--status-critical))",
  };
  
  const color = colors[state as NeuroState] || colors.controlled;
  
  // Render a vertical line spanning the chart height
  return (
    <line
      x1={cx}
      y1={0}
      x2={cx}
      y2={1000}
      stroke={color}
      strokeWidth={2}
      strokeDasharray="4 2"
    />
  );
};

export function UnifiedBrainChart({
  patientId,
  timeRange,
  currentPIC,
  currentPAM,
  optimalPAM,
  lowerLimit,
  upperLimit,
  nirsReliability,
  autoregulationScore,
  isNirsBased,
  selectedIndicators,
}: UnifiedBrainChartProps) {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [neuroZones, setNeuroZones] = useState<{ start: number; end: number; state: NeuroState }[]>([]);
  const [patientData, setPatientData] = useState<PatientFileData | null>(null);

  const hasData = hasPatientFileData(patientId);
  
  // Determine which elements to show based on selectedIndicators
  // If selectedIndicators is undefined or empty, show all
  const showAll = !selectedIndicators || selectedIndicators.length === 0;
  const showNeuro = showAll || selectedIndicators.includes("État Neuro");
  const showPIC = showAll || selectedIndicators.includes("PIC");
  const showPAM = showAll || selectedIndicators.includes("PAM Opt") || selectedIndicators.includes("PPC Opt");

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
          
          // Load PPC data for ischemia detection
          const ppcSeries = getTimeSeriesForRange(data, "Variable_PPC", hours);
          const ppcByTime = new Map<number, number>();
          for (const p of ppcSeries) {
            ppcByTime.set(new Date(p.charttime).getTime(), p.valeur);
          }

          // Determine neurological states from PIC + PPC values
          const neuroEvents: NeuroEvent[] = [];
          let currentState: NeuroState = "controlled";
          
          for (const point of sortedData) {
            const pic = point.pic;

            // Find closest PPC value (within 30 min)
            let closestPpc: number | null = null;
            if (ppcByTime.size > 0) {
              let minDiff = 30 * 60 * 1000;
              for (const [ppcTime, ppcVal] of ppcByTime) {
                const diff = Math.abs(ppcTime - point.time);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestPpc = ppcVal;
                }
              }
            }

            // Clinical classification:
            // PIC ≥ 20 → HTIC
            // PPC < 50 → Ischemia  
            // Both → HTIC + Ischemia
            // PIC ≥ 25 used as proxy for ischemia when PPC unavailable
            let newState: NeuroState = "controlled";
            const isHtic = pic !== null && pic >= 20;
            const isIschemia = closestPpc !== null ? closestPpc < 50 : (pic !== null && pic >= 25);
            
            if (isHtic && isIschemia) {
              newState = "htic_ischemia";
            } else if (isHtic) {
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

      const stateColors: Record<NeuroState, string> = {
        controlled: "text-muted-foreground",
        htic: "text-status-warning",
        htic_ischemia: "text-status-critical",
      };
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[180px]">
          <p className="text-xs text-muted-foreground mb-2 border-b border-border pb-2">
            {format(new Date(data.timestamp), "dd/MM HH:mm", { locale: fr })}
          </p>
          
          {/* Neurological State */}
          {data.neuroState && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">État :</span>
              <span className={`text-sm font-medium ${stateColors[data.neuroState as NeuroState]}`}>
                {stateLabels[data.neuroState as NeuroState]}
              </span>
            </div>
          )}
          
          {/* PIC */}
          {data.pic !== null && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">PIC :</span>
              <span className="text-sm font-medium text-status-warning">
                {Math.round(data.pic)} mmHg
              </span>
            </div>
          )}
          
          {/* PAM Optimale */}
          {optimalPAM !== null && optimalPAM !== undefined && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">PAM Opt :</span>
              <span className="text-sm font-medium text-status-normal">
                {Math.round(optimalPAM)} mmHg
              </span>
            </div>
          )}
          
          {/* NIRS Reliability */}
          {nirsReliability !== null && nirsReliability !== undefined && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Fiabilité NIRS :</span>
              <span className={`text-sm font-medium ${nirsReliability >= 70 ? 'text-status-normal' : nirsReliability >= 50 ? 'text-status-warning' : 'text-status-critical'}`}>
                {Math.round(nirsReliability)}%
              </span>
            </div>
          )}
          
          {/* Autoregulation Score (PRx or COx) */}
          {autoregulationScore !== null && autoregulationScore !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {isNirsBased ? "COx :" : "PRx :"}
              </span>
              <span className={`text-sm font-medium ${autoregulationScore < 0.3 ? 'text-status-normal' : autoregulationScore < 0.5 ? 'text-status-warning' : 'text-status-critical'}`}>
                {autoregulationScore.toFixed(2)}
              </span>
            </div>
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
            {showNeuro && neuroZones.map((zone, idx) => (
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
            {showPAM && lowerLimit && upperLimit && (
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
            {showPAM && lowerLimit && (
              <ReferenceLine
                y={lowerLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
            )}
            {showPAM && upperLimit && (
              <ReferenceLine
                y={upperLimit}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
            )}

            {/* PIC Scatter (dots only) */}
            {showPIC && (
              <Scatter
                data={chartData.filter(d => d.pic !== null)}
                dataKey="pic"
                fill="hsl(var(--status-warning))"
                name="PIC"
                isAnimationActive={false}
                shape={(props: any) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill="hsl(var(--status-warning))"
                  />
                )}
              />
            )}

            {/* PAM Line */}
            {showPAM && (
              <Line
                type="monotone"
                dataKey="pam"
                stroke="hsl(var(--status-critical))"
                strokeWidth={2}
                dot={false}
                connectNulls
                name="PAM"
              />
            )}

            {/* Neurological state transition markers */}
            {showNeuro && (
              <Scatter
                data={transitionData}
                dataKey="pic"
                shape={<NeuroTransitionShape />}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer with current values */}
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {showPIC && (
            <>
              <div>
                <span className="text-muted-foreground">PIC actuelle :</span>{" "}
                <span className="font-semibold text-foreground">
                  {currentPIC !== null && currentPIC !== undefined ? `${Math.round(currentPIC)} mmHg` : "--"}
                </span>
              </div>
              {showPAM && <span className="text-border">|</span>}
            </>
          )}
          {showPAM && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Time Distribution Bar - only show when neuro states are visible */}
      {showNeuro && <TimeDistributionBar neuroZones={neuroZones} />}

      {/* Interpretation - adapt based on what's shown */}
      <div className="text-xs text-muted-foreground">
        <p>
          <span className="font-medium">Interprétation :</span>{" "}
          {showPIC && <><span className="text-status-warning font-medium">Les points orange</span> montrent l'évolution de la PIC. </>}
          {showPAM && <><span className="text-status-critical font-medium">La courbe rouge</span> montre l'évolution de la PAM. </>}
          {showNeuro && <>Les zones colorées en arrière-plan indiquent l'état neurologique. Les lignes verticales marquent les changements d'état.</>}
        </p>
      </div>
    </div>
  );
}
