import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, ReferenceArea, YAxis, ReferenceLine, XAxis, Tooltip } from 'recharts';
import { brainMetrics, heartMetrics, lungMetrics } from '@/utils/organMetrics';

interface MiniMetricChartProps {
  metricLabel: string;
  organ: string;
  timeRange?: 'now' | '3h' | '6h' | '12h' | '24h' | 'stay';
}

export const MiniMetricChart = ({ metricLabel, organ, timeRange = '24h' }: MiniMetricChartProps) => {
  const chartData = useMemo(() => {
    // Find the metric
    const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
    const metric = allMetrics.find(m => m.label === metricLabel && m.organ === organ);
    
    if (!metric) return [];

    const data = [];
    const now = new Date();
    
    // Determine number of data points and time intervals based on time range
    let dataPoints: number;
    let intervalMinutes: number;
    
    switch (timeRange) {
      case 'now':
        dataPoints = 1;
        intervalMinutes = 0;
        break;
      case '3h':
        dataPoints = 18; // One point every 10 minutes
        intervalMinutes = 10;
        break;
      case '6h':
        dataPoints = 24; // One point every 15 minutes
        intervalMinutes = 15;
        break;
      case '12h':
        dataPoints = 24; // One point every 30 minutes
        intervalMinutes = 30;
        break;
      case '24h':
        dataPoints = 24; // One point every hour
        intervalMinutes = 60;
        break;
      case 'stay':
        dataPoints = 48; // One point every 2 hours for a typical ICU stay
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
      
      const baseValue = metric.value;
      // Add realistic variation based on trend
      let variation = (Math.random() - 0.5) * (baseValue * 0.15);
      
      if ('trend' in metric && metric.trend === 'up') {
        variation += (dataPoints - i) * 0.05;
      } else if ('trend' in metric && metric.trend === 'down') {
        variation -= (dataPoints - i) * 0.05;
      }
      
      data.push({
        time: timeStr,
        value: Math.max(metric.min, Math.min(metric.max, baseValue + variation))
      });
    }
    
    return data;
  }, [metricLabel, organ, timeRange]);

  // Get metric to determine color based on status
  const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
  const metric = allMetrics.find(m => m.label === metricLabel && m.organ === organ);
  
  if (!metric) return null;

  const isOutOfRange = metric.value < metric.targetMin || metric.value > metric.targetMax;
  const strokeColor = isOutOfRange ? '#ef4444' : '#9ca3af';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 9 }}
          stroke="hsl(var(--muted-foreground))"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis 
          domain={[metric.min, metric.max]} 
          tick={{ fontSize: 9 }}
          stroke="hsl(var(--muted-foreground))"
          tickLine={false}
          axisLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '11px',
            padding: '4px 8px'
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [`${value.toFixed(1)} ${metric.unit}`, metric.label]}
        />
        <ReferenceArea
          y1={metric.targetMin}
          y2={metric.targetMax}
          fill="hsl(142 76% 36% / 0.1)"
          strokeOpacity={0}
        />
        <ReferenceLine 
          y={metric.targetMin} 
          stroke="hsl(142 76% 36%)" 
          strokeDasharray="4 4" 
          strokeWidth={1.5}
          label={{ value: metric.targetMin, position: 'right', fontSize: 8, fill: 'hsl(142 76% 36%)' }}
        />
        <ReferenceLine 
          y={metric.targetMax} 
          stroke="hsl(142 76% 36%)" 
          strokeDasharray="4 4" 
          strokeWidth={1.5}
          label={{ value: metric.targetMax, position: 'right', fontSize: 8, fill: 'hsl(142 76% 36%)' }}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={strokeColor} 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
