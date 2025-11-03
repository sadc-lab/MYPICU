import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Heart, Thermometer, Activity, Droplet, Gauge } from 'lucide-react';

const Optistats = () => {
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

  const vitalSigns = [
    { icon: Heart, label: 'Heart Rate', value: '98', unit: 'bpm', color: 'text-red-500' },
    { icon: Thermometer, label: 'Temperature', value: '37.2', unit: '°C', color: 'text-orange-500' },
    { icon: Activity, label: 'Resp. Rate', value: '22', unit: '/min', color: 'text-blue-500' },
    { icon: Droplet, label: 'SpO2', value: '98', unit: '%', color: 'text-green-500' },
    { icon: Gauge, label: 'BP', value: '110/70', unit: 'mmHg', color: 'text-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optistats" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {vitalSigns.map((vital, index) => (
            <Card key={index} className="bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <vital.icon className={`h-5 w-5 ${vital.color}`} />
                  {vital.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{vital.value}</div>
                <p className="text-xs text-gray-500 mt-1">{vital.unit}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Vital Signs Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-400">Chart will be displayed here</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Therapeutic Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Prescriptions</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• Paracetamol 500mg</p>
                  <p>• Amoxicillin 250mg</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Access</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• Peripheral IV - Left arm</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Investigations</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>• Blood culture - Pending</p>
                  <p>• {patient.exam || 'No recent exams'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Medical Antecedents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {patient.diagnosis}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optistats;
