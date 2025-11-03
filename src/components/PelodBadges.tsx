import { Badge } from '@/components/ui/badge';
import { Patient } from '@/utils/patientData';

interface PelodBadgesProps {
  patients: Patient[];
  unitAverage: number;
}

export const PelodBadges = ({ patients, unitAverage }: PelodBadgesProps) => {
  const topPatients = [...patients]
    .sort((a, b) => b.pelodScore - a.pelodScore)
    .slice(0, 5);

  const getPelodBgColor = (score: number) => {
    if (score >= 25) return 'bg-red-500';
    if (score >= 20) return 'bg-red-400';
    if (score >= 15) return 'bg-orange-500';
    if (score >= 12) return 'bg-orange-400';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-start gap-6">
      <div className="text-center">
        <div className="flex items-center justify-center mb-2">
          <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
          </svg>
        </div>
        <div className="text-xs text-gray-600 mb-1">{unitAverage}/70</div>
        <div className="text-xs text-gray-500">Unit&apos;s PELOD</div>
      </div>

      <div className="text-center">
        <div className="text-xs text-gray-600 mb-2">Patient&apos;s Score</div>
        <div className="flex gap-2">
          {topPatients.map((patient) => (
            <div key={patient.id} className="text-center">
              <div className={`${getPelodBgColor(patient.pelodScore)} text-white rounded-lg px-3 py-2 min-w-[50px] font-bold text-lg`}>
                {patient.pelodScore}
              </div>
              <div className="text-xs text-gray-500 mt-1">{patient.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
