import { Badge } from '@/components/ui/badge';
import { Patient } from '@/utils/patientData';
import { getPelodBorderColor } from '@/utils/colorUtils';

interface PelodBadgesProps {
  patients: Patient[];
  unitAverage: number;
}

export const PelodBadges = ({
  patients,
  unitAverage
}: PelodBadgesProps) => {
  const topPatients = [...patients].sort((a, b) => b.pelodScore - a.pelodScore).slice(0, 5);
  return <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      <div className="text-center">
        <div className="text-xs text-muted-foreground mb-2">Moyenne PELOD</div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center">
            
          </div>
          <div className="border-2 border-primary text-foreground bg-background rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] font-bold text-base sm:text-lg text-center">
            {unitAverage}
          </div>
          <div className="text-xs text-muted-foreground">/70</div>
        </div>
      </div>

      <div className="text-center w-full sm:w-auto">
        <div className="text-xs text-muted-foreground mb-2">Score des Patients</div>
        <div className="flex flex-wrap gap-2 justify-center">
          {topPatients.map(patient => (
            <div key={patient.id} className="flex flex-col items-center gap-1">
              <div className={`border-2 ${getPelodBorderColor(patient.pelodScore)} bg-background text-foreground rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 min-w-[40px] sm:min-w-[50px] font-bold text-base sm:text-lg text-center`}>
                {patient.pelodScore}
              </div>
              <div className="text-xs font-medium text-foreground">#{patient.picuId.replace(/\D/g, '').padStart(2, '0')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>;
};