// Consolidated organ metrics for the application

export const brainMetrics = [
  {
    label: 'PIC',
    value: 15,
    unit: 'mmHg',
    min: 0,
    max: 30,
    targetMin: 7,
    targetMax: 15,
    trend: 'down',
    change: -2,
    organ: 'brain'
  },
  {
    label: 'PPC',
    value: 65,
    unit: 'mmHg',
    min: 30,
    max: 90,
    targetMin: 50,
    targetMax: 70,
    trend: 'up',
    change: 3,
    organ: 'brain'
  },
  {
    label: 'GCS',
    value: 12,
    unit: '',
    min: 3,
    max: 15,
    targetMin: 13,
    targetMax: 15,
    trend: 'stable',
    change: 0,
    organ: 'brain'
  },
  {
    label: 'PaCO2',
    value: 38,
    unit: 'mmHg',
    min: 25,
    max: 55,
    targetMin: 35,
    targetMax: 45,
    trend: 'down',
    change: -1,
    organ: 'brain'
  }
];

export const heartMetrics = [
  {
    label: 'Cardiac Output',
    value: 4.5,
    unit: 'L/min',
    min: 2,
    max: 10,
    targetMin: 4,
    targetMax: 8,
    trend: 'up',
    change: 0.3,
    organ: 'heart'
  },
  {
    label: 'Cardiac Index',
    value: 3.2,
    unit: 'L/min/m²',
    min: 1.5,
    max: 5,
    targetMin: 2.5,
    targetMax: 4.0,
    trend: 'up',
    change: 0.2,
    organ: 'heart'
  },
  {
    label: 'CVP',
    value: 8,
    unit: 'mmHg',
    min: 0,
    max: 15,
    targetMin: 2,
    targetMax: 8,
    trend: 'stable',
    change: 0,
    organ: 'heart'
  },
  {
    label: 'SVR',
    value: 1200,
    unit: 'dynes/sec/cm⁻⁵',
    min: 500,
    max: 1600,
    targetMin: 800,
    targetMax: 1200,
    trend: 'down',
    change: -50,
    organ: 'heart'
  },
  {
    label: 'Lactate',
    value: 1.2,
    unit: 'mmol/L',
    min: 0,
    max: 4,
    targetMin: 0,
    targetMax: 2,
    trend: 'down',
    change: -0.3,
    organ: 'heart'
  },
  {
    label: 'ScvO2',
    value: 72,
    unit: '%',
    min: 50,
    max: 85,
    targetMin: 65,
    targetMax: 75,
    trend: 'up',
    change: 2,
    organ: 'heart'
  }
];

export const lungMetrics = [
  {
    label: 'PaO2',
    value: 95,
    unit: 'mmHg',
    min: 60,
    max: 120,
    targetMin: 80,
    targetMax: 100,
    organ: 'lungs'
  },
  {
    label: 'PaCO2',
    value: 38,
    unit: 'mmHg',
    min: 25,
    max: 55,
    targetMin: 35,
    targetMax: 45,
    organ: 'lungs'
  },
  {
    label: 'pH',
    value: 7.38,
    unit: '',
    min: 7.2,
    max: 7.6,
    targetMin: 7.35,
    targetMax: 7.45,
    organ: 'lungs'
  },
  {
    label: 'FiO2',
    value: 40,
    unit: '%',
    min: 21,
    max: 100,
    targetMin: 21,
    targetMax: 30,
    organ: 'lungs'
  },
  {
    label: 'P/F Ratio',
    value: 238,
    unit: '',
    min: 100,
    max: 500,
    targetMin: 300,
    targetMax: 500,
    organ: 'lungs'
  },
  {
    label: 'SpO2',
    value: 98,
    unit: '%',
    min: 85,
    max: 100,
    targetMin: 94,
    targetMax: 100,
    organ: 'lungs'
  }
];

interface Metric {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  targetMin: number;
  targetMax: number;
  trend?: string;
  change?: number;
  organ: string;
}

interface ProblematicIndicator {
  icon: string;
  label: string;
  current: string;
  target: string;
  trend: 'up' | 'down' | 'stable';
  status: 'critical' | 'warning';
  organ: string;
}

// Monitoring targets for adherence sections
export const brainMonitoringTargets = [
  {
    label: "Opioide",
    value: 150,
    unit: "mcg/h",
    target: "100-200 mcg/h",
    status: "normal",
    trend: "stable",
    change: 0,
    organ: "brain"
  },
  {
    label: "Hypnotique",
    value: 220,
    unit: "mg/h",
    target: "150-250 mg/h",
    status: "normal",
    trend: "down",
    change: -10,
    organ: "brain"
  },
  {
    label: "AntiEpileptique",
    value: "Non",
    target: "Aucune",
    status: "normal",
    trend: "stable",
    organ: "brain"
  },
  {
    label: "Propofol 48h",
    value: "10.5",
    unit: "g",
    target: "< 12g",
    status: "normal",
    trend: "stable",
    change: 0,
    organ: "brain"
  },
  {
    label: "Nutrition",
    value: "Entérale",
    target: "Entérale/Parentérale",
    status: "normal",
    trend: "stable",
    organ: "brain"
  },
  {
    label: "PIC",
    value: 26,
    unit: "mmHg",
    target: "< 20 mmHg",
    status: "warning",
    trend: "down",
    change: -3,
    organ: "brain"
  },
  {
    label: "PAM",
    value: 85,
    unit: "mmHg",
    target: "> 65 mmHg",
    status: "normal",
    trend: "up",
    change: 2,
    organ: "brain"
  },
  {
    label: "PVC",
    value: 8,
    unit: "mmHg",
    target: "2-8 mmHg",
    status: "normal",
    trend: "stable",
    change: 0,
    organ: "brain"
  },
  {
    label: "ETCO2",
    value: 38,
    unit: "mmHg",
    target: "35-45 mmHg",
    status: "normal",
    trend: "stable",
    change: 0,
    organ: "brain"
  },
  {
    label: "Pupille droite",
    value: "3mm",
    target: "Réactive",
    status: "normal",
    trend: "stable",
    organ: "brain"
  },
  {
    label: "Pupille gauche",
    value: "3mm",
    target: "Réactive",
    status: "normal",
    trend: "stable",
    organ: "brain"
  }
];

export const heartMonitoringTargets = [
  { label: 'PAM', value: 72, unit: 'mmHg', target: '> 65 mmHg', status: 'normal', trend: 'up', change: 3, organ: 'heart' },
  { label: 'Débit cardiaque', value: 3.2, unit: 'L/min', target: '4.5-6.0 L/min', status: 'critical', trend: 'up', change: 0.4, organ: 'heart' },
  { label: 'Lactates', value: 1.2, unit: 'mmol/L', target: '< 2 mmol/L', status: 'normal', trend: 'down', change: -0.2, organ: 'heart' },
  { label: 'ScvO2', value: 72, unit: '%', target: '> 70%', status: 'normal', trend: 'up', change: 2, organ: 'heart' },
  { label: 'Bilan hydrique', value: '+500', unit: 'mL', target: 'Équilibré', status: 'warning', trend: 'stable', change: 0, organ: 'heart' },
  { label: 'Support inotrope', value: 'Dobutamine 5', unit: 'mcg/kg/min', target: 'Selon besoin', status: 'normal', trend: 'stable', organ: 'heart' },
  { label: 'Vasopresseurs', value: 'Noradré 0.15', unit: 'mcg/kg/min', target: 'Selon MAP', status: 'normal', trend: 'down', change: -0.05, organ: 'heart' },
  { label: 'Échocardiographie', value: 'FEVG 35%', target: 'Contrôle régulier', status: 'critical', trend: 'stable', organ: 'heart' }
];

export const lungMonitoringTargets: any[] = [
  // Optilungs doesn't have monitoring targets section yet
];

export const getProblematicIndicators = (): ProblematicIndicator[] => {
  const allMonitoringTargets = [
    ...brainMonitoringTargets,
    ...heartMonitoringTargets,
    ...lungMonitoringTargets
  ];
  
  const problematic: ProblematicIndicator[] = [];

  allMonitoringTargets.forEach((target: any) => {
    // Only include indicators that are not normal
    if (target.status !== 'normal') {
      const currentValue = typeof target.value === 'number' 
        ? `${target.value}${target.unit || ''}`
        : target.value;
        
      problematic.push({
        icon: target.organ === 'brain' ? 'Brain' : target.organ === 'heart' ? 'Heart' : 'Lungs',
        label: target.label,
        current: currentValue,
        target: target.target,
        trend: (target.trend as 'up' | 'down' | 'stable') || 'stable',
        status: target.status,
        organ: target.organ
      });
    }
  });

  return problematic;
};

export const getOrganIcon = (organ: string) => {
  switch (organ) {
    case 'brain':
      return 'Brain';
    case 'heart':
      return 'Heart';
    case 'lungs':
      return 'Lungs';
    default:
      return 'Activity';
  }
};
