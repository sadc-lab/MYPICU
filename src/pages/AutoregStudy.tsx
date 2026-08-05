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
  Tooltip,
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
  Target,
  TrendingDown,
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  parseAny,
  describeAnalysisReadiness,
  runAnalysis,
  rollingOptimal,
  resultsToCSV,
  modeLabels,
  PRX_THRESHOLD,
  type AutoregMode,
  type AutoregResult,
  type CurvePoint,
  type OptimalTimePoint,
  type ReadinessError,
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
  const [error, setError] = useState<string | ReadinessError | null>(null);
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
      // Rows saved before the robustness flag existed carry no `robust` field:
      // treat those bins as trustworthy so legacy analyses render unchanged.
      const savedCurve: CurvePoint[] = (Array.isArray(data.curve) ? data.curve : []).map(
        (raw: unknown) => {
          const p = (raw ?? {}) as Partial<CurvePoint>;
          return {
            ppc: Number(p.ppc),
            prx: Number(p.prx),
            count: Number(p.count ?? 0),
            robust: p.robust ?? true,
          };
        },
      );
      if (savedCurve.length === 0 && data.optimal_ppc === null) {
        setError(
          `Le dernier fichier enregistré (${data.file_name ?? 'sans nom'}) ne contient pas de résultat calculable. Réimportez un fichier avec des variations exploitables de PIC/PAM/PPC.`,
        );
        return;
      }
      const restoredMinPrx = data.min_prx !== null ? Number(data.min_prx) : null;
      const restored: AutoregResult = {
        mode: ((data as any).mode as AutoregMode) ?? 'prx',
        optimalPPC: data.optimal_ppc !== null ? Number(data.optimal_ppc) : null,
        lowerLimit: data.lower_limit !== null ? Number(data.lower_limit) : null,
        upperLimit: data.upper_limit !== null ? Number(data.upper_limit) : null,
        minPrx: restoredMinPrx,
        plateauValid:
          Array.isArray(savedCurve) && savedCurve.length >= 3 &&
          restoredMinPrx !== null && restoredMinPrx < PRX_THRESHOLD,
        sampleCount: data.sample_count ?? 0,
        durationHours: data.duration_hours !== null ? Number(data.duration_hours) : 0,
        curve: savedCurve,
        samples: [],
        // Quality diagnostics are derived from the raw signal, which is not
        // persisted: a restored analysis shows results without the quality panel.
        usableSamples: 0,
        pctUsable: 0,
        meanIndex: null,
        pctImpaired: 0,
        robustBins: savedCurve.filter((p) => p.robust).length,
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
      if (readinessError) {
        setError(readinessError);
        setParsing(false);
        return false;
      }
      const analysis = runAnalysis(samples, 30, 5);
      if (analysis.curve.length === 0 || analysis.optimalPPC === null) {
        throw new Error(
          "Calcul impossible : aucune courbe PRx/PPC exploitable n'a pu être générée avec ce fichier.",
        );
      }
      const derived = analysis.samples;
      const rolled = rollingOptimal(derived, Math.min(240, Math.floor(derived.length / 3)), 30, 5, analysis.mode);
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
              mode: analysis.mode,
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


  const labels = useMemo(() => modeLabels(result?.mode ?? 'prx'), [result?.mode]);

  const timeSeriesChartData = useMemo(() => {
    if (!result || !result.samples.length) return [];
    const step = Math.max(1, Math.floor(result.samples.length / 800));
    return result.samples
      .filter((_, i) => i % step === 0)
      .map((s) => ({ t: s.time.getTime(), pic: s.pic, pam: s.pam, ppc: s.ppc, nirs: s.nirs }));
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
      const L = modeLabels(result.mode);

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
          ['Index utilisé', L.index],
          [`${L.optimal} (mmHg)`, result.optimalPPC?.toFixed(0) ?? '—'],
          ['Limite basse LLA (mmHg)', result.lowerLimit?.toFixed(0) ?? '—'],
          ['Limite haute ULA (mmHg)', result.upperLimit?.toFixed(0) ?? '—'],
          [`${L.index} minimum`, result.minPrx?.toFixed(2) ?? '—'],
          ['Plateau fiable', result.plateauValid ? 'Oui' : 'Non'],
          ['Nombre d\'échantillons', String(result.sampleCount)],
          ['Durée (h)', String(result.durationHours)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
      });

      if (result.usableSamples > 0) {
        autoTable(doc, {
          head: [['Qualité et interprétation', 'Valeur']],
          body: [
            ['Échantillons exploitables', `${result.usableSamples} (${result.pctUsable} %)`],
            [`${L.index} moyen`, result.meanIndex?.toFixed(2) ?? '—'],
            [`Temps avec ${L.index} > ${PRX_THRESHOLD.toFixed(1)}`, `${result.pctImpaired} %`],
            ['Bins fiables (≥ 2 % des données)', String(result.robustBins)],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 64, 175] },
        });
      }

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
      doc.text(`Courbe ${L.index} vs ${L.pressure} (bins de 5 mmHg)`, margin, 40);
      autoTable(doc, {
        startY: 60,
        head: [[`${L.pressure} (mmHg)`, `${L.index} moyen`, 'N échantillons', 'Fiable', 'Autorégulation']],
        body: result.curve.map((p) => [
          p.ppc,
          p.prx.toFixed(2),
          p.count,
          p.robust ? 'Oui' : 'Non',
          !p.robust ? 'Non retenu' : p.prx < PRX_THRESHOLD ? 'Préservée' : 'Altérée',
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
                  CSV, Excel (<code>.xlsx</code>) ou JSON Fisher. Deux modes détectés automatiquement :
                  <strong> COx</strong> non invasif (colonnes <code>rSO₂/NIRS, PAM</code>) ou
                  <strong> PRx</strong> invasif (colonnes <code>PIC, PAM, PPC</code>).
                </CardDescription>
              </div>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Étapes de validation" className="shrink-0 -mr-2 -mt-2">
                      <HelpCircle className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    align="start"
                    className="max-w-[16rem] sm:max-w-xs p-0 bg-card border shadow-lg"
                  >
                    <div className="p-2 sm:p-3 space-y-1 sm:space-y-2">
                      <p className="font-semibold text-xs sm:text-sm text-foreground">Étapes de validation</p>
                      <div className="space-y-1">
                        <StepCard
                          n={1}
                          title="Créer un sujet"
                          desc="Ajoutez un pseudonyme via le bouton Sujet."
                          compact
                        />
                        <StepCard
                          n={2}
                          title="Importer les données"
                          desc="CSV, Excel (.xlsx) ou JSON Fisher."
                          compact
                        />
                        <StepCard
                          n={3}
                          title="Analyser et exporter"
                          desc="Visualisations interactives et export CSV."
                          compact
                        />
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
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
                <AlertTitle className="text-sm sm:text-base">Impossible de traiter le fichier</AlertTitle>
                <AlertDescription>
                  {typeof error === 'string' ? (
                    <p className="text-xs sm:text-sm whitespace-pre-line">{error}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm sm:text-base font-semibold leading-snug">{error.cause}</p>
                      <div className="space-y-1">
                        <p className="text-[11px] sm:text-xs font-medium text-destructive/90 uppercase tracking-wide">
                          Remédiation
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-destructive/90 leading-relaxed">
                          {error.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </AlertDescription>
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
                  title="Index COx ou PRx"
                  desc="Corrélation glissante rSO₂/PAM (COx, non invasif) ou PIC/PAM (PRx), fenêtre 30 échantillons."
                />
                <FeatureCard
                  icon={<LineChart className="h-5 w-5" />}
                  title="Courbe en U"
                  desc="Détection automatique de la PAM/PPC optimale et des limites LLA/ULA."
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
                      {result.sampleCount} échantillons · {result.durationHours} h · {labels.index} = corrélation
                      glissante {labels.signal}/PAM (fenêtre 30 échantillons)
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
              <CardContent className="space-y-4">

                <InterpretationBanner result={result} labels={labels} />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <SummaryStat
                    label={labels.optimal}
                    value={result.optimalPPC}
                    unit="mmHg"
                    highlight={result.plateauValid}
                    muted={!result.plateauValid}
                    hint={`Pression où ${labels.index} est minimal : la cible thérapeutique estimée.`}
                  />
                  <SummaryStat
                    label="LLA"
                    value={result.lowerLimit}
                    unit="mmHg"
                    hint={`Limite basse : sous cette pression, ${labels.index} repasse au-dessus de ${PRX_THRESHOLD.toFixed(1)} (autorégulation perdue).`}
                  />
                  <SummaryStat
                    label="ULA"
                    value={result.upperLimit}
                    unit="mmHg"
                    hint={`Limite haute : au-dessus de cette pression, ${labels.index} repasse au-dessus de ${PRX_THRESHOLD.toFixed(1)}.`}
                  />
                  <SummaryStat
                    label={`${labels.index} minimum`}
                    value={result.minPrx}
                    unit=""
                    digits={2}
                    hint={`Meilleure valeur de ${labels.index} atteinte. En dessous de ${PRX_THRESHOLD.toFixed(1)}, l'autorégulation est considérée préservée.`}
                  />
                </div>

                <QualityPanel result={result} labels={labels} />
              </CardContent>
            </Card>

            <Card className="mb-6" id="pdf-chart-curve" data-pdf-title={`Courbe d'autorégulation · ${labels.index} vs ${labels.pressure}`}>
              <CardHeader>
                <CardTitle>Courbe d'autorégulation · {labels.index} vs {labels.pressure}</CardTitle>
                <CardDescription>
                  Le creux de la courbe donne la {labels.optimal.toLowerCase()}. Sous la ligne de seuil
                  ({labels.index} &lt; {PRX_THRESHOLD.toFixed(1)}), l'autorégulation est préservée
                  {result.lowerLimit !== null && result.upperLimit !== null
                    ? ' ; la bande colorée est la plage LLA–ULA à viser.'
                    : '.'}
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
                        label={{ value: `${labels.pressure} (mmHg)`, position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        domain={[-0.4, 1]}
                        label={{ value: labels.index, angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      {result.lowerLimit !== null && result.upperLimit !== null && (
                        <ReferenceArea
                          x1={result.lowerLimit}
                          x2={result.upperLimit}
                          fill="hsl(var(--success))"
                          fillOpacity={0.1}
                          label={{
                            value: 'Plage autorégulée',
                            position: 'insideTop',
                            fontSize: 11,
                            fill: 'hsl(var(--muted-foreground))',
                          }}
                        />
                      )}
                      <ReferenceLine
                        y={PRX_THRESHOLD}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="5 4"
                        label={{
                          value: `Seuil ${PRX_THRESHOLD.toFixed(1)}`,
                          position: 'right',
                          fontSize: 10,
                          fill: 'hsl(var(--destructive))',
                        }}
                      />
                      {result.lowerLimit !== null && (
                        <ReferenceLine x={result.lowerLimit} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                          label={{ value: 'LLA', position: 'insideBottomLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      )}
                      {result.upperLimit !== null && (
                        <ReferenceLine x={result.upperLimit} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                          label={{ value: 'ULA', position: 'insideBottomRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      )}
                      <RechartsTooltip
                        cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
                        content={<CurveTooltip labels={labels} />}
                      />
                      <Line
                        type="monotone"
                        dataKey="prx"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={<CurveDot />}
                        activeDot={{ r: 6 }}
                        name={`${labels.index} moyen`}
                      />
                      {result.optimalPPC !== null && result.minPrx !== null && (
                        <ReferenceDot
                          x={result.optimalPPC}
                          y={result.minPrx}
                          r={7}
                          fill="hsl(var(--primary))"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          label={{ value: `${labels.pressure}opt`, position: 'top', fontSize: 11 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend labels={labels} result={result} />
              </CardContent>
            </Card>

            {rollingChartData.length > 0 && (
              <Card className="mb-6" id="pdf-chart-rolling" data-pdf-title={`${labels.optimal} et limites dans le temps`}>
                <CardHeader>
                  <CardTitle>{labels.optimal} et limites dans le temps</CardTitle>
                  <CardDescription>
                    Estimation glissante de {labels.pressure}opt, LLA et ULA. {labels.pressure} mesurée superposée.
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
                        <RechartsTooltip
                          labelFormatter={(l) => new Date(l).toLocaleString('fr-CA')}
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="ppc" stroke="hsl(var(--muted-foreground))" dot={false} name={`${labels.pressure} mesurée`} />
                        <Line type="monotone" dataKey="optimalPPC" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={labels.optimal} />
                        <Line type="monotone" dataKey="lla" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="LLA" />
                        <Line type="monotone" dataKey="ula" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="ULA" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {timeSeriesChartData.length > 0 && (
            <Card className="mb-6" id="pdf-chart-timeseries" data-pdf-title={result.mode === 'cox' ? 'Séries temporelles rSO₂ / PAM' : 'Séries temporelles PIC / PAM / PPC'}>
              <CardHeader>
                <CardTitle>{result.mode === 'cox' ? 'Séries temporelles rSO₂ / PAM' : 'Séries temporelles PIC / PAM / PPC'}</CardTitle>
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
                      <RechartsTooltip
                        labelFormatter={(l) => new Date(l).toLocaleString('fr-CA')}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                      />
                      <Legend />
                      {result.mode === 'cox' ? (
                        <Line type="monotone" dataKey="nirs" stroke="hsl(var(--destructive))" dot={false} name="rSO₂" />
                      ) : (
                        <>
                          <Line type="monotone" dataKey="pic" stroke="hsl(var(--destructive))" dot={false} name="PIC" />
                          <Line type="monotone" dataKey="ppc" stroke="hsl(142 71% 45%)" dot={false} name="PPC" />
                        </>
                      )}
                      <Line type="monotone" dataKey="pam" stroke="hsl(var(--primary))" dot={false} name="PAM" />
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
                  {labels.index} moyen par bin de {labels.pressure} (5 mmHg). Les bins grisés reposent sur
                  trop peu de données (&lt; 2 % de l'enregistrement) : ils sont affichés mais exclus du calcul
                  de la {labels.optimal.toLowerCase()} et des limites.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[360px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{labels.pressure} (mmHg)</TableHead>
                        <TableHead>{labels.index} moyen</TableHead>
                        <TableHead>N échantillons</TableHead>
                        <TableHead>Fiabilité</TableHead>
                        <TableHead>Autorégulation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.curve.map((p) => {
                        const good = p.prx < PRX_THRESHOLD;
                        const isOptimal = p.robust && p.ppc === result.optimalPPC;
                        return (
                          <TableRow
                            key={p.ppc}
                            className={
                              isOptimal
                                ? 'bg-primary/5'
                                : p.robust
                                  ? undefined
                                  : 'opacity-55 text-muted-foreground'
                            }
                          >
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-2">
                                {p.ppc}
                                {isOptimal && (
                                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px] px-1.5 py-0">
                                    {labels.pressure}opt
                                  </Badge>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>{p.prx.toFixed(2)}</TableCell>
                            <TableCell>{p.count}</TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {p.robust ? (
                                  'Fiable'
                                ) : (
                                  <span className="text-muted-foreground">Peu de données</span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              {p.robust ? (
                                <Badge variant={good ? 'default' : 'destructive'}>
                                  {good ? 'Préservée' : 'Altérée'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Non retenu
                                </Badge>
                              )}
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

const StepCard = ({
  n,
  title,
  desc,
  compact = false,
}: {
  n: number;
  title: string;
  desc: string;
  compact?: boolean;
}) => (
  <div className={`rounded-lg border bg-card ${compact ? 'p-2' : 'p-4'}`}>
    <div className={`flex items-center gap-2 ${compact ? 'mb-0.5' : 'mb-1'}`}>
      <span
        className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold ${
          compact ? 'h-4 w-4 text-[10px]' : 'h-6 w-6 text-xs'
        }`}
      >
        {n}
      </span>
      <span className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        {title}
      </span>
    </div>
    <p className={`text-muted-foreground ${compact ? 'text-[11px] leading-snug' : 'text-sm'}`}>
      {desc}
    </p>
  </div>
);

const SummaryStat = ({
  label,
  value,
  unit,
  digits = 0,
  highlight = false,
  muted = false,
  hint,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits?: number;
  highlight?: boolean;
  muted?: boolean;
  hint?: string;
}) => (
  <div className={`rounded-lg border p-4 ${highlight ? 'bg-primary/5 border-primary/30' : muted ? 'bg-muted/40 border-dashed opacity-70' : 'bg-card'}`}>
    <div className="flex items-start justify-between gap-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {hint && <HintButton text={hint} />}
    </div>
    <div className="mt-1 flex items-baseline gap-1">
      <span className={`text-2xl font-bold ${highlight ? 'text-primary' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value !== null ? value.toFixed(digits) : '—'}
      </span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
  </div>
);

// Focusable trigger so the explanation is also reachable by tap on mobile.
const HintButton = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Aide : ${text}`}
          className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[15rem] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

type ModeLabelSet = ReturnType<typeof modeLabels>;

// Plain-language verdict: what the clinician should retain before reading any chart.
const InterpretationBanner = ({
  result,
  labels,
}: {
  result: AutoregResult;
  labels: ModeLabelSet;
}) => {
  const hasRange = result.lowerLimit !== null && result.upperLimit !== null;
  const ok = result.plateauValid;
  const min = result.minPrx?.toFixed(2) ?? '—';

  const headline = !ok
    ? "Aucun plateau d'autorégulation fiable"
    : hasRange
      ? `Cible ${labels.pressure} : ${result.lowerLimit}–${result.upperLimit} mmHg`
      : `${labels.optimal} estimée : ${result.optimalPPC ?? '—'} mmHg`;

  const detail = !ok ? (
    <>
      {labels.index} reste au-dessus du seuil de {PRX_THRESHOLD.toFixed(1)} sur toute la plage
      (minimum {min}) : l'autorégulation semble <strong>globalement altérée</strong>. La{' '}
      {labels.optimal.toLowerCase()} affichée ci-dessous correspond seulement au bin le moins altéré
      et n'est <strong>pas cliniquement interprétable</strong>.
    </>
  ) : hasRange ? (
    <>
      Autorégulation préservée ({labels.index} &lt; {PRX_THRESHOLD.toFixed(1)}) entre{' '}
      {result.lowerLimit} et {result.upperLimit} mmHg, optimum à{' '}
      <strong>{result.optimalPPC} mmHg</strong> ({labels.index} = {min}). Maintenir la{' '}
      {labels.pressure} dans cette plage.
    </>
  ) : (
    <>
      Autorégulation préservée autour de <strong>{result.optimalPPC} mmHg</strong> ({labels.index} ={' '}
      {min}), mais les limites LLA/ULA ne sont pas identifiables : la plage de {labels.pressure}{' '}
      enregistrée ne franchit pas le seuil de part et d'autre de l'optimum.
    </>
  );

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        ok ? 'border-primary/30 bg-primary/5' : 'border-destructive/40 bg-destructive/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {ok ? (
          <Target className="h-5 w-5 shrink-0 text-primary mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-lg sm:text-xl font-bold leading-tight ${
              ok ? 'text-primary' : 'text-destructive'
            }`}
          >
            {headline}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{detail}</p>
        </div>
      </div>
      {ok && hasRange && <TargetRangeBar result={result} labels={labels} />}
    </div>
  );
};

// Positions LLA / optimum / ULA on the pressure range actually recorded, so the
// target window can be read at a glance instead of from three separate numbers.
const TargetRangeBar = ({
  result,
  labels,
}: {
  result: AutoregResult;
  labels: ModeLabelSet;
}) => {
  const min = result.curve[0]?.ppc;
  const max = result.curve[result.curve.length - 1]?.ppc;
  if (min === undefined || max === undefined || max <= min) return null;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const left = pct(result.lowerLimit as number);
  const right = pct(result.upperLimit as number);

  return (
    <div className="mt-4 pt-4 border-t border-primary/20">
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-success/30 border border-success/60"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }}
        />
        {result.optimalPPC !== null && (
          <div
            className="absolute -top-1.5 h-6 w-[3px] rounded-full bg-primary"
            style={{ left: `${pct(result.optimalPPC)}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{min} mmHg</span>
        <span className="text-center">
          <span className="font-medium text-primary">{labels.pressure}opt {result.optimalPPC}</span>
          {' · '}plage {result.lowerLimit}–{result.upperLimit} mmHg
        </span>
        <span>{max} mmHg</span>
      </div>
    </div>
  );
};

// Signal-quality diagnostics: tells the reader how much to trust the numbers above.
const QualityPanel = ({ result, labels }: { result: AutoregResult; labels: ModeLabelSet }) => {
  if (result.usableSamples <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Analyse restaurée depuis la base : les indicateurs de qualité du signal ne sont disponibles
        qu'après un nouvel import du fichier brut.
      </p>
    );
  }

  const tone = (v: number, good: number, warn: number, invert = false) => {
    const ok = invert ? v <= good : v >= good;
    const mid = invert ? v <= warn : v >= warn;
    return ok ? 'good' : mid ? 'warn' : 'bad';
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Qualité du signal et interprétation
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QualityStat
          label="Données exploitables"
          value={`${result.pctUsable} %`}
          sub={`${result.usableSamples} échantillons`}
          tone={tone(result.pctUsable, 90, 70)}
          hint={`Part des paires ${labels.index}/${labels.pressure} comprises dans la fenêtre physiologique 20–150 mmHg. Le reste est écarté comme artefact (rinçage, débranchement).`}
        />
        <QualityStat
          label={`${labels.index} moyen`}
          value={result.meanIndex?.toFixed(2) ?? '—'}
          sub={`seuil ${PRX_THRESHOLD.toFixed(1)}`}
          tone={result.meanIndex === null ? 'neutral' : tone(result.meanIndex, 0.3, 0.5, true)}
          hint={`Moyenne de ${labels.index} sur toute la période exploitable, toutes pressions confondues.`}
        />
        <QualityStat
          label="Temps altéré"
          value={`${result.pctImpaired} %`}
          sub={`${labels.index} > ${PRX_THRESHOLD.toFixed(1)}`}
          tone={tone(result.pctImpaired, 20, 50, true)}
          hint={`Proportion du temps exploitable passée au-dessus du seuil d'altération. Un pourcentage élevé indique une autorégulation défaillante sur une grande partie de l'enregistrement.`}
        />
        <QualityStat
          label="Bins fiables"
          value={String(result.robustBins)}
          sub={`sur ${result.curve.length} bins`}
          tone={tone(result.robustBins, 5, 3)}
          hint="Nombre de paliers de pression contenant au moins 2 % des données. Seuls ces paliers servent au calcul de l'optimum et des limites."
        />
      </div>
    </div>
  );
};

const QualityStat = ({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  hint: string;
}) => {
  const toneClass =
    tone === 'good'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-warning'
        : tone === 'bad'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
        <HintButton text={hint} />
      </div>
      <div className={`text-lg font-bold leading-tight ${toneClass}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
};

// Filled dot = bin retained for the fit; hollow grey dot = too few samples.
const CurveDot = (props: { cx?: number; cy?: number; payload?: CurvePoint }) => {
  const { cx, cy, payload } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
  return payload?.robust === false ? (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill="hsl(var(--background))"
      stroke="hsl(var(--muted-foreground))"
      strokeWidth={1.5}
      strokeOpacity={0.6}
    />
  ) : (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth={1}
    />
  );
};

const CurveTooltip = ({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurvePoint }>;
  labels: ModeLabelSet;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const good = p.prx < PRX_THRESHOLD;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-semibold text-foreground">
        {labels.pressure} {p.ppc} mmHg
      </p>
      <p className="text-muted-foreground">
        {labels.index} moyen : <span className="font-medium text-foreground">{p.prx.toFixed(2)}</span>
      </p>
      <p className="text-muted-foreground">{p.count} échantillons</p>
      {p.robust === false ? (
        <p className="text-muted-foreground italic">Peu de données — exclu du calcul</p>
      ) : (
        <p className={good ? 'text-success' : 'text-destructive'}>
          {good ? 'Autorégulation préservée' : 'Autorégulation altérée'}
        </p>
      )}
    </div>
  );
};

const ChartLegend = ({ labels, result }: { labels: ModeLabelSet; result: AutoregResult }) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="4" fill="hsl(var(--primary))" />
      </svg>
      Bin fiable (retenu pour le calcul)
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="3.5" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" />
      </svg>
      Peu de données (&lt; 2 %) — exclu
    </span>
    <span className="flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden>
        <line x1="0" y1="6" x2="16" y2="6" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
      Seuil {labels.index} = {PRX_THRESHOLD.toFixed(1)}
    </span>
    {result.lowerLimit !== null && result.upperLimit !== null && (
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-sm bg-success/25 border border-success/50" aria-hidden />
        Plage autorégulée (LLA–ULA)
      </span>
    )}
  </div>
);

export default AutoregStudy;
