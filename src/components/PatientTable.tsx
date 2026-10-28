import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Droplets, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import kidneyIcon from '@/assets/kidney-icon.svg';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { getScoreTextColor, getScoreColorFilter } from '@/utils/colorUtils';
import { compareBeds, formatBedLabel, type SortDirection } from '@/utils/bedNumber';
import { PatientCard } from '@/components/PatientCard';
interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
  showTitle?: boolean;
}

type SortKey = 'picuId' | 'pelodScore';

export const PatientTable = ({ patients, pedName, averagePelod, showTitle = true }: PatientTableProps) => {
  const navigate = useNavigate();
  const { getVisitStatus } = useTourNavigation();

  // Column names carry the sort control, so a null key means "source order".
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Unsorted -> ascending -> descending -> unsorted.
  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection('asc');
    }
  };

  const sortedPatients = useMemo(() => {
    if (!sortKey) return patients;
    const sign = sortDirection === 'asc' ? 1 : -1;
    return [...patients].sort((a, b) => {
      if (sortKey === 'picuId') return compareBeds(a.picuId, b.picuId, sortDirection);
      // Numeric columns can carry null, so they keep unassigned rows last too.
      const left = a.pelodScore ?? null;
      const right = b.pelodScore ?? null;
      if (left === null || right === null) {
        if (left === right) return 0;
        return left === null ? 1 : -1;
      }
      return (left - right) * sign;
    });
  }, [patients, sortKey, sortDirection]);

  // The label itself is the target, not just the arrow: the button fills the
  // header cell so the whole column name is clickable, and it carries the
  // focus ring and aria-sort for keyboard and assistive technology.
  const SortableHeader = ({
    label,
    column,
    className,
  }: {
    label: string;
    column: SortKey;
    className?: string;
  }) => {
    const isActive = sortKey === column;
    const Icon = !isActive ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={className}
        aria-sort={!isActive ? 'none' : sortDirection === 'asc' ? 'ascending' : 'descending'}
      >
        <button
          type="button"
          onClick={() => toggleSort(column)}
          title={`Trier par ${label}`}
          aria-label={`Trier par ${label}`}
          className="-ml-2 flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1 text-left font-medium transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span>{label}</span>
          <Icon className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary' : ''}`} aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 85) return 'text-muted-foreground';
    if (adherence >= 70) return 'text-status-warning';
    return 'text-destructive';
  };

  // Bordure / pastille colorée selon le score (aligné sur PatientHeader)
  const getOrganBadgeBorder = (score?: number) => {
    if (!score || score === 0) return 'border-border';
    if (score === 1) return 'border-orange-500';
    if (score === 2) return 'border-orange-600';
    return 'border-red-600';
  };

  const getOrganDotFill = (score?: number) => {
    if (!score || score === 0) return 'bg-muted-foreground';
    if (score === 1) return 'bg-orange-500';
    if (score === 2) return 'bg-orange-600';
    return 'bg-red-600';
  };

  const getOrganIconWithScore = (
    organ: 'brain' | 'heart' | 'lungs' | 'kidney',
    score?: number,
    patientId?: string,
  ) => {
    const textColor = getScoreTextColor(score);
    const borderColor = getOrganBadgeBorder(score);
    const dotFill = getOrganDotFill(score);

    const getOrganRoute = (o: 'brain' | 'heart' | 'lungs' | 'kidney') => {
      switch (o) {
        case 'brain':
          return 'optibrain';
        case 'heart':
          return 'optiheart';
        case 'lungs':
          return 'optilungs';
        case 'kidney':
          return 'optirenal';
        default:
          return 'optistate';
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (patientId) {
        navigate(`/${getOrganRoute(organ)}?patient=${encodeURIComponent(patientId)}`);
      }
    };

    const organLabels: Record<string, string> = {
      brain: 'cerveau',
      heart: 'cœur',
      lungs: 'poumons',
      kidney: 'reins',
    };

    const iconNode =
      organ === 'brain' ? (
        <img src={brainIcon} alt="brain" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getScoreColorFilter(score) }} />
      ) : organ === 'lungs' ? (
        <img src={lungsIcon} alt="lungs" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getScoreColorFilter(score) }} />
      ) : organ === 'heart' ? (
        <HeartIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${textColor}`} />
      ) : organ === 'kidney' ? (
        <img src={kidneyIcon} alt="kidney" className="h-6 w-6 sm:h-7 sm:w-7" style={{ filter: getScoreColorFilter(score) }} />
      ) : (
        <Droplets className={`h-6 w-6 sm:h-7 sm:w-7 ${textColor}`} />
      );

    return (
      <button
        type="button"
        onClick={handleClick}
        title={`Voir le module ${organLabels[organ] ?? organ}`}
        className="relative flex items-center justify-center p-0.5 bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-md"
      >
        <Badge
          variant="outline"
          className={`bg-muted text-foreground border ${borderColor} text-xs gap-1 transition-all duration-150 hover:-translate-y-[1px]`}
        >
          {iconNode}
          <span className={`font-semibold ${textColor}`}>{score ?? "—"}</span>
          <span
            aria-hidden="true"
            className={`ml-0.5 h-2 w-2 rounded-full border ${borderColor} bg-transparent`}
          />
        </Badge>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {showTitle && (
        <h2 className="text-lg sm:text-xl font-medium text-primary">
          Statut des patients {pedName}
        </h2>
      )}
      
      {/* Mobile: card layout */}
      <div className="grid grid-cols-1 gap-3 md:hidden" data-guide="patient-table-mobile">
        {sortedPatients.map((patient) => (
          <PatientCard key={patient.id} patient={patient} />
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden hidden md:block" data-guide="patient-table">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b">
              <TableHead className="font-medium text-foreground text-xs sm:text-sm">Informations Patient</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden sm:table-cell">Âge</TableHead>
              <SortableHeader
                label="#D PICU"
                column="picuId"
                className="font-medium text-foreground text-xs sm:text-sm hidden md:table-cell"
              />
              <SortableHeader
                label="PELOD"
                column="pelodScore"
                className="font-medium text-foreground text-xs sm:text-sm"
              />
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden lg:table-cell">Adhérence</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell">Diagnostic</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell">Examens</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm">Alarmes</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden md:table-cell">Tournée</TableHead>
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPatients.map((patient, index) => (
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
                <TableCell className="text-foreground text-sm hidden md:table-cell">{formatBedLabel(patient.picuId)}</TableCell>
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
                          case 'Priority': return 'Priorité';
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
                              : 'bg-muted-foreground hover:bg-muted-foreground/90 text-status-normal-fg'
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
                            patient.tour === 'Priority' || patient.tour === 'Prioritaire'
                              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                              : 'bg-muted-foreground hover:bg-muted-foreground/90 text-status-normal-fg'
                          }`}
                        >
                          {patient.tour === 'Priority' || patient.tour === 'Prioritaire' ? 'Priorité' : patient.tour}
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
