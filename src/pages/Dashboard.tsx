import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';
import { PelodBadges } from '@/components/PelodBadges';
import { Button } from '@/components/ui/button';
import { getAllPatients, getPatientsForPed, pedAPatients, pedBPatients, pedCPatients } from '@/utils/patientData';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const selectedPed = searchParams.get('ped');
  
  const allPatients = getAllPatients();
  
  // Filter patients based on selection
  const displayedPatients = selectedPed && selectedPed !== 'all' 
    ? getPatientsForPed(selectedPed as 'A' | 'B' | 'C')
    : allPatients;

  const averagePelod = displayedPatients.length > 0
    ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length)
    : 0;
  
  const showAllPeds = !selectedPed || selectedPed === 'all';

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

          <PelodBadges patients={displayedPatients} unitAverage={averagePelod} />
        </div>

        <div className="space-y-6">
          {showAllPeds ? (
            <>
              <PatientTable 
                patients={pedAPatients}
                pedName="PED A"
                averagePelod={averagePelod}
              />

              {pedBPatients.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium text-primary">Patient status PED B</h2>
                    <Button variant="link" className="text-primary">
                      See more <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {pedCPatients.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium text-primary">Patient status PED C</h2>
                    <Button variant="link" className="text-primary">
                      See more <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <PatientTable 
              patients={displayedPatients}
              pedName={`PED ${selectedPed}`}
              averagePelod={averagePelod}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
