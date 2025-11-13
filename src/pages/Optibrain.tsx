import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Brain, Eye } from 'lucide-react';

const Optibrain = () => {
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

  const brainMetrics = [
    { label: 'ICP (Intracranial Pressure)', value: '15', unit: 'mmHg', normal: '7-15', status: 'normal' },
    { label: 'CPP (Cerebral Perfusion Pressure)', value: '65', unit: 'mmHg', normal: '50-70', status: 'normal' },
    { label: 'GCS (Glasgow Coma Scale)', value: '12', unit: '', normal: '15', status: 'warning' },
    { label: 'PaCO2', value: '38', unit: 'mmHg', normal: '35-45', status: 'normal' },
  ];

  const clinicalIndicators = [
    { label: 'Head Position', value: '30°', status: 'normal' },
    { label: 'Temperature', value: '37.2°C', status: 'normal' },
    { label: 'Hemoglobin', value: '12.5 g/dL', status: 'normal' },
    { label: 'Platelets', value: '180 K/µL', status: 'normal' },
    { label: 'Glycemia', value: '5.8 mmol/L', status: 'normal' },
    { label: 'INR', value: '1.1', status: 'normal' },
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
      <PatientHeader currentPage="optibrain" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {brainMetrics.map((metric, index) => (
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Pupil Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Left Pupil</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size: 3mm</span>
                  <Badge className="bg-green-100 text-green-700">Reactive</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Right Pupil</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size: 3mm</span>
                  <Badge className="bg-green-100 text-green-700">Reactive</Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Both pupils equal, round, and reactive to light
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Clinical Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {clinicalIndicators.map((indicator, index) => (
                <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">{indicator.label}</p>
                  <p className="font-semibold text-sm text-gray-900">{indicator.value}</p>
                </div>
              ))}
            </div>
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
    </div>
  );
};

export default Optibrain;
