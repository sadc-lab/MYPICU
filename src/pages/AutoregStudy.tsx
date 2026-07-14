import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { StudyNav } from '@/components/study/StudyNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Upload,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Brain,
  LineChart,
  ShieldCheck,
  UserPlus,
  HelpCircle,
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  parseAny,
  describeAnalysisReadiness,
  runAnalysis,
  rollingOptimal,
  resultsToCSV,
  type AutoregResult,
  type OptimalTimePoint,
} from '@/services/autoregComputation.service';
import { useStudyPatients } from '@/hooks/useStudyPatients';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PatientAnalysis {
  result: AutoregResult;
  rolling: OptimalTimePoint[];
  fileName: string;
}

async function readFileAsText(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames[0];
    if (!first) throw new Error('Fichier Excel sans feuille.');
    return XLSX.utils.sheet_to_csv(wb.Sheets[first]);
  }
  return await file.text();
}

const AutoregStudy = () => {
  const patientsController = useStudyPatients();
  const { patients, active, addPatient, updatePatient, removePatient } = patientsController;

  // Per-patient cache so each subject is independent
  const [analysisByPatient, setAnalysisByPatient] = useState<Record<string, PatientAnalysis>>({});
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = active ? analysisByPatient[active.id] ?? null : null;
  const result = current?.result ?? null;
  const rolling = current?.rolling ?? [];
  const fileName = current?.fileName ?? null;

  // Load saved analysis from Supabase whenever active patient changes and cache is empty
  useEffect(() => {
    if (!active) return;
    if (analysisByPatient[active.id]) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: fetchError } = await supabase
        .from('autoreg_study_results')
        .select('*')
        .eq('user_id', user.id)
        .eq('study_patient_id', active.id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || fetchError || !data) return;
      const savedCurve = Array.isArray(data.curve) ? data.curve : [];
      if (savedCurve.length === 0 && data.optimal_ppc === null) {
        setError(
          `Le dernier fichier enregistré (${data.file_name ?? 'sans nom'}) ne contient pas de résultat calculable. Réimportez un fichier avec des variations exploitables de PIC/PAM/PPC.`,
        );
        return;
      }
      const restored: AutoregResult = {
        optimalPPC: data.optimal_ppc !== null ? Number(data.optimal_ppc) : null,
        lowerLimit: data.lower_limit !== null ? Number(data.lower_limit) : null,
        upperLimit: data.upper_limit !== null ? Number(data.upper_limit) : null,
        minPrx: data.min_prx !== null ? Number(data.min_prx) : null,
        sampleCount: data.sample_count ?? 0,
        durationHours: data.duration_hours !== null ? Number(data.duration_hours) : 0,
        curve: savedCurve as any,
        samples: [],
      };
      setAnalysisByPatient((prev) =>
        prev[active.id]
          ? prev
          : {
              ...prev,
              [active.id]: {
                result: restored,
                rolling: (data.rolling as any) ?? [],
                fileName: data.file_name ?? '',
              },
            },
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Add-patient dialog state (label + required file)
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const submitNewPatient = async () => {
    setAddError(null);
    if (!newFile) {
      setAddError('Veuillez sélectionner un fichier CSV, JSON ou Excel.');
      return;
    }
    const created = addPatient(newLabel);
    const finalLabel = newLabel.trim();
    if (finalLabel) {
      updatePatient(created.id, { label: finalLabel });
    }
    const target = { id: created.id, code: created.code, label: finalLabel || created.label };
    const fileToProcess = newFile;
    setAddOpen(false);
    setNewLabel('');
    setNewFile(null);
    const ok = await handleFile(fileToProcess, target);
    if (!ok) {
      removePatient(created.id);
    }
  };


  const handleFile = async (file: File, patientOverride?: { id: string; code: string; label: string }): Promise<boolean> => {
    setError(null);
    setParsing(true);
    const target = patientOverride ?? active;
    if (!target) {
      setError("Aucun patient sélectionné.");
      setParsing(false);
      return false;
    }
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 25 Mo).');
      const text = await readFileAsText(file);
      const samples = parseAny(text);
      const readinessError = describeAnalysisReadiness(samples);
      if (readinessError) throw new Error(readinessError);
      const analysis = runAnalysis(samples, 30, 5);
      if (analysis.curve.length === 0 || analysis.optimalPPC === null) {
        throw new Error(
          "Calcul impossible : aucune courbe PRx/PPC exploitable n'a pu être générée avec ce fichier.",
        );
      }
      const derived = analysis.samples;
      const rolled = rollingOptimal(derived, Math.min(240, Math.floor(derived.length / 3)), 30, 5);
      setAnalysisByPatient((prev) => ({
        ...prev,
        [target.id]: { result: analysis, rolling: rolled, fileName: file.name },
      }));
      updatePatient(target.id, { fileName: file.name });
      // Persist results in Supabase (linked to study patient id)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: insertError } = await supabase
            .from('autoreg_study_results')
            .insert({
              user_id: user.id,
              study_patient_id: target.id,
              study_patient_code: target.code,
              study_patient_label: target.label,
              file_name: file.name,
              optimal_ppc: analysis.optimalPPC,
              lower_limit: analysis.lowerLimit,
              upper_limit: analysis.upperLimit,
              min_prx: analysis.minPrx,
              sample_count: analysis.sampleCount,
              duration_hours: analysis.durationHours,
              curve: analysis.curve as any,
              rolling: rolled as any,
            });
          if (insertError) throw insertError;
          toast.success('Résultats enregistrés dans la base de données');
        } else {
          toast.info("Connectez-vous pour conserver les résultats dans la base.");
        }
      } catch (persistErr: any) {
        console.error('Persist autoreg result error:', persistErr);
        toast.error("Impossible d'enregistrer les résultats : " + (persistErr.message || 'erreur inconnue'));
      }
      return true;
    } catch (e: any) {
      setError(e.message || 'Erreur lors du traitement du fichier.');
      return false;
    } finally {
      setParsing(false);
    }
  };


  const timeSeriesChartData = useMemo(() => {
    if (!result || !result.samples.length) return [];
    const step = Math.max(1, Math.floor(result.samples.length / 800));
    return result.samples
      .filter((_, i) => i % step === 0)
      .map((s) => ({ t: s.time.getTime(), pic: s.pic, pam: s.pam, ppc: s.ppc }));
  }, [result]);

  const rollingChartData = useMemo(
    () =>
      rolling.map((r) => ({
        t: new Date(r.time).getTime(),
        ppc: r.ppc,
        optimalPPC: r.optimalPPC,
        lla: r.lowerLimit,
        ula: r.upperLimit,
      })),
    [rolling],
  );


  const downloadCSV = () => {
    if (!result) return;
    const csv = resultsToCSV(result, {
      subjectId: active?.id,
      subjectCode: active?.code,
      subjectLabel: active?.label,
      fileName: fileName ?? undefined,
      studyDate: result.samples[0]?.time,
      exportedAt: new Date(),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoreg_${active?.code ?? 'sujet'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const downloadPDF = async () => {
    if (!result) return;
    try {
      const [{ jsPDF }, autoTable, { toPng }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable').then((m) => m.default),
        import('html-to-image'),
      ]);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      const now = new Date();

      doc.setFontSize(16);
      doc.text("Rapport d'autorégulation cérébrale", margin, 50);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(
        `Sujet : ${active?.code ?? '—'} · ${active?.label ?? ''}`,
        margin,
        70,
      );
      doc.text(`Fichier : ${fileName ?? '—'}`, margin, 84);
      doc.text(`Généré le : ${now.toLocaleString('fr-CA')}`, margin, 98);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 120,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['PPC optimale (mmHg)', result.optimalPPC?.toFixed(0) ?? '—'],
          ['Limite basse LLA (mmHg)', result.lowerLimit?.toFixed(0) ?? '—'],
          ['Limite haute ULA (mmHg)', result.upperLimit?.toFixed(0) ?? '—'],
          ['PRx minimum', result.minPrx?.toFixed(2) ?? '—'],
          ['Nombre d\'échantillons', String(result.sampleCount)],
          ['Durée (h)', String(result.durationHours)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
      });

      // Capture each chart card as PNG and add to the PDF
      const chartIds = ['pdf-chart-curve', 'pdf-chart-rolling', 'pdf-chart-timeseries'];
      for (const id of chartIds) {
        const node = document.getElementById(id);
        if (!node) continue;
        const png = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 });
        const imgWidth = pageWidth - margin * 2;
        const props = doc.getImageProperties(png);
        const imgHeight = (props.height * imgWidth) / props.width;
        doc.addPage();
        doc.setFontSize(12);
        doc.text(node.dataset.pdfTitle || 'Graphique', margin, 40);
        doc.addImage(png, 'PNG', margin, 60, imgWidth, imgHeight);
      }

      // Curve table
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Courbe PRx vs PPC (bins de 5 mmHg)', margin, 40);
      autoTable(doc, {
        startY: 60,
        head: [['PPC (mmHg)', 'PRx moyen', 'N échantillons', 'Autorégulation']],
        body: result.curve.map((p) => [
          p.ppc,
          p.prx.toFixed(2),
          p.count,
          p.prx < 0.3 ? 'Préservée' : 'Altérée',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 9 },
      });

      doc.save(`autoreg_${active?.code ?? 'sujet'}_${Date.now()}.pdf`);
      toast.success('PDF généré');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error("Échec de l'export PDF : " + (err.message || 'erreur inconnue'));
    }
  };


  const formatTime = (t: number) =>
    new Date(t).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background">
      <Header studyNav={<StudyNav patientsController={patientsController} />} />

      {/* Landing hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto max-w-5xl px-4 pt-10 sm:pt-16 pb-4 text-center">
          <Badge variant="outline" className="mb-3">
            Étude clinique · Usage recherche uniquement
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight mb-2">
            Validation clinique de l'autorégulation cérébrale
          </h1>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Import panel */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import des données
                  {active && (
                    <Badge variant="secondary" className="ml-2">
                      {active.code} · {active.label}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Formats acceptés : CSV, Excel (<code>.xlsx</code>) ou JSON Fisher (colonnes <code>Horodate, PIC, PAM, PPC</code>).
                </CardDescription>
              </div>
              <TooltipProvider delayDuration={100}>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 -mr-2 -mt-2">
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" align="start" className="max-w-sm p-0 bg-card border shadow-lg">
                    <div className="p-3 space-y-3">
                      <p className="font-semibold text-sm text-foreground">Étapes de validation</p>
                      <StepCard
                        n={1}
                        title="Créer un sujet"
                        desc="Ajoutez un pseudonyme via le bouton Sujet dans la barre du haut."
                      />
                      <StepCard
                        n={2}
                        title="Importer les données"
                        desc="CSV, Excel (.xlsx) ou JSON Fisher. Détection automatique."
                      />
                      <StepCard
                        n={3}
                        title="Analyser et exporter"
                        desc="Visualisations interactives et export CSV des résultats calculés."
                      />
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {!active && patients.length === 0 && (
              <Alert className="mb-4">
                <UserPlus className="h-4 w-4" />
                <AlertTitle>Aucun sujet</AlertTitle>
                <AlertDescription>
                  Cliquez sur <strong>Ajouter un patient</strong> pour créer un sujet et importer
                  son fichier CSV/JSON en une seule étape.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,.txt,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = '';
                }}
              />
              <Button onClick={() => { setAddError(null); setAddOpen(true); }} disabled={parsing}>
                <UserPlus className="mr-2 h-4 w-4" />
                Ajouter un patient
              </Button>
              {active && (
                <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={parsing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {parsing ? 'Analyse…' : 'Modifier fichier'}
                </Button>
              )}
              {fileName && (
                <span className="text-sm text-muted-foreground truncate">
                  Fichier chargé : <span className="font-medium text-foreground">{fileName}</span>
                </span>
              )}
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Impossible de traiter le fichier</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddError(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un patient</DialogTitle>
              <DialogDescription>
                Renseignez un pseudonyme et joignez le fichier CSV ou JSON du sujet. Les deux sont
                requis pour créer le patient et lancer l'analyse.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-patient-label">Pseudonyme (optionnel)</Label>
                <Input
                  id="new-patient-label"
                  placeholder="ex. Sujet A"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-patient-file">Fichier CSV, Excel ou JSON *</Label>
                <Input
                  id="new-patient-file"
                  type="file"
                  accept=".csv,.json,.txt,.xlsx,.xls"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                />
                {newFile && (
                  <p className="text-xs text-muted-foreground truncate">
                    Sélectionné : <span className="font-medium text-foreground">{newFile.name}</span>
                  </p>
                )}
              </div>
              {addError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{addError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={parsing}>
                Annuler
              </Button>
              <Button onClick={submitNewPatient} disabled={parsing || !newFile}>
                {parsing ? 'Analyse…' : 'Créer et analyser'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {!result && !error && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="mb-6">Aucune donnée. Importez un fichier pour lancer l'analyse.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
                <FeatureCard
                  icon={<Brain className="h-5 w-5" />}
                  title="Indice PRx"
                  desc="Corrélation glissante PIC/PAM sur fenêtre 30 échantillons."
                />
                <FeatureCard
                  icon={<LineChart className="h-5 w-5" />}
                  title="Courbe en U"
                  desc="Détection automatique de la PPC optimale et des limites LLA/ULA."
                />
                <FeatureCard
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Données locales"
                  desc="Traitement 100% navigateur, aucune donnée transmise à un serveur."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Résultats de l'analyse
                    </CardTitle>
                    <CardDescription>
                      {result.sampleCount} échantillons · {result.durationHours} h · PRx = corrélation
                      glissante PIC/PAM (fenêtre 30 échantillons)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      Exporter CSV
                    </Button>
                    <Button variant="default" size="sm" onClick={downloadPDF}>
                      <FileText className="mr-2 h-4 w-4" />
                      Exporter PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryStat label="PPC optimale" value={result.optimalPPC} unit="mmHg" highlight />
                  <SummaryStat label="LLA" value={result.lowerLimit} unit="mmHg" />
                  <SummaryStat label="ULA" value={result.upperLimit} unit="mmHg" />
                  <SummaryStat label="PRx minimum" value={result.minPrx} unit="" digits={2} />
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6" id="pdf-chart-curve" data-pdf-title="Courbe d'autorégulation · PRx vs PPC">
              <CardHeader>
                <CardTitle>Courbe d'autorégulation · PRx vs PPC</CardTitle>
                <CardDescription>
                  Minimum de PRx = PPC optimale. La zone verte indique la plage de bonne autorégulation
                  (PRx &lt; 0.3).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={result.curve} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="ppc"
                        type="number"
                        domain={['dataMin - 2', 'dataMax + 2']}
                        label={{ value: 'PPC (mmHg)', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        domain={[-0.4, 1]}
                        label={{ value: 'PRx', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      {result.lowerLimit !== null && result.upperLimit !== null && (
                        <ReferenceArea
                          x1={result.lowerLimit}
                          x2={result.upperLimit}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.08}
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                        labelFormatter={(l) => `PPC : ${l} mmHg`}
                      />
                      <Line
                        type="monotone"
                        dataKey="prx"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="PRx moyen"
                      />
                      {result.optimalPPC !== null && result.minPrx !== null && (
                        <ReferenceDot
                          x={result.optimalPPC}
                          y={result.minPrx}
                          r={7}
                          fill="hsl(var(--primary))"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          label={{ value: 'PPCopt', position: 'top', fontSize: 11 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {rollingChartData.length > 0 && (
              <Card className="mb-6" id="pdf-chart-rolling" data-pdf-title="PPC optimale et limites dans le temps">
                <CardHeader>
                  <CardTitle>PPC optimale et limites dans le temps</CardTitle>
                  <CardDescription>
                    Estimation glissante de PPCopt, LLA et ULA. PPC mesurée superposée.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={rollingChartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={formatTime}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          domain={['dataMin - 5', 'dataMax + 5']}
                          label={{ value: 'mmHg', angle: -90, position: 'insideLeft' }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          labelFormatter={(l) => new Date(l).toLocaleString('fr-CA')}
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="ppc" stroke="hsl(var(--muted-foreground))" dot={false} name="PPC mesurée" />
                        <Line type="monotone" dataKey="optimalPPC" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="PPC optimale" />
                        <Line type="monotone" dataKey="lla" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="LLA" />
                        <Line type="monotone" dataKey="ula" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="ULA" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {timeSeriesChartData.length > 0 && (
            <Card className="mb-6" id="pdf-chart-timeseries" data-pdf-title="Séries temporelles PIC / PAM / PPC">
              <CardHeader>
                <CardTitle>Séries temporelles PIC / PAM / PPC</CardTitle>
                <CardDescription>Données brutes après import.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={timeSeriesChartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatTime}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(l) => new Date(l).toLocaleString('fr-CA')}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="pic" stroke="hsl(var(--destructive))" dot={false} name="PIC" />
                      <Line type="monotone" dataKey="pam" stroke="hsl(var(--primary))" dot={false} name="PAM" />
                      <Line type="monotone" dataKey="ppc" stroke="hsl(142 71% 45%)" dot={false} name="PPC" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            )}


            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Tableau des résultats</CardTitle>
                <CardDescription>
                  PRx moyen par bin de PPC (5 mmHg). Bins avec au moins 3 échantillons.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[360px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PPC (mmHg)</TableHead>
                        <TableHead>PRx moyen</TableHead>
                        <TableHead>N échantillons</TableHead>
                        <TableHead>Autorégulation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.curve.map((p) => {
                        const good = p.prx < 0.3;
                        return (
                          <TableRow key={p.ppc}>
                            <TableCell className="font-medium">{p.ppc}</TableCell>
                            <TableCell>{p.prx.toFixed(2)}</TableCell>
                            <TableCell>{p.count}</TableCell>
                            <TableCell>
                              <Badge variant={good ? 'default' : 'destructive'}>
                                {good ? 'Préservée' : 'Altérée'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Cet outil est fourni à des fins de recherche clinique. Il ne remplace pas l'évaluation
          médicale et n'est pas un dispositif médical homologué.
        </p>
      </main>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 text-primary mb-1">
      {icon}
      <span className="font-semibold text-foreground">{title}</span>
    </div>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </div>
);

const StepCard = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
  <div className="rounded-lg border bg-card p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {n}
      </span>
      <span className="font-semibold text-foreground">{title}</span>
    </div>
    <p className="text-sm text-muted-foreground">{desc}</p>
  </div>
);

const SummaryStat = ({
  label,
  value,
  unit,
  digits = 0,
  highlight = false,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits?: number;
  highlight?: boolean;
}) => (
  <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value !== null ? value.toFixed(digits) : '—'}
      </span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
  </div>
);

export default AutoregStudy;
