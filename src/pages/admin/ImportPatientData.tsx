import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTemporaryPatients } from "@/hooks/useTemporaryPatients";
import {
  addTemporaryPatientImport,
  clearTemporaryPatientImports,
} from "@/services/temporaryPatient.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImportStatus {
  fileName: string;
  status: "done" | "error";
  error?: string;
  patientId?: string;
  vitals: number;
  medications: number;
}

const ImportPatientData = () => {
  const [results, setResults] = useState<ImportStatus[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const temporaryPatients = useTemporaryPatients();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsImporting(true);
    const imported: ImportStatus[] = [];

    for (const file of files) {
      try {
        const input: unknown = JSON.parse(await file.text());
        const patient = addTemporaryPatientImport(file.name, input);
        imported.push({
          fileName: file.name,
          status: "done",
          patientId: patient.id,
          vitals: patient.vitalCount,
          medications: patient.medicationCount,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import du fichier impossible.";
        imported.push({
          fileName: file.name,
          status: "error",
          error: message,
          vitals: 0,
          medications: 0,
        });
      }
    }

    setResults((previous) => [...imported, ...previous]);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const failures = imported.filter((result) => result.status === "error").length;
    if (failures) toast.error(`${failures} fichier(s) n'ont pas pu être importés.`);
    if (failures < imported.length) toast.success("Import temporaire terminé dans ce navigateur.");
  };

  const clearImports = () => {
    clearTemporaryPatientImports();
    setResults([]);
    toast.success("Les imports temporaires ont été effacés de ce navigateur.");
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Import temporaire de données</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Les fichiers sont lus et conservés uniquement en mémoire dans cet onglet.
          Aucune donnée n'est écrite dans Supabase ni dans la base clinique.
        </p>
      </header>

      <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-6 text-sm">
          <strong>Données de démonstration — ne pas utiliser pour des décisions cliniques.</strong>
          <p className="mt-1 text-muted-foreground">
            Les patients temporaires sont isolés du census, en lecture seule et supprimés
            quand l'onglet est rechargé ou fermé.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Choisir des fichiers JSON patients</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Le fichier doit commencer par un identifiant numérique et contenir des
            observations horodatées reconnues.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <FileUp className="mr-2 h-4 w-4" />}
            {isImporting ? "Import en cours..." : "Choisir des fichiers JSON"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <section className="space-y-3" aria-labelledby="import-results-title">
          <h2 id="import-results-title" className="text-lg font-semibold">Résultat de l'import</h2>
          {results.map((result, index) => (
            <Card key={`${result.fileName}-${index}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {result.status === "done"
                      ? <CheckCircle className="h-4 w-4 text-green-600" />
                      : <AlertCircle className="h-4 w-4 text-destructive" />}
                    <span className="truncate">{result.fileName}</span>
                  </p>
                  {result.error && <p className="mt-1 text-sm text-destructive">{result.error}</p>}
                  {result.status === "done" && (
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline">Observations : {result.vitals}</Badge>
                      <Badge variant="outline">Médications : {result.medications}</Badge>
                    </div>
                  )}
                </div>
                {result.patientId && (
                  <Button asChild size="sm">
                    <Link to={`/optibrain?patient=${encodeURIComponent(result.patientId)}`}>
                      Voir temporairement
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {temporaryPatients.length > 0 && (
        <section className="space-y-3" aria-labelledby="active-imports-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="active-imports-title" className="text-lg font-semibold">
                Cohorte temporaire active
              </h2>
              <p className="text-sm text-muted-foreground">
                {temporaryPatients.length} patient(s), présents uniquement en mémoire.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearImports}>
              <Trash2 className="mr-2 h-4 w-4" />
              Effacer les imports
            </Button>
          </div>
          {temporaryPatients.map((patient) => (
            <Card key={patient.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="font-medium">{patient.scenario}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.fileName} · {patient.vitalCount} observations
                    {patient.mode ? ` · ${patient.mode}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/optibrain?patient=${encodeURIComponent(patient.id)}`}>
                    Ouvrir
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
};

export default ImportPatientData;
