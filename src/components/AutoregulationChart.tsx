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
  windowMinutes?: number;
}

export function AutoregulationChart({
  patientId,
  currentPPC,
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

      {/* Legend and metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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
          <p className="text-muted-foreground text-xs">PPC actuelle</p>
          <p className="font-semibold text-lg">
            {currentPPC !== null ? `${Math.round(currentPPC)} mmHg` : "--"}
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
          de PPC où l'autorégulation cérébrale est optimale (LLA à ULA).
        </p>
      </div>
    </div>
  );
}
