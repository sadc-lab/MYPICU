import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/utils/patientData';
import { Heart, Thermometer, Activity, Droplet } from 'lucide-react';

const Optistats = () => {
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">{patient.name}</h1>
              <p className="text-muted-foreground">
                {patient.age} • {patient.weight} • {patient.picuId}
              </p>
            </div>
            <Badge variant="outline" className="text-2xl px-4 py-2">
              PELOD: {patient.pelodScore}
            </Badge>
          </div>
          
          <div className="flex gap-2 mb-4">
            <Badge>Brain: {patient.brainScore || 0}</Badge>
            <Badge>Heart: {patient.heartScore || 0}</Badge>
            <Badge>Lungs: {patient.lungsScore || 0}</Badge>
          </div>

          <p className="text-sm"><strong>Diagnosis:</strong> {patient.diagnosis}</p>
          <p className="text-sm"><strong>Recent Exam:</strong> {patient.exam}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4 text-destructive" />
                Heart Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98</div>
              <p className="text-xs text-muted-foreground">bpm</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-warning" />
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">37.2</div>
              <p className="text-xs text-muted-foreground">°C</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Resp. Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">22</div>
              <p className="text-xs text-muted-foreground">/min</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Droplet className="h-4 w-4 text-success" />
                SpO2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98</div>
              <p className="text-xs text-muted-foreground">%</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vital Signs Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Detailed vital signs monitoring and trends will be displayed here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optistats;
