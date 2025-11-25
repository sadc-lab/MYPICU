// Consolidated organ metrics for the application

export const brainMetrics = [
  {
    label: 'ICP',
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
    label: 'CPP',
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

export const getProblematicIndicators = (): ProblematicIndicator[] => {
  const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
  const problematic: ProblematicIndicator[] = [];

  allMetrics.forEach((metric: Metric) => {
    const isOutOfRange = metric.value < metric.targetMin || metric.value > metric.targetMax;
    
    if (isOutOfRange) {
      const deviation = Math.abs(
        metric.value < metric.targetMin 
          ? metric.value - metric.targetMin 
          : metric.value - metric.targetMax
      );
      const deviationPercent = (deviation / metric.targetMin) * 100;
      
      problematic.push({
        icon: metric.organ === 'brain' ? 'Brain' : metric.organ === 'heart' ? 'Heart' : 'Lungs',
        label: metric.label,
        current: `${metric.value}${metric.unit}`,
        target: `${metric.targetMin}-${metric.targetMax}${metric.unit}`,
        trend: (metric.trend as 'up' | 'down' | 'stable') || 'stable',
        status: deviationPercent > 20 ? 'critical' : 'warning',
        organ: metric.organ
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
