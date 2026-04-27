import { Badge } from '@/components/ui/badge';
import { Droplets } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { getScoreTextColor, getScoreColorFilter } from '@/utils/colorUtils';

interface PatientCardProps {
  patient: Patient;
}

const getOrganBadgeBorder = (score?: number) => {
  if (!score || score === 0) return 'border-border';
  if (score === 1) return 'border-orange-500';
  if (score === 2) return 'border-orange-600';
  return 'border-red-600';
};

const OrganBadge = ({ organ, score, patientId }: { organ: 'brain' | 'heart' | 'lungs' | 'kidney'; score?: number; patientId?: string }) => {
  const navigate = useNavigate();
  const textColor = getScoreTextColor(score);
  const borderColor = getOrganBadgeBorder(score);

  const routeMap: Record<string, string> = { brain: 'optibrain', heart: 'optiheart', lungs: 'optilungs', kidney: 'optirenal' };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (patientId) navigate(`/${routeMap[organ]}?patient=${encodeURIComponent(patientId)}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative flex items-center justify-center p-0.5 bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-md"
    >
      <Badge
        variant="outline"
        className={`bg-muted text-foreground border ${borderColor} text-xs gap-1 transition-all duration-150 hover:-translate-y-[1px]`}
      >
        {organ === 'brain' ? (
          <img src={brainIcon} alt="brain" className="h-5 w-5" style={{ filter: getScoreColorFilter(score) }} />
        ) : organ === 'lungs' ? (
          <img src={lungsIcon} alt="lungs" className="h-5 w-5" style={{ filter: getScoreColorFilter(score) }} />
        ) : organ === 'heart' ? (
          <HeartIcon className={`h-5 w-5 ${textColor}`} />
        ) : (
          <Droplets className={`h-5 w-5 ${textColor}`} />
        )}
        <span className={`font-semibold ${textColor}`}>{score ?? 0}</span>
        <span aria-hidden="true" className={`ml-0.5 h-2 w-2 rounded-full border ${borderColor} bg-transparent`} />
      </Badge>
    </button>
  );
};

export const PatientCard = ({ patient }: PatientCardProps) => {
  const navigate = useNavigate();
  const { getVisitStatus } = useTourNavigation();
  const visitStatus = getVisitStatus(patient.id);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'Priority': return 'Priorité';
      case 'Confirmed': return 'Confirmé';
      case 'Leaving': return 'Sortant';
      case 'To Check': return 'À vérifier';
      default: return status;
    }
  };

  const totalAlarms = (patient.brainScore || 0) + (patient.heartScore || 0) + (patient.lungsScore || 0) + (patient.kidneyScore || 0);

  return (
    <div
      className="bg-card rounded-lg border shadow-sm p-4 cursor-pointer hover:bg-accent transition-colors active:scale-[0.98]"
      onClick={() => navigate(`/optistate?patient=${encodeURIComponent(patient.id)}`)}
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-medium text-sm text-foreground">{patient.name}</div>
          <div className="text-xs text-muted-foreground">{patient.age} · {patient.weight}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {visitStatus ? (
            <Badge
              variant="secondary"
              className={`text-xs ${visitStatus === 'Priority' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-muted-foreground hover:bg-muted-foreground/90 text-status-normal-fg'}`}
            >
              {getStatusDisplay(visitStatus)}
            </Badge>
          ) : totalAlarms > 5 ? (
            <Badge variant="destructive" className="text-xs">Priorité</Badge>
          ) : patient.tour ? (
            <Badge
              variant="secondary"
              className={`text-xs ${patient.tour === 'Priority' || patient.tour === 'Prioritaire' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-muted-foreground hover:bg-muted-foreground/90 text-status-normal-fg'}`}
            >
              {patient.tour === 'Priority' || patient.tour === 'Prioritaire' ? 'Priorité' : patient.tour}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Middle row: PELOD + Adhérence + PICU */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span>PELOD: <span className="font-medium text-foreground">{patient.pelodScore}</span></span>
        <span>Adh: <span className="font-medium text-foreground">{patient.adherence}%</span></span>
        <span>#{patient.picuId.replace(/\D/g, '').padStart(2, '0')}</span>
      </div>

      {/* Bottom row: organ scores */}
      <div className="flex gap-1.5">
        <OrganBadge organ="brain" score={patient.brainScore} patientId={patient.id} />
        <OrganBadge organ="heart" score={patient.heartScore} patientId={patient.id} />
        <OrganBadge organ="lungs" score={patient.lungsScore} patientId={patient.id} />
      </div>
    </div>
  );
};
