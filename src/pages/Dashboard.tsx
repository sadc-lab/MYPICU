import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';
import { PelodBadges } from '@/components/PelodBadges';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPatientsForPed, getAllPatients, pedAPatients, pedBPatients, pedCPatients } from '@/utils/patientData';

const Dashboard = () => {
  const [selectedPed, setSelectedPed] = useState<'A' | 'B' | 'C'>('A');
  
  const patients = getPatientsForPed(selectedPed);
  const allPatients = getAllPatients();

  const averagePelod = patients.length > 0
    ? Math.round(patients.reduce((sum, p) => sum + p.pelodScore, 0) / patients.length)
    : 0;

  const getPedName = (ped: 'A' | 'B' | 'C') => {
    return `PED ${ped}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="flex items-start justify-between mb-6">
          <div className="flex gap-4">
            <Button variant="outline" className="bg-card">
              TVL Access
            </Button>
            
            <Button variant="outline" className="text-primary border-primary bg-card">
              Organize Tour
            </Button>
          </div>

          <PelodBadges patients={allPatients} unitAverage={averagePelod} />
        </div>

        <div className="mb-6">
          <Select value={selectedPed} onValueChange={(value: any) => setSelectedPed(value)}>
            <SelectTrigger className="w-[200px] bg-card">
              <SelectValue placeholder="Select PED" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="A">PED A</SelectItem>
              <SelectItem value="B">PED B</SelectItem>
              <SelectItem value="C">PED C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PatientTable 
          patients={patients}
          pedName={getPedName(selectedPed)}
          averagePelod={averagePelod}
        />
      </main>
    </div>
  );
};

export default Dashboard;
