import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Brain } from 'lucide-react';

const Optibrain = () => {
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
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Brain Monitoring</h1>
              <p className="text-muted-foreground">{patient.name}</p>
            </div>
          </div>
          
          <Badge variant={patient.brainScore && patient.brainScore >= 3 ? 'destructive' : 'secondary'}>
            Brain Score: {patient.brainScore || 0}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ICP (Intracranial Pressure)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">15</div>
              <p className="text-sm text-muted-foreground">mmHg (Normal: 7-15)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CPP (Cerebral Perfusion Pressure)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">65</div>
              <p className="text-sm text-muted-foreground">mmHg (Target: 50-70)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GCS (Glasgow Coma Scale)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">12</div>
              <p className="text-sm text-muted-foreground">Eyes: 3, Verbal: 4, Motor: 5</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pupil Reactivity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Left:</span>
                  <Badge>Reactive</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Right:</span>
                  <Badge>Reactive</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Optibrain;
