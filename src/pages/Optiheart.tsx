import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPatientById } from '@/utils/patientData';
import { Info, ChevronDown, ChevronUp, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Optiheart = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'now' | '3h' | '6h' | '12h' | '24h' | 'stay'>('24h');
  const [objectives, setObjectives] = useState<string[]>([
    'Maintain MAP > 65 mmHg',
    'Cardiac index > 2.5 L/min/m²',
    'Lactate < 2 mmol/L',
    'ScvO2 > 70%'
  ]);
  const [interventions, setInterventions] = useState<string[]>([
    'Fluid resuscitation completed',
    'Inotropic support optimized',
    'Continuous hemodynamic monitoring'
  ]);
  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [isEditingInterventions, setIsEditingInterventions] = useState(false);
  const [editedInterventions, setEditedInterventions] = useState<string[]>([]);
  const [checkedTasks, setCheckedTasks] = useState({
    map: false,
    cardiacOutput: false,
    lactate: false,
    scvo2: false,
    fluidBalance: false,
    inotropes: false,
    vasopressors: false,
    echocardiography: false
  });
  
  const totalTasks = Object.keys(checkedTasks).length;
  const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
  const completionPercentage = Math.round(completedTasks / totalTasks * 100);

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

  const heartMetrics = [
    { label: 'Cardiac Output', value: 4.5, unit: 'L/min', min: 2, max: 10, targetMin: 4, targetMax: 8 },
    { label: 'Cardiac Index', value: 3.2, unit: 'L/min/m²', min: 1.5, max: 5, targetMin: 2.5, targetMax: 4.0 },
    { label: 'CVP', value: 8, unit: 'mmHg', min: 0, max: 15, targetMin: 2, targetMax: 8 },
    { label: 'SVR', value: 1200, unit: 'dynes/sec/cm⁻⁵', min: 500, max: 1600, targetMin: 800, targetMax: 1200 },
    { label: 'Lactate', value: 1.2, unit: 'mmol/L', min: 0, max: 4, targetMin: 0, targetMax: 2 },
    { label: 'ScvO2', value: 72, unit: '%', min: 50, max: 85, targetMin: 65, targetMax: 75 },
  ];

  const heartOptimisationMetrics = [
    {
      label: 'État Cardiaque',
      value: 'Choc cardiogénique',
      displayValue: 'Choc cardiogénique',
      unit: '',
      status: 'critical',
      hasDetails: true,
      dialogKey: 'cardiac'
    },
    {
      label: 'VAP Prediction 1',
      value: '75%',
      displayValue: '75',
      unit: '%',
      status: 'warning',
      hasDetails: true,
      dialogKey: 'vap1'
    },
    {
      label: 'VAP Prediction 2',
      value: '62%',
      displayValue: '62',
      unit: '%',
      status: 'normal',
      hasDetails: true,
      dialogKey: 'vap2'
    }
  ];

  const clinicalIndicators = [
    { label: 'MAP', value: 72, unit: 'mmHg', target: '> 65 mmHg', status: 'normal' },
    { label: 'FC', value: 98, unit: 'bpm', target: '60-100 bpm', status: 'normal' },
    { label: 'DC', value: 3.2, unit: 'L/min', target: '4.5-6.0 L/min', status: 'critical' },
    { label: 'IC', value: 2.1, unit: 'L/min/m²', target: '2.5-4.0 L/min/m²', status: 'critical' },
    { label: 'RVS', value: 1450, unit: 'dynes/s/cm⁻⁵', target: '800-1200 dynes/s/cm⁻⁵', status: 'warning' },
    { label: 'CVP', value: 8, unit: 'mmHg', target: '2-8 mmHg', status: 'normal' },
    { label: 'Lactate', value: 1.2, unit: 'mmol/L', target: '< 2 mmol/L', status: 'normal' },
    { label: 'ScvO2', value: 72, unit: '%', target: '> 70%', status: 'normal' },
    { label: 'PAPO', value: 12, unit: 'mmHg', target: '6-12 mmHg', status: 'normal' }
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
                    <div className={`text-4xl font-bold ${valueColor} mb-3`}>
                      {metric.value}
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
            <div className="grid grid-cols-3 gap-8">
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
                    <div className={`text-4xl font-bold ${statusColor} mb-2`}>
                      {metric.displayValue}
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

        {/* VAP Prediction 1 Dialog */}
        <Dialog open={openDialog === 'vap1'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>VAP Prediction 1 - Risk Assessment</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Prediction Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-700">
                    Prédictions VAP module 1 : <span className="font-normal text-gray-500">dernières 48 heures</span>
                  </h3>
                </div>
                
                {/* Percentage Badge */}
                <div className="flex justify-center mb-4">
                  <div className="inline-block px-4 py-1 border-2 border-gray-300 rounded-full">
                    <span className="text-xl font-semibold text-gray-700">77.9%</span>
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
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
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
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>FiO2 : <span className="font-semibold">N/A</span></span>
                    <span>PEEP : <span className="font-semibold">N/A</span></span>
                    <span>Fiabilité : <span className="font-semibold text-orange-500">77.9%</span></span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Recommendations:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Enhance respiratory hygiene protocols</li>
                  <li>Review sedation levels</li>
                  <li>Consider probiotic prophylaxis</li>
                  <li>Monitor ventilator settings</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* VAP Prediction 2 Dialog */}
        <Dialog open={openDialog === 'vap2'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>VAP Prediction 2 - Alternative Model</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Prediction Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-700">
                    Prédictions VAP module 2 : <span className="font-normal text-gray-500">dernières 48 heures</span>
                  </h3>
                </div>
                
                {/* Percentage Badge */}
                <div className="flex justify-center mb-4">
                  <div className="inline-block px-4 py-1 border-2 border-gray-300 rounded-full">
                    <span className="text-xl font-semibold text-gray-700">80.1%</span>
                  </div>
                </div>

                {/* Gradient Bar */}
                <div className="mb-6">
                  <div className="relative h-8 rounded-full overflow-hidden flex">
                    <div className="w-[10%] bg-red-500"></div>
                    <div className="w-[10%] bg-red-400"></div>
                    <div className="w-[10%] bg-orange-500"></div>
                    <div className="w-[10%] bg-orange-400"></div>
                    <div className="w-[10%] bg-yellow-400"></div>
                    <div className="w-[10%] bg-yellow-300"></div>
                    <div className="w-[10%] bg-lime-400"></div>
                    <div className="w-[10%] bg-lime-300"></div>
                    <div className="w-[10%] bg-green-400"></div>
                    <div className="w-[10%] bg-green-500"></div>
                  </div>
                  
                  {/* Scale markers */}
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
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
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>FiO2 : <span className="font-semibold">N/A</span></span>
                    <span>PEEP : <span className="font-semibold">N/A</span></span>
                    <span>Fiabilité : <span className="font-semibold text-green-500">80.1%</span></span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Preventive Measures:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Maintain head-of-bed elevation 30-45°</li>
                  <li>Implement daily sedation interruption</li>
                  <li>Oral hygiene with chlorhexidine</li>
                  <li>Regular endotracheal cuff pressure check</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Adhérence & Monitoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Clinical Indicators Adherence */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      clinicalAdherence >= 90 ? 'border-gray-400 text-gray-600 bg-gray-50' : 
                      clinicalAdherence >= 80 ? 'border-orange-400 text-orange-600 bg-orange-50' : 
                      'border-red-400 text-red-600 bg-red-50'
                    }`}>
                      {clinicalAdherence}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Adhérence globale des indicateurs cliniques : surveiller DC, IC, et RVS
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {outOfRangeCount} indicateurs à surveiller
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
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              {indicator.label} : {indicator.value}{indicator.unit}
                            </p>
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

            {/* Monitoring Tasks Checklist */}
            <Card className="border-2 border-gray-200">
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setChecklistExpanded(!checklistExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      completionPercentage >= 90 ? 'border-gray-400 text-gray-600 bg-gray-50' : 
                      completionPercentage >= 80 ? 'border-orange-400 text-orange-600 bg-orange-50' : 
                      'border-red-400 text-red-600 bg-red-50'
                    }`}>
                      {completionPercentage}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Checklist hémodynamique
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {completedTasks} tâches sur {totalTasks} à faire
                      </p>
                    </div>
                  </div>
                  {checklistExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </CardHeader>
              {checklistExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, map: !prev.map }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.map 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.map && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        PAM
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, cardiacOutput: !prev.cardiacOutput }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.cardiacOutput 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.cardiacOutput && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Débit cardiaque
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, lactate: !prev.lactate }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.lactate 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.lactate && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Lactates
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, scvo2: !prev.scvo2 }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.scvo2 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.scvo2 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        ScvO2
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, fluidBalance: !prev.fluidBalance }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.fluidBalance 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.fluidBalance && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Bilan hydrique
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, inotropes: !prev.inotropes }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.inotropes 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.inotropes && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Support inotrope
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, vasopressors: !prev.vasopressors }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.vasopressors 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.vasopressors && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Vasopresseurs
                      </label>
                    </div>
                    <div 
                      className="flex items-center space-x-2 cursor-pointer group"
                      onClick={() => setCheckedTasks(prev => ({ ...prev, echocardiography: !prev.echocardiography }))}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                        checkedTasks.echocardiography 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}>
                        {checkedTasks.echocardiography && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer">
                        Échocardiographie
                      </label>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {timeRange === 'now' ? 'Monitoring (Current)' : timeRange === 'stay' ? 'Monitoring (Séjour complet)' : `Monitoring Last ${timeRange.toUpperCase()}`}
                  </CardTitle>
                  <div className="flex gap-2">
                    {(['now', '3h', '6h', '12h', '24h', 'stay'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                          timeRange === range
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {range === 'now' ? 'Now' : range === 'stay' ? 'Séjour complet' : range.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
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
