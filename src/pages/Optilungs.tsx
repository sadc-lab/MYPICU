import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Wind, Gauge } from 'lucide-react';

const Optilungs = () => {
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

  const lungMetrics = [
    { label: 'PaO2', value: 95, unit: 'mmHg', min: 60, max: 120, targetMin: 80, targetMax: 100 },
    { label: 'PaCO2', value: 38, unit: 'mmHg', min: 25, max: 55, targetMin: 35, targetMax: 45 },
    { label: 'pH', value: 7.38, unit: '', min: 7.2, max: 7.6, targetMin: 7.35, targetMax: 7.45 },
    { label: 'FiO2', value: 40, unit: '%', min: 21, max: 100, targetMin: 21, targetMax: 30 },
    { label: 'P/F Ratio', value: 238, unit: '', min: 100, max: 500, targetMin: 300, targetMax: 500 },
    { label: 'SpO2', value: 98, unit: '%', min: 85, max: 100, targetMin: 94, targetMax: 100 },
  ];

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

  const ventilatorSettings = [
    { label: 'Mode', value: 'SIMV' },
    { label: 'Tidal Volume', value: '300 mL' },
    { label: 'PEEP', value: '5 cmH2O' },
    { label: 'Rate', value: '18 /min' },
    { label: 'Peak Pressure', value: '22 cmH2O' },
    { label: 'Compliance', value: '45 mL/cmH2O' },
  ];


  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optilungs" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Lung Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lungMetrics.map((metric, index) => {
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wind className="h-5 w-5 text-primary" />
                Respiratory Mechanics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-400">Pressure-Volume loop will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Ventilator Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ventilatorSettings.map((setting, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{setting.label}:</span>
                  <span className="font-semibold text-sm text-gray-900">{setting.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Blood Gas Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">PaO2/FiO2 Ratio</span>
                  <span className="font-semibold text-gray-900">238</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Base Excess</span>
                  <span className="font-semibold text-gray-900">-2 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">HCO3</span>
                  <span className="font-semibold text-gray-900">24 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Lactate</span>
                  <span className="font-semibold text-gray-900">1.2 mmol/L</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Oxygenation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Oxygenation Index</span>
                    <Badge className="bg-gray-100 text-gray-600">5.5</Badge>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-500" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Alveolar-arterial Gradient</span>
                    <Badge className="bg-orange-100 text-orange-700">35 mmHg</Badge>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Objectives & Interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Current Objectives:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Maintain SpO2 &gt; 92%</li>
                <li>Lung protective ventilation (TV 6-8 mL/kg IBW)</li>
                <li>Plateau pressure &lt; 30 cmH2O</li>
                <li>Optimize PEEP for recruitment</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Recent Interventions:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>FiO2 reduced from 50% to 40%</li>
                <li>Recruitment maneuver performed</li>
                <li>Prone positioning considered</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optilungs;
