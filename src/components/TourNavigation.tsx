import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X, List } from 'lucide-react';
import { useTourNavigation } from '@/hooks/useTourNavigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const TourNavigation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentPatientId = searchParams.get('patient') || '';
  
  const {
    activeTour,
    endTour,
    getCurrentPatientIndex,
    getNextPatient,
    getPreviousPatient,
    isInTour,
  } = useTourNavigation();

  if (!activeTour || !isInTour(currentPatientId)) return null;

  const currentIndex = getCurrentPatientIndex(currentPatientId);
  const nextPatient = getNextPatient(currentPatientId);
  const previousPatient = getPreviousPatient(currentPatientId);
  const totalPatients = activeTour.length;

  const handleNavigate = (patientId: string) => {
    navigate(`/optistats?patient=${patientId}`);
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 py-2">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="bg-primary text-white">
              Tour Active
            </Badge>
            <span className="text-sm font-medium text-gray-700">
              Patient {currentIndex + 1} of {totalPatients}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-white">
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">View All Patients</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto bg-white z-50">
                {activeTour.map((patient, index) => (
                  <DropdownMenuItem
                    key={patient.id}
                    onClick={() => handleNavigate(patient.id)}
                    className={`cursor-pointer ${
                      patient.id === currentPatientId ? 'bg-primary/10 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{index + 1}.</span>
                        <span className="text-red-500 font-semibold">{patient.id}</span>
                        <span>{patient.name}</span>
                      </div>
                      {patient.id === currentPatientId && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => previousPatient && handleNavigate(previousPatient.id)}
                disabled={!previousPatient}
                className="gap-1 h-8"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              
              <div className="h-6 w-px bg-gray-200" />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => nextPatient && handleNavigate(nextPatient.id)}
                disabled={!nextPatient}
                className="gap-1 h-8"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={endTour}
              className="gap-1 bg-white text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">End Tour</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
