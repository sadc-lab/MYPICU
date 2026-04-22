import { useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePatient } from '@/hooks/usePatients';
import { Info, ChevronDown, ChevronUp, Edit2, Check, X, Plus, Trash2, Minus, AlertTriangle, Heart, Droplets, Activity } from 'lucide-react';
import { DataLoadingOverlay } from '@/components/DataLoadingOverlay';
import { MetricRangeBar } from '@/components/MetricRangeBar';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';


import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { heartMetrics as importedHeartMetrics } from '@/utils/organMetrics';
import { useTimeRange } from '@/hooks/useTimeRange';
import { TimeWindowSelector } from '@/components/ui/TimeWindowSelector';
import { getStatusHexColor } from '@/utils/colorUtils';
import {
  loadPatientFileData,
  hasPatientFileData,
  getAdherenceStatus,
  getValidityData,
  calculateValidityAdherence,
  PatientFileData,
  VALIDITY_DATA_KEYS,
} from '@/services/patientFileData.service';

const Optiheart = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const metricParam = searchParams.get('metric');
  const { data: patient, isLoading } = usePatient(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
  const [heartGroupsOpen, setHeartGroupsOpen] = useState<Record<string, boolean>>({
    "Hémodynamique": true,
    "Perfusion tissulaire": false,
  });
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  // File data and editing states remain for other functionality

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

  // Heart-specific validity keys mapping
  const heartValidityMapping: Array<{ label: string; validityKey: string | null }> = [
    { label: 'PAM', validityKey: 'PAMData_validite' },
    { label: 'Débit cardiaque', validityKey: null }, // No validity data available
    { label: 'Lactates', validityKey: null },
    { label: 'ScvO2', validityKey: null },
    { label: 'Bilan hydrique', validityKey: null },
    { label: 'Support inotrope', validityKey: null },
    { label: 'Vasopresseurs', validityKey: null },
    { label: 'Échocardiographie', validityKey: null },
  ];

  const monitoringTargets = useMemo(() => {
    const defaultIndicators = [
      { label: 'PAM', value: 72, unit: 'mmHg', target: '> 65 mmHg', trend: 'up', change: 3 },
      { label: 'Débit cardiaque', value: 3.2, unit: 'L/min', target: '4.5-6.0 L/min', trend: 'up', change: 0.4 },
      { label: 'Lactates', value: 1.2, unit: 'mmol/L', target: '< 2 mmol/L', trend: 'down', change: -0.2 },
      { label: 'ScvO2', value: 72, unit: '%', target: '> 70%', trend: 'up', change: 2 },
      { label: 'Bilan hydrique', value: '+500', unit: 'mL', target: 'Équilibré', trend: 'stable', change: 0 },
      { label: 'Support inotrope', value: 'Dobutamine 5', unit: 'mcg/kg/min', target: 'Selon besoin', trend: 'stable' },
      { label: 'Vasopresseurs', value: 'Noradré 0.15', unit: 'mcg/kg/min', target: 'Selon MAP', trend: 'down', change: -0.05 },
      { label: 'Échocardiographie', value: 'FEVG 35%', target: 'Contrôle régulier', trend: 'stable' },
    ];

    return defaultIndicators.map((indicator) => {
      const mapping = heartValidityMapping.find(m => m.label === indicator.label);
      
      if (patientFileData && mapping?.validityKey) {
        const validityData = getValidityData(patientFileData, mapping.validityKey);
        const { percentage, hasData } = calculateValidityAdherence(validityData, hoursForAdherence);
        
        if (hasData) {
          return {
            ...indicator,
            adherencePercentage: percentage,
            status: getAdherenceStatus(percentage),
          };
        }
      }
      
      // Default status based on mock values
      const defaultStatus = indicator.label === 'Débit cardiaque' || indicator.label === 'Échocardiographie' 
        ? 'critical' 
        : indicator.label === 'Bilan hydrique' 
          ? 'warning' 
          : 'normal';
      
      return {
        ...indicator,
        adherencePercentage: defaultStatus === 'normal' ? 100 : defaultStatus === 'warning' ? 85 : 70,
        status: defaultStatus as 'normal' | 'warning' | 'critical',
      };
    });
  }, [patientFileData, hoursForAdherence]);
  
  const totalTargets = monitoringTargets.length;
  const normalTargets = monitoringTargets.filter(t => t.status === 'normal').length;
  const monitoringAdherence = Math.round(monitoringTargets.reduce((sum, t) => sum + t.adherencePercentage, 0) / totalTargets);
  const targetOutOfRangeCount = monitoringTargets.filter(t => t.status !== 'normal').length;

  const showPatientNotFound = !patient && !isLoading;

  const heartMetrics = importedHeartMetrics;



  const clinicalIndicators = [
    { label: 'MAP', value: 72, unit: 'mmHg', target: '> 65 mmHg', status: 'normal', trend: 'up', change: 3 },
    { label: 'FC', value: 98, unit: 'bpm', target: '60-100 bpm', status: 'normal', trend: 'stable', change: 0 },
    { label: 'DC', value: 3.2, unit: 'L/min', target: '4.5-6.0 L/min', status: 'critical', trend: 'up', change: 0.4 },
    { label: 'IC', value: 2.1, unit: 'L/min/m²', target: '2.5-4.0 L/min/m²', status: 'critical', trend: 'up', change: 0.3 },
    { label: 'RVS', value: 1450, unit: 'dynes/s/cm⁻⁵', target: '800-1200 dynes/s/cm⁻⁵', status: 'warning', trend: 'down', change: -50 },
    { label: 'CVP', value: 8, unit: 'mmHg', target: '2-8 mmHg', status: 'normal', trend: 'stable', change: 0 },
    { label: 'Lactate', value: 1.2, unit: 'mmol/L', target: '< 2 mmol/L', status: 'normal', trend: 'down', change: -0.2 },
    { label: 'ScvO2', value: 72, unit: '%', target: '> 70%', status: 'normal', trend: 'up', change: 2 },
    { label: 'PAPO', value: 12, unit: 'mmHg', target: '6-12 mmHg', status: 'normal', trend: 'stable', change: 0 }
  ];

  // Calculate clinical adherence
  const totalIndicators = clinicalIndicators.length;
  const normalIndicators = clinicalIndicators.filter(i => i.status === 'normal').length;
  const clinicalAdherence = Math.round(normalIndicators / totalIndicators * 100);
  const outOfRangeCount = clinicalIndicators.filter(i => i.status !== 'normal').length;

  // Generate mock chart data based on selected time range
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    let dataPoints: number;
    let intervalMinutes: number;
    
    switch (timeRange) {
      case '24h':
        dataPoints = 24;
        intervalMinutes = 60;
        break;
      case 'stay':
        dataPoints = 48;
        intervalMinutes = 120;
        break;
      default:
        dataPoints = 24;
        intervalMinutes = 60;
        break;
    }
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      
      const dataPoint: any = {
        time: timeStr
      };
      
      clinicalIndicators.forEach(indicator => {
        const baseValue = indicator.value;
        const variation = (Math.random() - 0.5) * (baseValue * 0.2);
        dataPoint[indicator.label] = Math.round((baseValue + variation) * 100) / 100;
      });
      
      data.push(dataPoint);
    }
    
    return data;
  }, [timeRange]);

  const getIndicatorColor = (label: string) => {
    const indicator = clinicalIndicators.find(i => i.label === label);
    if (!indicator) return '#9ca3af';
    return getStatusHexColor(indicator.status);
  };

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

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
      <PatientHeader currentPage="optiheart" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <div className="mb-6">
          <VitalSignsPanel />
        </div>
        <DataLoadingOverlay isLoading={fileDataLoading} label="Chargement des données cardiaques..." variant="skeleton">
          <div className="space-y-4 mb-6">
            {(() => {
              const groups: Array<{ title: string; metricLabels: string[] }> = [
                { title: "Hémodynamique", metricLabels: ["Cardiac Output", "Cardiac Index", "CVP", "SVR"] },
                { title: "Perfusion tissulaire", metricLabels: ["Lactate", "ScvO2"] },
              ];
              return groups.map((group) => {
                const groupMetrics = heartMetrics.filter(m => group.metricLabels.includes(m.label));
                if (groupMetrics.length === 0) return null;
                const abnormal = groupMetrics.filter(m => !isInRange(m.value, m.targetMin, m.targetMax)).length;
                const isOpen = heartGroupsOpen[group.title] ?? false;
                return (
                  <Card key={group.title} className="bg-card shadow-sm">
                    <button
                      type="button"
                      onClick={() => setHeartGroupsOpen(prev => ({ ...prev, [group.title]: !isOpen }))}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold tabular-nums ${
                              abnormal > 0
                                ? 'bg-status-critical text-white'
                                : 'bg-status-normal/10 text-status-normal'
                            }`}
                            aria-label={`${abnormal} paramètre(s) hors cible`}
                          >
                            {abnormal}
                          </div>
                          <div className="text-left">
                            <div className="text-base font-semibold text-foreground">{group.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {abnormal === 0
                                ? "Tous les paramètres dans les cibles"
                                : `${abnormal} paramètre${abnormal > 1 ? "s" : ""} hors cible`}
                            </div>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <CardContent className="pt-4 border-t">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-8">
                          {groupMetrics.map((metric, index) => {
                            const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                            const valueColor = inRange ? 'text-muted-foreground' : 'text-status-critical';
                            return (
                              <div key={index} className="flex flex-col items-center">
                                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide text-center">
                                  {metric.label}
                                </div>
                                <div className="flex items-baseline gap-1 mb-3">
                                  <div className={`text-2xl sm:text-4xl font-bold ${valueColor}`}>
                                    {metric.value}
                                  </div>
                                  {metric.unit && (
                                    <div className="text-[10px] text-muted-foreground">{metric.unit}</div>
                                  )}
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
                      </CardContent>
                    )}
                  </Card>
                );
              });
            })()}
          </div>
        </DataLoadingOverlay>


        {/* Cardiac State Dialog */}
        <Dialog open={openDialog === 'cardiac'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>État Cardiaque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="text-destructive font-semibold">Choc cardiogénique</span> depuis : 2am
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Choc cardiogénique', percent: 45, status: 'critical' },
                  { label: 'Insuffisance cardiaque', percent: 25, status: 'warning' },
                  { label: 'Arythmie', percent: 15, status: 'warning' },
                  { label: 'Stable', percent: 15, status: 'normal' }
                ].map((state, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{state.label}</span>
                      <span className={
                        state.status === 'critical' ? 'text-destructive font-semibold' :
                        state.status === 'warning' ? 'text-status-warning font-semibold' :
                        'text-muted-foreground font-semibold'
                      }>
                        {state.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          state.status === 'critical' ? 'bg-destructive' :
                          state.status === 'warning' ? 'bg-status-warning' :
                          'bg-muted-foreground'
                        }`}
                        style={{ width: `${state.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t text-sm text-muted-foreground">
                Débit cardiaque actuel : <span className="text-foreground font-semibold">3.2 L/min</span>
                <span className="ml-4">Débit moyen : <span className="text-foreground font-semibold">3.5 L/min</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Adhérence & Monitorage {timeRange === 'stay' ? 'sur le séjour' : `moyen sur ${timeRange}`}
              </CardTitle>
              <TimeWindowSelector
                value={timeRange}
                onChange={(value) => setTimeRange(value as any)}
                includeStay={true}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Clinical Indicators */}
            <Card className="border-2 border-border">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      outOfRangeCount === 0 ? 'border-muted-foreground text-muted-foreground bg-muted/50' : 
                       outOfRangeCount <= 2 ? 'border-status-warning text-status-warning bg-status-warning/10' : 
                       'border-destructive text-destructive bg-destructive/10'
                    }`}>
                      {outOfRangeCount}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Indicateurs cliniques problématiques : surveiller DC, IC, et RVS
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {outOfRangeCount} indicateur{outOfRangeCount > 1 ? 's' : ''} hors cible sur {totalIndicators}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                       const statusColor = indicator.status === 'critical' ? 'bg-destructive' : indicator.status === 'warning' ? 'bg-status-warning' : 'bg-muted-foreground';
                      return (
                        <div 
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected ? 'bg-primary/10 border-2 border-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedIndicators(prev =>
                              prev.includes(indicator.label)
                                ? prev.filter(label => label !== indicator.label)
                                : [...prev, indicator.label]
                            );
                          }}
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-foreground">
                                {indicator.label} : {indicator.value}{indicator.unit}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Click on an indicator to display it in the chart
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Targets */}
            <Card className="border-2 border-border">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setChecklistExpanded(!checklistExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      monitoringAdherence >= 90 ? 'border-muted-foreground text-muted-foreground bg-muted/50' : 
                       monitoringAdherence >= 80 ? 'border-status-warning text-status-warning bg-status-warning/10' : 
                       'border-destructive text-destructive bg-destructive/10'
                    }`}>
                      {monitoringAdherence}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Adhérence globale des cibles de monitorage
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {targetOutOfRangeCount} cibles à surveiller
                      </p>
                    </div>
                  </div>
                  {checklistExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {checklistExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      const statusColor = target.status === 'critical' ? 'bg-destructive' : target.status === 'warning' ? 'bg-status-warning' : 'bg-muted-foreground';
                      return (
                        <div 
                          key={index}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-all"
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-medium text-foreground">
                                {target.label} : {target.value}{target.unit || ''}
                              </p>
                              <span className={`text-xs font-medium ${
                                target.status === 'critical' ? 'text-destructive' : 
                                target.status === 'warning' ? 'text-status-warning' : 'text-muted-foreground'
                              }`}>
                                {target.adherencePercentage}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{target.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  {timeRange === 'stay' ? 'Monitoring (Séjour complet)' : `Monitoring (${timeRange.toUpperCase()})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] border-2 border-border rounded-lg p-4">
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">Select clinical indicators below to display their trends</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedIndicators.map(label => {
                          const indicator = clinicalIndicators.find(i => i.label === label);
                          if (!indicator) return null;
                           const statusColor = indicator.status === 'critical' ? 'bg-destructive' : indicator.status === 'warning' ? 'bg-status-warning' : 'bg-muted-foreground';
                           return (
                             <Badge key={label} className={`${statusColor} text-status-critical-fg`}>
                              {label}: {indicator.value}{indicator.unit}
                            </Badge>
                          );
                        })}
                      </div>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" style={{ fontSize: '12px' }} />
                            <YAxis style={{ fontSize: '12px' }} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {selectedIndicators.map(label => (
                              <Line 
                                key={label} 
                                type="monotone" 
                                dataKey={label} 
                                stroke={getIndicatorColor(label)} 
                                strokeWidth={2} 
                                dot={false}
                                activeDot={{ r: 4 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        
      </main>
    </div>
  );
};

export default Optiheart;
