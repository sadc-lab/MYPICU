import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Patient } from '@/utils/patientData';
import { getPelodBorderColor } from '@/utils/colorUtils';

interface PelodBadgesProps {
  patients: Patient[];
  unitAverage: number;
}

/** Bordure et pastille couleur selon la sévérité PELOD (aligné sur PatientHeader). */
const getPelodSeverity = (score: number) => {
  if (score >= 25) return { border: 'border-red-700', dot: 'bg-red-700', text: 'text-red-700 dark:text-red-400' };
  if (score >= 20) return { border: 'border-red-600', dot: 'bg-red-600', text: 'text-red-700 dark:text-red-400' };
  if (score >= 15) return { border: 'border-orange-600', dot: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300' };
  if (score >= 12) return { border: 'border-orange-500', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' };
  return { border: 'border-border', dot: 'bg-muted-foreground', text: 'text-foreground' };
};

export const PelodBadges = ({ patients, unitAverage }: PelodBadgesProps) => {
  const navigate = useNavigate();
  const topPatients = [...patients].sort((a, b) => b.pelodScore - a.pelodScore).slice(0, 5);

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-2">Moyenne PELOD</div>
        <div className="flex flex-col items-center gap-1">
          <div
            className={`border-2 ${getPelodBorderColor(unitAverage)} text-foreground bg-background rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] font-bold text-base sm:text-lg text-center`}
          >
            {unitAverage}
          </div>
          <div className="text-xs text-muted-foreground">/70</div>
        </div>
      </div>

      <div className="text-center w-full sm:w-auto">
        <div className="text-xs text-muted-foreground mb-2">Score des Patients</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {topPatients.map((patient) => {
            const severity = getPelodSeverity(patient.pelodScore);
            const room = `#${patient.picuId.replace(/\D/g, '').padStart(2, '0')}`;
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => navigate(`/optistate?patient=${encodeURIComponent(patient.id)}`)}
                title={`Ouvrir le dossier de ${patient.name} (chambre ${room})`}
                className="bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md group p-0.5"
              >
                <Badge
                  variant="outline"
                  className={`bg-background text-foreground border-2 ${severity.border} px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] gap-1.5 transition-all duration-150 group-hover:-translate-y-[1px] group-hover:shadow-sm`}
                >
                  <span className={`font-bold text-base sm:text-lg tabular-nums leading-none ${severity.text}`}>
                    {patient.pelodScore}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${severity.dot}`}
                  />
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
