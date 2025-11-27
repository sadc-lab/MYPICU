import { useState, useEffect } from 'react';
import { Patient } from '@/utils/patientData';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Play, ClipboardCheck, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { HeartIcon } from '@/components/icons/HeartIcon';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TourOrganizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  pedName: string;
}

interface SortablePatientItemProps {
  patient: Patient;
  getPelodColor: (score: number) => string;
  navigate: (path: string) => void;
}

const SortablePatientItem = ({ patient, getPelodColor, navigate }: SortablePatientItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: patient.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getColorFilter = (score?: number) => {
    if (!score || score === 0) return 'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)';
    if (score === 1) return 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)';
    if (score === 2) return 'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)';
    return 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)';
  };

  const getColor = (score?: number) => {
    if (!score || score === 0) return 'text-gray-500';
    if (score === 1) return 'text-orange-600';
    if (score === 2) return 'text-orange-700';
    return 'text-red-700';
  };

  const getBgColor = (score?: number) => {
    if (!score || score === 0) return 'bg-gray-100';
    if (score === 1) return 'bg-orange-50';
    if (score === 2) return 'bg-orange-100';
    return 'bg-red-50';
  };

  const getOrganRoute = (organ: 'brain' | 'heart' | 'lungs') => {
    switch (organ) {
      case 'brain':
        return 'optibrain';
      case 'heart':
        return 'optiheart';
      case 'lungs':
        return 'optilungs';
      default:
        return 'optistats';
    }
  };

  const handleOrganClick = (e: React.MouseEvent, organ: 'brain' | 'heart' | 'lungs') => {
    e.stopPropagation();
    navigate(`/${getOrganRoute(organ)}?patient=${encodeURIComponent(patient.id)}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-red-500">{patient.id}</span>
          <span className="font-medium text-gray-900">{patient.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>{patient.age}</span>
          <span>•</span>
          <span>{patient.weight}</span>
          <span>•</span>
          <span className="truncate">{patient.diagnosis}</span>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded ${getBgColor(patient.brainScore)} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={(e) => handleOrganClick(e, 'brain')}
          title="Voir détails du cerveau"
        >
          <img src={brainIcon} alt="brain" className="h-5 w-5" style={{ filter: getColorFilter(patient.brainScore) }} />
          <span className={`text-xs font-semibold ${getColor(patient.brainScore)}`}>
            {patient.brainScore || 0}
          </span>
        </div>

        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded ${getBgColor(patient.heartScore)} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={(e) => handleOrganClick(e, 'heart')}
          title="Voir détails du cœur"
        >
          <HeartIcon className={`h-5 w-5 ${getColor(patient.heartScore)}`} />
          <span className={`text-xs font-semibold ${getColor(patient.heartScore)}`}>
            {patient.heartScore || 0}
          </span>
        </div>

        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded ${getBgColor(patient.lungsScore)} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={(e) => handleOrganClick(e, 'lungs')}
          title="Voir détails des poumons"
        >
          <img src={lungsIcon} alt="lungs" className="h-5 w-5" style={{ filter: getColorFilter(patient.lungsScore) }} />
          <span className={`text-xs font-semibold ${getColor(patient.lungsScore)}`}>
            {patient.lungsScore || 0}
          </span>
        </div>
      </div>

      <Badge className={`${getPelodColor(patient.pelodScore)} font-bold min-w-[60px] justify-center`}>
        PELOD: {patient.pelodScore}
      </Badge>

      {patient.tour && (
        <Badge variant={patient.tour === 'Priority' ? 'destructive' : 'secondary'} className="text-xs">
          {patient.tour}
        </Badge>
      )}
    </div>
  );
};

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

const defaultChecklist: ChecklistItem[] = [
  { id: "bilan", label: "Objectif de Bilan Entrée/Sortie", checked: false },
  { id: "thrombose", label: "Prophylaxie Thrombose veineuse", checked: false },
  { id: "ulcere", label: "Prophylaxie Ulcère de stress", checked: false },
  { id: "radios", label: "Fréquence des radios", checked: false },
  { id: "labos", label: "Fréquence des labos", checked: false },
  { id: "equipement", label: "Équipement à retirer", checked: false },
  { id: "alarmes", label: "Limites d'alarmes et fréquence de surveillance", checked: false },
  { id: "isolement", label: "Mesures d'isolement", checked: false },
];

const STORAGE_KEY = "tour-checklist";

export const TourOrganizer = ({ open, onOpenChange, patients, pedName }: TourOrganizerProps) => {
  const [orderedPatients, setOrderedPatients] = useState<Patient[]>(patients);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultChecklist;
  });
  const navigate = useNavigate();
  const { startTour } = useTourNavigation();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checklist));
  }, [checklist]);

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const resetChecklist = () => {
    setChecklist(defaultChecklist);
  };

  const completedCount = checklist.filter((item) => item.checked).length;
  const progress = Math.round((completedCount / checklist.length) * 100);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedPatients((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleStartTour = () => {
    // Save tour order and navigate to first patient
    if (orderedPatients.length > 0) {
      startTour(orderedPatients);
      navigate(`/optistats?patient=${orderedPatients[0].id}`);
      onOpenChange(false);
    }
  };

  const getPelodColor = (score: number) => {
    if (score >= 25) return 'bg-red-500 text-white';
    if (score >= 20) return 'bg-red-400 text-white';
    if (score >= 15) return 'bg-orange-500 text-white';
    if (score >= 12) return 'bg-orange-400 text-white';
    return 'bg-green-500 text-white';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Organiser tournée - {pedName}</DialogTitle>
          <DialogDescription>
            Glissez et déposez les patients pour réorganiser l'ordre de votre tournée.
          </DialogDescription>
        </DialogHeader>

        {/* Tour Checklist */}
        <div className="border rounded-lg border-primary/20 bg-card">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Liste de contrôle</span>
                <span className="text-xs text-muted-foreground">
                  ({completedCount}/{checklist.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetChecklist}
                  className="h-7 px-2 text-muted-foreground hover:text-primary"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setChecklistExpanded(!checklistExpanded)} className="h-7 px-2">
                  {checklistExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {checklistExpanded && (
            <div className="px-3 pb-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors text-xs ${
                      item.checked ? "bg-primary/10 text-muted-foreground line-through" : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="leading-tight">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            <SortableContext
              items={orderedPatients.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedPatients.map((patient) => (
                <SortablePatientItem
                  key={patient.id}
                  patient={patient}
                  getPelodColor={getPelodColor}
                  navigate={navigate}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            {orderedPatients.length} patient{orderedPatients.length !== 1 ? 's' : ''} dans la tournée
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleStartTour} className="gap-2">
              <Play className="h-4 w-4" />
              Démarrer tournée
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
