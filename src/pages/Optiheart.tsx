import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Heart } from 'lucide-react';

const Optiheart = () => {
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
            <Heart className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-3xl font-bold">Heart Monitoring</h1>
              <p className="text-muted-foreground">{patient.name}</p>
            </div>
          </div>
          
          <Badge variant={patient.heartScore && patient.heartScore >= 3 ? 'destructive' : 'secondary'}>
            Heart Score: {patient.heartScore || 0}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cardiac Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">4.5</div>
              <p className="text-sm text-muted-foreground">L/min</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cardiac Index</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">3.2</div>
              <p className="text-sm text-muted-foreground">L/min/m²</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CVP (Central Venous Pressure)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">8</div>
              <p className="text-sm text-muted-foreground">mmHg</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lactate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">1.2</div>
              <p className="text-sm text-muted-foreground">mmol/L</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Optiheart;
