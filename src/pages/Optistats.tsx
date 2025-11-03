import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPatientById } from '@/utils/patientData';
import { Heart, Thermometer, Activity, Droplet, Gauge, Pill, Check, FileText, Users, Brain, ChevronRight } from 'lucide-react';

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

  const therapeuticTabs = [
    { icon: Pill, label: 'Prescriptions', active: true },
    { icon: Check, label: 'Access', active: false },
    { icon: FileText, label: 'Investigation', active: false },
    { icon: Users, label: 'Consultants', active: false },
  ];

  const problematicIndicators = [
    {
      module: 'brain',
      icon: Brain,
      color: 'text-red-500',
      indicators: [
        { label: 'PIC : 27mmHg', target: '< 20mmHg', trend: '-10.4%', trendColor: 'bg-orange-100 text-orange-600', status: 'red' },
        { label: 'PPC: 73mmHg', target: '60-70 mmHg', trend: '-29.4%', trendColor: 'bg-red-100 text-red-600', status: 'red' },
        { label: 'INR : 1,54', target: '< 1,2', trend: null, trendColor: '', status: 'red' },
      ]
    },
    {
      module: 'general',
      icon: Thermometer,
      color: 'text-orange-500',
      indicators: [
        { label: 'Tête : 32°', target: '0-30°', trend: null, trendColor: '', status: 'orange' },
      ]
    },
    {
      module: 'heart',
      icon: Heart,
      color: 'text-orange-500',
      indicators: [
        { label: 'RM : 150 bpm', target: '86-123 bpm', trend: '-49.4%', trendColor: 'bg-red-100 text-red-600', status: 'orange' },
      ]
    },
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

        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Therapeutic Actions and Problematic Indicators
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Therapeutic actions section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Therapeutic actions</h3>
              
              {/* Tabs */}
              <div className="flex gap-4 mb-4">
                {therapeuticTabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`flex items-center gap-2 text-sm ${
                      tab.active ? 'text-primary font-medium' : 'text-gray-600'
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${
                      tab.active 
                        ? index === 0 ? 'text-blue-500' 
                        : index === 1 ? 'text-gray-700'
                        : index === 2 ? 'text-orange-600'
                        : 'text-blue-400'
                        : 'text-gray-500'
                    }`} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>3 hours ago</span>
                <span>Now</span>
              </div>

              {/* Medications timeline */}
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="bg-blue-200 text-blue-900 px-3 py-2 rounded text-sm font-medium">
                    Mannitol
                  </div>
                  <div className="bg-blue-400 text-white px-3 py-2 rounded text-sm font-medium">
                    Midazolam + Ceftriaxone + Gentamicine + Metronidazole
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium">
                    Urinary catheter
                  </div>
                  <div className="bg-gray-100 rounded"></div>
                </div>
              </div>
            </div>

            {/* Problematic Indicators section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Problematic Indicators</h3>
              
              {/* Table header */}
              <div className="grid grid-cols-[80px_200px_150px_120px_1fr_50px] gap-4 mb-3 text-xs font-medium text-gray-600 pb-2 border-b">
                <div>Module</div>
                <div>Problematic Indicators</div>
                <div>Clinical target</div>
                <div>Trend</div>
                <div>Indicator Analysis</div>
                <div></div>
              </div>

              {/* Table rows */}
              <div className="space-y-4">
                {problematicIndicators.map((item, itemIndex) => (
                  <div key={itemIndex}>
                    {item.indicators.map((indicator, indicatorIndex) => (
                      <div 
                        key={indicatorIndex}
                        className="grid grid-cols-[80px_200px_150px_120px_1fr_50px] gap-4 items-center py-3 border-b border-gray-100"
                      >
                        {/* Module icon - only show on first row */}
                        <div>
                          {indicatorIndex === 0 && (
                            <div className={`w-10 h-10 rounded-lg ${
                              indicator.status === 'red' ? 'bg-red-100' : 'bg-orange-100'
                            } flex items-center justify-center`}>
                              <item.icon className={item.color} size={24} />
                            </div>
                          )}
                        </div>

                        {/* Problematic indicator */}
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            indicator.status === 'red' ? 'bg-red-500' : 'bg-orange-500'
                          }`}></div>
                          <span className="text-sm font-medium text-gray-900">{indicator.label}</span>
                        </div>

                        {/* Clinical target */}
                        <div className="text-sm text-gray-600">{indicator.target}</div>

                        {/* Trend */}
                        <div>
                          {indicator.trend && (
                            <Badge className={`${indicator.trendColor} text-xs px-2 py-1`}>
                              {indicator.trend}
                            </Badge>
                          )}
                        </div>

                        {/* Indicator Analysis - mini chart placeholder */}
                        <div className="h-16 bg-gray-50 rounded flex items-center justify-center">
                          <div className="w-full h-12 flex items-end justify-around px-2">
                            {[...Array(20)].map((_, i) => (
                              <div 
                                key={i} 
                                className="w-1 bg-gray-300 rounded-t"
                                style={{ height: `${Math.random() * 100}%` }}
                              ></div>
                            ))}
                          </div>
                        </div>

                        {/* Arrow button */}
                        <div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optistats;
