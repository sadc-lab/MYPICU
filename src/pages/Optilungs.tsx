import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPatientById } from '@/utils/patientData';
import { Wind, Gauge, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';

const Optilungs = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [objectives, setObjectives] = useState<string[]>([
    'Maintain SpO2 > 92%',
    'Lung protective ventilation (TV 6-8 mL/kg IBW)',
    'Plateau pressure < 30 cmH2O',
    'Optimize PEEP for recruitment'
  ]);
  const [interventions, setInterventions] = useState<string[]>([
    'FiO2 reduced from 50% to 40%',
    'Recruitment maneuver performed',
    'Prone positioning considered'
  ]);
  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [isEditingInterventions, setIsEditingInterventions] = useState(false);
  const [editedInterventions, setEditedInterventions] = useState<string[]>([]);

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
            <CardTitle className="text-base font-semibold text-gray-900">Métriques Pulmonaires</CardTitle>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Objectifs & Interventions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Objectives Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-700">Objectifs Actuels:</h4>
                {!isEditingObjectives ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedObjectives([...objectives]);
                      setIsEditingObjectives(true);
                    }}
                    className="h-8 gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setObjectives(editedObjectives);
                        setIsEditingObjectives(false);
                      }}
                      className="h-8 gap-1 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingObjectives(false);
                        setEditedObjectives([]);
                      }}
                      className="h-8 gap-1 text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingObjectives ? (
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {editedObjectives.map((objective, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={objective}
                        onChange={(e) => {
                          const newObjectives = [...editedObjectives];
                          newObjectives[index] = e.target.value;
                          setEditedObjectives(newObjectives);
                        }}
                        className="text-sm"
                        placeholder="Enter objective..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newObjectives = editedObjectives.filter((_, i) => i !== index);
                          setEditedObjectives(newObjectives);
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditedObjectives([...editedObjectives, ''])}
                    className="h-8 gap-1 text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Add Objective
                  </Button>
                </div>
              )}
            </div>

            {/* Interventions Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-700">Interventions Récentes:</h4>
                {!isEditingInterventions ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedInterventions([...interventions]);
                      setIsEditingInterventions(true);
                    }}
                    className="h-8 gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInterventions(editedInterventions);
                        setIsEditingInterventions(false);
                      }}
                      className="h-8 gap-1 text-green-600 hover:text-green-700"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingInterventions(false);
                        setEditedInterventions([]);
                      }}
                      className="h-8 gap-1 text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingInterventions ? (
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {interventions.map((intervention, index) => (
                    <li key={index}>{intervention}</li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {editedInterventions.map((intervention, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={intervention}
                        onChange={(e) => {
                          const newInterventions = [...editedInterventions];
                          newInterventions[index] = e.target.value;
                          setEditedInterventions(newInterventions);
                        }}
                        className="text-sm"
                        placeholder="Enter intervention..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newInterventions = editedInterventions.filter((_, i) => i !== index);
                          setEditedInterventions(newInterventions);
                        }}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditedInterventions([...editedInterventions, ''])}
                    className="h-8 gap-1 text-sm"
                  >
                    <Plus className="h-3 w-3" />
                    Add Intervention
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optilungs;
