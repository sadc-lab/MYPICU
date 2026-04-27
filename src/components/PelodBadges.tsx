import { useNavigate } from 'react-router-dom';
import { Patient } from '@/utils/patientData';

interface PelodBadgesProps {
  patients: Patient[];
  unitAverage: number;
}

/** Bordure, pastille et texte selon la sévérité PELOD (aligné sur PatientHeader). */
const getPelodSeverity = (score: number) => {
  if (score >= 25) return { border: 'border-red-700', dot: 'bg-red-700', text: 'text-red-700 dark:text-red-400' };
  if (score >= 20) return { border: 'border-red-600', dot: 'bg-red-600', text: 'text-red-700 dark:text-red-400' };
  if (score >= 15) return { border: 'border-orange-600', dot: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300' };
  if (score >= 12) return { border: 'border-orange-500', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' };
  return { border: 'border-border', dot: 'bg-muted-foreground', text: 'text-foreground' };
};

/** Badge unifié au style « vignette organe » : fond muted, bordure colorée, chiffre + pastille. */
const PelodBadge = ({
  score,
  severity,
  suffix,
  onClick,
  title,
  ariaLabel,
}: {
  score: number;
  severity: ReturnType<typeof getPelodSeverity>;
  suffix?: string;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-xs transition-all duration-150 outline-none ${severity.border} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-[1px] hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
          : ''
      }`}
    >
      <span className={`font-semibold tabular-nums ${severity.text}`}>{score}</span>
      {suffix && <span className="text-[10px] text-muted-foreground tabular-nums">{suffix}</span>}
      <span
        aria-hidden="true"
        className={`ml-0.5 h-2 w-2 rounded-full border ${severity.border} bg-transparent`}
      />
    </Tag>
  );
};

export const PelodBadges = ({ patients, unitAverage }: PelodBadgesProps) => {
  const navigate = useNavigate();
  const topPatients = [...patients].sort((a, b) => b.pelodScore - a.pelodScore).slice(0, 5);
  const avgSeverity = getPelodSeverity(unitAverage);

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-2">Moyenne PELOD</div>
        <PelodBadge score={unitAverage} severity={avgSeverity} suffix="/70" />
      </div>

      <div className="text-center w-full sm:w-auto">
        <div className="text-xs text-muted-foreground mb-2">Score des Patients</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {topPatients.map((patient) => {
            const severity = getPelodSeverity(patient.pelodScore);
            const room = `#${patient.picuId.replace(/\D/g, '').padStart(2, '0')}`;
            return (
              <div key={patient.id} className="flex flex-col items-center gap-1">
                <PelodBadge
                  score={patient.pelodScore}
                  severity={severity}
                  onClick={() => navigate(`/optistate?patient=${encodeURIComponent(patient.id)}`)}
                  title={`Ouvrir le dossier de ${patient.name} (chambre ${room})`}
                  ariaLabel={`Ouvrir le dossier de ${patient.name}, score PELOD ${patient.pelodScore}`}
                />
                <span className="text-[10px] text-muted-foreground tabular-nums leading-none">{room}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
