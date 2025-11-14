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
    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      <div className="text-center">
        <div className="text-xs text-gray-600 mb-2">PELOD de l&apos;unité</div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center">
            <svg className="h-6 w-6 sm:h-8 sm:w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
          </div>
          <div className="bg-primary text-primary-foreground rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] font-bold text-base sm:text-lg text-center">
            {unitAverage}
          </div>
          <div className="text-xs text-gray-500">/70</div>
        </div>
      </div>

      <div className="text-center w-full sm:w-auto">
        <div className="text-xs text-gray-600 mb-2">Score des Patients</div>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-start">
          {topPatients.map((patient) => (
            <div key={patient.id} className="text-center">
              <div className={`${getPelodBgColor(patient.pelodScore)} text-white rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] font-bold text-base sm:text-lg`}>
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
