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
import { GripVertical, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TourOrganizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  pedName: string;
}

export const TourOrganizer = ({ open, onOpenChange, patients, pedName }: TourOrganizerProps) => {
  const [orderedPatients, setOrderedPatients] = useState<Patient[]>(patients);
  const navigate = useNavigate();

  const movePatient = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedPatients];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setOrderedPatients(newOrder);
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
            Reorder patients to plan your tour sequence. Click "Start Tour" when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {orderedPatients.map((patient, index) => (
            <div
              key={patient.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
              
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

              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePatient(index, 'up')}
                  disabled={index === 0}
                  className="h-7 px-2"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => movePatient(index, 'down')}
                  disabled={index === orderedPatients.length - 1}
                  className="h-7 px-2"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

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
