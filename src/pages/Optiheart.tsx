import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Activity, Info } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Optiheart = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);

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
      label: 'Débit Cardiaque',
      value: '3.2 L/min',
      displayValue: '3.2',
      unit: 'L/min',
      status: 'warning',
      hasDetails: true,
      dialogKey: 'output'
    },
    {
      label: 'RVS Opt',
      value: '1450 dynes/s/cm⁻⁵',
      displayValue: '1450',
      unit: 'dynes/s/cm⁻⁵',
      status: 'warning',
      hasDetails: true,
      dialogKey: 'svr'
    }
  ];

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
            <CardTitle className="text-base font-semibold text-gray-900">Heart Metrics</CardTitle>
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

        {/* Cardiac Output Dialog */}
        <Dialog open={openDialog === 'output'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Débit Cardiaque Optimal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Débit actuel</p>
                  <p className="text-2xl font-bold text-orange-500">3.2 L/min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Débit cible</p>
                  <p className="text-2xl font-bold text-gray-600">4.5-6.0 L/min</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Recommandations:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Augmenter le support inotrope (Dobutamine)</li>
                  <li>Optimiser la précharge (bolus liquidien)</li>
                  <li>Surveillance continue de l'index cardiaque</li>
                  <li>Échocardiographie de contrôle</li>
                </ul>
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                Index cardiaque actuel : <span className="text-gray-600 font-semibold">2.1 L/min/m²</span>
                <span className="ml-4">Cible : <span className="text-gray-600 font-semibold">2.5-4.0 L/min/m²</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SVR Dialog */}
        <Dialog open={openDialog === 'svr'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Résistances Vasculaires Systémiques Optimales</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">RVS actuelles</p>
                  <p className="text-2xl font-bold text-orange-500">1450 dynes/s/cm⁻⁵</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">RVS cibles</p>
                  <p className="text-2xl font-bold text-gray-600">800-1200 dynes/s/cm⁻⁵</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Interventions suggérées:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Réduire les vasopresseurs progressivement</li>
                  <li>Optimiser la volémie</li>
                  <li>Considérer vasodilatateur si persistance</li>
                  <li>Surveillance de la PAM et lactates</li>
                </ul>
              </div>
              <div className="pt-3 border-t text-sm text-gray-600">
                PAM actuelle : <span className="text-gray-600 font-semibold">72 mmHg</span>
                <span className="ml-4">PAM moyenne : <span className="text-gray-600 font-semibold">70 mmHg</span></span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HeartIcon className="h-7 w-7 text-red-600" size={28} />
                Hemodynamic Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-400">Hemodynamic chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                ECG Rhythm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Current Rhythm</h4>
                <Badge className="bg-gray-100 text-gray-600">Sinus Rhythm</Badge>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Heart Rate</h4>
                <p className="text-2xl font-bold text-gray-900">98 bpm</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Blood Pressure</h4>
                <p className="text-2xl font-bold text-gray-900">110/70</p>
                <p className="text-xs text-gray-500">MAP: 83 mmHg</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Vasoactive Support</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Inotropes</h4>
                <p className="text-sm text-gray-600">Dobutamine 5 mcg/kg/min</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Vasopressors</h4>
                <p className="text-sm text-gray-600">None currently</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Fluid Balance</h4>
                <p className="text-sm text-gray-600">+150 mL (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Objectives & Interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Current Objectives:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Maintain MAP &gt; 65 mmHg</li>
                <li>Cardiac index &gt; 2.5 L/min/m²</li>
                <li>Lactate &lt; 2 mmol/L</li>
                <li>ScvO2 &gt; 70%</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Recent Interventions:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Fluid resuscitation completed</li>
                <li>Inotropic support optimized</li>
                <li>Continuous hemodynamic monitoring</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optiheart;
