// Centralized color utilities for consistent styling across the application
// These functions should be used throughout the app for score-based and status-based coloring

// Score-based colors (for organ scores 0-3)
export const getScoreTextColor = (score?: number) => {
  if (!score || score === 0) return 'text-score-normal-text';
  if (score === 1) return 'text-score-warning-text';
  if (score === 2) return 'text-score-warning-high-text';
  return 'text-score-critical-text';
};

export const getScoreBgColor = (score?: number) => {
  if (!score || score === 0) return 'bg-score-normal-bg';
  if (score === 1) return 'bg-score-warning-bg';
  if (score === 2) return 'bg-score-warning-high-bg';
  return 'bg-score-critical-bg';
};

export const getScoreBorderColor = (score?: number) => {
  if (!score || score === 0) return 'border-score-normal-border';
  if (score === 1) return 'border-score-warning-border';
  if (score === 2) return 'border-score-warning-high-border';
  return 'border-score-critical-border';
};

// Filter for SVG icons based on score
export const getScoreColorFilter = (score?: number) => {
  if (!score || score === 0) return 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)'; // grey
  if (score === 1) return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'; // orange
  if (score === 2) return 'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)'; // darker orange
  return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'; // red
};

// PELOD badge colors
export const getPelodBorderColor = (score: number) => {
  if (score >= 25) return 'border-pelod-critical';
  if (score >= 20) return 'border-pelod-high';
  if (score >= 15) return 'border-pelod-warning';
  if (score >= 12) return 'border-pelod-moderate';
  return 'border-pelod-normal';
};

export const getPelodBgColor = (score: number) => {
  if (score >= 25) return 'bg-pelod-critical text-white';
  if (score >= 20) return 'bg-pelod-high text-white';
  if (score >= 15) return 'bg-pelod-warning text-white';
  if (score >= 12) return 'bg-pelod-moderate text-white';
  return 'bg-pelod-normal text-white';
};

// Status-based colors (for clinical indicators: critical, warning, normal)
export const getStatusTextColor = (status: string) => {
  if (status === 'critical') return 'text-score-critical-text';
  if (status === 'warning') return 'text-score-warning-text';
  return 'text-muted-foreground';
};

export const getStatusBgColor = (status: string) => {
  if (status === 'critical') return 'bg-score-critical';
  if (status === 'warning') return 'bg-score-warning';
  return 'bg-muted-foreground';
};

export const getStatusBorderColor = (status: string) => {
  if (status === 'critical') return 'border-score-critical';
  if (status === 'warning') return 'border-score-warning';
  return 'border-muted-foreground';
};

// For charts (hex values needed)
export const getStatusHexColor = (status: string) => {
  if (status === 'critical') return '#ef4444'; // red-500
  if (status === 'warning') return '#fb923c'; // orange-400
  return '#9ca3af'; // gray-400
};

// Value in range indicator
export const getValueInRangeColor = (inRange: boolean) => ({
  text: inRange ? 'text-muted-foreground' : 'text-score-critical-text',
  bg: inRange ? 'bg-muted-foreground' : 'bg-score-critical',
  border: inRange ? 'border-muted-foreground' : 'border-score-critical',
});

// Count-based colors (for clinical indicators count bubble)
export const getCountBorderColor = (count: number) => {
  if (count === 0) return 'border-muted-foreground text-muted-foreground bg-muted';
  if (count <= 2) return 'border-score-warning text-score-warning-text bg-score-warning-bg';
  return 'border-score-critical text-score-critical-text bg-score-critical-bg';
};
