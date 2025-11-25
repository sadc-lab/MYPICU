import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Droplets, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';

interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
  showTitle?: boolean;
}

export const PatientTable = ({ patients, pedName, averagePelod, showTitle = true }: PatientTableProps) => {
  const navigate = useNavigate();

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 85) return 'text-muted-foreground';
    if (adherence >= 70) return 'text-orange-500';
    return 'text-destructive';
  };

  const getOrganIconWithScore = (organ: 'brain' | 'heart' | 'lungs' | 'kidney', score?: number, patientId?: string) => {
    const getColor = (score?: number) => {
      if (!score || score === 0) return 'text-muted-foreground';
      if (score === 1) return 'text-orange-600';
      if (score === 2) return 'text-orange-700';
      return 'text-red-700 dark:text-red-500';
    };

    const getBgColor = (score?: number) => {
      if (!score || score === 0) return 'bg-muted';
      if (score === 1) return 'bg-orange-50 dark:bg-orange-950';
      if (score === 2) return 'bg-orange-100 dark:bg-orange-900';
      return 'bg-red-50 dark:bg-red-950';
    };

    const color = getColor(score);
    const bgColor = getBgColor(score);
    
    let IconComponent;
    switch (organ) {
      case 'heart':
        IconComponent = HeartIcon;
        break;
      case 'kidney':
        IconComponent = Droplets;
        break;
    }

    const getColorFilter = (score?: number) => {
      if (!score || score === 0) return 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)'; // grey
      if (score === 1) return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'; // orange
      if (score === 2) return 'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)'; // darker orange
      return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'; // red
    };

    const getOrganRoute = (organ: 'brain' | 'heart' | 'lungs' | 'kidney') => {
      switch (organ) {
        case 'brain':
          return 'optibrain';
        case 'heart':
          return 'optiheart';
        case 'lungs':
          return 'optilungs';
        case 'kidney':
          return 'optistats'; // Default to stats for kidney
        default:
          return 'optistats';
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent row click
      if (patientId) {
        navigate(`/${getOrganRoute(organ)}?patient=${encodeURIComponent(patientId)}`);
      }
    };

    return (
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={handleClick}
        title="Voir détails ${organ}"
      >
        {organ === 'brain' ? (
          <img src={brainIcon} alt="brain" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getColorFilter(score) }} />
        ) : organ === 'lungs' ? (
          <img src={lungsIcon} alt="lungs" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getColorFilter(score) }} />
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
          Patient Status {pedName}
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
              <TableHead className="hidden sm:table-cell"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.id}
                className="cursor-pointer hover:bg-accent transition-colors border-b"
                onClick={() => navigate(`/optistats?patient=${encodeURIComponent(patient.id)}`)}
              >
                <TableCell className="py-3 sm:py-4">
                  <div className="font-medium text-sm sm:text-base text-foreground">
                    {patient.id} {patient.name}
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
                          variant={patient.tour === 'Priority' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {patient.tour}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <button className="text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
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
