/**
 * Utility functions for time range calculations
 * Uses Montreal timezone (America/Montreal)
 */

const MONTREAL_TIMEZONE = 'America/Montreal';

/**
 * Format a date to Montreal timezone with specific format
 */
const formatMontrealTime = (date: Date): string => {
  return date.toLocaleTimeString('fr-CA', {
    timeZone: MONTREAL_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * Get the current time range label based on selected time range
 * @param timeRange - The selected time range ('3h', '6h', '12h', '24h', 'stay')
 * @returns A formatted string showing the time range in Montreal timezone
 */
export const getTimeRangeDisplayLabel = (timeRange: string): string => {
  if (timeRange === 'stay') {
    return 'Séjour complet';
  }

  const hoursMatch = timeRange.match(/^(\d+)h$/);
  if (!hoursMatch) {
    return timeRange;
  }

  const hours = parseInt(hoursMatch[1], 10);
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const startFormatted = formatMontrealTime(startTime);
  const endFormatted = formatMontrealTime(now);

  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Get hours from time range string
 */
export const getHoursFromTimeRange = (timeRange: string): number | null => {
  if (timeRange === 'stay') {
    return null; // Full stay, no specific hours
  }
  
  const hoursMatch = timeRange.match(/^(\d+)h$/);
  if (!hoursMatch) {
    return null;
  }
  
  return parseInt(hoursMatch[1], 10);
};
