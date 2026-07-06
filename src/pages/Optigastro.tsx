import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { usePatient } from '@/hooks/usePatients';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import intestineIcon from '@/assets/intestine-icon.svg';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { TimeWindowSelector, TimeWindowValue } from '@/components/ui/TimeWindowSelector';

const Optigastro = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);

  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
  const [selectedGastroOptIndicators, setSelectedGastroOptIndicators] = useState<string[]>([]);
  const [optChartTimeRange, setOptChartTimeRange] = useState<string>('24h');

  const showPatientNotFound = !patient && !isLoading;

  // État gastrique : selectable metrics (Optibrain / Optilungs style)
  const gastroOptimisationMetrics = [
    {
      label: 'Hyperammoniémie',
      displayValue: '180',
      unit: 'µmol/L',
      status: 'critical' as const,
      criticalLabel: 'Cible < 100',
      criticalColor: 'text-status-critical',
    },
    {
      label: 'Glasgow',
      displayValue: '9',
      unit: '/15',
      status: 'warning' as const,
      criticalLabel: 'Altéré',
      criticalColor: 'text-status-warning',
    },
    {
      label: 'Convulsions',
      displayValue: '2',
      unit: '/24h',
      status: 'warning' as const,
      criticalLabel: 'Épisodes récents',
      criticalColor: 'text-status-warning',
    },
    {
      label: 'Pupilles',
      displayValue: 'Iso',
      unit: '',
      status: 'normal' as const,
      criticalLabel: 'Réactives 3 mm',
      criticalColor: 'text-muted-foreground',
    },
  ];

  const OPT_CHART_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const getOptIndicatorColor = (label: string) => {
    const index = selectedGastroOptIndicators.indexOf(label);
    if (index === -1) return '#9ca3af';
    return OPT_CHART_COLORS[index % OPT_CHART_COLORS.length];
  };

  const optTargetZones: Record<string, { min: number; max: number }> = {
    Hyperammoniémie: { min: 20, max: 100 },
    Glasgow: { min: 13, max: 15 },
    Convulsions: { min: 0, max: 0 },
    Pupilles: { min: 2, max: 4 },
  };

  const gastroOptChartData = useMemo(() => {
    if (selectedGastroOptIndicators.length === 0) return [];
    const hoursMap: Record<string, number> = { '24h': 24, stay: 96 };
    const hours = hoursMap[optChartTimeRange] || 24;
    const points = Math.min(hours * 4, 200);
    const now = Date.now();

    const generators: Record<string, (t: number) => number> = {
      Hyperammoniémie: (t) => 140 + Math.sin(t * 0.6) * 30 + Math.random() * 15,
      Glasgow: (t) => 10 + Math.sin(t * 0.4) * 2 + Math.random() * 1,
      Convulsions: (t) => Math.max(0, Math.round(Math.sin(t) + Math.random() * 1.5)),
      Pupilles: (t) => 3 + Math.sin(t * 0.8) * 0.5 + Math.random() * 0.3,
    };

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - i) * ((hours * 3600000) / points);
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const t = (i / points) * Math.PI * 4;

      const dataPoint: any = { time: timeStr, timestamp };
      selectedGastroOptIndicators.forEach((label) => {
        const gen = generators[label];
        if (gen) dataPoint[label] = Math.round(gen(t) * 100) / 100;
      });
      return dataPoint;
    });
  }, [optChartTimeRange, selectedGastroOptIndicators]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8 space-y-4">
          <DataLoadingOverlay isLoading={true} label="Chargement du patient..." variant="skeleton">
            <div />
          </DataLoadingOverlay>
        </div>
      </div>
    );
  }

  if (showPatientNotFound) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p className="text-foreground">Patient non trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optigastro" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px]">
        <div className="mb-6">
          <VitalSignsPanel />
        </div>

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setOptimisationExpanded((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-4 border-status-warning text-status-warning bg-status-warning/10 shrink-0">
                  <img
                    src={intestineIcon}
                    alt="gastro"
                    className="h-6 w-6 sm:h-8 sm:w-8"
                    style={{
                      filter:
                        'invert(60%) sepia(80%) saturate(600%) hue-rotate(0deg) brightness(95%) contrast(90%)',
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                    Optimisation gastrique
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-status-critical">Hyperammoniémie</span> • Glasgow 9/15 • Convulsions récentes
                  </p>
                </div>
              </div>
              {optimisationExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
          </CardHeader>
          {optimisationExpanded && (
            <CardContent className="pt-0 space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-4">
                État gastrique
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6">
                {gastroOptimisationMetrics.map((metric, index) => {
                  const isSelected = selectedGastroOptIndicators.includes(metric.label);
                  const statusColor =
                    metric.status === 'critical'
                      ? 'text-status-critical'
                      : metric.status === 'warning'
                        ? 'text-status-warning'
                        : 'text-foreground';

                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center cursor-pointer p-2 sm:p-3 rounded-lg transition-all border-2 ${
                        isSelected
                          ? 'bg-card shadow-sm border-primary'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGastroOptIndicators((prev) =>
                          prev.includes(metric.label)
                            ? prev.filter((l) => l !== metric.label)
                            : [...prev, metric.label]
                        );
                      }}
                    >
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide text-center">
                        {metric.label}
                      </div>
                      <div className="flex items-baseline gap-1 mb-1">
                        <div className={`text-2xl sm:text-4xl font-bold ${statusColor}`}>
                          {metric.displayValue}
                        </div>
                        {metric.unit && (
                          <span className="text-[10px] text-muted-foreground">{metric.unit}</span>
                        )}
                      </div>
                      {metric.criticalLabel && (
                        <div
                          className={`text-[10px] sm:text-xs font-medium ${metric.criticalColor} text-center leading-tight`}
                        >
                          {metric.criticalLabel}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedGastroOptIndicators.length > 0 && (
                <div className="border-t border-border pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">Évolution temporelle</div>
                    <TimeWindowSelector
                      value={optChartTimeRange as TimeWindowValue}
                      onChange={(v) => setOptChartTimeRange(v)}
                      includeStay={true}
                      size="sm"
                      variant="compact"
                    />
                  </div>
                  <div className="h-[250px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gastroOptChartData}>
                        {selectedGastroOptIndicators.map((label) => {
                          const zone = optTargetZones[label];
                          if (!zone) return null;
                          const color = getOptIndicatorColor(label);
                          return (
                            <ReferenceArea
                              key={`zone-${label}`}
                              y1={zone.min}
                              y2={zone.max}
                              fill={color}
                              fillOpacity={0.08}
                              stroke={color}
                              strokeOpacity={0.3}
                              strokeDasharray="4 2"
                            />
                          );
                        })}
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            padding: '12px',
                            color: 'hsl(var(--popover-foreground))',
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                          iconType="plainline"
                          formatter={(value: string) => (
                            <span style={{ color: getOptIndicatorColor(value), fontWeight: 500 }}>
                              {value}
                            </span>
                          )}
                        />
                        {selectedGastroOptIndicators.map((label) => {
                          const color = getOptIndicatorColor(label);
                          return (
                            <Line
                              key={label}
                              type="monotone"
                              dataKey={label}
                              stroke={color}
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: color }}
                              connectNulls={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Optigastro;
