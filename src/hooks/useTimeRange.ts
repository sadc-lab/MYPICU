import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

export type TimeRange = '3h' | '6h' | '12h' | '24h' | 'stay';

const DEFAULT_TIME_RANGE: TimeRange = '24h';
const VALID_RANGES: TimeRange[] = ['3h', '6h', '12h', '24h', 'stay'];

export const useTimeRange = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const timeRangeParam = searchParams.get('timeRange') as TimeRange;
  const timeRange: TimeRange = VALID_RANGES.includes(timeRangeParam) ? timeRangeParam : DEFAULT_TIME_RANGE;
  
  const setTimeRange = useCallback((newRange: TimeRange) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('timeRange', newRange);
      return newParams;
    });
  }, [setSearchParams]);

  const getTimeRangeLabel = (range: TimeRange): string => {
    switch (range) {
      case 'stay': return 'Séjour';
      default: return range;
    }
  };

  return {
    timeRange,
    setTimeRange,
    getTimeRangeLabel,
    timeRanges: VALID_RANGES,
  };
};
