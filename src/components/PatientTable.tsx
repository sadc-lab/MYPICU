import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Droplets, ArrowUpDown, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { Patient } from '@/types/patient.types';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import kidneyIcon from '@/assets/kidney-icon.svg';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { getScoreTextColor, getScoreColorFilter } from '@/utils/colorUtils';
import { PatientCard } from '@/components/PatientCard';
import { tr } from '@/i18n';
interface PatientTableProps {
  patients: Patient[];
  pedName: string;
  averagePelod: number;
  showTitle?: boolean;
  /**
   * Étude autorégulation : un clic sélectionne le patient sur place au lieu
   * d'ouvrir son dossier.
   */
  onSelectPatient?: (patientId: string) => void;
  selectedPatientId?: string | null;
  /** Patients mis en évidence, avec l'étiquette affichée (ex. « COx », « PRx »). */
  highlighted?: Record<string, string>;
  /** Version étroite (colonne de gauche) : patient et lit seulement. */
  compact?: boolean;
}

export const PatientTable = ({
  patients,
  pedName,
  averagePelod,
  showTitle = true,
  onSelectPatient,
  selectedPatientId,
  highlighted,
  compact = false,
}: PatientTableProps) => {
  const navigate = useNavigate();
  const { getVisitStatus } = useTourNavigation();

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
      if (patientId && onSelectPatient) {
        onSelectPatient(patientId);
      } else if (patientId) {
        navigate(`/${getOrganRoute(organ)}?patient=${encodeURIComponent(patientId)}`);
      }
    };

    const organLabels: Record<string, string> = {
      brain: tr('cerveau', 'brain'),
      heart: tr('cœur', 'heart'),
      lungs: tr('poumons', 'lungs'),
      kidney: tr('reins', 'kidneys'),
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
        title={tr(`Voir le module ${organLabels[organ] ?? organ}`, `View ${organLabels[organ] ?? organ} module`)}
        className="relative flex items-center justify-center p-0.5 bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-md"
      >
        <Badge
          variant="outline"
          className={`bg-muted text-foreground border ${borderColor} text-xs gap-1 transition-all duration-150 hover:-translate-y-[1px]`}
        >
          {iconNode}
          <span className={`font-semibold ${textColor}`}>{score ?? 0}</span>
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
          {tr('Statut des patients', 'Patient status')} {pedName}
        </h2>
      )}
      
      {/* Mobile: card layout */}
      <div className="grid grid-cols-1 gap-3 md:hidden" data-guide="patient-table-mobile">
        {patients.map((patient) =>
          onSelectPatient ? (
            <div
              key={patient.id}
              className={cn(
                'rounded-lg',
                highlighted?.[patient.id] && 'ring-2 ring-primary/60',
                patient.id === selectedPatientId && 'ring-2 ring-primary',
              )}
              onClickCapture={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelectPatient(patient.id);
              }}
            >
              <PatientCard patient={patient} />
            </div>
          ) : (
            <PatientCard key={patient.id} patient={patient} />
          ),
        )}
      </div>

      {/* Desktop: table layout */}
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden hidden md:block" data-guide="patient-table">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b">
              <TableHead className="font-medium text-foreground text-xs sm:text-sm min-w-[150px]">{tr('Informations Patient', 'Patient information')}</TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm hidden sm:table-cell", compact && "sm:hidden")}>{tr('Âge', 'Age')}</TableHead>
              <TableHead className="font-medium text-foreground text-xs sm:text-sm hidden md:table-cell">
                <div className="flex items-center gap-1">
                  {tr('#D PICU', 'PICU #')}
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm", compact && "hidden")}>
                <div className="flex items-center gap-1">
                  PELOD
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm hidden lg:table-cell", compact && "lg:hidden")}>{tr('Adhérence', 'Adherence')}</TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell", compact && "xl:hidden")}>{tr('Diagnostic', 'Diagnosis')}</TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm hidden xl:table-cell", compact && "xl:hidden")}>{tr('Examens', 'Exams')}</TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm", compact && "hidden")}>{tr('Alarmes', 'Alarms')}</TableHead>
              <TableHead className={cn("font-medium text-foreground text-xs sm:text-sm hidden md:table-cell", compact && "md:hidden")}>{tr('Tournée', 'Rounds')}</TableHead>
              
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient, index) => (
              <TableRow 
                key={patient.id}
                data-patient-id={patient.id}
                aria-selected={patient.id === selectedPatientId || undefined}
                className={cn(
                  "cursor-pointer hover:bg-accent transition-colors border-b",
                  highlighted?.[patient.id] && "bg-primary/5 shadow-[inset_4px_0_0_hsl(var(--primary))] hover:bg-primary/10",
                  patient.id === selectedPatientId && "bg-primary/15 hover:bg-primary/15",
                )}
                onClick={() =>
                  onSelectPatient
                    ? onSelectPatient(patient.id)
                    : navigate(`/optistate?patient=${encodeURIComponent(patient.id)}`)
                }
              >
                <TableCell className="py-3 sm:py-4">
                  <div className="flex items-center gap-2 font-medium text-sm sm:text-base text-foreground">
                    <span>{patient.name}</span>
                    {highlighted?.[patient.id] && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Brain className="h-3 w-3" /> {highlighted[patient.id]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{patient.weight}</div>
                </TableCell>
                <TableCell className={cn("text-foreground text-sm hidden sm:table-cell", compact && "sm:hidden")}>{patient.age}</TableCell>
                <TableCell className="text-foreground text-sm hidden md:table-cell">#{patient.picuId.replace(/\D/g, '').padStart(2, '0')}</TableCell>
                <TableCell className={cn(compact && "hidden")}>
                  <span className="text-foreground text-sm">
                    {patient.pelodScore}
                  </span>
                </TableCell>
                <TableCell className={cn("hidden lg:table-cell", compact && "lg:hidden")}>
                  <span className="font-medium text-sm text-foreground">
                    {patient.adherence}%
                  </span>
                </TableCell>
                <TableCell className={cn("text-foreground text-sm hidden xl:table-cell max-w-[200px] truncate", compact && "xl:hidden")}>{patient.diagnosis}</TableCell>
                <TableCell className={cn("hidden xl:table-cell", compact && "xl:hidden")}>
                  {patient.exam && (
                    <span className="text-xs sm:text-sm text-muted-foreground">{patient.exam}</span>
                  )}
                </TableCell>
                <TableCell className={cn(compact && "hidden")}>
                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
                    {getOrganIconWithScore('brain', patient.brainScore, patient.id)}
                    {getOrganIconWithScore('heart', patient.heartScore, patient.id)}
                    {getOrganIconWithScore('lungs', patient.lungsScore, patient.id)}
                  </div>
                </TableCell>
                <TableCell className={cn("hidden md:table-cell", compact && "md:hidden")}>
                  {(() => {
                    const visitStatus = getVisitStatus(patient.id);
                    if (visitStatus) {
                      const getStatusDisplay = (status: string) => {
                        switch(status) {
                          case 'Priority': return tr('Priorité', 'Priority');
                          case 'Confirmed': return tr('Confirmé', 'Confirmed');
                          case 'Leaving': return tr('Sortant', 'Leaving');
                          case 'To Check': return tr('À vérifier', 'To check');
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
                          {tr('Priorité', 'Priority')}
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
                          {patient.tour === 'Priority' || patient.tour === 'Prioritaire' ? tr('Priorité', 'Priority') : patient.tour}
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
