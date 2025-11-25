import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPatientById } from '@/utils/patientData';
import { Thermometer, Activity, Droplet, Gauge, Pill, Check, FileText, Users, Brain, ChevronRight } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';

const Optistats = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);

  if (!patient) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>Patient not found</p>
        </div>
      </div>
    );
  }

  const vitalSigns = [
    { 
      label: 'FC', 
      fullLabel: 'Heart Rate',
      value: 130, 
      min: 60,
      targetMin: 80,
      targetMax: 120,
      max: 140,
      unit: 'bpm'
    },
    { 
      label: 'TAM', 
      fullLabel: 'Blood Pressure',
      value: 70, 
      min: 60,
      targetMin: 78,
      targetMax: 85,
      max: 100,
      unit: 'mmHg'
    },
    { 
      label: 'FR', 
      fullLabel: 'Resp. Rate',
      value: 25, 
      min: 15,
      targetMin: 20,
      targetMax: 30,
      max: 35,
      unit: '/min'
    },
    { 
      label: 'T°', 
      fullLabel: 'Temperature',
      value: 37, 
      min: 34,
      targetMin: 35,
      targetMax: 37,
      max: 39,
      unit: '°C'
    },
    { 
      label: 'SPO2', 
      fullLabel: 'SpO2',
      value: 95, 
      min: 80,
      targetMin: 90,
      targetMax: 100,
      max: 100,
      unit: '%'
    },
  ];

  const isInRange = (value: number, targetMin: number, targetMax: number) => {
    return value >= targetMin && value <= targetMax;
  };

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
      icon: HeartIcon,
      color: 'text-orange-500',
      indicators: [
        { label: 'RM : 150 bpm', target: '86-123 bpm', trend: '-49.4%', trendColor: 'bg-red-100 text-red-600', status: 'orange' },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optistats" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Signes Vitaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {vitalSigns.map((vital, index) => {
                const inRange = isInRange(vital.value, vital.targetMin, vital.targetMax);
                const valueColor = inRange ? 'text-muted-foreground' : 'text-destructive';
                
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {vital.label}
                    </div>
                    <div className={`text-4xl font-bold ${valueColor} mb-3`}>
                      {vital.value}
                    </div>
                    
                    <div className="w-full max-w-[180px]">
                      {/* Range bar */}
                      <div className="relative h-3 bg-muted rounded-full overflow-visible">
                        {/* Target range (light grey zone) */}
                        <div 
                          className="absolute top-0 bottom-0 bg-muted/70 rounded-full"
                          style={{
                            left: `${((vital.targetMin - vital.min) / (vital.max - vital.min)) * 100}%`,
                            width: `${((vital.targetMax - vital.targetMin) / (vital.max - vital.min)) * 100}%`
                          }}>
                        </div>
                        
                        {/* Current value position on bar */}
                        <div 
                          className={`absolute w-3 h-3 rounded-full border-2 ${
                            inRange ? 'bg-muted-foreground border-foreground' : 'bg-destructive border-destructive'
                          } z-10 top-0`}
                          style={{
                            left: `${Math.max(0, Math.min(100, ((vital.value - vital.min) / (vital.max - vital.min)) * 100))}%`,
                            transform: 'translateX(-50%)'
                          }}>
                        </div>
                      </div>
                      
                      {/* Target range labels */}
                      <div className="flex justify-between items-center mt-1.5 text-xs text-muted-foreground">
                        <span>{vital.targetMin}</span>
                        <span>{vital.targetMax}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="text-lg font-semibold">
              Actions Thérapeutiques et Indicateurs Problématiques
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Therapeutic actions section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-foreground mb-4">Actions thérapeutiques</h3>
              
              {/* Tabs */}
              <div className="flex gap-4 mb-4">
                {therapeuticTabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`flex items-center gap-2 text-sm ${
                      tab.active ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${
                      tab.active 
                        ? index === 0 ? 'text-blue-500 dark:text-blue-400' 
                        : index === 1 ? 'text-foreground'
                        : index === 2 ? 'text-orange-600 dark:text-orange-400'
                        : 'text-blue-400 dark:text-blue-300'
                        : 'text-muted-foreground'
                    }`} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>3 hours ago</span>
                <span>Now</span>
              </div>

              {/* Medications timeline */}
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-3 py-2 rounded text-sm font-medium">
                    Mannitol
                  </div>
                  <div className="bg-blue-400 dark:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Midazolam + Ceftriaxone + Gentamicine + Metronidazole
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="bg-muted text-muted-foreground px-3 py-2 rounded text-sm font-medium">
                    Urinary catheter
                  </div>
                  <div className="bg-muted rounded"></div>
                </div>
              </div>
            </div>

            {/* Problematic Indicators section */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Problematic Indicators</h3>
              
              {/* Table header */}
              <div className="grid grid-cols-[80px_200px_150px_120px_1fr_50px] gap-4 mb-3 text-xs font-medium text-muted-foreground pb-2 border-b">
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
                        className="grid grid-cols-[80px_200px_150px_120px_1fr_50px] gap-4 items-center py-3 border-b"
                      >
                        {/* Module icon - only show on first row */}
                        <div>
                          {indicatorIndex === 0 && (
                            <div className={`w-10 h-10 rounded-lg ${
                              indicator.status === 'red' ? 'bg-red-100 dark:bg-red-950' : 'bg-orange-100 dark:bg-orange-950'
                            } flex items-center justify-center`}>
                              <item.icon className={item.color} size={24} />
                            </div>
                          )}
                        </div>

                        {/* Problematic indicator */}
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            indicator.status === 'red' ? 'bg-red-500 dark:bg-red-400' : 'bg-orange-500 dark:bg-orange-400'
                          }`}></div>
                          <span className="text-sm font-medium text-foreground">{indicator.label}</span>
                        </div>

                        {/* Clinical target */}
                        <div className="text-sm text-muted-foreground">{indicator.target}</div>

                        {/* Trend */}
                        <div>
                          {indicator.trend && (
                            <Badge className={`${indicator.trendColor} text-xs px-2 py-1`}>
                              {indicator.trend}
                            </Badge>
                          )}
                        </div>

                        {/* Indicator Analysis - mini chart placeholder */}
                        <div className="h-16 bg-muted rounded flex items-center justify-center">
                          <div className="w-full h-12 flex items-end justify-around px-2">
                            {[...Array(20)].map((_, i) => (
                              <div 
                                key={i} 
                                className="w-1 bg-muted-foreground/30 rounded-t"
                                style={{ height: `${Math.random() * 100}%` }}
                              ></div>
                            ))}
                          </div>
                        </div>

                        {/* Arrow button */}
                        <div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
