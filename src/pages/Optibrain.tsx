import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Brain, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
const Optibrain = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
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
    label: 'Head Position',
    value: '30°',
    status: 'normal'
  }, {
    label: 'Temperature',
    value: '37.2°C',
    status: 'normal'
  }, {
    label: 'Hemoglobin',
    value: '12.5 g/dL',
    status: 'normal'
  }, {
    label: 'Platelets',
    value: '180 K/µL',
    status: 'normal'
  }, {
    label: 'Glycemia',
    value: '5.8 mmol/L',
    status: 'normal'
  }, {
    label: 'INR',
    value: '1.1',
    status: 'normal'
  }];
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
                return <div key={index} 
                      className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                      onClick={() => metric.hasDetails && setOpenDialog(metric.dialogKey || null)}>
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
                    </div>;
            })}
            </div>
          </CardContent>
        </Card>

        {/* Neurological State Dialog */}
        <Dialog open={openDialog === 'neuro'} onOpenChange={(open) => !open && setOpenDialog(null)}>
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
                }].map((state, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{state.label}</span>
                      <span className={state.status === 'normal' ? 'text-gray-600 font-semibold' : 'text-orange-500 font-semibold'}>
                        {state.percent}%
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={state.status === 'normal' ? 'h-full bg-gray-400' : 'h-full bg-blue-400'} 
                        style={{ width: `${state.percent}%` }}>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                <span className="text-orange-500 font-semibold">Hyperhémie</span> depuis : 3am. Risque de HTIC + ischémie
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PIC Dialog */}
        <Dialog open={openDialog === 'pic'} onOpenChange={(open) => !open && setOpenDialog(null)}>
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
                }].map((level, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{level.label}</span>
                      <span className={level.status === 'critical' ? 'text-red-500 font-semibold' : level.status === 'warning' ? 'text-orange-500 font-semibold' : 'text-gray-600 font-semibold'}>
                        {level.time} min
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={level.status === 'critical' ? 'h-full bg-red-400' : level.status === 'warning' ? 'h-full bg-blue-400' : 'h-full bg-gray-400'} 
                        style={{ width: `${level.time / 180 * 100}%` }}>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                Intensité actuelle : <span className="text-orange-500 font-semibold">26 mmHg</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PPC Optimal Dialog */}
        <Dialog open={openDialog === 'ppc'} onOpenChange={(open) => !open && setOpenDialog(null)}>
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
                }].map((level, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{level.label}</span>
                      <span className={level.status === 'critical' ? 'text-red-500 font-semibold' : level.status === 'warning' ? 'text-orange-500 font-semibold' : 'text-gray-600 font-semibold'}>
                        {level.time} min
                      </span>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div className={level.status === 'critical' ? 'h-full bg-red-400' : level.status === 'warning' ? 'h-full bg-blue-400' : 'h-full bg-gray-400'} 
                        style={{ width: `${level.time / 180 * 100}%` }}>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                PPC actuelle : <span className="text-gray-600 font-semibold">65 mmHg</span>
                <span className="ml-4">PPC moyenne : <span className="text-gray-600 font-semibold">63 mmHg</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                ICP Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-400">ICP trend chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Clinical Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {clinicalIndicators.map((indicator, index) => <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">{indicator.label}</p>
                    <p className="font-semibold text-sm text-gray-900">{indicator.value}</p>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </div>

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