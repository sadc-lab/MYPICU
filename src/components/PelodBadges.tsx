import { Patient } from '@/utils/patientData';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { HeartIcon } from '@/components/icons/HeartIcon';
import statsIcon from '@/assets/stats-icon.svg';

interface PelodBadgesProps {
  patients: Patient[];
  unitAverage: number;
}

export const PelodBadges = ({ patients, unitAverage }: PelodBadgesProps) => {
  // Calculate average organ scores
  const avgBrainScore = patients.length > 0 
    ? Math.round(patients.reduce((sum, p) => sum + (p.brainScore || 0), 0) / patients.length) 
    : 0;
  const avgHeartScore = patients.length > 0 
    ? Math.round(patients.reduce((sum, p) => sum + (p.heartScore || 0), 0) / patients.length) 
    : 0;
  const avgLungsScore = patients.length > 0 
    ? Math.round(patients.reduce((sum, p) => sum + (p.lungsScore || 0), 0) / patients.length) 
    : 0;

  const getColorFilter = (score: number) => {
    if (score === 0) return 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)';
    if (score === 1) return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)';
    if (score === 2) return 'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)';
    return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)';
  };

  const getBgColor = (score: number) => {
    if (score === 0) return 'bg-gray-200';
    if (score === 1) return 'bg-red-200';
    if (score === 2) return 'bg-orange-300';
    return 'bg-red-400';
  };

  const getTextColor = (score: number) => {
    if (score === 0) return 'text-gray-600';
    if (score === 1) return 'text-red-700';
    if (score === 2) return 'text-orange-800';
    return 'text-red-900';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-left">
        <div className="text-sm text-gray-500 mb-1">PELOD Score</div>
        <div className="text-4xl font-bold text-gray-900">{unitAverage}</div>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-blue-500 bg-blue-50">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-200">
            <img src={statsIcon} alt="stats" className="h-5 w-5" style={{ filter: 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)' }} />
            <span className="text-sm font-semibold text-red-700">Stats</span>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getBgColor(avgBrainScore)}`}>
          <img src={brainIcon} alt="brain" className="h-5 w-5" style={{ filter: getColorFilter(avgBrainScore) }} />
          <span className={`text-lg font-bold ${getTextColor(avgBrainScore)}`}>{avgBrainScore}</span>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getBgColor(avgHeartScore)}`}>
          <HeartIcon className={`h-5 w-5 ${getTextColor(avgHeartScore)}`} />
          <span className={`text-lg font-bold ${getTextColor(avgHeartScore)}`}>{avgHeartScore}</span>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getBgColor(avgLungsScore)}`}>
          <img src={lungsIcon} alt="lungs" className="h-5 w-5" style={{ filter: getColorFilter(avgLungsScore) }} />
          <span className={`text-lg font-bold ${getTextColor(avgLungsScore)}`}>{avgLungsScore}</span>
        </div>
      </div>
    </div>
  );
};
