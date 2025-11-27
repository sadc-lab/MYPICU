import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceArea, YAxis, ReferenceLine } from 'recharts';
import { brainMetrics, heartMetrics, lungMetrics, brainMonitoringTargets, heartMonitoringTargets } from '@/utils/organMetrics';

interface MiniMetricChartProps {
  metricLabel: string;
  organ: string;
  timeRange?: 'now' | '3h' | '6h' | '12h' | '24h' | 'stay';
}

// Parse target string to get min/max values
const parseTarget = (target: string): { min: number; max: number } | null => {
  // Handle "< X" format
  const lessThanMatch = target.match(/<\s*(\d+(?:\.\d+)?)/);
  if (lessThanMatch) {
    return { min: 0, max: parseFloat(lessThanMatch[1]) };
  }
  
  // Handle "> X" format
  const greaterThanMatch = target.match(/>\s*(\d+(?:\.\d+)?)/);
  if (greaterThanMatch) {
    return { min: parseFloat(greaterThanMatch[1]), max: parseFloat(greaterThanMatch[1]) * 2 };
  }
  
  // Handle "X-Y" format
  const rangeMatch = target.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }
  
  return null;
};

export const MiniMetricChart = ({ metricLabel, organ, timeRange = '24h' }: MiniMetricChartProps) => {
  // Find metric from all sources
  const metricData = useMemo(() => {
    // First try brainMetrics/heartMetrics/lungMetrics
    const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
    const metric = allMetrics.find(m => m.label === metricLabel && m.organ === organ);
    
    if (metric) {
      return {
        value: metric.value,
        min: metric.min,
        max: metric.max,
        targetMin: metric.targetMin,
        targetMax: metric.targetMax,
        unit: metric.unit,
        trend: ('trend' in metric ? metric.trend : 'stable') as string
      };
    }
    
    // Try monitoring targets
    const allMonitoringTargets = [...brainMonitoringTargets, ...heartMonitoringTargets];
    const monitoringTarget = allMonitoringTargets.find(m => m.label === metricLabel && m.organ === organ);
    
    if (monitoringTarget && typeof monitoringTarget.value === 'number') {
      const parsedTarget = parseTarget(monitoringTarget.target);
      const value = monitoringTarget.value;
      
      return {
        value,
        min: parsedTarget ? Math.min(parsedTarget.min * 0.5, value * 0.5) : value * 0.5,
        max: parsedTarget ? Math.max(parsedTarget.max * 1.5, value * 1.5) : value * 1.5,
        targetMin: parsedTarget?.min || value * 0.8,
        targetMax: parsedTarget?.max || value * 1.2,
        unit: monitoringTarget.unit || '',
        trend: (monitoringTarget.trend || 'stable') as string
      };
    }
    
    return null;
  }, [metricLabel, organ]);

  const chartData = useMemo(() => {
    if (!metricData) return [];

    const data = [];
    const now = new Date();
    
    let dataPoints: number;
    let intervalMinutes: number;
    
    switch (timeRange) {
      case 'now':
        dataPoints = 1;
        intervalMinutes = 0;
        break;
      case '3h':
        dataPoints = 18;
        intervalMinutes = 10;
        break;
      case '6h':
        dataPoints = 24;
        intervalMinutes = 15;
        break;
      case '12h':
        dataPoints = 24;
        intervalMinutes = 30;
        break;
      case '24h':
        dataPoints = 24;
        intervalMinutes = 60;
        break;
      case 'stay':
        dataPoints = 48;
        intervalMinutes = 120;
        break;
      default:
        dataPoints = 24;
        intervalMinutes = 60;
        break;
    }
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      const timeStr = timeRange === 'now' 
        ? 'Now'
        : `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      
      const baseValue = metricData.value;
      let variation = (Math.random() - 0.5) * (baseValue * 0.15);
      
      if (metricData.trend === 'up') {
        variation += (dataPoints - i) * 0.05;
      } else if (metricData.trend === 'down') {
        variation -= (dataPoints - i) * 0.05;
      }
      
      data.push({
        time: timeStr,
        value: Math.max(metricData.min, Math.min(metricData.max, baseValue + variation))
      });
    }
    
    return data;
  }, [metricData, timeRange]);

  if (!metricData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        Pas de données
      </div>
    );
  }

  const isOutOfRange = metricData.value < metricData.targetMin || metricData.value > metricData.targetMax;
  const strokeColor = isOutOfRange ? '#ef4444' : '#9ca3af';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <YAxis 
          domain={[metricData.min, metricData.max]} 
          hide={true}
        />
        <ReferenceArea
          y1={metricData.targetMin}
          y2={metricData.targetMax}
          fill="hsl(var(--muted) / 0.5)"
          strokeOpacity={0}
        />
        <ReferenceLine 
          y={metricData.targetMin} 
          stroke="hsl(var(--muted-foreground))" 
          strokeDasharray="4 4" 
          strokeWidth={1}
        />
        <ReferenceLine 
          y={metricData.targetMax} 
          stroke="hsl(var(--muted-foreground))" 
          strokeDasharray="4 4" 
          strokeWidth={1}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={strokeColor} 
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
