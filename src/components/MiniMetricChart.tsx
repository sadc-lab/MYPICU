import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { brainMetrics, heartMetrics, lungMetrics } from '@/utils/organMetrics';

interface MiniMetricChartProps {
  metricLabel: string;
  organ: string;
}

export const MiniMetricChart = ({ metricLabel, organ }: MiniMetricChartProps) => {
  const chartData = useMemo(() => {
    // Find the metric
    const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
    const metric = allMetrics.find(m => m.label === metricLabel && m.organ === organ);
    
    if (!metric) return [];

    const data = [];
    const dataPoints = 20;
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const baseValue = metric.value;
      // Add realistic variation based on trend
      let variation = (Math.random() - 0.5) * (baseValue * 0.15);
      
      if ('trend' in metric && metric.trend === 'up') {
        variation += (dataPoints - i) * 0.05;
      } else if ('trend' in metric && metric.trend === 'down') {
        variation -= (dataPoints - i) * 0.05;
      }
      
      data.push({
        value: Math.max(metric.min, Math.min(metric.max, baseValue + variation))
      });
    }
    
    return data;
  }, [metricLabel, organ]);

  // Get metric to determine color based on status
  const allMetrics = [...brainMetrics, ...heartMetrics, ...lungMetrics];
  const metric = allMetrics.find(m => m.label === metricLabel && m.organ === organ);
  
  if (!metric) return null;

  const isOutOfRange = metric.value < metric.targetMin || metric.value > metric.targetMax;
  const strokeColor = isOutOfRange ? '#ef4444' : '#9ca3af';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
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
