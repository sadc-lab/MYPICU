import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Droplets, ArrowUpDown } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { getScoreTextColor, getScoreBgColor, getScoreColorFilter } from '@/utils/colorUtils';

interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
  showTitle?: boolean;
}

export const PatientTable = ({ patients, pedName, averagePelod, showTitle = true }: PatientTableProps) => {
  const navigate = useNavigate();
  const { getVisitStatus } = useTourNavigation();

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 85) return 'text-muted-foreground';
    if (adherence >= 70) return 'text-orange-500';
    return 'text-destructive';
  };

  const getOrganIconWithScore = (organ: 'brain' | 'heart' | 'lungs' | 'kidney', score?: number, patientId?: string) => {
    const color = getScoreTextColor(score);
    const bgColor = getScoreBgColor(score);
    
    let IconComponent;
    switch (organ) {
      case 'heart':
        IconComponent = HeartIcon;
        break;
      case 'kidney':
        IconComponent = Droplets;
        break;
    }

    const getOrganRoute = (organ: 'brain' | 'heart' | 'lungs' | 'kidney') => {
      switch (organ) {
        case 'brain':
          return 'optibrain';
        case 'heart':
          return 'optiheart';
        case 'lungs':
          return 'optilungs';
        case 'kidney':
          return 'optistate'; // Default to state for kidney
        default:
          return 'optistate';
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent row click
      if (patientId) {
        navigate(`/${getOrganRoute(organ)}?patient=${encodeURIComponent(patientId)}`);
      }
    };

    const organNames: Record<string, string> = {
      brain: 'du cerveau',
      heart: 'du cœur',
      lungs: 'des poumons',
      kidney: 'des reins'
    };

    return (
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={handleClick}
        title={`Voir détails ${organNames[organ] || organ}`}
      >
        {organ === 'brain' ? (
          <img src={brainIcon} alt="brain" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getScoreColorFilter(score) }} />
        ) : organ === 'lungs' ? (
          <img src={lungsIcon} alt="lungs" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getScoreColorFilter(score) }} />
        ) : organ === 'heart' ? (
          <HeartIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${color}`} />
        ) : (
          <IconComponent className={`h-6 w-6 sm:h-7 sm:w-7 ${color}`} />
        )}
        <span className={`text-xs sm:text-sm font-semibold ${color}`}>
          {score || 0}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <h2 className="text-lg sm:text-xl font-medium text-primary">
          Statut des patients {pedName}
        </h2>
      )}
      
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden" data-guide="patient-table">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b">
              <TableHead className="font-medium text-foreground text-xs sm:text-sm min-w-[150px]">Informations Patient</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden sm:table-cell">Âge</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden md:table-cell">
                <div className="flex items-center gap-1">
                  #D PICU
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  PELOD
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden lg:table-cell">Adhérence</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell">Diagnostic</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell">Examens</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm">Alarmes</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden md:table-cell">Tournée</TableHead>
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.id}
                className="cursor-pointer hover:bg-accent transition-colors border-b"
                onClick={() => navigate(`/optistate?patient=${encodeURIComponent(patient.id)}`)}
              >
                <TableCell className="py-3 sm:py-4">
                  <div className="font-medium text-sm sm:text-base text-foreground">
                    {patient.name}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{patient.weight}</div>
                </TableCell>
                <TableCell className="text-foreground text-sm hidden sm:table-cell">{patient.age}</TableCell>
                <TableCell className="text-foreground text-sm hidden md:table-cell">{patient.picuId}</TableCell>
                <TableCell>
                  <span className="text-foreground text-sm">
                    {patient.pelodScore}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="font-medium text-sm text-foreground">
                    {patient.adherence}%
                  </span>
                </TableCell>
                <TableCell className="text-foreground text-sm hidden xl:table-cell max-w-[200px] truncate">{patient.diagnosis}</TableCell>
                <TableCell className="hidden xl:table-cell">
                  {patient.exam && (
                    <span className="text-xs sm:text-sm text-muted-foreground">{patient.exam}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {getOrganIconWithScore('brain', patient.brainScore, patient.id)}
                    {getOrganIconWithScore('heart', patient.heartScore, patient.id)}
                    {getOrganIconWithScore('lungs', patient.lungsScore, patient.id)}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {(() => {
                    const visitStatus = getVisitStatus(patient.id);
                    if (visitStatus) {
                      const getStatusDisplay = (status: string) => {
                        switch(status) {
                          case 'Priority': return 'Prioritaire';
                          case 'Confirmed': return 'Confirmé';
                          case 'Leaving': return 'Sortant';
                          case 'To Check': return 'À vérifier';
                          default: return status;
                        }
                      };
                      
                      return (
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${
                            visitStatus === 'Priority' 
                              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                              : 'bg-muted-foreground hover:bg-muted-foreground/90 text-white dark:text-white'
                          }`}
                        >
                          {getStatusDisplay(visitStatus)}
                        </Badge>
                      );
                    }
                    
                    const totalAlarms = (patient.brainScore || 0) + (patient.heartScore || 0) + (patient.lungsScore || 0) + (patient.kidneyScore || 0);
                    if (totalAlarms > 5) {
                      return (
                        <Badge variant="destructive" className="text-xs">
                          Priorité
                        </Badge>
                      );
                    }
                    if (patient.tour) {
                      return (
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${
                            patient.tour === 'Priority' 
                              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                              : 'bg-muted-foreground hover:bg-muted-foreground/90 text-white dark:text-white'
                          }`}
                        >
                          {patient.tour}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
};
