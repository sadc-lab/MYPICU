import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesDataPoint } from "@/services/patientFileData.service";
import type { AutoregulationResult } from "@/services/patientAutoregulation.service";
import { getWindowPosition, hasAutoregulationWindow } from "@/services/autoregulationWindow";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AutoregulationChartProps {
  mode: "prx" | "cox";
  result: AutoregulationResult | null;
  signalSeries: TimeSeriesDataPoint[];
  pressureSeries: TimeSeriesDataPoint[];
}

interface ChartPoint {
  timestamp: number;
  value: number;
}

function chartPoints(series: TimeSeriesDataPoint[]): ChartPoint[] {
  return series
    .map((point) => ({ timestamp: new Date(point.charttime).getTime(), value: point.valeur }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function valueDomain(points: ChartPoint[], limits: number[] = []): [number, number] {
  const values = [...points.map((point) => point.value), ...limits].filter(Number.isFinite);
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 1);
  return [Math.floor(min - padding), Math.ceil(max + padding)];
}

export function AutoregulationChart({
  mode,
  result,
  signalSeries,
  pressureSeries,
}: AutoregulationChartProps) {
  const signalLabel = mode === "prx" ? "PIC" : "NIRS (rSO₂)";
  const pressureLabel = mode === "prx" ? "PPC" : "PAM";
  const signal = chartPoints(signalSeries);
  const pressure = chartPoints(pressureSeries);
  const window = hasAutoregulationWindow(result) ? result : null;

  if (signal.length === 0 || pressure.length === 0) {
    return (
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Fenêtre non affichée : {signalLabel} et {pressureLabel} sont tous deux nécessaires
        pour cette analyse d'autorégulation.
      </div>
    );
  }

  const latestPressure = pressure[pressure.length - 1].value;
  const position = getWindowPosition(latestPressure, window);
  const statusText = {
    inside: "Dans la fenêtre d'autorégulation",
    below: "Sous la limite inférieure",
    above: "Au-dessus de la limite supérieure",
    unavailable: "Valeur actuelle indisponible",
  }[position];
  const statusClass = position === "inside"
    ? "text-status-normal"
    : position === "unavailable"
      ? "text-muted-foreground"
      : "text-status-warning";
  const dateTick = (timestamp: number) => format(new Date(timestamp), "HH:mm", { locale: fr });

  return (
    <section className="space-y-4" aria-label="Fenêtre d'autorégulation">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {mode === "prx" ? "PRx · PIC + PPC" : "COx · NIRS (rSO₂) + PAM"}
          </h3>
          {window ? (
            <p className="text-xs text-muted-foreground">
              Fenêtre {pressureLabel} : {Math.round(window.inferiorLimit)}–
              {Math.round(window.superiorLimit)} mmHg
              {" · "}optimum {Math.round(window.optimalPressure)} mmHg
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucune fenêtre fiable produite par OptiBrain; les signaux restent affichés sans plage cible.
            </p>
          )}
        </div>
        {window && (
          <p className={`text-sm font-semibold ${statusClass}`}>
            {statusText} ({Math.round(latestPressure)} mmHg)
          </p>
        )}
      </header>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {pressureLabel} · la fenêtre ombrée représente la plage optimale
        </p>
        <div className="h-48 w-full" data-testid="autoregulation-pressure-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pressure} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={dateTick}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={valueDomain(
                  pressure,
                  window ? [window.inferiorLimit, window.superiorLimit] : [],
                )}
                unit=" mmHg"
                tick={{ fontSize: 10 }}
                width={56}
              />
              <Tooltip
                labelFormatter={(value) => format(new Date(Number(value)), "dd/MM HH:mm", { locale: fr })}
                formatter={(value: number) => [`${value.toFixed(1)} mmHg`, pressureLabel]}
              />
              {window && (
                <>
                  <ReferenceArea
                    y1={window.inferiorLimit}
                    y2={window.superiorLimit}
                    fill="hsl(var(--status-normal))"
                    fillOpacity={0.2}
                    stroke="hsl(var(--status-normal))"
                    strokeOpacity={0.5}
                    label={{ value: "Fenêtre optimale", position: "insideTop", fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={window.optimalPressure}
                    stroke="hsl(var(--status-normal))"
                    strokeDasharray="4 3"
                  />
                </>
              )}
              <Line
                type="monotone"
                dataKey="value"
                name={pressureLabel}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {mode === "cox"
            ? `${signalLabel} · saturation régionale en oxygène cérébrale (%)`
            : `${signalLabel} · pression intracrânienne (mmHg)`}
        </p>
        <div className="h-36 w-full" data-testid="autoregulation-signal-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signal} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={dateTick}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={valueDomain(signal)}
                unit={mode === "cox" ? "%" : " mmHg"}
                tick={{ fontSize: 10 }}
                width={56}
              />
              <Tooltip
                labelFormatter={(value) => format(new Date(Number(value)), "dd/MM HH:mm", { locale: fr })}
                formatter={(value: number) => [
                  `${value.toFixed(1)} ${mode === "cox" ? "%" : "mmHg"}`,
                  signalLabel,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={signalLabel}
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
