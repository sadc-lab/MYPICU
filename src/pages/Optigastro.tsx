import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';

const Optigastro = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optigastro" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px] space-y-6">
        <VitalSignsPanel />
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Optimisation gastro-intestinale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
              <Construction className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium">Module en cours de développement</p>
              <p className="text-xs text-muted-foreground/70">Les indicateurs gastro-intestinaux seront bientôt disponibles.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optigastro;
