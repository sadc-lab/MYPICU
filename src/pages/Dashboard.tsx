import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';
import { PelodBadges } from '@/components/PelodBadges';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllPatients, getPatientsForPed, pedAPatients, pedBPatients, pedCPatients } from '@/utils/patientData';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

const Dashboard = () => {
  const [selectedPed, setSelectedPed] = useState<'A' | 'B' | 'C'>('A');
  
  const allPatients = getAllPatients();
  
  // Get patients for selected PED
  const displayedPatients = getPatientsForPed(selectedPed);

  const averagePelod = displayedPatients.length > 0
    ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-[1600px]">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-0 mb-6">
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
            <Button variant="outline" className="bg-white border-2 border-gray-300 text-sm sm:text-base">
              TVL Access
            </Button>
            
            <Button variant="outline" className="bg-white border-2 border-primary text-primary hover:bg-primary/5 text-sm sm:text-base">
              Organize Tour <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="hidden lg:block">
            <PelodBadges patients={allPatients} unitAverage={averagePelod} />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <h2 className="text-lg sm:text-xl font-medium text-primary">Patient status</h2>
              <Select value={selectedPed} onValueChange={(value) => setSelectedPed(value as 'A' | 'B' | 'C')}>
                <SelectTrigger className="w-full sm:w-[120px] bg-white border-primary text-primary h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="A">PED A</SelectItem>
                  <SelectItem value="B">PED B</SelectItem>
                  <SelectItem value="C">PED C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <PatientTable 
              patients={displayedPatients}
              pedName={`PED ${selectedPed}`}
              averagePelod={averagePelod}
              showTitle={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
