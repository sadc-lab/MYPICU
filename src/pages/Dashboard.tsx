import { useState } from 'react';
import { Header } from '@/components/Header';
import { PatientCard } from '@/components/PatientCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPatientsForPed, getAllPatients } from '@/utils/patientData';

const Dashboard = () => {
  const [selectedPed, setSelectedPed] = useState<'all' | 'A' | 'B' | 'C'>('all');
  
  const patients = selectedPed === 'all' 
    ? getAllPatients() 
    : getPatientsForPed(selectedPed);

  const averagePelod = patients.length > 0
    ? Math.round(patients.reduce((sum, p) => sum + p.pelodScore, 0) / patients.length)
    : 0;

  const topPatients = [...patients]
    .sort((a, b) => b.pelodScore - a.pelodScore)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Patient Overview</h1>
            <p className="text-muted-foreground">
              {selectedPed === 'all' ? 'All PEDs' : `PED ${selectedPed}`} - Average PELOD: {averagePelod}
            </p>
          </div>

          <div className="flex gap-4">
            <Select value={selectedPed} onValueChange={(value: any) => setSelectedPed(value)}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Select PED" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">All PEDs</SelectItem>
                <SelectItem value="A">PED A</SelectItem>
                <SelectItem value="B">PED B</SelectItem>
                <SelectItem value="C">PED C</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline">
              TVL Access
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Top 5 Patients by PELOD Score</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topPatients.map(patient => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">All Patients</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map(patient => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
