import { useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePatient } from '@/hooks/usePatients';
import { Wind, Gauge, Edit2, Check, X, Plus, Trash2, Info, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { MetricRangeBar } from '@/components/MetricRangeBar';
import lungsIcon from '@/assets/lungs-icon.svg';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { lungMetrics as importedLungMetrics } from '@/utils/organMetrics';
import { useTimeRange } from '@/hooks/useTimeRange';
import { TimeWindowSelector, TimeWindowValue } from '@/components/ui/TimeWindowSelector';
import {
  loadPatientFileData,
  hasPatientFileData,
  getAdherenceStatus,
  getValidityData,
  calculateValidityAdherence,
  PatientFileData,
} from '@/services/patientFileData.service';

const Optilungs = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const metricParam = searchParams.get('metric');
  const { data: patient, isLoading } = usePatient(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
  const [showTargetZones, setShowTargetZones] = useState(true);
  const [selectedLungOptIndicators, setSelectedLungOptIndicators] = useState<string[]>([]);
  const [optChartTimeRange, setOptChartTimeRange] = useState<string>("24h");
  const chartRef = useRef<HTMLDivElement>(null);

  // Patient file data state
  const [patientFileData, setPatientFileData] = useState<PatientFileData | null>(null);
  const [fileDataLoading, setFileDataLoading] = useState(false);
  const hasFileData = hasPatientFileData(patientId);

  // Load patient file data
  useEffect(() => {
    if (hasFileData) {
      setFileDataLoading(true);
      loadPatientFileData(patientId)
        .then((data) => setPatientFileData(data))
        .finally(() => setFileDataLoading(false));
    } else {
      setPatientFileData(null);
    }
  }, [patientId, hasFileData]);

  // Map time range to hours for adherence calculation
  const getHoursFromTimeRange = (range: string): number => {
    switch (range) {
      case '24h': return 24;
      case 'stay': return 96;
      default: return 24;
    }
  };

  const hoursForAdherence = getHoursFromTimeRange(timeRange);

  // Lung-specific validity keys mapping
  const lungValidityMapping: Array<{ label: string; validityKey: string | null }> = [
    { label: 'SpO2', validityKey: null },
    { label: 'PaO2', validityKey: null },
    { label: 'PaCO2', validityKey: 'PaCO2Data_validite' },
    { label: 'pH', validityKey: null },
    { label: 'FiO2', validityKey: null },
    { label: 'P/F Ratio', validityKey: null },
    { label: 'Pplat', validityKey: null },
    { label: 'Driving P', validityKey: null },
    { label: 'Compliance', validityKey: null },
    { label: 'ETCO2', validityKey: 'EtCO2Data_validite' },
    { label: 'Température', validityKey: 'TemperatureData_validite' },
  ];

  const clinicalIndicators = useMemo(() => {
    const baseIndicators = [
      { label: 'eOI & OI', target: '< 8' },
      { label: 'PaO2/FiO2', target: '> 300' },
      { label: 'SpO2', target: '92-100%' },
      { label: 'Pressions ventilation', target: '< 30 cmH2O' },
      { label: 'FiO2', target: '< 40%' },
      { label: 'Volume courant expiré', target: '200-400 mL' },
      { label: 'pH', target: '7.35-7.45' },
      { label: 'Balance ingesta-excreta', target: '< 200 mL' },
    ];

    return baseIndicators.map((indicator) => {
      const mapping = lungValidityMapping.find(m => m.label === indicator.label);
      
      if (patientFileData && mapping?.validityKey) {
        const validityData = getValidityData(patientFileData, mapping.validityKey);
        const { percentage, hasData } = calculateValidityAdherence(validityData, hoursForAdherence);
        
        if (hasData) {
          return {
            ...indicator,
            adherencePercentage: percentage as number | null,
            status: getAdherenceStatus(percentage) as 'normal' | 'warning' | 'critical' | null,
          };
        }
      }
      
      // Default status based on indicator
      let defaultStatus: 'normal' | 'warning' | 'critical' = 'normal';
      if (indicator.label === 'FiO2' || indicator.label === 'Volume courant expiré') {
        defaultStatus = 'warning';
      } else if (indicator.label === 'PaO2/FiO2') {
        defaultStatus = 'critical';
      }
      
      const defaultAdherence = defaultStatus === 'normal' ? 100 : defaultStatus === 'warning' ? 85 : 70;
      
      return {
        ...indicator,
        adherencePercentage: defaultAdherence as number | null,
        status: defaultStatus as 'normal' | 'warning' | 'critical' | null,
      };
    });
  }, [patientFileData, hoursForAdherence]);

  // Clinical adherence (average of indicators with real data)
  const clinicalAdherence = useMemo(() => {
    const withData = clinicalIndicators.filter(i => i.adherencePercentage !== null);
    if (withData.length === 0) return null;
    return Math.round(withData.reduce((sum, i) => sum + (i.adherencePercentage ?? 0), 0) / withData.length);
  }, [clinicalIndicators]);

  const totalIndicators = clinicalIndicators.length;
  const outOfRangeCount = clinicalIndicators.filter(i => i.status !== null && i.status !== 'normal').length;

  const showPatientNotFound = !patient && !isLoading;

  const lungMetrics = importedLungMetrics;

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

  const ventilatorSettings = [
    { label: 'Mode', value: 'SIMV' },
    { label: 'Volume courant', value: '300 mL' },
    { label: 'PEEP', value: '5 cmH2O' },
    { label: 'Fréquence', value: '18 /min' },
    { label: 'Pression crête', value: '22 cmH2O' },
    { label: 'Compliance', value: '45 mL/cmH2O' },
  ];

  // Lung optimisation metrics (selectable like Optibrain)
  const lungOptimisationMetrics = [
    {
      label: "État Pulmonaire",
      displayValue: "Hypoxémie",
      unit: "",
      status: "critical" as const,
      selectable: true,
      criticalLabel: "Sévère",
      criticalColor: "text-status-critical",
    },
    {
      label: "VAP Prediction",
      displayValue: "75",
      unit: "%",
      status: "warning" as const,
      selectable: true,
      criticalLabel: "Fiabilité : 77.9%",
      criticalColor: "text-muted-foreground",
    },
    {
      label: "Ratio P/F",
      displayValue: "167",
      unit: "",
      status: "critical" as const,
      selectable: true,
      criticalLabel: "Cible > 300",
      criticalColor: "text-status-critical",
    },
    {
      label: "Ventilateur",
      displayValue: "SIMV",
      unit: "",
      status: "normal" as const,
      selectable: false, // Opens dialog instead
      criticalLabel: "Voir détails",
      criticalColor: "text-muted-foreground",
      icon: true,
    },
  ];

  // Optimisation chart colors
  const OPT_CHART_COLORS = ["#3b82f6", "#f59e0b", "#ef4444"];

  const getOptIndicatorColor = (label: string) => {
    const index = selectedLungOptIndicators.indexOf(label);
    if (index === -1) return "#9ca3af";
    return OPT_CHART_COLORS[index % OPT_CHART_COLORS.length];
  };

  // Generate demo chart data for lung optimisation indicators
  const lungOptChartData = useMemo(() => {
    if (selectedLungOptIndicators.length === 0) return [];
    const hoursMap: Record<string, number> = { '24h': 24, 'stay': 96 };
    const hours = hoursMap[optChartTimeRange] || 24;
    const points = Math.min(hours * 4, 200);
    const now = Date.now();

    const generators: Record<string, (t: number) => number> = {
      'État Pulmonaire': (t) => 88 + Math.sin(t) * 4 + Math.random() * 3, // SpO2-like
      'VAP Prediction': (t) => 60 + Math.sin(t * 0.8) * 15 + Math.random() * 10, // Risk %
      'Ratio P/F': (t) => 140 + Math.sin(t * 1.2) * 50 + Math.random() * 30, // P/F ratio
    };

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - i) * (hours * 3600000 / points);
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
      const t = i / points * Math.PI * 4;

      const dataPoint: any = { time: timeStr, timestamp };
      selectedLungOptIndicators.forEach(label => {
        const gen = generators[label];
        if (gen) dataPoint[label] = Math.round(gen(t) * 100) / 100;
      });
      return dataPoint;
    });
  }, [optChartTimeRange, selectedLungOptIndicators]);

  // Target zones for optimisation chart
  const optTargetZones: Record<string, { min: number; max: number }> = {
    'État Pulmonaire': { min: 92, max: 100 },
    'VAP Prediction': { min: 0, max: 30 },
    'Ratio P/F': { min: 300, max: 500 },
  };

  // Chart colors for indicators
  const CHART_COLORS = [
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  ];

  const getIndicatorColor = (label: string) => {
    const index = selectedIndicators.indexOf(label);
    if (index === -1) return "#9ca3af";
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  const parseTargetRange = (target: string): { min: number; max: number } => {
    const cleanTarget = target.toLowerCase().replace(/°/g, "").trim();
    const rangeMatch = cleanTarget.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
    const lessThanMatch = cleanTarget.match(/<\s*(\d+(?:\.\d+)?)/);
    if (lessThanMatch) return { min: -Infinity, max: parseFloat(lessThanMatch[1]) };
    const greaterThanMatch = cleanTarget.match(/>\s*(\d+(?:\.\d+)?)/);
    if (greaterThanMatch) return { min: parseFloat(greaterThanMatch[1]), max: Infinity };
    return { min: -Infinity, max: Infinity };
  };

  // Generate demo chart data for lung indicators
  const lungChartData = useMemo(() => {
    const hoursMap: Record<string, number> = { '24h': 24, 'stay': 96 };
    const hours = hoursMap[timeRange] || 24;
    const points = Math.min(hours * 4, 200);
    const now = Date.now();
    
    const generators: Record<string, (t: number) => number> = {
      'eOI & OI': (t) => 4 + Math.sin(t * 3) * 3 + Math.random() * 4 + (Math.random() > 0.95 ? 6 : 0),
      'PaO2/FiO2': (t) => 140 + Math.sin(t * 2) * 40 + Math.random() * 30,
      'SpO2': (t) => 92 + Math.sin(t) * 3 + Math.random() * 2,
      'Pressions ventilation': (t) => 18 + Math.sin(t * 2) * 5 + Math.random() * 4,
      'FiO2': (t) => 35 + Math.sin(t * 1.5) * 10 + Math.random() * 5,
      'Volume courant expiré': (t) => 280 + Math.sin(t * 2) * 50 + Math.random() * 30,
      'pH': (t) => 7.35 + Math.sin(t) * 0.05 + Math.random() * 0.03,
      'Balance ingesta-excreta': (t) => 80 + Math.sin(t * 0.5) * 60 + Math.random() * 40,
    };

    return Array.from({ length: points }, (_, i) => {
      const timestamp = now - (points - i) * (hours * 3600000 / points);
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
      const t = i / points * Math.PI * 4;

      const dataPoint: any = { time: timeStr, timestamp };
      selectedIndicators.forEach(label => {
        const gen = generators[label];
        if (gen) dataPoint[label] = Math.round(gen(t) * 100) / 100;
      });
      return dataPoint;
    });
  }, [timeRange, selectedIndicators]);


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
      <PatientHeader currentPage="optilungs" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Métriques Pulmonaires</CardTitle>
          </CardHeader>
          <CardContent>
            <DataLoadingOverlay isLoading={fileDataLoading} label="Chargement des données pulmonaires..." variant="skeleton">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lungMetrics.map((metric, index) => {
                const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                const valueColor = inRange ? 'text-muted-foreground' : 'text-status-critical';
                
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {metric.label}
                    </div>
                    <div className={`text-4xl font-bold ${valueColor} mb-3`}>
                      {metric.value}
                    </div>
                    
                    <MetricRangeBar
                      value={metric.value}
                      min={metric.min}
                      max={metric.max}
                      targetMin={metric.targetMin}
                      targetMax={metric.targetMax}
                    />
                  </div>
                );
              })}
            </div>
            </DataLoadingOverlay>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setOptimisationExpanded(prev => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 border-destructive text-destructive bg-destructive/10 shrink-0">
                  <img src={lungsIcon} alt="lungs" className="h-6 w-6 sm:h-8 sm:w-8" style={{ filter: "invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)" }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">Optimisation pulmonaire</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-destructive">Hypoxémie sévère</span> • VAP Prediction : 75%
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
              {/* Selectable Lung Metrics - Optibrain style */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6 pt-4">
                {lungOptimisationMetrics.map((metric, index) => {
                  const isSelected = selectedLungOptIndicators.includes(metric.label);
                  const statusColor = metric.status === "critical" 
                    ? "text-status-critical" 
                    : metric.status === "warning" 
                      ? "text-status-warning" 
                      : "text-foreground";

                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center cursor-pointer p-2 sm:p-3 rounded-lg transition-all border-2 ${
                        isSelected
                          ? "bg-card shadow-sm border-primary"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!metric.selectable) {
                          setOpenDialog('ventilateur');
                          return;
                        }
                        setSelectedLungOptIndicators((prev) =>
                          prev.includes(metric.label)
                            ? prev.filter((l) => l !== metric.label)
                            : [...prev, metric.label]
                        );
                      }}
                    >
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide text-center">
                        {metric.label}
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        {metric.icon && <Gauge className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />}
                        <div className={`text-lg sm:text-2xl font-bold ${statusColor}`}>{metric.displayValue}</div>
                        {metric.unit && <span className="text-xs text-muted-foreground">{metric.unit}</span>}
                      </div>
                      {metric.criticalLabel && (
                        <div className={`text-[10px] sm:text-xs font-medium ${metric.criticalColor} text-center leading-tight`}>
                          {metric.criticalLabel}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Cliquez sur un indicateur pour l'afficher dans le graphique
              </p>

              {/* Embedded Chart - shown when indicators are selected */}
              {selectedLungOptIndicators.length > 0 && (
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
                      <LineChart data={lungOptChartData}>
                        {selectedLungOptIndicators.map((label) => {
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.98)",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            fontSize: "12px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            padding: "12px",
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                          iconType="plainline"
                          formatter={(value: string) => (
                            <span style={{ color: getOptIndicatorColor(value), fontWeight: 500 }}>{value}</span>
                          )}
                        />
                        {selectedLungOptIndicators.map((label, idx) => {
                          const color = getOptIndicatorColor(label);
                          return (
                            <Line
                              key={label}
                              type="monotone"
                              dataKey={label}
                              stroke={color}
                              strokeWidth={2.5}
                              dot={false}
                              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: color }}
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

        {/* VAP Prediction 1 Dialog */}
        <Dialog open={openDialog === 'vap1'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>VAP Prediction 1 - Risk Assessment</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Prediction Card */}
              <div className="border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Prédictions VAP module 1 : <span className="font-normal text-muted-foreground">dernières 48 heures</span>
                  </h3>
                </div>
                
                {/* Percentage Badge */}
                <div className="flex justify-center mb-4">
                  <div className="inline-block px-4 py-1 border-2 border-border rounded-full">
                    <span className="text-xl font-semibold text-foreground">77.9%</span>
                  </div>
                </div>

                {/* Gradient Bar */}
                <div className="mb-6">
                  <div className="relative h-8 rounded-full overflow-hidden flex">
                    <div className="w-[10%] bg-red-500"></div>
                    <div className="w-[10%] bg-red-400"></div>
                    <div className="w-[10%] bg-orange-400"></div>
                    <div className="w-[10%] bg-orange-300"></div>
                    <div className="w-[10%] bg-yellow-300"></div>
                    <div className="w-[10%] bg-yellow-200"></div>
                    <div className="w-[10%] bg-lime-300"></div>
                    <div className="w-[10%] bg-lime-400"></div>
                    <div className="w-[10%] bg-green-400"></div>
                    <div className="w-[10%] bg-green-500"></div>
                  </div>
                  
                  {/* Scale markers */}
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40</span>
                    <span>50</span>
                    <span>60</span>
                    <span>70</span>
                    <span>80</span>
                    <span>90</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>FiO2 : <span className="font-semibold">N/A</span></span>
                    <span>PEEP : <span className="font-semibold">N/A</span></span>
                    <span>Fiabilité : <span className="font-semibold text-orange-500 dark:text-orange-400">77.9%</span></span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Recommandations :</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Renforcer les protocoles d'hygiène respiratoire</li>
                  <li>Revoir les niveaux de sédation</li>
                  <li>Considérer la prophylaxie probiotique</li>
                  <li>Surveiller les paramètres du ventilateur</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clinical Indicators Section - Optibrain style */}
        <Card className="bg-card shadow-sm mb-6">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">
                Monitorage {timeRange === "stay" ? "sur le séjour" : `sur ${timeRange}`}
              </CardTitle>
              <TimeWindowSelector
                value={timeRange}
                onChange={(value) => setTimeRange(value as any)}
                includeStay={true}
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="border-2 border-border">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setClinicalExpanded(!clinicalExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold border-4 shrink-0 ${
                        outOfRangeCount === 0
                          ? "border-muted-foreground text-muted-foreground bg-muted"
                          : outOfRangeCount <= 2
                            ? "border-status-warning text-status-warning bg-status-warning/10"
                            : "border-status-critical text-status-critical bg-status-critical/10"
                      }`}
                    >
                      {outOfRangeCount}/{totalIndicators}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground">Indicateurs à surveiller</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {outOfRangeCount > 0 ? `${outOfRangeCount} indicateur${outOfRangeCount > 1 ? 's' : ''} à surveiller` : "Tous les indicateurs dans la cible"}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0 px-3 sm:px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const adherenceDotColor =
                        indicator.adherencePercentage === null
                          ? "bg-muted-foreground/30"
                          : (indicator.adherencePercentage ?? 0) >= 90
                            ? "bg-muted-foreground"
                            : (indicator.adherencePercentage ?? 0) >= 80
                              ? "bg-status-warning"
                              : "bg-status-critical";
                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border-2 ${
                            isSelected
                              ? "bg-card shadow-sm border-primary"
                              : "border-transparent hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedIndicators(prev =>
                              prev.includes(indicator.label)
                                ? prev.filter(label => label !== indicator.label)
                                : [...prev, indicator.label]
                            );
                            setTimeout(() => {
                              chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }}
                        >
                          <TooltipProvider delayDuration={200}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-3 h-3 rounded-full mt-1 ${adherenceDotColor} cursor-help`}></div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-48">
                                {indicator.adherencePercentage !== null
                                  ? (
                                    <div>
                                      <div className="font-semibold">{indicator.adherencePercentage}% adhérence</div>
                                      <div className="text-muted-foreground mt-1">% du temps passé dans la cible recommandée</div>
                                    </div>
                                  )
                                  : "Pas de données"
                                }
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{indicator.label}</p>
                            <p className="text-xs text-muted-foreground">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Cliquez sur un indicateur pour l'afficher dans le graphique
                  </p>
                </CardContent>
              )}
            </Card>
            {/* Monitoring Chart */}
            <Card ref={chartRef} className="border-2 border-border">
              <CardHeader className="px-3 sm:px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-lg">
                    {timeRange === "stay" ? "Monitorage (Séjour)" : `Monitorage (${timeRange.toUpperCase()})`}
                  </CardTitle>
                  {selectedIndicators.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showTargetZones}
                        onChange={(e) => setShowTargetZones(e.target.checked)}
                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                      Zones cibles
                    </label>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div
                  className={`border-2 border-border rounded-lg p-2 sm:p-4 ${
                    selectedIndicators.length === 0 ? "h-24 sm:h-32" : "h-[250px] sm:h-[300px]"
                  }`}
                >
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-xs sm:text-base text-center px-2">
                        Sélectionnez des indicateurs ci-dessus pour afficher leurs tendances
                      </p>
                    </div>
                  ) : (
                    <div className="h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lungChartData}>
                          {showTargetZones && selectedIndicators.map((label) => {
                            const indicator = clinicalIndicators.find((i) => i.label === label);
                            if (!indicator) return null;
                            const target = parseTargetRange(indicator.target);
                            if (target.min === -Infinity && target.max === Infinity) return null;
                            const color = getIndicatorColor(label);
                            const yMin = target.min === -Infinity ? 0 : target.min;
                            const yMax = target.max === Infinity ? target.min * 2 : target.max;
                            return (
                              <ReferenceArea
                                key={`zone-${label}`}
                                y1={yMin}
                                y2={yMax}
                                fill={color}
                                fillOpacity={0.08}
                                stroke={color}
                                strokeOpacity={0.3}
                                strokeDasharray="4 2"
                              />
                            );
                          })}
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(255, 255, 255, 0.98)",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              fontSize: "12px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              padding: "12px",
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                            formatter={(value: number, name: string) => {
                              const color = getIndicatorColor(name);
                              return [
                                <span key={name} style={{ color, fontWeight: 600 }}>
                                  {name}: {value.toFixed(1)}
                                </span>,
                                null
                              ];
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                            iconType="plainline"
                            formatter={(value: string) => (
                              <span style={{ color: getIndicatorColor(value), fontWeight: 500 }}>
                                {value}
                              </span>
                            )}
                          />
                          {selectedIndicators.map((label, idx) => {
                            const color = getIndicatorColor(label);
                            return (
                              <Line
                                key={label}
                                type="monotone"
                                dataKey={label}
                                stroke={color}
                                strokeWidth={2.5}
                                strokeDasharray={idx > 0 ? (idx % 2 === 1 ? "8 4" : undefined) : undefined}
                                dot={false}
                                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2, fill: color }}
                                connectNulls={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Ventilateur Dialog */}
        <Dialog open={openDialog === 'ventilateur'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Paramètres du Ventilateur
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {ventilatorSettings.map((setting, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">{setting.label}</span>
                  <span className="font-semibold text-sm text-foreground">{setting.value}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Analyse des Gaz du Sang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Ratio PaO2/FiO2</span>
                  <span className="font-semibold text-foreground">238</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Excès de Base</span>
                  <span className="font-semibold text-foreground">-2 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">HCO3</span>
                  <span className="font-semibold text-foreground">24 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Lactate</span>
                  <span className="font-semibold text-foreground">1.2 mmol/L</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Statut d'Oxygénation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Index d'Oxygénation</span>
                    <Badge className="bg-muted text-muted-foreground">5.5</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-muted-foreground" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Gradient Alvéolo-artériel</span>
                    <Badge className="bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400">35 mmHg</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 dark:bg-orange-400" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        
      </main>
    </div>
  );
};

export default Optilungs;
