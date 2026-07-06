import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { usePatient } from '@/hooks/usePatients';
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import intestineIcon from '@/assets/intestine-icon.svg';
import { TimeWindowSelector, TimeWindowValue } from '@/components/ui/TimeWindowSelector';
import {
  CollapsibleModuleCard,
  StatusIconCircle,
} from '@/components/CollapsibleModuleCard';
import { SelectableMetricTile, TileStatus } from '@/components/SelectableMetricTile';
import { OptimisationChart } from '@/components/OptimisationChart';

const OPT_CHART_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const Optigastro = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);

  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
  const [selectedGastroOptIndicators, setSelectedGastroOptIndicators] = useState<string[]>([]);
  const [optChartTimeRange, setOptChartTimeRange] = useState<string>('24h');

  const showPatientNotFound = !patient && !isLoading;

  const gastroOptimisationMetrics: Array<{
    label: string;
    displayValue: string;
    unit: string;
    status: TileStatus;
    criticalLabel: string;
    criticalColor: string;
  }> = [
    {
      label: 'Hyperammoniémie',
      displayValue: '180',
      unit: 'µmol/L',
      status: 'critical',
      criticalLabel: 'Cible < 100',
      criticalColor: 'text-status-critical',
    },
    {
      label: 'Glasgow',
      displayValue: '9',
      unit: '/15',
      status: 'warning',
      criticalLabel: 'Altéré',
      criticalColor: 'text-status-warning',
    },
    {
      label: 'Convulsions',
      displayValue: '2',
      unit: '/24h',
      status: 'warning',
      criticalLabel: 'Épisodes récents',
      criticalColor: 'text-status-warning',
    },
    {
      label: 'Pupilles',
      displayValue: 'Iso',
      unit: '',
      status: 'normal',
      criticalLabel: 'Réactives 3 mm',
      criticalColor: 'text-muted-foreground',
    },
  ];

  const optTargetZones: Record<string, { min: number; max: number }> = {
    Hyperammoniémie: { min: 20, max: 100 },
    Glasgow: { min: 13, max: 15 },
    Convulsions: { min: 0, max: 0 },
    Pupilles: { min: 2, max: 4 },
  };

  const colorFor = (label: string) => {
    const index = selectedGastroOptIndicators.indexOf(label);
    if (index === -1) return '#9ca3af';
    return OPT_CHART_COLORS[index % OPT_CHART_COLORS.length];
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

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px] space-y-6">
        <VitalSignsPanel />

        <CollapsibleModuleCard
          expanded={optimisationExpanded}
          onToggle={() => setOptimisationExpanded((p) => !p)}
          headerIcon={
            <StatusIconCircle status="warning">
              <img
                src={intestineIcon}
                alt="gastro"
                className="h-6 w-6 sm:h-8 sm:w-8"
                style={{
                  filter:
                    'invert(60%) sepia(80%) saturate(600%) hue-rotate(0deg) brightness(95%) contrast(90%)',
                }}
              />
            </StatusIconCircle>
          }
          title="Optimisation gastrique"
          subtitle={
            <>
              <span className="font-semibold text-status-critical">Hyperammoniémie</span> • Glasgow
              9/15 • Convulsions récentes
            </>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 pt-4">
            {gastroOptimisationMetrics.map((metric) => (
              <SelectableMetricTile
                key={metric.label}
                label={metric.label}
                displayValue={metric.displayValue}
                unit={metric.unit}
                status={metric.status}
                criticalLabel={metric.criticalLabel}
                criticalColor={metric.criticalColor}
                isSelected={selectedGastroOptIndicators.includes(metric.label)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGastroOptIndicators((prev) =>
                    prev.includes(metric.label)
                      ? prev.filter((l) => l !== metric.label)
                      : [...prev, metric.label]
                  );
                }}
              />
            ))}
          </div>

          {selectedGastroOptIndicators.length > 0 && (
            <div className="border-t border-border pt-4 mt-4 space-y-4">
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
              <OptimisationChart
                data={gastroOptChartData}
                series={selectedGastroOptIndicators.map((label) => ({
                  label,
                  color: colorFor(label),
                  targetZone: optTargetZones[label],
                }))}
              />
            </div>
          )}
        </CollapsibleModuleCard>
      </main>
    </div>
  );
};

export default Optigastro;
