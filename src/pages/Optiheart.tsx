import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { TourChecklist } from '@/components/TourChecklist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPatientById } from '@/utils/patientData';
import { Info, ChevronDown, ChevronUp, Edit2, Check, X, Plus, Trash2, Minus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { heartMetrics as importedHeartMetrics } from '@/utils/organMetrics';
import { useTimeRange } from '@/hooks/useTimeRange';

const Optiheart = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const metricParam = searchParams.get('metric');
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  const [objectives, setObjectives] = useState<string[]>([
    'Maintain MAP > 65 mmHg',
    'Cardiac index > 2.5 L/min/m²',
    'Lactate < 2 mmol/L',
    'ScvO2 > 70%'
  ]);
  const [interventions, setInterventions] = useState<string[]>([
    'Fluid resuscitation completed',
    'Inotropic support optimized',
    'Continuous hemodynamic monitorage'
  ]);
  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [isEditingInterventions, setIsEditingInterventions] = useState(false);
  const [editedInterventions, setEditedInterventions] = useState<string[]>([]);
  const monitoringTargets = [
    { label: 'PAM', value: 72, unit: 'mmHg', target: '> 65 mmHg', status: 'normal', trend: 'up', change: 3 },
    { label: 'Débit cardiaque', value: 3.2, unit: 'L/min', target: '4.5-6.0 L/min', status: 'critical', trend: 'up', change: 0.4 },
    { label: 'Lactates', value: 1.2, unit: 'mmol/L', target: '< 2 mmol/L', status: 'normal', trend: 'down', change: -0.2 },
    { label: 'ScvO2', value: 72, unit: '%', target: '> 70%', status: 'normal', trend: 'up', change: 2 },
    { label: 'Bilan hydrique', value: '+500', unit: 'mL', target: 'Équilibré', status: 'warning', trend: 'stable', change: 0 },
    { label: 'Support inotrope', value: 'Dobutamine 5', unit: 'mcg/kg/min', target: 'Selon besoin', status: 'normal', trend: 'stable' },
    { label: 'Vasopresseurs', value: 'Noradré 0.15', unit: 'mcg/kg/min', target: 'Selon MAP', status: 'normal', trend: 'down', change: -0.05 },
    { label: 'Échocardiographie', value: 'FEVG 35%', target: 'Contrôle régulier', status: 'critical', trend: 'stable' }
  ];
  
  const totalTargets = monitoringTargets.length;
  const normalTargets = monitoringTargets.filter(t => t.status === 'normal').length;
  const monitoringAdherence = Math.round(normalTargets / totalTargets * 100);
  const targetOutOfRangeCount = monitoringTargets.filter(t => t.status !== 'normal').length;

  if (!patient) {
    return (
      <div className="min-h-screen bg-[#EDF2F9]">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>Patient not found</p>
        </div>
      </div>
    );
  }

  const heartMetrics = importedHeartMetrics;

  const heartOptimisationMetrics = [
    {
      label: 'État Cardiaque',
      value: 'Choc cardiogénique',
      displayValue: 'Choc cardiogénique',
      unit: '',
      status: 'critical',
      hasDetails: true,
      dialogKey: 'cardiac',
      trend: 'stable'
    }
  ];

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
      case 'now':
        dataPoints = 1;
        intervalMinutes = 0;
        break;
      case '3h':
        dataPoints = 18;
        intervalMinutes = 10;
        break;
      case '6h':
        dataPoints = 24;
        intervalMinutes = 15;
        break;
      case '12h':
        dataPoints = 24;
        intervalMinutes = 30;
        break;
      case '24h':
        dataPoints = 24;
        intervalMinutes = 60;
        break;
      case 'stay':
        dataPoints = 48; // One point every 2 hours for a typical ICU stay
        intervalMinutes = 120;
        break;
      default:
        dataPoints = 24;
        intervalMinutes = 60;
        break;
    }
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      const timeStr = timeRange === 'now' 
        ? 'Now'
        : `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      
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
    return indicator.status === 'critical' ? '#ef4444' : indicator.status === 'warning' ? '#fb923c' : '#9ca3af';
  };

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optiheart" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <TourChecklist compact patientId={patientId} />
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Métriques Cardiaques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {heartMetrics.map((metric, index) => {
                const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                const valueColor = inRange ? 'text-gray-600' : 'text-red-500';
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                      {metric.label}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`text-4xl font-bold ${valueColor}`}>
                        {metric.value}
                      </div>
                    </div>
                    
                    <div className="w-full max-w-[180px]">
                      {/* Range bar */}
                      <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
                        {/* Target range (light grey zone) */}
                        <div 
                          className="absolute top-0 bottom-0 bg-gray-300 rounded-full"
                          style={{
                            left: `${((metric.targetMin - metric.min) / (metric.max - metric.min)) * 100}%`,
                            width: `${((metric.targetMax - metric.targetMin) / (metric.max - metric.min)) * 100}%`
                          }}>
                        </div>
                        
                        {/* Current value position on bar */}
                        <div 
                          className={`absolute w-3 h-3 rounded-full border-2 ${
                            inRange ? 'bg-gray-500 border-gray-600' : 'bg-red-500 border-red-600'
                          } z-10 top-0`}
                          style={{
                            left: `${Math.max(0, Math.min(100, ((metric.value - metric.min) / (metric.max - metric.min)) * 100))}%`,
                            transform: 'translateX(-50%)'
                          }}>
                        </div>
                      </div>
                      
                      {/* Target range labels */}
                      <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                        <span>{metric.targetMin}</span>
                        <span>{metric.targetMax}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Heart Optimisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8">
              {heartOptimisationMetrics.map((metric, index) => {
                const statusColor = metric.status === 'critical' ? 'text-red-500' : metric.status === 'warning' ? 'text-orange-500' : 'text-gray-600';
                return (
                  <div 
                    key={index} 
                    className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                    onClick={() => metric.hasDetails && setOpenDialog(metric.dialogKey || null)}
                  >
                    <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                      {metric.label}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`text-4xl font-bold ${statusColor}`}>
                        {metric.displayValue}
                      </div>
                    </div>
                    {metric.hasDetails && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <Info className="h-3 w-3" />
                        <span>Voir détails</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cardiac State Dialog */}
        <Dialog open={openDialog === 'cardiac'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>État Cardiaque</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                <span className="text-red-500 font-semibold">Choc cardiogénique</span> depuis : 2am
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
                      <span className="text-gray-700">{state.label}</span>
                      <span className={
                        state.status === 'critical' ? 'text-red-500 font-semibold' :
                        state.status === 'warning' ? 'text-orange-500 font-semibold' :
                        'text-gray-600 font-semibold'
                      }>
                        {state.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          state.status === 'critical' ? 'bg-red-500' :
                          state.status === 'warning' ? 'bg-orange-400' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${state.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                Débit cardiaque actuel : <span className="text-gray-600 font-semibold">3.2 L/min</span>
                <span className="ml-4">Débit moyen : <span className="text-gray-600 font-semibold">3.5 L/min</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Adhérence & Monitorage</CardTitle>
              <div className="flex gap-2">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      timeRange === range
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Clinical Indicators */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      outOfRangeCount === 0 ? 'border-gray-400 text-gray-600 bg-gray-50' : 
                      outOfRangeCount <= 2 ? 'border-orange-400 text-orange-600 bg-orange-50' : 
                      'border-red-400 text-red-600 bg-red-50'
                    }`}>
                      {outOfRangeCount}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Indicateurs cliniques problématiques : surveiller DC, IC, et RVS
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {outOfRangeCount} indicateur{outOfRangeCount > 1 ? 's' : ''} hors cible sur {totalIndicators}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const statusColor = indicator.status === 'critical' ? 'bg-red-500' : indicator.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                      return (
                        <div 
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setSelectedIndicators(prev =>
                              prev.includes(indicator.label)
                                ? prev.filter(label => label !== indicator.label)
                                : [...prev, indicator.label]
                            );
                          }}
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-gray-700">
                                {indicator.label} : {indicator.value}{indicator.unit}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Click on an indicator to display it in the chart
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Targets */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setChecklistExpanded(!checklistExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      monitoringAdherence >= 90 ? 'border-gray-400 text-gray-600 bg-gray-50' : 
                      monitoringAdherence >= 80 ? 'border-orange-400 text-orange-600 bg-orange-50' : 
                      'border-red-400 text-red-600 bg-red-50'
                    }`}>
                      {monitoringAdherence}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Adhérence globale des cibles de monitorage
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {targetOutOfRangeCount} cibles à surveiller
                      </p>
                    </div>
                  </div>
                  {checklistExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </CardHeader>
              {checklistExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      const statusColor = target.status === 'critical' ? 'bg-red-500' : target.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                      return (
                        <div 
                          key={index}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-gray-700">
                                {target.label} : {target.value}{target.unit || ''}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">{target.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">
                  {timeRange === 'now' ? 'Monitoring (Maintenant)' : timeRange === 'stay' ? 'Monitoring (Séjour complet)' : `Monitoring (${timeRange.toUpperCase()})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] border-2 border-gray-200 rounded-lg p-4">
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-400">Select clinical indicators below to display their trends</p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedIndicators.map(label => {
                          const indicator = clinicalIndicators.find(i => i.label === label);
                          if (!indicator) return null;
                          const statusColor = indicator.status === 'critical' ? 'bg-red-500' : indicator.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                          return (
                            <Badge key={label} className={`${statusColor} text-white`}>
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

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Objectifs & Interventions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Objectives Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-700">Objectifs Actuels:</h4>
                {!isEditingObjectives ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedObjectives([...objectives]);
                      setIsEditingObjectives(true);
                    }}
                    className="h-8 gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setObjectives(editedObjectives);
                        setIsEditingObjectives(false);
                      }}
                      className="h-8 gap-1 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingObjectives(false);
                        setEditedObjectives([]);
                      }}
                      className="h-8 gap-1 text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingObjectives ? (
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {editedObjectives.map((objective, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={objective}
                        onChange={(e) => {
                          const newObjectives = [...editedObjectives];
                          newObjectives[index] = e.target.value;
                          setEditedObjectives(newObjectives);
                        }}
                        className="text-sm"
                        placeholder="Enter objective..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newObjectives = editedObjectives.filter((_, i) => i !== index);
                          setEditedObjectives(newObjectives);
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditedObjectives([...editedObjectives, ''])}
                    className="h-8 gap-1 text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Add Objective
                  </Button>
                </div>
              )}
            </div>

            {/* Interventions Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-700">Interventions Récentes:</h4>
                {!isEditingInterventions ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedInterventions([...interventions]);
                      setIsEditingInterventions(true);
                    }}
                    className="h-8 gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInterventions(editedInterventions);
                        setIsEditingInterventions(false);
                      }}
                      className="h-8 gap-1 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingInterventions(false);
                        setEditedInterventions([]);
                      }}
                      className="h-8 gap-1 text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingInterventions ? (
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {interventions.map((intervention, index) => (
                    <li key={index}>{intervention}</li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {editedInterventions.map((intervention, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={intervention}
                        onChange={(e) => {
                          const newInterventions = [...editedInterventions];
                          newInterventions[index] = e.target.value;
                          setEditedInterventions(newInterventions);
                        }}
                        className="text-sm"
                        placeholder="Enter intervention..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newInterventions = editedInterventions.filter((_, i) => i !== index);
                          setEditedInterventions(newInterventions);
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditedInterventions([...editedInterventions, ''])}
                    className="h-8 gap-1 text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Add Intervention
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optiheart;
