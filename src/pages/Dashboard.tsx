import { Header } from '@/components/Header';
import { PatientTable } from '@/components/PatientTable';

import { TourOrganizer } from '@/components/TourOrganizer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatients } from '@/hooks/usePatients';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { Patient } from '@/types/patient.types';
import { AlertTriangle, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemporaryPatients } from '@/hooks/useTemporaryPatients';
import { clearTemporaryPatientImports } from '@/services/temporaryPatient.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const Dashboard = () => {
  const [selectedPed, setSelectedPed] = useState<'A' | 'B' | 'C'>('A');
  const [showTourOrganizer, setShowTourOrganizer] = useState(false);
  const temporaryPatients = useTemporaryPatients();
  
  // Enable real-time subscriptions
  useRealtimePatients();
  
  // Fetch patients from Supabase (falls back to static data if empty)
  const { data: patientResponse, isLoading } = usePatients();
  const allPatients = patientResponse?.patients || [];

  // Filter patients by selected PED
  const displayedPatients = allPatients.filter(p => {
    if (selectedPed === 'A') return p.ward === 'pedA' || !p.ward;
    if (selectedPed === 'B') return p.ward === 'pedB';
    return false;
  });
  
  // Calculate unit average from ALL patients (all 3 PEDs)
  const unitAveragePelod = allPatients.length > 0 
    ? Math.round(allPatients.reduce((sum, p) => sum + p.pelodScore, 0) / allPatients.length) 
    : 0;
  
  // Calculate selected PED average
  const averagePelod = displayedPatients.length > 0 
    ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header selectedPed={selectedPed} patients={displayedPatients} />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-[1600px]">
        {temporaryPatients.length > 0 && (
          <section className="mb-8 space-y-3" aria-labelledby="temporary-patients-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="temporary-patients-title" className="text-lg font-semibold">
                  Patients temporaires importés
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cohorte locale à ce navigateur; séparée du census et supprimée au rechargement.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearTemporaryPatientImports();
                  toast.success("Les patients temporaires ont été effacés.");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer les imports
              </Button>
            </div>
            <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="flex items-start gap-2 pt-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p>
                  Données synthétiques ou temporaires — lecture seule, non enregistrées
                  et à ne pas utiliser pour des décisions cliniques.
                </p>
              </CardContent>
            </Card>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {temporaryPatients.map((patient) => (
                <Card key={patient.id}>
                  <CardContent className="flex items-center justify-between gap-3 pt-6">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{patient.scenario}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {patient.fileName} · {patient.vitalCount} observations
                      </p>
                      {patient.mode && (
                        <Badge className="mt-2" variant="outline">{patient.mode}</Badge>
                      )}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/optibrain?patient=${encodeURIComponent(patient.id)}`}>
                        Voir
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          <Button variant="outline" className="h-10 bg-muted text-sm sm:text-base">
            Accès TVL
          </Button>
          
          <Button variant="outline" className="h-10 bg-muted border-2 border-primary text-primary hover:bg-primary/5 text-sm sm:text-base" onClick={() => setShowTourOrganizer(true)} data-guide="organize-tour">
            Organiser tournée <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-1 mb-3">
              <h2 className="text-lg sm:text-xl font-medium text-primary">Liste des patients -</h2>
              <Select value={selectedPed} onValueChange={value => setSelectedPed(value as 'A' | 'B' | 'C')}>
                <SelectTrigger className="w-auto border-0 bg-transparent text-primary h-auto p-0 text-lg sm:text-xl font-medium hover:opacity-80 focus:ring-0 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="A">PED A</SelectItem>
                  <SelectItem value="B">PED B</SelectItem>
                  <SelectItem value="C">PED C</SelectItem>
                </SelectContent>
              </Select>
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            
            {displayedPatients.length > 0 ? (
              <PatientTable patients={displayedPatients} pedName={`PED ${selectedPed}`} averagePelod={averagePelod} showTitle={false} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-lg bg-card">
                <p className="text-lg font-medium">Aucun patient dans cette unité</p>
                <p className="text-sm mt-1">Il n'y a actuellement aucun patient en PED {selectedPed}.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <TourOrganizer open={showTourOrganizer} onOpenChange={setShowTourOrganizer} patients={displayedPatients} pedName={`PED ${selectedPed}`} />
    </div>
  );
};

export default Dashboard;
