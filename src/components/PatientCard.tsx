import { Badge } from '@/components/ui/badge';
import { Droplets } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { getScoreTextColor, getScoreBgColor, getScoreColorFilter } from '@/utils/colorUtils';

interface PatientCardProps {
  patient: Patient;
}

const OrganBadge = ({ organ, score, patientId }: { organ: 'brain' | 'heart' | 'lungs' | 'kidney'; score?: number; patientId?: string }) => {
  const navigate = useNavigate();
  const color = getScoreTextColor(score);
  const bgColor = getScoreBgColor(score);

  const routeMap: Record<string, string> = { brain: 'optibrain', heart: 'optiheart', lungs: 'optilungs', kidney: 'optistate' };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (patientId) navigate(`/${routeMap[organ]}?patient=${encodeURIComponent(patientId)}`);
  };

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`} onClick={handleClick}>
      {organ === 'brain' ? (
        <img src={brainIcon} alt="brain" className="h-5 w-5" style={{ filter: getScoreColorFilter(score) }} />
      ) : organ === 'lungs' ? (
        <img src={lungsIcon} alt="lungs" className="h-5 w-5" style={{ filter: getScoreColorFilter(score) }} />
      ) : organ === 'heart' ? (
        <HeartIcon className={`h-5 w-5 ${color}`} />
      ) : (
        <Droplets className={`h-5 w-5 ${color}`} />
      )}
      <span className={`text-xs font-semibold ${color}`}>{score || 0}</span>
    </div>
  );
};

export const PatientCard = ({ patient }: PatientCardProps) => {
  const navigate = useNavigate();
  const { getVisitStatus } = useTourNavigation();
  const visitStatus = getVisitStatus(patient.id);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'Priority': return 'Prioritaire';
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
              className={`text-xs ${patient.tour === 'Priority' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 'bg-muted-foreground hover:bg-muted-foreground/90 text-status-normal-fg'}`}
            >
              {patient.tour}
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
