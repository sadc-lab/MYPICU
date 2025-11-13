import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getPatientById } from '@/utils/patientData';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
const Optibrain = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [checkedTasks, setCheckedTasks] = useState({
    pupils: false,
    etco2: false,
    pam: false,
    pvc: false,
    nutrition: false,
    epilepsy: false,
    fentanyl: false,
    propofol: false
  });
  const totalTasks = Object.keys(checkedTasks).length;
  const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
  const completionPercentage = Math.round(completedTasks / totalTasks * 100);
  if (!patient) {
    return <div className="min-h-screen bg-[#EDF2F9]">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>Patient not found</p>
        </div>
      </div>;
  }
  const brainMetrics = [{
    label: 'ICP',
    value: 15,
    unit: 'mmHg',
    min: 0,
    max: 30,
    targetMin: 7,
    targetMax: 15
  }, {
    label: 'CPP',
    value: 65,
    unit: 'mmHg',
    min: 30,
    max: 90,
    targetMin: 50,
    targetMax: 70
  }, {
    label: 'GCS',
    value: 12,
    unit: '',
    min: 3,
    max: 15,
    targetMin: 13,
    targetMax: 15
  }, {
    label: 'PaCO2',
    value: 38,
    unit: 'mmHg',
    min: 25,
    max: 55,
    targetMin: 35,
    targetMax: 45
  }];
  const brainOptimisationMetrics = [{
    label: 'État Neuro',
    value: 'Hyperhémie',
    displayValue: 'Hyperhémie',
    unit: '',
    status: 'warning',
    hasDetails: true,
    dialogKey: 'neuro'
  }, {
    label: 'PIC',
    value: '26 mmHg',
    displayValue: '26',
    unit: 'mmHg',
    status: 'warning',
    hasDetails: true,
    dialogKey: 'pic'
  }, {
    label: 'PPC Opt',
    value: '65 mmHg',
    displayValue: '65',
    unit: 'mmHg',
    status: 'normal',
    hasDetails: true,
    dialogKey: 'ppc'
  }];
  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };
  const clinicalIndicators = [{
    label: 'PaCO2',
    value: 38,
    unit: 'mmHg',
    target: '35-45mmHg',
    status: 'normal'
  }, {
    label: 'PIC',
    value: 27,
    unit: 'mmHg',
    target: '< 20mmHg',
    status: 'critical'
  }, {
    label: 'PPC',
    value: 73,
    unit: 'mmHg',
    target: '60-70 mmHg',
    status: 'warning'
  }, {
    label: 'INR',
    value: 1.54,
    unit: '',
    target: '< 1.2',
    status: 'critical'
  }, {
    label: 'Tête',
    value: 32,
    unit: '°',
    target: '0-30°',
    status: 'warning'
  }, {
    label: 'Hb',
    value: 8,
    unit: 'g/dL',
    target: '> 7g/dl',
    status: 'normal'
  }, {
    label: 'Temp.',
    value: 35.8,
    unit: '°C',
    target: '35-38°C',
    status: 'normal'
  }, {
    label: 'Plaquettes',
    value: 179,
    unit: 'g/L',
    target: '> 100 g/L',
    status: 'normal'
  }, {
    label: 'Glycémie',
    value: 5.9,
    unit: 'mmol/L',
    target: '5-11 mmol/L',
    status: 'normal'
  }];

  // Calculate clinical adherence
  const totalIndicators = clinicalIndicators.length;
  const normalIndicators = clinicalIndicators.filter(i => i.status === 'normal').length;
  const clinicalAdherence = Math.round(normalIndicators / totalIndicators * 100);
  const outOfRangeCount = clinicalIndicators.filter(i => i.status !== 'normal').length;

  // Generate mock chart data for the last 24 hours
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:00`;
      const dataPoint: any = {
        time: timeStr
      };
      clinicalIndicators.forEach(indicator => {
        const baseValue = indicator.value;
        // Add some random variation to make it look realistic
        const variation = (Math.random() - 0.5) * (baseValue * 0.2);
        dataPoint[indicator.label] = Math.round((baseValue + variation) * 100) / 100;
      });
      data.push(dataPoint);
    }
    return data;
  }, []);

  // Group selected indicators by unit
  const groupedIndicators = useMemo(() => {
    const groups: Record<string, string[]> = {};
    selectedIndicators.forEach(label => {
      const indicator = clinicalIndicators.find(i => i.label === label);
      if (indicator) {
        const unit = indicator.unit || 'sans unité';
        if (!groups[unit]) {
          groups[unit] = [];
        }
        groups[unit].push(label);
      }
    });
    return groups;
  }, [selectedIndicators]);

  // Color mapping for chart lines based on status
  const getIndicatorColor = (label: string) => {
    const indicator = clinicalIndicators.find(i => i.label === label);
    if (!indicator) return '#9ca3af';
    return indicator.status === 'critical' ? '#ef4444' : indicator.status === 'warning' ? '#fb923c' : '#9ca3af';
  };
  return <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optibrain" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Brain Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {brainMetrics.map((metric, index) => {
              const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
              const valueColor = inRange ? 'text-gray-600' : 'text-red-500';
              return <div key={index} className="flex flex-col items-center">
                      <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                        {metric.label}
                      </div>
                      <div className={`text-4xl font-bold ${valueColor} mb-3`}>
                        {metric.value}
                      </div>
                      
                      <div className="w-full max-w-[180px]">
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
                          <div className="absolute top-0 bottom-0 bg-gray-300 rounded-full" style={{
                      left: `${(metric.targetMin - metric.min) / (metric.max - metric.min) * 100}%`,
                      width: `${(metric.targetMax - metric.targetMin) / (metric.max - metric.min) * 100}%`
                    }}></div>
                          <div className={`absolute w-3 h-3 rounded-full border-2 ${inRange ? 'bg-gray-500 border-gray-600' : 'bg-red-500 border-red-600'} z-10 top-0`} style={{
                      left: `${Math.max(0, Math.min(100, (metric.value - metric.min) / (metric.max - metric.min) * 100))}%`,
                      transform: 'translateX(-50%)'
                    }}></div>
                        </div>
                        <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                          <span>{metric.targetMin}</span>
                          <span>{metric.targetMax}</span>
                        </div>
                      </div>
                    </div>;
            })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Brain Optimisation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-8">
              {brainOptimisationMetrics.map((metric, index) => {
              const statusColor = metric.status === 'warning' ? 'text-orange-500' : 'text-gray-600';
              return <div key={index} className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors" onClick={() => metric.hasDetails && setOpenDialog(metric.dialogKey || null)}>
                      <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                        {metric.label}
                      </div>
                      <div className={`text-4xl font-bold ${statusColor} mb-2`}>
                        {metric.displayValue}
                      </div>
                      {metric.hasDetails && <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                          <Info className="h-3 w-3" />
                          <span>Voir détails</span>
                        </div>}
                    </div>;
            })}
            </div>
          </CardContent>
        </Card>

        {/* Neurological State Dialog */}
        <Dialog open={openDialog === 'neuro'} onOpenChange={open => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>État Neurologique</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                <span className="text-orange-500 font-semibold">Hyperhémie</span> depuis : 3am
              </p>
              <div className="space-y-3">
                {[{
                label: 'Hyperhémie',
                percent: 40,
                status: 'warning'
              }, {
                label: 'HTIC / Hyp.',
                percent: 30,
                status: 'warning'
              }, {
                label: 'Ischémie',
                percent: 10,
                status: 'warning'
              }, {
                label: 'Contrôlé',
                percent: 20,
                status: 'normal'
              }].map((state, index) => <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{state.label}</span>
                      <span className={state.status === 'normal' ? 'text-gray-600 font-semibold' : 'text-orange-500 font-semibold'}>
                        {state.percent}%
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={state.status === 'normal' ? 'h-full bg-gray-400' : 'h-full bg-blue-400'} style={{
                    width: `${state.percent}%`
                  }}>
                      </div>
                    </div>
                  </div>)}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                <span className="text-orange-500 font-semibold">Hyperhémie</span> depuis : 3am. Risque de HTIC + ischémie
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PIC Dialog */}
        <Dialog open={openDialog === 'pic'} onOpenChange={open => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>PIC (Pression Intracrânienne)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Intensité actuelle : <span className="text-orange-500 font-semibold">26 mmHg</span> | Intensité moyenne : <span className="text-orange-500 font-semibold">28 mmHg</span>
              </p>
              <div className="space-y-3">
                {[{
                label: '25 - 30 mmHg',
                time: 128,
                status: 'warning'
              }, {
                label: '20 - 25 mmHg',
                time: 30,
                status: 'warning'
              }, {
                label: '> 30 mmHg',
                time: 2,
                status: 'critical'
              }, {
                label: '< 20 mmHg',
                time: 20,
                status: 'normal'
              }].map((level, index) => <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{level.label}</span>
                      <span className={level.status === 'critical' ? 'text-red-500 font-semibold' : level.status === 'warning' ? 'text-orange-500 font-semibold' : 'text-gray-600 font-semibold'}>
                        {level.time} min
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={level.status === 'critical' ? 'h-full bg-red-400' : level.status === 'warning' ? 'h-full bg-blue-400' : 'h-full bg-gray-400'} style={{
                    width: `${level.time / 180 * 100}%`
                  }}>
                      </div>
                    </div>
                  </div>)}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                Intensité actuelle : <span className="text-orange-500 font-semibold">26 mmHg</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PPC Optimal Dialog */}
        <Dialog open={openDialog === 'ppc'} onOpenChange={open => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>PPC Optimale</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Actuelle : <span className="text-gray-600 font-semibold">65 mmHg</span> | Moyenne : <span className="text-gray-600 font-semibold">63 mmHg</span>
              </p>
              <div className="space-y-3">
                {[{
                label: '60 - 70 mmHg',
                time: 145,
                status: 'normal'
              }, {
                label: '50 - 60 mmHg',
                time: 25,
                status: 'warning'
              }, {
                label: '> 70 mmHg',
                time: 8,
                status: 'warning'
              }, {
                label: '< 50 mmHg',
                time: 2,
                status: 'critical'
              }].map((level, index) => <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{level.label}</span>
                      <span className={level.status === 'critical' ? 'text-red-500 font-semibold' : level.status === 'warning' ? 'text-orange-500 font-semibold' : 'text-gray-600 font-semibold'}>
                        {level.time} min
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={level.status === 'critical' ? 'h-full bg-red-400' : level.status === 'warning' ? 'h-full bg-blue-400' : 'h-full bg-gray-400'} style={{
                    width: `${level.time / 180 * 100}%`
                  }}>
                      </div>
                    </div>
                  </div>)}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                PPC actuelle : <span className="text-gray-600 font-semibold">65 mmHg</span>
                <span className="ml-4">PPC moyenne : <span className="text-gray-600 font-semibold">63 mmHg</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">Monitoring   
              

            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[300px] border-2 border-gray-200 rounded-lg p-4">
              {selectedIndicators.length === 0 ? <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400">Sélectionnez des indicateurs ci-dessous pour afficher leurs tendances</p>
                </div> : <div className="h-full flex flex-col">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedIndicators.map(label => {
                  const indicator = clinicalIndicators.find(i => i.label === label);
                  if (!indicator) return null;
                  const statusColor = indicator.status === 'critical' ? 'bg-red-500' : indicator.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                  return <div key={label} className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200">
                          <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                          <span className="text-xs text-gray-700">{label}</span>
                        </div>;
                })}
                  </div>
                  <div className="flex-1 flex gap-4">
                    {Object.entries(groupedIndicators).map(([unit, indicators]) => <div key={unit} className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-2 text-center">
                          {unit && unit !== 'sans unité' ? `Unité: ${unit}` : 'Sans unité'}
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="time" tick={{
                          fontSize: 12
                        }} stroke="#9ca3af" />
                            <YAxis tick={{
                          fontSize: 12
                        }} stroke="#9ca3af" label={{
                          value: unit !== 'sans unité' ? unit : '',
                          angle: -90,
                          position: 'insideLeft',
                          style: {
                            fontSize: 12,
                            fill: '#9ca3af'
                          }
                        }} />
                            <Tooltip contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }} />
                            <Legend wrapperStyle={{
                          fontSize: '12px'
                        }} />
                            {indicators.map(label => <Line key={label} type="monotone" dataKey={label} stroke={getIndicatorColor(label)} strokeWidth={2} dot={false} activeDot={{
                          r: 4
                        }} />)}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>)}
                  </div>
                </div>}
            </div>

              {/* Clinical Indicators Adherence */}
              <Card className="border-2 border-gray-200">
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${clinicalAdherence >= 90 ? 'border-gray-400 text-gray-600 bg-gray-50' : clinicalAdherence >= 80 ? 'border-orange-400 text-orange-600 bg-orange-50' : 'border-red-400 text-red-600 bg-red-50'}`}>
                        {clinicalAdherence}%
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">
                          Adhérence globale des indicateurs cliniques : surveiller PIC, PPC, INR et tête
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {outOfRangeCount} indicateurs à surveiller
                        </p>
                      </div>
                    </div>
                    {clinicalExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                  </div>
                </CardHeader>
                {clinicalExpanded && <CardContent className="pt-0">
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      {clinicalIndicators.map((indicator, index) => {
                  const isSelected = selectedIndicators.includes(indicator.label);
                  const statusColor = indicator.status === 'critical' ? 'bg-red-500' : indicator.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                  return <div key={index} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50'}`} onClick={() => {
                    setSelectedIndicators(prev => prev.includes(indicator.label) ? prev.filter(label => label !== indicator.label) : [...prev, indicator.label]);
                  }}>
                            <div className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}></div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {indicator.label} : {indicator.value}{indicator.unit}
                              </p>
                              <p className="text-xs text-gray-500">{indicator.target}</p>
                            </div>
                          </div>;
                })}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Cliquez sur un indicateur pour l'afficher dans le graphique
                    </p>
                  </CardContent>}
              </Card>

              {/* Monitoring Tasks Checklist */}
              <Card className="border-2 border-gray-200">
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setChecklistExpanded(!checklistExpanded)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${completionPercentage === 100 ? 'border-green-500 text-green-600 bg-green-50' : completionPercentage >= 50 ? 'border-blue-400 text-blue-600 bg-blue-50' : 'border-red-400 text-red-600 bg-red-50'}`}>
                        {completionPercentage}%
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">
                          Adhérence globale des cibles de monitorage : faire pupilles et ETCO2
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {completedTasks} tâches sur {totalTasks} à faire
                        </p>
                      </div>
                    </div>
                    {checklistExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                  </div>
                </CardHeader>
                {checklistExpanded && <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="pupils" checked={checkedTasks.pupils} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    pupils: checked as boolean
                  }))} />
                        <label htmlFor="pupils" className="text-sm text-gray-700 cursor-pointer">
                          Pupilles : N/A
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="etco2" checked={checkedTasks.etco2} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    etco2: checked as boolean
                  }))} />
                        <label htmlFor="etco2" className="text-sm text-gray-700 cursor-pointer">
                          ETCO2
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="pam" checked={checkedTasks.pam} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    pam: checked as boolean
                  }))} />
                        <label htmlFor="pam" className="text-sm text-gray-700 cursor-pointer">
                          PAM
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="pvc" checked={checkedTasks.pvc} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    pvc: checked as boolean
                  }))} />
                        <label htmlFor="pvc" className="text-sm text-gray-700 cursor-pointer">
                          PVC
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="nutrition" checked={checkedTasks.nutrition} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    nutrition: checked as boolean
                  }))} />
                        <label htmlFor="nutrition" className="text-sm text-gray-700 cursor-pointer">
                          Nutrition
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="epilepsy" checked={checkedTasks.epilepsy} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    epilepsy: checked as boolean
                  }))} />
                        <label htmlFor="epilepsy" className="text-sm text-gray-700 cursor-pointer">
                          Epilepsie
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="fentanyl" checked={checkedTasks.fentanyl} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    fentanyl: checked as boolean
                  }))} />
                        <label htmlFor="fentanyl" className="text-sm text-gray-700 cursor-pointer">
                          Fentanyl
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="propofol" checked={checkedTasks.propofol} onCheckedChange={checked => setCheckedTasks(prev => ({
                    ...prev,
                    propofol: checked as boolean
                  }))} />
                        <label htmlFor="propofol" className="text-sm text-gray-700 cursor-pointer">
                          Propofol
                        </label>
                      </div>
                    </div>
                  </CardContent>}
              </Card>
          </CardContent>
        </Card>

        <Card className="mt-6 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Objectives & Interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Current Objectives:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Maintain ICP &lt; 20 mmHg</li>
                <li>Maintain CPP 50-70 mmHg</li>
                <li>Normocapnia (PaCO2 35-45 mmHg)</li>
                <li>Head of bed elevated 30°</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Recent Interventions:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Osmotherapy with mannitol administered</li>
                <li>Sedation optimized</li>
                <li>Continuous ICP monitoring</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>;
};
export default Optibrain;