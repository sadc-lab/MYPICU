import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Activity } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';

const Optiheart = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);

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
                      {metric.unit && <span className="text-lg ml-1">{metric.unit}</span>}
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
