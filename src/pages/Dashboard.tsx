import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';
import { PelodBadges } from '@/components/PelodBadges';
import { TourOrganizer } from '@/components/TourOrganizer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllPatients, getPatientsForPed } from '@/utils/patientData';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
const Dashboard = () => {
  const [selectedPed, setSelectedPed] = useState<'A' | 'B' | 'C'>('A');
  const [showTourOrganizer, setShowTourOrganizer] = useState(false);
  const allPatients = getAllPatients();

  // Get patients for selected PED
  const displayedPatients = getPatientsForPed(selectedPed);
  
  // Calculate unit average from ALL patients (all 3 PEDs)
  const unitAveragePelod = allPatients.length > 0 
    ? Math.round(allPatients.reduce((sum, p) => sum + p.pelodScore, 0) / allPatients.length) 
    : 0;
  
  // Calculate selected PED average
  const averagePelod = displayedPatients.length > 0 
    ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length) 
    : 0;
  return <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-[1600px]">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-0 mb-6">
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
            <Button variant="outline" className="bg-white border-2 border-gray-300 text-sm sm:text-base">
              Accès TVL
            </Button>
            
            <Button variant="outline" className="bg-white border-2 border-primary text-primary hover:bg-primary/5 text-sm sm:text-base" onClick={() => setShowTourOrganizer(true)} data-guide="organize-tour">
              Organiser tournée <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="hidden lg:block">
            <PelodBadges patients={displayedPatients} unitAverage={unitAveragePelod} />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-1 mb-3">
              <h2 className="text-lg sm:text-xl font-medium text-primary">Liste des patients -</h2>
              <Select value={selectedPed} onValueChange={value => setSelectedPed(value as 'A' | 'B' | 'C')}>
                <SelectTrigger className="w-auto border-0 bg-transparent text-primary h-auto p-0 text-lg sm:text-xl font-medium hover:opacity-80 focus:ring-0 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="A">PED A</SelectItem>
                  <SelectItem value="B">PED B</SelectItem>
                  <SelectItem value="C">PED C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <PatientTable patients={displayedPatients} pedName={`PED ${selectedPed}`} averagePelod={averagePelod} showTitle={false} />
          </div>
        </div>
      </main>

      <TourOrganizer open={showTourOrganizer} onOpenChange={setShowTourOrganizer} patients={displayedPatients} pedName={`PED ${selectedPed}`} />
    </div>;
};
export default Dashboard;