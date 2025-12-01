import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ExternalLink, ChevronDown, Bell } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { getPatientById } from '@/utils/patientData';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import stateIcon from '@/assets/stats-icon.svg';
import { Patient } from '@/types/patient.types';

const reminders = [
  "Objectif de Bilan Entrée/Sortie",
  "Prophylaxie Thrombose veineuse",
  "Prophylaxie Ulcère de stress",
  "Fréquence des radios",
  "Fréquence des labos",
  "Équipement à retirer",
  "Limites d'alarmes et fréquence de surveillance",
  "Mesures d'isolement",
];

interface PatientHeaderProps {
  currentPage: 'optistate' | 'optibrain' | 'optiheart' | 'optilungs';
}

export const PatientHeader = ({ currentPage }: PatientHeaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#25';
  const patient = getPatientById(patientId);
  const [showVitals, setShowVitals] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  if (!patient) return null;

  const getOrganBadgeClass = (score?: number) => {
    if (!score || score === 0) return 'bg-gray-100 text-gray-500 border border-gray-300';
    if (score === 1) return 'bg-orange-100 text-orange-600 border border-orange-300';
    if (score === 2) return 'bg-orange-200 text-orange-700 border border-orange-400';
    return 'bg-red-200 text-red-700 border border-red-400';
  };

  const getColorFilter = (score?: number) => {
    if (!score || score === 0) return 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)'; // grey
    if (score === 1) return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'; // orange
    if (score === 2) return 'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)'; // darker orange
    return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'; // red
  };

  const getTextColor = (score?: number) => {
    if (!score || score === 0) return 'text-gray-500';
    if (score === 1) return 'text-orange-600';
    if (score === 2) return 'text-orange-700';
    return 'text-red-700';
  };

  const isActivePage = (page: string) => currentPage === page;

  return (
    <div className="bg-card border-b border-border mb-4 sm:mb-6">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground text-sm self-start"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour aux patients
          </Button>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button
  asChild
  variant="outline"
  size="sm"
  className="gap-2 text-xs sm:text-sm"
>
  <a
    href="https://www.uptodate.com/login"
    target="_blank"
    rel="noopener noreferrer"
  >
    <ExternalLink className="size-3 sm:size-4" />
    <span className="hidden sm:inline">UpToDate</span>
  </a>
</Button>

          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              {patient.id} {patient.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>{patient.age}</span>
              <span>•</span>
              <span>{patient.weight}</span>
              <span>•</span>
              <span>PICU: {patient.picuId}</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground mt-2">
              <strong>Diagnostic:</strong> {patient.diagnosis}
            </p>
            
            <Collapsible open={showVitals} onOpenChange={setShowVitals} className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors">
                <span className="font-medium">Signes vitaux</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showVitals ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-border">
                  <div className="text-xs">
                    <span className="text-muted-foreground block">FC</span>
                    <span className="font-semibold text-foreground">85 bpm</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block">TA</span>
                    <span className="font-semibold text-foreground">120/80 mmHg</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block">Temp</span>
                    <span className="font-semibold text-foreground">37.2°C</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block">FR</span>
                    <span className="font-semibold text-foreground">18/min</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block">SpO2</span>
                    <span className="font-semibold text-foreground">98%</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={showReminders} onOpenChange={setShowReminders} className="mt-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors">
                <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Rappels ({reminders.length})</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showReminders ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
                  {reminders.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                      <span className="text-xs text-muted-foreground leading-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 w-full lg:w-auto">
            <div className="text-left sm:text-right sm:mr-4">
              <div className="text-xs text-muted-foreground mb-1">PELOD Score</div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{patient.pelodScore}</div>
            </div>

            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => {
                  const timeRange = searchParams.get('timeRange');
                  const params = new URLSearchParams();
                  params.set('patient', patientId);
                  if (timeRange) params.set('timeRange', timeRange);
                  navigate(`/optistate?${params.toString()}`);
                }}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optistate')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.pelodScore)} text-xs`}>
                  <img 
                    src={stateIcon} 
                    alt="state" 
                    className="h-6 w-6 sm:h-7 sm:w-7" 
                    style={{ filter: getColorFilter(patient.pelodScore) }} 
                  />
                  <span className="ml-1 font-semibold">State</span>
                </Badge>
              </button>

              <button
                onClick={() => {
                  const timeRange = searchParams.get('timeRange');
                  const params = new URLSearchParams();
                  params.set('patient', patientId);
                  if (timeRange) params.set('timeRange', timeRange);
                  navigate(`/optibrain?${params.toString()}`);
                }}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optibrain')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.brainScore)} text-xs`}>
                  <img 
                    src={brainIcon} 
                    alt="brain" 
                    className="h-6 w-6 sm:h-7 sm:w-7" 
                    style={{ filter: getColorFilter(patient.brainScore) }} 
                  />
                  <span className="ml-1 font-semibold">{patient.brainScore || 0}</span>
                </Badge>
              </button>

              <button
                onClick={() => {
                  const timeRange = searchParams.get('timeRange');
                  const params = new URLSearchParams();
                  params.set('patient', patientId);
                  if (timeRange) params.set('timeRange', timeRange);
                  navigate(`/optiheart?${params.toString()}`);
                }}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optiheart')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.heartScore)} text-xs`}>
                  <HeartIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${getTextColor(patient.heartScore)}`} />
                  <span className="ml-1 font-semibold">{patient.heartScore || 0}</span>
                </Badge>
              </button>

              <button
                onClick={() => {
                  const timeRange = searchParams.get('timeRange');
                  const params = new URLSearchParams();
                  params.set('patient', patientId);
                  if (timeRange) params.set('timeRange', timeRange);
                  navigate(`/optilungs?${params.toString()}`);
                }}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  isActivePage('optilungs')
                    ? 'bg-primary text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Badge variant="outline" className={`${getOrganBadgeClass(patient.lungsScore)} text-xs`}>
                  <img 
                    src={lungsIcon} 
                    alt="lungs" 
                    className="h-6 w-6 sm:h-7 sm:w-7" 
                    style={{ filter: getColorFilter(patient.lungsScore) }} 
                  />
                  <span className="ml-1 font-semibold">{patient.lungsScore || 0}</span>
                </Badge>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
