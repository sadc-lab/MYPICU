import { useMemo, useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import {
  loadAutoregulationData,
  hasAutoregulationData,
  getAutoregulationCurveData,
  AutoregulationCurvePoint,
} from "@/services/autoregulation.service";
import { Loader2 } from "lucide-react";

interface AutoregulationChartProps {
  patientId: string;
  currentPPC?: number | null;
  currentPAM?: number | null;
  pamMin?: number | null;
  pamMax?: number | null;
  windowMinutes?: number;
}

export function AutoregulationChart({
  patientId,
  currentPPC,
  currentPAM,
  pamMin,
  pamMax,
  windowMinutes = 30,
}: AutoregulationChartProps) {
  const [loading, setLoading] = useState(false);
  const [curveData, setCurveData] = useState<AutoregulationCurvePoint[]>([]);
  const [optimalPPC, setOptimalPPC] = useState<number | null>(null);
  const [lowerLimit, setLowerLimit] = useState<number | null>(null);
  const [upperLimit, setUpperLimit] = useState<number | null>(null);
  const [minPrx, setMinPrx] = useState<number | null>(null);

  const hasData = hasAutoregulationData(patientId);

  useEffect(() => {
    if (!hasData) {
      setCurveData([]);
      return;
    }

    setLoading(true);
    loadAutoregulationData(patientId)
      .then((data) => {
        if (data) {
          const result = getAutoregulationCurveData(data, windowMinutes, 5);
          setCurveData(result.curveData);
          setOptimalPPC(result.optimalPPC);
          setLowerLimit(result.lowerLimit);
          setUpperLimit(result.upperLimit);
          setMinPrx(result.minPrx);
        }
      })
      .catch((err) => {
        console.error("Failed to load autoregulation curve data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [patientId, windowMinutes, hasData]);

  // Calculate axis domains
  const { xDomain, yDomain } = useMemo(() => {
    if (curveData.length === 0) {
      return { xDomain: [40, 100], yDomain: [-0.5, 1] };
    }

    const ppcValues = curveData.map((d) => d.ppc);
    const prxValues = curveData.map((d) => d.prx);

    const minPPC = Math.min(...ppcValues);
    const maxPPC = Math.max(...ppcValues);
    const minPRx = Math.min(...prxValues);
    const maxPRx = Math.max(...prxValues);

    return {
      xDomain: [Math.floor(minPPC / 10) * 10 - 5, Math.ceil(maxPPC / 10) * 10 + 5],
      yDomain: [Math.min(-0.5, minPRx - 0.1), Math.max(1, maxPRx + 0.1)],
    };
  }, [curveData]);

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

  if (curveData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <p>Données insuffisantes pour construire la courbe d'autorégulation</p>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">PPC: {data.ppc} mmHg</p>
          <p className="text-sm text-muted-foreground">PRx: {data.prx.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">({data.count} mesures)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              dataKey="ppc"
              domain={xDomain}
              name="PPC"
              unit=" mmHg"
              tick={{ fontSize: 11 }}
              className="fill-foreground"
              label={{
                value: "PPC (mmHg)",
                position: "bottom",
                offset: -5,
                className: "fill-muted-foreground",
              }}
            />
            <YAxis
              type="number"
              dataKey="prx"
              domain={yDomain}
              name="PRx"
              tick={{ fontSize: 11 }}
              className="fill-foreground"
              label={{
                value: "PRx",
                angle: -90,
                position: "insideLeft",
                className: "fill-muted-foreground",
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* PRx threshold line (0.3 = loss of autoregulation) */}
            <ReferenceLine
              y={0.3}
              stroke="hsl(var(--status-warning))"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: "PRx = 0.3",
                position: "right",
                className: "fill-status-warning text-xs",
              }}
            />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />

            {/* Optimal zone (LLA to ULA) */}
            {lowerLimit !== null && upperLimit !== null && (
              <ReferenceArea
                x1={lowerLimit}
                x2={upperLimit}
                fill="hsl(var(--status-normal))"
                fillOpacity={0.15}
              />
            )}

            {/* Optimal PPC line */}
            {optimalPPC !== null && (
              <ReferenceLine
                x={optimalPPC}
                stroke="hsl(var(--status-normal))"
                strokeWidth={2}
                label={{
                  value: `PPC opt: ${optimalPPC}`,
                  position: "top",
                  className: "fill-status-normal text-xs font-medium",
                }}
              />
            )}

            {/* Current PPC indicator */}
            {currentPPC !== null && (
              <ReferenceLine
                x={currentPPC}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="3 3"
                label={{
                  value: `Actuel: ${Math.round(currentPPC)}`,
                  position: "top",
                  className: "fill-primary text-xs",
                }}
              />
            )}

            {/* LLA line */}
            {lowerLimit !== null && (
              <ReferenceLine
                x={lowerLimit}
                stroke="hsl(var(--status-warning))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {/* ULA line */}
            {upperLimit !== null && (
              <ReferenceLine
                x={upperLimit}
                stroke="hsl(var(--status-warning))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {/* PRx vs PPC scatter points with connecting line */}
            <Scatter
              name="PRx vs PPC"
              data={curveData}
              fill="hsl(var(--primary))"
              line={{ stroke: "hsl(var(--primary))", strokeWidth: 2 }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* PAM Autoregulation Bar Chart */}
      <div className="mt-6">
        <h4 className="text-sm font-medium mb-3">Zone d'autorégulation - PAM</h4>
        <div className="relative h-20 bg-muted/30 rounded-lg overflow-hidden">
          {/* Background gradient showing danger zones */}
          <div className="absolute inset-0 flex">
            {/* Left danger zone (below LLA) */}
            <div 
              className="h-full bg-gradient-to-r from-status-critical/30 to-status-warning/20"
              style={{ width: `${lowerLimit !== null ? ((lowerLimit - 30) / 100) * 100 : 20}%` }}
            />
            {/* Optimal zone (LLA to ULA) */}
            <div 
              className="h-full bg-status-normal/20"
              style={{ 
                width: `${lowerLimit !== null && upperLimit !== null 
                  ? ((upperLimit - lowerLimit) / 100) * 100 
                  : 30}%` 
              }}
            />
            {/* Right danger zone (above ULA) */}
            <div 
              className="h-full bg-gradient-to-l from-status-critical/30 to-status-warning/20 flex-1"
            />
          </div>

          {/* Scale markers */}
          <div className="absolute bottom-0 left-0 right-0 h-5 flex justify-between px-2 text-[10px] text-muted-foreground">
            <span>30</span>
            <span>50</span>
            <span>70</span>
            <span>90</span>
            <span>110</span>
            <span>130</span>
          </div>

          {/* LLA marker */}
          {lowerLimit !== null && (
            <div 
              className="absolute top-0 bottom-5 w-0.5 bg-status-warning"
              style={{ left: `${((lowerLimit - 30) / 100) * 100}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-status-warning whitespace-nowrap">
                LLA: {lowerLimit}
              </span>
            </div>
          )}

          {/* ULA marker */}
          {upperLimit !== null && (
            <div 
              className="absolute top-0 bottom-5 w-0.5 bg-status-warning"
              style={{ left: `${((upperLimit - 30) / 100) * 100}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-status-warning whitespace-nowrap">
                ULA: {upperLimit}
              </span>
            </div>
          )}

          {/* Target PAM marker (optimal PPC = target PAM for brain perfusion) */}
          {optimalPPC !== null && (
            <div 
              className="absolute top-2 bottom-5 w-1 bg-status-normal rounded"
              style={{ left: `${((optimalPPC - 30) / 100) * 100}%` }}
            >
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-status-normal font-medium whitespace-nowrap">
                Cible: {optimalPPC}
              </span>
            </div>
          )}

          {/* PAM min-max range bar */}
          {pamMin !== null && pamMax !== null && (
            <div 
              className="absolute top-6 h-3 bg-primary/40 rounded"
              style={{ 
                left: `${((pamMin - 30) / 100) * 100}%`,
                width: `${((pamMax - pamMin) / 100) * 100}%`
              }}
            />
          )}

          {/* Current PAM marker */}
          {currentPAM !== null && (
            <div 
              className="absolute top-4 bottom-5 w-1.5 bg-primary rounded shadow-lg"
              style={{ left: `${((currentPAM - 30) / 100) * 100}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                PAM: {Math.round(currentPAM)}
              </div>
            </div>
          )}
        </div>

        {/* PAM Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary rounded" />
            <span>PAM actuelle{currentPAM !== null ? `: ${Math.round(currentPAM)} mmHg` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary/40 rounded" />
            <span>Plage PAM 24h{pamMin !== null && pamMax !== null ? `: ${Math.round(pamMin)}-${Math.round(pamMax)} mmHg` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-status-normal rounded" />
            <span>PAM cible{optimalPPC !== null ? `: ${optimalPPC} mmHg` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-status-normal/20 border border-status-normal rounded" />
            <span>Zone optimale{lowerLimit !== null && upperLimit !== null ? `: ${lowerLimit}-${upperLimit} mmHg` : ""}</span>
          </div>
        </div>
      </div>

      {/* Legend and metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">PPC Optimale</p>
          <p className="font-semibold text-lg">
            {optimalPPC !== null ? `${optimalPPC} mmHg` : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Zone optimale (LLA-ULA)</p>
          <p className="font-semibold text-lg">
            {lowerLimit !== null && upperLimit !== null
              ? `${lowerLimit} - ${upperLimit} mmHg`
              : "--"}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">PRx minimum</p>
          <p className="font-semibold text-lg">{minPrx !== null ? minPrx.toFixed(2) : "--"}</p>
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
          <span className="font-medium">Interprétation :</span> PRx {"<"} 0.3 = autorégulation
          préservée, PRx {">"} 0.3 = autorégulation altérée
        </p>
        <p>
          La <span className="text-status-normal font-medium">zone verte</span> représente la plage
          de PAM où l'autorégulation cérébrale est optimale (LLA à ULA).
        </p>
      </div>
    </div>
  );
}
