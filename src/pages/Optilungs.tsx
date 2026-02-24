import { useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePatient } from '@/hooks/usePatients';
import { Wind, Gauge, Edit2, Check, X, Plus, Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { lungMetrics as importedLungMetrics } from '@/utils/organMetrics';
import { useTimeRange } from '@/hooks/useTimeRange';
import { TimeWindowSelector } from '@/components/ui/TimeWindowSelector';
import {
  loadPatientFileData,
  hasPatientFileData,
  getAdherenceStatus,
  getValidityData,
  calculateValidityAdherence,
  PatientFileData,
} from '@/services/patientFileData.service';

const Optilungs = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const metricParam = searchParams.get('metric');
  const { data: patient, isLoading } = usePatient(patientId);
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

  // Patient file data state
  const [patientFileData, setPatientFileData] = useState<PatientFileData | null>(null);
  const [fileDataLoading, setFileDataLoading] = useState(false);
  const hasFileData = hasPatientFileData(patientId);

  // Load patient file data
  useEffect(() => {
    if (hasFileData) {
      setFileDataLoading(true);
      loadPatientFileData(patientId)
        .then((data) => setPatientFileData(data))
        .finally(() => setFileDataLoading(false));
    } else {
      setPatientFileData(null);
    }
  }, [patientId, hasFileData]);

  // Map time range to hours for adherence calculation
  const getHoursFromTimeRange = (range: string): number => {
    switch (range) {
      case '3h': return 3;
      case '6h': return 6;
      case '12h': return 12;
      case '24h': return 24;
      case 'stay': return 96;
      default: return 24;
    }
  };

  const hoursForAdherence = getHoursFromTimeRange(timeRange);

  // Lung-specific validity keys mapping
  const lungValidityMapping: Array<{ label: string; validityKey: string | null }> = [
    { label: 'SpO2', validityKey: null },
    { label: 'PaO2', validityKey: null },
    { label: 'PaCO2', validityKey: 'PaCO2Data_validite' },
    { label: 'pH', validityKey: null },
    { label: 'FiO2', validityKey: null },
    { label: 'P/F Ratio', validityKey: null },
    { label: 'Pplat', validityKey: null },
    { label: 'Driving P', validityKey: null },
    { label: 'Compliance', validityKey: null },
    { label: 'ETCO2', validityKey: 'EtCO2Data_validite' },
    { label: 'Température', validityKey: 'TemperatureData_validite' },
  ];

  // Clinical indicators with adherence data
  const clinicalIndicators = useMemo(() => {
    const baseIndicators = [
      { label: 'SpO2', value: 95, unit: '%', target: '> 92%', trend: 'stable', change: 0 },
      { label: 'PaO2', value: 75, unit: 'mmHg', target: '80-100 mmHg', trend: 'up', change: 3 },
      { label: 'PaCO2', value: 42, unit: 'mmHg', target: '35-45 mmHg', trend: 'stable', change: 0 },
      { label: 'pH', value: 7.38, unit: '', target: '7.35-7.45', trend: 'stable', change: 0 },
      { label: 'FiO2', value: 45, unit: '%', target: '< 40%', trend: 'down', change: -5 },
      { label: 'P/F Ratio', value: 167, unit: '', target: '> 300', trend: 'up', change: 12 },
      { label: 'Pplat', value: 28, unit: 'cmH2O', target: '< 30 cmH2O', trend: 'stable', change: 0 },
      { label: 'Driving P', value: 14, unit: 'cmH2O', target: '< 15 cmH2O', trend: 'down', change: -1 },
      { label: 'Compliance', value: 32, unit: 'mL/cmH2O', target: '> 40 mL/cmH2O', trend: 'up', change: 2 },
    ];

    return baseIndicators.map((indicator) => {
      const mapping = lungValidityMapping.find(m => m.label === indicator.label);
      
      if (patientFileData && mapping?.validityKey) {
        const validityData = getValidityData(patientFileData, mapping.validityKey);
        const { percentage, hasData } = calculateValidityAdherence(validityData, hoursForAdherence);
        
        if (hasData) {
          return {
            ...indicator,
            adherencePercentage: percentage,
            status: getAdherenceStatus(percentage),
          };
        }
      }
      
      // Default status based on indicator value ranges
      let defaultStatus: 'normal' | 'warning' | 'critical' = 'normal';
      if (indicator.label === 'PaO2' || indicator.label === 'FiO2' || indicator.label === 'Compliance') {
        defaultStatus = 'warning';
      } else if (indicator.label === 'P/F Ratio') {
        defaultStatus = 'critical';
      }
      
      return {
        ...indicator,
        adherencePercentage: defaultStatus === 'normal' ? 100 : defaultStatus === 'warning' ? 85 : 70,
        status: defaultStatus,
      };
    });
  }, [patientFileData, hoursForAdherence]);

  const totalIndicators = clinicalIndicators.length;
  const outOfRangeCount = clinicalIndicators.filter(i => i.status !== 'normal').length;

  if (!patient) {
    return (
      <div className="min-h-screen bg-background">
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


  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optilungs" />
      
      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Métriques Pulmonaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {lungMetrics.map((metric, index) => {
                const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                const valueColor = inRange ? 'text-muted-foreground' : 'text-destructive';
                
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {metric.label}
                    </div>
                    <div className={`text-4xl font-bold ${valueColor} mb-3`}>
                      {metric.value}
                    </div>
                    
                    <div className="w-full max-w-[180px]">
                      {/* Range bar */}
                      <div className="relative h-3 bg-muted rounded-full overflow-visible">
                        {/* Target range (light grey zone) */}
                        <div 
                          className="absolute top-0 bottom-0 bg-muted/70 rounded-full"
                          style={{
                            left: `${((metric.targetMin - metric.min) / (metric.max - metric.min)) * 100}%`,
                            width: `${((metric.targetMax - metric.targetMin) / (metric.max - metric.min)) * 100}%`
                          }}>
                        </div>
                        
                        {/* Current value position on bar */}
                        <div 
                          className={`absolute w-3 h-3 rounded-full border-2 ${
                            inRange ? 'bg-muted-foreground border-foreground' : 'bg-destructive border-destructive'
                          } z-10 top-0`}
                          style={{
                            left: `${Math.max(0, Math.min(100, ((metric.value - metric.min) / (metric.max - metric.min)) * 100))}%`,
                            transform: 'translateX(-50%)'
                          }}>
                        </div>
                      </div>
                      
                      {/* Target range labels */}
                      <div className="flex justify-between items-center mt-1.5 text-xs text-muted-foreground">
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

        <Card className="shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Optimisation Pulmonaire</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8">
              <div 
                className="flex flex-col items-center cursor-pointer hover:bg-muted/50 p-4 rounded-lg transition-colors"
                onClick={() => setOpenDialog('vap1')}
              >
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  VAP Prediction 1
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-4xl font-bold text-orange-500 dark:text-orange-400">75</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
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
              <div className="border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Prédictions VAP module 1 : <span className="font-normal text-muted-foreground">dernières 48 heures</span>
                  </h3>
                </div>
                
                {/* Percentage Badge */}
                <div className="flex justify-center mb-4">
                  <div className="inline-block px-4 py-1 border-2 border-border rounded-full">
                    <span className="text-xl font-semibold text-foreground">77.9%</span>
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
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
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
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>FiO2 : <span className="font-semibold">N/A</span></span>
                    <span>PEEP : <span className="font-semibold">N/A</span></span>
                    <span>Fiabilité : <span className="font-semibold text-orange-500 dark:text-orange-400">77.9%</span></span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Recommandations :</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
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
        <Card className="shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Indicateurs Cliniques</CardTitle>
              <TimeWindowSelector
                value={timeRange}
                onChange={(value) => setTimeRange(value as any)}
                includeStay={true}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Card className="border-2 border-border">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setClinicalExpanded(!clinicalExpanded)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                      outOfRangeCount === 0 ? 'border-muted-foreground text-muted-foreground bg-muted/50' : 
                      outOfRangeCount <= 2 ? 'border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950' : 
                      'border-destructive text-destructive bg-red-50 dark:bg-red-950'
                    }`}>
                      {outOfRangeCount}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Indicateurs respiratoires problématiques : surveiller PaO2, FiO2, P/F Ratio
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {outOfRangeCount} indicateur{outOfRangeCount > 1 ? 's' : ''} hors cible sur {totalIndicators}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const statusColor = indicator.status === 'critical' ? 'bg-destructive' : indicator.status === 'warning' ? 'bg-orange-400 dark:bg-orange-500' : 'bg-muted-foreground';
                      return (
                        <div 
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                            isSelected ? 'bg-primary/10 border-2 border-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedIndicators(prev =>
                              prev.includes(indicator.label)
                                ? prev.filter(label => label !== indicator.label)
                                : [...prev, indicator.label]
                            );
                          }}
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-medium text-foreground">
                                {indicator.label} : {indicator.value}{indicator.unit}
                              </p>
                              <span className={`text-xs font-medium ${
                                indicator.status === 'critical' ? 'text-destructive' : 
                                indicator.status === 'warning' ? 'text-orange-500 dark:text-orange-400' : 'text-muted-foreground'
                              }`}>
                                {indicator.adherencePercentage}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wind className="h-5 w-5 text-primary" />
                Mécanique Respiratoire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Courbe Pression-Volume affichée ici</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Paramètres du Ventilateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ventilatorSettings.map((setting, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{setting.label} :</span>
                  <span className="font-semibold text-sm text-foreground">{setting.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Analyse des Gaz du Sang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Ratio PaO2/FiO2</span>
                  <span className="font-semibold text-foreground">238</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Excès de Base</span>
                  <span className="font-semibold text-foreground">-2 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">HCO3</span>
                  <span className="font-semibold text-foreground">24 mEq/L</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Lactate</span>
                  <span className="font-semibold text-foreground">1.2 mmol/L</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Statut d'Oxygénation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Index d'Oxygénation</span>
                    <Badge className="bg-muted text-muted-foreground">5.5</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-muted-foreground" style={{ width: '65%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Gradient Alvéolo-artériel</span>
                    <Badge className="bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400">35 mmHg</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 dark:bg-orange-400" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Objectifs & Interventions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Objectives Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-foreground">Objectifs Actuels:</h4>
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
                      className="h-8 gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
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
                      className="h-8 gap-1 text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingObjectives ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
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
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
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
                <h4 className="font-semibold text-sm text-foreground">Interventions Récentes:</h4>
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
                      className="h-8 gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
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
                      className="h-8 gap-1 text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              
              {!isEditingInterventions ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
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
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
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
