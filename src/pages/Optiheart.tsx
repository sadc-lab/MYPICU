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
    { label: 'Cardiac Output', value: '4.5', unit: 'L/min', normal: '4-8', status: 'normal' },
    { label: 'Cardiac Index', value: '3.2', unit: 'L/min/m²', normal: '2.5-4.0', status: 'normal' },
    { label: 'CVP', value: '8', unit: 'mmHg', normal: '2-8', status: 'normal' },
    { label: 'SVR', value: '1200', unit: 'dynes/sec/cm⁻⁵', normal: '800-1200', status: 'normal' },
    { label: 'Lactate', value: '1.2', unit: 'mmol/L', normal: '<2', status: 'normal' },
    { label: 'ScvO2', value: '72', unit: '%', normal: '65-75', status: 'normal' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-orange-500 bg-orange-50';
      default: return 'border-green-500 bg-green-50';
    }
  };

  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optiheart" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {heartMetrics.map((metric, index) => (
            <Card key={index} className={`bg-white shadow-sm border-l-4 ${getStatusColor(metric.status)}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {metric.value}
                  {metric.unit && <span className="text-lg ml-1 text-gray-600">{metric.unit}</span>}
                </div>
                <p className="text-xs text-gray-500">Normal: {metric.normal}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HeartIcon className="h-5 w-5 text-red-500" size={20} />
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
                <Badge className="bg-green-100 text-green-700">Sinus Rhythm</Badge>
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
