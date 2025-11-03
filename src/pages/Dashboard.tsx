import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';
import { PelodBadges } from '@/components/PelodBadges';
import { Button } from '@/components/ui/button';
import { getAllPatients, pedAPatients, pedBPatients, pedCPatients } from '@/utils/patientData';
import { ChevronRight } from 'lucide-react';

const Dashboard = () => {
  const allPatients = getAllPatients();

  const averagePelodA = pedAPatients.length > 0
    ? Math.round(pedAPatients.reduce((sum, p) => sum + p.pelodScore, 0) / pedAPatients.length)
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

          <PelodBadges patients={allPatients} unitAverage={averagePelodA} />
        </div>

        <div className="space-y-6">
          <PatientTable 
            patients={pedAPatients}
            pedName="PED A"
            averagePelod={averagePelodA}
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
