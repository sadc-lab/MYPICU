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
import { GripVertical, Play } from 'lucide-react';
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
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const SortablePatientItem = ({ patient, getPelodColor, navigate, isChecked, onCheckedChange }: SortablePatientItemProps) => {
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
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${isChecked ? 'bg-muted/50 border-border opacity-75' : 'bg-card border-border hover:bg-muted/30'}`}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        className="flex-shrink-0"
      />
      
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-semibold ${isChecked ? 'text-destructive/50 line-through' : 'text-destructive'}`}>{patient.id}</span>
          <span className={`font-medium ${isChecked ? 'text-foreground/50 line-through' : 'text-foreground'}`}>{patient.name}</span>
        </div>
        <div className={`flex flex-wrap items-center gap-2 text-sm ${isChecked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
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

export const TourOrganizer = ({ open, onOpenChange, patients, pedName }: TourOrganizerProps) => {
  const [orderedPatients, setOrderedPatients] = useState<Patient[]>(patients);
  const navigate = useNavigate();
  const { startTour } = useTourNavigation();
  
  // Storage key for this specific tour
  const storageKey = `tour-checklist-${pedName}-${new Date().toLocaleDateString()}`;
  
  // Initialize checked patients from localStorage
  const [checkedPatients, setCheckedPatients] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading tour checklist:', error);
    }
    return new Set();
  });

  // Save checked patients to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(checkedPatients)));
    } catch (error) {
      console.error('Error saving tour checklist:', error);
    }
  }, [checkedPatients, storageKey]);

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

  const handleCheckChange = (patientId: string, checked: boolean) => {
    setCheckedPatients(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(patientId);
      } else {
        newSet.delete(patientId);
      }
      return newSet;
    });
  };

  const getPelodColor = (score: number) => {
    if (score >= 25) return 'bg-red-500 text-white';
    if (score >= 20) return 'bg-red-400 text-white';
    if (score >= 15) return 'bg-orange-500 text-white';
    if (score >= 12) return 'bg-orange-400 text-white';
    return 'bg-green-500 text-white';
  };

  const completedCount = checkedPatients.size;
  const totalCount = orderedPatients.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Organize Tour - {pedName}</DialogTitle>
          <DialogDescription>
            Drag and drop patients to reorder your tour sequence. Check off patients as you visit them.
          </DialogDescription>
        </DialogHeader>

        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg border border-border">
            <span className="text-sm font-medium text-foreground">Tour Progress</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {completedCount} / {totalCount} completed
              </span>
              <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

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
                  isChecked={checkedPatients.has(patient.id)}
                  onCheckedChange={(checked) => handleCheckChange(patient.id, checked)}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {orderedPatients.length} patient{orderedPatients.length !== 1 ? 's' : ''} in tour
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStartTour} className="gap-2">
              <Play className="h-4 w-4" />
              Start Tour
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
