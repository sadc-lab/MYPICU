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
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const searchQuery = searchParams.get('search')?.toLowerCase() || '';
  
  const allPatients = getAllPatients();
  
  // Get patients for selected PED
  let displayedPatients = getPatientsForPed(selectedPed);
  
  // Filter by search query if present
  if (searchQuery) {
    displayedPatients = displayedPatients.filter(patient => 
      patient.name.toLowerCase().includes(searchQuery) ||
      patient.id.toLowerCase().includes(searchQuery)
    );
  }

  const averagePelod = displayedPatients.length > 0
    ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      
      <main className="container mx-auto px-6 py-6 max-w-[1600px]">
        <div className="flex items-start justify-between mb-6">
          <div className="flex gap-3">
            <Button variant="outline" className="bg-white border-2 border-gray-300">
              TVL Access
            </Button>
            
            <Button variant="outline" className="bg-white border-2 border-primary text-primary hover:bg-primary/5">
              Organize Tour <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <PelodBadges patients={allPatients} unitAverage={averagePelod} />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-medium text-primary">Patient status</h2>
                <Select value={selectedPed} onValueChange={(value) => setSelectedPed(value as 'A' | 'B' | 'C')}>
                  <SelectTrigger className="w-[120px] bg-white border-primary text-primary h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="A">PED A</SelectItem>
                    <SelectItem value="B">PED B</SelectItem>
                    <SelectItem value="C">PED C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600">
                  Found {displayedPatients.length} patient{displayedPatients.length !== 1 ? 's' : ''} matching "{searchQuery}"
                </p>
              )}
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
