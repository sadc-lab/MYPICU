import { useState } from 'react';
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
import { GripVertical, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import { HeartIcon } from '@/components/icons/HeartIcon';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { getScoreTextColor, getScoreBgColor, getScoreColorFilter, getPelodBgColor } from '@/utils/colorUtils';
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

  const getColorFilter = getScoreColorFilter;
  const getColor = getScoreTextColor;
  const getBgColor = getScoreBgColor;

  const getOrganRoute = (organ: 'brain' | 'heart' | 'lungs') => {
    switch (organ) {
      case 'brain':
        return 'optibrain';
      case 'heart':
        return 'optiheart';
      case 'lungs':
        return 'optilungs';
      default:
        return 'optistate';
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
        <Badge variant="destructive" className="text-xs">
          Prioritaire
        </Badge>
      )}
    </div>
  );
};

export const TourOrganizer = ({ open, onOpenChange, patients, pedName }: TourOrganizerProps) => {
  const [orderedPatients, setOrderedPatients] = useState<Patient[]>(patients);
  const navigate = useNavigate();
  const { startTour } = useTourNavigation();

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
      navigate(`/optistate?patient=${orderedPatients[0].id}`);
      onOpenChange(false);
    }
  };

  const getPelodColor = getPelodBgColor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Organiser la tournée - {pedName}</DialogTitle>
          <DialogDescription>
            Glissez et déposez les patients pour réorganiser l'ordre de votre tournée.
          </DialogDescription>
        </DialogHeader>

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
              Démarrer la tournée
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
