import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPatientById } from '@/utils/patientData';
import { Wind, Gauge, Edit2, Check, X, Plus, Trash2, Info, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { lungMetrics as importedLungMetrics } from '@/utils/organMetrics';
import { useTimeRange } from '@/hooks/useTimeRange';

const Optilungs = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const metricParam = searchParams.get('metric');
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
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
          <p>Patient non trouvé</p>
        </div>
      </div>
    );
  }

  const lungMetrics = importedLungMetrics;

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

  const ventilatorSettings = [
    { label: 'Mode', value: 'SIMV' },
    { label: 'Volume courant', value: '300 mL' },
    { label: 'PEEP', value: '5 cmH2O' },
    { label: 'Fréquence', value: '18 /min' },
    { label: 'Pression crête', value: '22 cmH2O' },
    { label: 'Compliance', value: '45 mL/cmH2O' },
  ];

  const clinicalIndicators = [
    { label: 'SpO2', value: 95, unit: '%', target: '> 92%', status: 'normal', trend: 'stable', change: 0 },
    { label: 'PaO2', value: 75, unit: 'mmHg', target: '80-100 mmHg', status: 'warning', trend: 'up', change: 3 },
    { label: 'PaCO2', value: 42, unit: 'mmHg', target: '35-45 mmHg', status: 'normal', trend: 'stable', change: 0 },
    { label: 'pH', value: 7.38, unit: '', target: '7.35-7.45', status: 'normal', trend: 'stable', change: 0 },
    { label: 'FiO2', value: 45, unit: '%', target: '< 40%', status: 'warning', trend: 'down', change: -5 },
    { label: 'P/F Ratio', value: 167, unit: '', target: '> 300', status: 'critical', trend: 'up', change: 12 },
    { label: 'Pplat', value: 28, unit: 'cmH2O', target: '< 30 cmH2O', status: 'normal', trend: 'stable', change: 0 },
    { label: 'Driving P', value: 14, unit: 'cmH2O', target: '< 15 cmH2O', status: 'normal', trend: 'down', change: -1 },
    { label: 'Compliance', value: 32, unit: 'mL/cmH2O', target: '> 40 mL/cmH2O', status: 'warning', trend: 'up', change: 2 },
  ];

  const totalIndicators = clinicalIndicators.length;
  const outOfRangeCount = clinicalIndicators.filter(i => i.status !== 'normal').length;


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

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Optimisation Pulmonaire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8">
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                onClick={() => setOpenDialog('vap1')}
              >
                <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  VAP Prediction 1
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-orange-500">75</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                  <Info className="h-3 w-3" />
                  <span>Voir détails</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VAP Prediction 1 Dialog */}
        <Dialog open={openDialog === 'vap1'} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>VAP Prediction 1 - Risk Assessment</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Prediction Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-700">
                    Prédictions VAP module 1 : <span className="font-normal text-gray-500">dernières 48 heures</span>
                  </h3>
                </div>
                
                {/* Percentage Badge */}
                <div className="flex justify-center mb-4">
                  <div className="inline-block px-4 py-1 border-2 border-gray-300 rounded-full">
                    <span className="text-xl font-semibold text-gray-700">77.9%</span>
                  </div>
                </div>

                {/* Gradient Bar */}
                <div className="mb-6">
                  <div className="relative h-8 rounded-full overflow-hidden flex">
                    <div className="w-[10%] bg-red-500"></div>
                    <div className="w-[10%] bg-red-400"></div>
                    <div className="w-[10%] bg-orange-400"></div>
                    <div className="w-[10%] bg-orange-300"></div>
                    <div className="w-[10%] bg-yellow-300"></div>
                    <div className="w-[10%] bg-yellow-200"></div>
                    <div className="w-[10%] bg-lime-300"></div>
                    <div className="w-[10%] bg-lime-400"></div>
                    <div className="w-[10%] bg-green-400"></div>
                    <div className="w-[10%] bg-green-500"></div>
                  </div>
                  
                  {/* Scale markers */}
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40</span>
                    <span>50</span>
                    <span>60</span>
                    <span>70</span>
                    <span>80</span>
                    <span>90</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>FiO2 : <span className="font-semibold">N/A</span></span>
                    <span>PEEP : <span className="font-semibold">N/A</span></span>
                    <span>Fiabilité : <span className="font-semibold text-orange-500">77.9%</span></span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Recommandations :</p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>Renforcer les protocoles d'hygiène respiratoire</li>
                  <li>Revoir les niveaux de sédation</li>
                  <li>Considérer la prophylaxie probiotique</li>
                  <li>Surveiller les paramètres du ventilateur</li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clinical Indicators Section */}
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Indicateurs Cliniques</CardTitle>
              <div className="flex gap-2">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      timeRange === range
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Card className="border-2 border-gray-200">
              <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      outOfRangeCount === 0 ? 'border-gray-400 text-gray-600 bg-gray-50' : 
                      outOfRangeCount <= 2 ? 'border-orange-400 text-orange-600 bg-orange-50' : 
                      'border-red-400 text-red-600 bg-red-50'
                    }`}>
                      {outOfRangeCount}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">
                        Indicateurs respiratoires problématiques : surveiller PaO2, FiO2, P/F Ratio
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {outOfRangeCount} indicateur{outOfRangeCount > 1 ? 's' : ''} hors cible sur {totalIndicators}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const statusColor = indicator.status === 'critical' ? 'bg-red-500' : indicator.status === 'warning' ? 'bg-orange-400' : 'bg-gray-400';
                      return (
                        <div 
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected ? 'bg-blue-50 border-2 border-blue-400' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => {
                            setSelectedIndicators(prev =>
                              prev.includes(indicator.label)
                                ? prev.filter(label => label !== indicator.label)
                                : [...prev, indicator.label]
                            );
                          }}
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-gray-700">
                                {indicator.label} : {indicator.value}{indicator.unit}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rappels section */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-gray-700">Rappels</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        "Objectif de Bilan Entrée/Sortie",
                        "Prophylaxie Thrombose veineuse",
                        "Prophylaxie Ulcère de stress",
                        "Fréquence des radios",
                        "Fréquence des labos",
                        "Équipement à retirer",
                        "Limites d'alarmes et fréquence de surveillance",
                        "Mesures d'isolement",
                      ].map((item, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                          <span className="h-2 w-2 rounded-full bg-primary/60 shrink-0 mt-1" />
                          <span className="text-xs text-gray-600 leading-tight">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wind className="h-5 w-5 text-primary" />
                Mécanique Respiratoire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-400">Courbe Pression-Volume affichée ici</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Paramètres du Ventilateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ventilatorSettings.map((setting, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{setting.label} :</span>
                  <span className="font-semibold text-sm text-gray-900">{setting.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Analyse des Gaz du Sang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Ratio PaO2/FiO2</span>
                  <span className="font-semibold text-gray-900">238</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Excès de Base</span>
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
              <CardTitle className="text-lg">Statut d'Oxygénation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Index d'Oxygénation</span>
                    <Badge className="bg-gray-100 text-gray-600">5.5</Badge>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-500" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Gradient Alvéolo-artériel</span>
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
