import { useMemo, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { StudyNav } from '@/components/study/StudyNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  parseAny,
  runAnalysis,
  rollingOptimal,
  resultsToCSV,
  type AutoregResult,
  type OptimalTimePoint,
} from '@/services/autoregComputation.service';
import { useStudyPatients } from '@/hooks/useStudyPatients';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AutoregStudy = () => {
  const patientsController = useStudyPatients();
  const { patients, active, addPatient, updatePatient } = patientsController;

  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<AutoregResult | null>(null);
  const [rolling, setRolling] = useState<OptimalTimePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 25 Mo).');
      const text = await file.text();
      const samples = parseAny(text);
      if (samples.length < 30) {
        throw new Error(
          "Fichier invalide ou insuffisant : au moins 30 échantillons avec Horodate, PIC, PAM sont requis.",
        );
      }
      const analysis = runAnalysis(samples, 30, 5);
      const derived = analysis.samples;
      const rolled = rollingOptimal(derived, Math.min(240, Math.floor(derived.length / 3)), 30, 5);
      setResult(analysis);
      setRolling(rolled);
      setFileName(file.name);
      if (active) updatePatient(active.id, { fileName: file.name });
      // Persist results in Supabase (linked to study patient id)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && active) {
          const { error: insertError } = await supabase
            .from('autoreg_study_results')
            .insert({
              user_id: user.id,
              study_patient_id: active.id,
              study_patient_code: active.code,
              study_patient_label: active.label,
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
        } else if (!user) {
          toast.info("Connectez-vous pour conserver les résultats dans la base.");
        }
      } catch (persistErr: any) {
        console.error('Persist autoreg result error:', persistErr);
        toast.error("Impossible d'enregistrer les résultats : " + (persistErr.message || 'erreur inconnue'));
      }
    } catch (e: any) {
      setError(e.message || 'Erreur lors du traitement du fichier.');
      setResult(null);
      setRolling([]);
    } finally {
      setParsing(false);
    }
  };

  const timeSeriesChartData = useMemo(() => {
    if (!result) return [];
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
    const blob = new Blob([resultsToCSV(result)], { type: 'text/csv;charset=utf-8;' });
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
        <div className="container mx-auto max-w-6xl px-4 pb-6">
          <section id="methodology" className="grid md:grid-cols-3 gap-4">
            <StepCard
              n={1}
              title="Créer un sujet"
              desc="Ajoutez un pseudonyme via le bouton Sujet dans la barre du haut."
            />
            <StepCard
              n={2}
              title="Importer les données"
              desc="CSV (Horodate, PIC, PAM, PPC) ou JSON Fisher. Détection automatique."
            />
            <StepCard
              n={3}
              title="Analyser et exporter"
              desc="Visualisations interactives et export CSV des résultats calculés."
            />
          </section>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 max-w-6xl">

        {/* Import panel */}
        <Card className="mb-6">
          <CardHeader>
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
              Formats acceptés : CSV (colonnes <code>Horodate, PIC, PAM, PPC</code>) ou JSON Fisher.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!active && patients.length === 0 && (
              <Alert className="mb-4">
                <UserPlus className="h-4 w-4" />
                <AlertTitle>Aucun sujet</AlertTitle>
                <AlertDescription>
                  Créez d'abord un sujet via le bouton <strong>Sujet</strong> en haut à droite, ou cliquez
                  ci-dessous pour en créer un automatiquement puis importer un fichier.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = '';
                }}
              />
              <Button onClick={() => addPatient('')} disabled={parsing}>
                <UserPlus className="mr-2 h-4 w-4" />
                Ajouter un patient
              </Button>
              {active && (
                <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
                  <LineChart className="mr-2 h-4 w-4" />
                  {parsing ? 'Analyse…' : 'Lancer les calculs'}
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

            <Card className="mb-6">
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
