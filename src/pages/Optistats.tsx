import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Table, LayoutGrid } from 'lucide-react';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPatientById } from '@/utils/patientData';
import { ChevronRight, Minus } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { getProblematicIndicators } from '@/utils/organMetrics';
import { MiniMetricChart } from '@/components/MiniMetricChart';
import { BodyDiagram } from '@/components/BodyDiagram';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Optistats = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [timeRange, setTimeRange] = useState<'now' | '3h' | '6h' | '12h' | '24h' | 'stay'>('24h');
  const [viewMode, setViewMode] = useState<'table' | 'diagram'>('table');

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

  // Get problematic indicators dynamically from organ metrics
  const dynamicIndicators = getProblematicIndicators();
  
  // Group indicators by organ
  const groupedIndicators = dynamicIndicators.reduce((acc, indicator) => {
    if (!acc[indicator.organ]) {
      acc[indicator.organ] = [];
    }
    acc[indicator.organ].push(indicator);
    return acc;
  }, {} as Record<string, typeof dynamicIndicators>);

  // Convert to the format expected by the UI
  const problematicIndicators = Object.entries(groupedIndicators).map(([organ, indicators]) => {
    const getOrganIconSrc = () => {
      switch (organ) {
        case 'brain': return brainIcon;
        case 'heart': return null; // Will use HeartIcon component
        case 'lungs': return lungsIcon;
        default: return null;
      }
    };

    const getColorFilter = (status: string) => {
      if (status === 'critical') {
        return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'; // red
      }
      return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'; // orange
    };

    const getHeartColor = (status: string) => {
      if (status === 'critical') {
        return 'text-red-600 dark:text-red-400';
      }
      return 'text-orange-600 dark:text-orange-400';
    };

    return {
      module: organ,
      iconSrc: getOrganIconSrc(),
      colorFilter: getColorFilter,
      heartColor: getHeartColor,
      indicators: indicators.map(ind => ({
        label: `${ind.label}: ${ind.current}`,
        target: ind.target,
        trend: ind.trend,
        trendIcon: ind.trend,
        trendColor: ind.status === 'critical' 
          ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400' 
          : 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400',
        status: ind.status === 'critical' ? 'red' : 'orange'
      }))
    };
  });

  const handleIndicatorClick = (organ: string, metricLabel: string) => {
    const organPageMap: Record<string, string> = {
      'brain': 'optibrain',
      'heart': 'optiheart',
      'lungs': 'optilungs'
    };
    
    const page = organPageMap[organ];
    if (page) {
      // Extract just the metric name (before the colon if present)
      const metricName = metricLabel.split(':')[0].trim();
      navigate(`/${page}?patient=${encodeURIComponent(patientId)}&metric=${encodeURIComponent(metricName)}`);
    }
  };

  // Prepare data for body diagram
  const problematicOrgans = Object.entries(groupedIndicators).map(([organ, indicators]) => {
    const hasCritical = indicators.some(ind => ind.status === 'critical');
    return {
      organ,
      status: hasCritical ? 'critical' as const : 'warning' as const,
      count: indicators.length
    };
  });

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
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Indicateurs Problématiques
              </CardTitle>
              <div className="flex items-center gap-3">
                <Label htmlFor="view-mode" className="text-sm text-muted-foreground flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  Tableau
                </Label>
                <Switch
                  id="view-mode"
                  checked={viewMode === 'diagram'}
                  onCheckedChange={(checked) => setViewMode(checked ? 'diagram' : 'table')}
                />
                <Label htmlFor="view-mode" className="text-sm text-muted-foreground flex items-center gap-2">
                  Schéma
                  <LayoutGrid className="h-4 w-4" />
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {viewMode === 'table' ? (
              /* Table View */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Problematic Indicators</h3>
                  
                  {/* Time Range Selector */}
                  <div className="flex gap-2">
                    {(['now', '3h', '6h', '12h', '24h', 'stay'] as const).map((range) => (
                      <Button
                        key={range}
                        variant={timeRange === range ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTimeRange(range)}
                        className="h-8 text-xs"
                      >
                        {range === 'stay' ? 'Full Stay' : range === 'now' ? 'Now' : range}
                      </Button>
                    ))}
                  </div>
                </div>
              
                {/* Table header */}
                <div className="grid grid-cols-[80px_200px_150px_1fr_50px] gap-4 mb-3 text-xs font-medium text-muted-foreground pb-2 border-b">
                  <div>Module</div>
                  <div>Problematic Indicators</div>
                  <div>Clinical target</div>
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
                          className="grid grid-cols-[80px_200px_150px_1fr_50px] gap-4 items-center py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleIndicatorClick(item.module, indicator.label)}
                        >
                          {/* Module icon - only show on first row */}
                          <div>
                            {indicatorIndex === 0 && (
                              <div className={`w-10 h-10 rounded-lg ${
                                indicator.status === 'red' ? 'bg-red-100 dark:bg-red-950' : 'bg-orange-100 dark:bg-orange-950'
                              } flex items-center justify-center`}>
                                {item.module === 'heart' ? (
                                  <HeartIcon className={`h-6 w-6 ${item.heartColor(indicator.status)}`} />
                                ) : (
                                  <img 
                                    src={item.iconSrc} 
                                    alt={item.module} 
                                    className="h-6 w-6"
                                    style={{ filter: item.colorFilter(indicator.status) }}
                                  />
                                )}
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

                          {/* Indicator Analysis - mini chart */}
                          <div className="h-16 bg-background border rounded flex items-center justify-center overflow-hidden">
                            <MiniMetricChart 
                              metricLabel={indicator.label.split(':')[0].trim()} 
                              organ={item.module}
                              timeRange={timeRange}
                            />
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
            ) : (
              /* Diagram View */
              <BodyDiagram 
                problematicOrgans={problematicOrgans}
                patientId={patientId}
                organIndicators={groupedIndicators}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optistats;
