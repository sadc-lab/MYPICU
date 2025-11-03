import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Wind } from 'lucide-react';

const Optilungs = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient') || '#1';
  const patient = getPatientById(patientId);

  if (!patient) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p>Patient not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Wind className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Lung Monitoring</h1>
              <p className="text-muted-foreground">{patient.name}</p>
            </div>
          </div>
          
          <Badge variant={patient.lungsScore && patient.lungsScore >= 3 ? 'destructive' : 'secondary'}>
            Lungs Score: {patient.lungsScore || 0}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>PaO2 (Arterial Oxygen)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">95</div>
              <p className="text-sm text-muted-foreground">mmHg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PaCO2 (Arterial CO2)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">38</div>
              <p className="text-sm text-muted-foreground">mmHg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FiO2 (Oxygen Fraction)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">40</div>
              <p className="text-sm text-muted-foreground">%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PEEP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">5</div>
              <p className="text-sm text-muted-foreground">cmH2O</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tidal Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">300</div>
              <p className="text-sm text-muted-foreground">mL</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">45</div>
              <p className="text-sm text-muted-foreground">mL/cmH2O</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Optilungs;
