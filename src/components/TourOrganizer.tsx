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
}

const SortablePatientItem = ({ patient, getPelodColor }: SortablePatientItemProps) => {
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

  const startTour = () => {
    // Navigate to first patient in the tour
    if (orderedPatients.length > 0) {
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
          <DialogTitle className="text-xl font-bold">Organize Tour - {pedName}</DialogTitle>
          <DialogDescription>
            Drag and drop patients to reorder your tour sequence. Click "Start Tour" when ready.
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
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            {orderedPatients.length} patient{orderedPatients.length !== 1 ? 's' : ''} in tour
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={startTour} className="gap-2">
              <Play className="h-4 w-4" />
              Start Tour
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
