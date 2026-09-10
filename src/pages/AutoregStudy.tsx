import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  Brush,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { useYAxisZoom } from '@/hooks/useYAxisZoom';
import { useSharedTimeWindow } from '@/hooks/useSharedTimeWindow';
import { ChartTimeRangeProvider } from '@/contexts/ChartTimeRangeContext';
import { ChartZoomControls } from '@/components/ChartZoomControls';
import { TimeRangeBadge } from '@/components/TimeRangeBadge';
import { BRUSH_TOUCH_WIDTH, renderWideTouchTraveller } from '@/lib/chartBrushTraveller';
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
import { useStudyPatients, type StudyPatient } from '@/hooks/useStudyPatients';
import { usePatients } from '@/hooks/usePatients';
import {
  loadAutoregSourceFromVitals,
  monitorSourceToFile,
  type MonitorAutoregSource,
} from '@/services/monitorAutoregSource.service';
import {
  AutoregCurveCard,
  AutoregKpiRow,
  InterpretationBanner,
  QualityPanel,
} from '@/components/autoreg/AutoregResultViews';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PatientAnalysis {
  result: AutoregResult;
  rolling: OptimalTimePoint[];
  fileName: string;
}

// Raw recordings shipped with the app follow this naming convention, keyed on the
// patient id used by the patient list (e.g. "#8749" → autoregulation_raw_8749.csv).
const recordingUrlFor = (patientId: string) =>
  `/data/autoregulation_raw_${patientId.replace('#', '')}.csv`;

// Returns the patient's bundled recording, or null when there is none.
// vercel.json rewrites unknown paths to index.html, so a 200 is not proof the
// file exists — the body has to be checked as well.
async function fetchPatientRecording(patientId: string): Promise<File | null> {
  const url = recordingUrlFor(patientId);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim() || text.trimStart().startsWith('<')) return null;
    return new File([text], url.split('/').pop() as string, { type: 'text/csv' });
  } catch {
    return null;
  }
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
  const [activeTab, setActiveTab] = useState('curve');
  const inputRef = useRef<HTMLInputElement>(null);

  const current = active ? analysisByPatient[active.id] ?? null : null;
  const result = current?.result ?? null;
  // Memoised so the `?? []` fallback does not hand a fresh array to the memos
  // downstream on every render, which would defeat their caching.
  const rolling = useMemo(() => current?.rolling ?? [], [current]);
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

  // Add-patient dialog state (label + file, or a patient picked from the unit list)
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [sourcePatientId, setSourcePatientId] = useState<string>('');
  const [sourceRecording, setSourceRecording] = useState<File | null>(null);
  const [probingRecording, setProbingRecording] = useState(false);
  // Set when the recording was assembled from the monitoring series in Supabase
  // rather than from a raw file bundled with the app.
  const [monitorSource, setMonitorSource] = useState<MonitorAutoregSource | null>(null);

  const { data: patientResponse } = usePatients(undefined);
  const unitPatients = patientResponse?.patients ?? [];
  const sourcePatient = unitPatients.find((p) => p.id === sourcePatientId) ?? null;

  const resetAddForm = () => {
    setNewLabel('');
    setNewFile(null);
    setSourcePatientId('');
    setSourceRecording(null);
    setMonitorSource(null);
    setAddError(null);
  };

  // Picking a patient prefills the pseudonym and looks for a recording, so a known
  // subject can be analysed without any manual import. Two sources are tried, in
  // order: the raw file bundled with the app, then — for patients without one —
  // the PIC/PAM series already charted in Supabase.
  const selectSourcePatient = async (patientId: string) => {
    setSourcePatientId(patientId);
    setAddError(null);
    setSourceRecording(null);
    setMonitorSource(null);
    const picked = unitPatients.find((p) => p.id === patientId);
    if (!picked) return;
    setNewLabel(picked.name);
    setProbingRecording(true);
    try {
      const recording = await fetchPatientRecording(picked.id);
      if (recording) {
        setSourceRecording(recording);
        return;
      }
      const fromMonitor = await loadAutoregSourceFromVitals(picked.id);
      if (fromMonitor) {
        setMonitorSource(fromMonitor);
        setSourceRecording(monitorSourceToFile(fromMonitor));
      }
    } catch (e) {
      // Probing is best-effort: the dialog falls back to asking for a file, but
      // the failure is surfaced rather than swallowed as "no data available".
      console.error('Recherche de données pour ce patient échouée:', e);
      setAddError(
        "La recherche de données pour ce patient a échoué. Joignez le fichier manuellement, ou réessayez.",
      );
    } finally {
      setProbingRecording(false);
    }
  };

  const submitNewPatient = async () => {
    setAddError(null);
    const fileToProcess = newFile ?? sourceRecording;
    if (!fileToProcess) {
      setAddError(
        sourcePatient
          ? "Aucun enregistrement n'est disponible pour ce patient : joignez un fichier CSV, JSON ou Excel."
          : 'Veuillez sélectionner un fichier CSV, JSON ou Excel.',
      );
      return;
    }
    const created = addPatient(newLabel);
    const finalLabel = newLabel.trim();
    const patch: Partial<StudyPatient> = {};
    if (finalLabel) patch.label = finalLabel;
    if (sourcePatient) patch.sourcePatientId = sourcePatient.id;
    if (Object.keys(patch).length > 0) {
      updatePatient(created.id, patch);
    }
    const target = { id: created.id, code: created.code, label: finalLabel || created.label };
    setAddOpen(false);
    resetAddForm();
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

  const timeSeriesTimeWindow = useSharedTimeWindow(timeSeriesChartData, (d) => d.t);
  const [timeSeriesEditing, setTimeSeriesEditing] = useState(false);
  const timeSeriesAutoYDomain = useMemo((): [number, number] => {
    const values: number[] = [];
    for (const d of timeSeriesTimeWindow.visibleData) {
      if (d.pic !== null) values.push(d.pic);
      if (d.pam !== null) values.push(d.pam);
      if (d.ppc !== null) values.push(d.ppc);
      if (d.nirs !== null) values.push(d.nirs);
    }
    if (values.length === 0) return [0, 100];
    return [Math.floor(Math.min(...values) / 5) * 5 - 5, Math.ceil(Math.max(...values) / 5) * 5 + 5];
  }, [timeSeriesTimeWindow.visibleData]);
  const timeSeriesZoom = useYAxisZoom(timeSeriesAutoYDomain);

  // LLA/ULA come out null when the curve never crosses the threshold on that side
  // over the whole recording. The rolling analysis works on shorter windows and
  // does find them part of the time, so its most recent estimate is shown instead
  // of a dash — labelled as such, never passed off as the whole-recording limit.
  const lastRollingLimits = useMemo(() => {
    let lower: { value: number; time: string } | null = null;
    let upper: { value: number; time: string } | null = null;
    for (const r of rolling) {
      if (r.lowerLimit !== null) lower = { value: r.lowerLimit, time: r.time };
      if (r.upperLimit !== null) upper = { value: r.upperLimit, time: r.time };
    }
    return { lower, upper };
  }, [rolling]);

  const llaFallback = result?.lowerLimit === null ? lastRollingLimits.lower : null;
  const ulaFallback = result?.upperLimit === null ? lastRollingLimits.upper : null;

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

  const rollingTimeWindow = useSharedTimeWindow(rollingChartData, (d) => d.t);
  const [rollingEditing, setRollingEditing] = useState(false);
  const rollingAutoYDomain = useMemo((): [number, number] => {
    const values: number[] = [];
    for (const d of rollingTimeWindow.visibleData) {
      if (d.ppc !== null) values.push(d.ppc);
      if (d.optimalPPC !== null) values.push(d.optimalPPC);
      if (d.lla !== null) values.push(d.lla);
      if (d.ula !== null) values.push(d.ula);
    }
    if (values.length === 0) return [0, 100];
    return [Math.floor(Math.min(...values) / 5) * 5 - 5, Math.ceil(Math.max(...values) / 5) * 5 + 5];
  }, [rollingTimeWindow.visibleData]);
  const rollingZoom = useYAxisZoom(rollingAutoYDomain);


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
    const restoreTab = activeTab;
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

      // Charts live in tabs and inactive tabs are unmounted, so each one is
      // brought on screen just long enough to be captured.
      const chartTabs = [
        { tab: 'curve', id: 'pdf-chart-curve' },
        { tab: 'rolling', id: 'pdf-chart-rolling' },
        { tab: 'signals', id: 'pdf-chart-timeseries' },
      ];
      for (const { tab, id } of chartTabs) {
        setActiveTab(tab);
        // Let React commit the tab switch and Recharts lay the chart out.
        await new Promise((resolve) => setTimeout(resolve, 450));
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
      setActiveTab(restoreTab);

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
      setActiveTab(restoreTab);
    }
  };


  const formatTime = (t: number) =>
    new Date(t).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  // Shared by the full import panel and its collapsed bar.
  const errorAlert = error && (
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
  );

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

        {/* Import panel — collapses to a single bar once an analysis is on screen,
            so the results start at the top of the viewport. */}
        {result ? (
          <Card className="mb-6">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Badge variant="secondary" className="shrink-0">
                  {active?.code} · {active?.label}
                </Badge>
                {fileName && (
                  <span className="text-sm text-muted-foreground truncate min-w-0">{fileName}</span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={parsing}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {parsing ? 'Analyse…' : 'Modifier fichier'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAddError(null); setAddOpen(true); }}
                    disabled={parsing}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Ajouter un patient
                  </Button>
                </div>
              </div>
              {errorAlert}
            </CardContent>
          </Card>
        ) : (
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
                  Cliquez sur <strong>Ajouter un patient</strong> pour choisir un patient de l'unité
                  — son enregistrement est chargé automatiquement s'il existe — ou pour créer un
                  sujet à partir de votre propre fichier CSV/JSON.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

            {errorAlert}
          </CardContent>
        </Card>
        )}

        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { resetAddForm(); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un patient</DialogTitle>
              <DialogDescription>
                Choisissez un patient de l'unité — son enregistrement est chargé automatiquement
                s'il est disponible — ou créez un sujet en joignant vous-même le fichier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {unitPatients.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="new-patient-source">Patient de l'unité</Label>
                  <Select value={sourcePatientId} onValueChange={selectSourcePatient}>
                    <SelectTrigger id="new-patient-source">
                      <SelectValue placeholder="Sélectionner un patient…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitPatients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.picuId} ({p.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {probingRecording && (
                    <p className="text-xs text-muted-foreground">
                      Recherche d'un enregistrement, puis des données du moniteur…
                    </p>
                  )}
                  {!probingRecording && sourcePatient && sourceRecording && !monitorSource && (
                    <p className="text-xs text-success flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Enregistrement trouvé : {sourceRecording.name} — aucun import manuel nécessaire.
                    </p>
                  )}
                  {!probingRecording && sourcePatient && monitorSource && (
                    <div className="text-xs text-success space-y-1">
                      <p className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Données du moniteur trouvées : {monitorSource.pairedSamples} échantillons
                        PIC + PAM appariés (moyenne par {monitorSource.bucketSeconds} s).
                      </p>
                      <p className="text-muted-foreground">
                        Analyse en PRx à partir des séries enregistrées dans la base
                        {monitorSource.ppcDerived ? ', PPC calculée comme PAM − PIC' : ''}. Aucune
                        rSO₂ n'est disponible dans la base : pour un COx, joignez l'enregistrement brut.
                      </p>
                      {monitorSource.truncated && (
                        <p className="text-warning">
                          Séries lues partiellement (séjour très long ou lecture interrompue) :
                          l'analyse ne couvre pas la totalité du monitorage.
                        </p>
                      )}
                    </div>
                  )}
                  {!probingRecording && sourcePatient && !sourceRecording && (
                    <p className="text-xs text-muted-foreground">
                      Ni enregistrement livré avec l'application, ni série PIC + PAM exploitable dans
                      la base pour ce patient : joignez le fichier ci-dessous.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-patient-label">Pseudonyme</Label>
                <Input
                  id="new-patient-label"
                  placeholder="ex. Sujet A"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-patient-file">
                  Fichier CSV, Excel ou JSON{' '}
                  {monitorSource
                    ? '(remplace les données du moniteur)'
                    : sourceRecording
                      ? '(remplace l’enregistrement du patient)'
                      : '*'}
                </Label>
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
              <Button
                onClick={submitNewPatient}
                disabled={parsing || probingRecording || (!newFile && !sourceRecording)}
              >
                {parsing ? 'Analyse…' : 'Créer et analyser'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {!result && !error && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="mb-6">
                Aucune donnée. Choisissez un patient de l'unité ou importez un fichier pour lancer
                l'analyse.
              </p>
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

                <InterpretationBanner result={result} rolling={rolling} />

                <AutoregKpiRow result={result} rolling={rolling} />

                <QualityPanel result={result} />
              </CardContent>
            </Card>

            {/* The curve is the everyday read; the rest is verification material,
                one click away instead of stacked below it. */}
            {/* Une plage de temps choisie sur "Évolution" ou "Signaux bruts"
                reste appliquée quand on bascule de l'un à l'autre. */}
            <ChartTimeRangeProvider>
            {rollingTimeWindow.isRangeSelected && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Plage affichée :</span>
                <TimeRangeBadge
                  rangeStart={rollingTimeWindow.rangeStart}
                  rangeEnd={rollingTimeWindow.rangeEnd}
                  onReset={rollingTimeWindow.resetRange}
                />
              </div>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="curve">Courbe</TabsTrigger>
                {rollingChartData.length > 0 && <TabsTrigger value="rolling">Évolution</TabsTrigger>}
                {timeSeriesChartData.length > 0 && <TabsTrigger value="signals">Signaux bruts</TabsTrigger>}
                <TabsTrigger value="table">Tableau</TabsTrigger>
              </TabsList>

              <TabsContent value="curve" className="mt-4">
            <AutoregCurveCard result={result} id="pdf-chart-curve" />
              </TabsContent>

            {rollingChartData.length > 0 && (
              <TabsContent value="rolling" className="mt-4">
              <Card id="pdf-chart-rolling" data-pdf-title={`${labels.optimal} et limites dans le temps`}>
                <CardHeader>
                  <CardTitle>{labels.optimal} et limites dans le temps</CardTitle>
                  <CardDescription>
                    Estimation glissante de {labels.pressure}opt, LLA et ULA. {labels.pressure} mesurée superposée.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartZoomControls
                    zoom={rollingZoom}
                    isEditing={rollingEditing}
                    onToggleEditing={() => setRollingEditing((v) => !v)}
                    className="mb-2"
                  />
                  <div
                    className={cn(
                      "rounded-lg transition-colors",
                      rollingEditing && "border-2 border-primary/60 bg-primary/5 p-2",
                    )}
                  >
                  <div className={rollingEditing ? "h-[344px]" : "h-[320px]"}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={rollingEditing ? rollingChartData : rollingTimeWindow.visibleData}
                        margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                      >
                        <defs>
                          <linearGradient id="rollingZoneGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={formatTime}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          domain={rollingZoom.yDomain}
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
                        {/* Bande LLA-ULA : remplit jusqu'à ULA, puis masque le bas avec
                            le fond de la carte jusqu'à LLA — ne laisse colorée que la
                            plage entre les deux (même technique que AutoregulationChart). */}
                        <Area
                          type="monotone"
                          dataKey="ula"
                          stroke="none"
                          fill="url(#rollingZoneGradient)"
                          fillOpacity={1}
                          connectNulls
                          isAnimationActive={false}
                          name="Plage autorégulée (LLA–ULA)"
                        />
                        <Area
                          type="monotone"
                          dataKey="lla"
                          stroke="none"
                          fill="hsl(var(--card))"
                          fillOpacity={1}
                          connectNulls
                          isAnimationActive={false}
                          legendType="none"
                          name="_lla_mask"
                        />
                        <Line type="monotone" isAnimationActive={false} dataKey="ppc" stroke="hsl(var(--muted-foreground))" dot={false} name={`${labels.pressure} mesurée`} />
                        <Line type="monotone" isAnimationActive={false} dataKey="optimalPPC" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={labels.optimal} />
                        <Line type="monotone" isAnimationActive={false} dataKey="lla" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="LLA" />
                        <Line type="monotone" isAnimationActive={false} dataKey="ula" stroke="hsl(var(--destructive))" strokeDasharray="4 3" dot={false} name="ULA" />
                        {rollingEditing && (
                          <Brush
                            dataKey="t"
                            height={24}
                            stroke="hsl(var(--primary))"
                            travellerWidth={BRUSH_TOUCH_WIDTH}
                            traveller={renderWideTouchTraveller}
                            tickFormatter={formatTime}
                            startIndex={rollingTimeWindow.startIndex}
                            endIndex={rollingTimeWindow.endIndex}
                            onChange={rollingTimeWindow.onBrushChange}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  </div>
                </CardContent>
              </Card>
              </TabsContent>
            )}

            {timeSeriesChartData.length > 0 && (
            <TabsContent value="signals" className="mt-4">
            <Card id="pdf-chart-timeseries" data-pdf-title={result.mode === 'cox' ? 'Séries temporelles rSO₂ / PAM' : 'Séries temporelles PIC / PAM / PPC'}>
              <CardHeader>
                <CardTitle>{result.mode === 'cox' ? 'Séries temporelles rSO₂ / PAM' : 'Séries temporelles PIC / PAM / PPC'}</CardTitle>
                <CardDescription>Données brutes après import.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartZoomControls
                  zoom={timeSeriesZoom}
                  isEditing={timeSeriesEditing}
                  onToggleEditing={() => setTimeSeriesEditing((v) => !v)}
                  className="mb-2"
                />
                <div
                  className={cn(
                    "rounded-lg transition-colors",
                    timeSeriesEditing && "border-2 border-primary/60 bg-primary/5 p-2",
                  )}
                >
                <div className={timeSeriesEditing ? "h-[344px]" : "h-[320px]"}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={timeSeriesEditing ? timeSeriesChartData : timeSeriesTimeWindow.visibleData}
                      margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={formatTime}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={timeSeriesZoom.yDomain} tick={{ fontSize: 12 }} />
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
                        <Line type="monotone" isAnimationActive={false} dataKey="nirs" stroke="hsl(var(--destructive))" dot={false} name="rSO₂" />
                      ) : (
                        <>
                          <Line type="monotone" isAnimationActive={false} dataKey="pic" stroke="hsl(var(--destructive))" dot={false} name="PIC" />
                          <Line type="monotone" isAnimationActive={false} dataKey="ppc" stroke="hsl(142 71% 45%)" dot={false} name="PPC" />
                        </>
                      )}
                      <Line type="monotone" isAnimationActive={false} dataKey="pam" stroke="hsl(var(--primary))" dot={false} name="PAM" />
                      {timeSeriesEditing && (
                        <Brush
                          dataKey="t"
                          height={24}
                          stroke="hsl(var(--primary))"
                          travellerWidth={BRUSH_TOUCH_WIDTH}
                          traveller={renderWideTouchTraveller}
                          tickFormatter={formatTime}
                          startIndex={timeSeriesTimeWindow.startIndex}
                          endIndex={timeSeriesTimeWindow.endIndex}
                          onChange={timeSeriesTimeWindow.onBrushChange}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                </div>
              </CardContent>
            </Card>
            </TabsContent>
            )}

            <TabsContent value="table" className="mt-4">
            <Card>
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
            </TabsContent>
            </Tabs>
            </ChartTimeRangeProvider>
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

export default AutoregStudy;
