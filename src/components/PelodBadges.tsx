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

  const getPelodBadgeVariant = (score: number): "default" | "destructive" | "secondary" => {
    if (score >= 25) return 'destructive';
    if (score >= 15) return 'secondary';
    return 'default';
  };

  const getPelodBgColor = (score: number) => {
    if (score >= 25) return 'bg-destructive';
    if (score >= 20) return 'bg-warning';
    if (score >= 15) return 'bg-[#F59E0B]';
    return 'bg-success';
  };

  return (
    <div className="flex items-start justify-end gap-8">
      <div className="text-right">
        <div className="text-sm text-muted-foreground mb-2">Unit&apos;s PELOD</div>
        <div className="flex justify-end">
          <div className={`${getPelodBgColor(unitAverage)} text-white rounded-lg px-6 py-3 text-center`}>
            <div className="text-3xl font-bold">{unitAverage}</div>
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm text-muted-foreground mb-2">Patient PELOD</div>
        <div className="flex gap-2">
          {topPatients.map((patient) => (
            <div key={patient.id} className="text-center">
              <div className={`${getPelodBgColor(patient.pelodScore)} text-white rounded-lg px-4 py-3 min-w-[60px]`}>
                <div className="text-2xl font-bold">{patient.pelodScore}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{patient.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
