import { useMemo, useRef, useState } from 'react';
import { StudyHeader } from '@/components/study/StudyHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Download, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Scatter,
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

const AutoregStudy = () => {
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
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('Fichier trop volumineux (max 25 Mo).');
      }
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
    // Downsample if huge
    const step = Math.max(1, Math.floor(result.samples.length / 800));
    return result.samples
      .filter((_, i) => i % step === 0)
      .map((s) => ({
        t: s.time.getTime(),
        pic: s.pic,
        pam: s.pam,
        ppc: s.ppc,
      }));
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
    a.download = `autoreg_resultats_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (t: number) => {
    const d = new Date(t);
    return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background">
      <StudyHeader />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero */}
        <section className="mb-8 text-center">
          <Badge variant="outline" className="mb-3">
            Étude clinique · Usage recherche uniquement
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Validation de l'autorégulation cérébrale
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Importez vos données de monitorage (PIC, PAM, PPC) pour calculer l'indice PRx,
            visualiser la courbe d'autorégulation et estimer la PPC optimale, la LLA et l'ULA.
          </p>
        </section>

        {/* Import */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import des données
            </CardTitle>
            <CardDescription>
              Formats acceptés&nbsp;: CSV (colonnes <code>Horodate, PIC, PAM, PPC</code>) ou JSON
              Fisher. Détection automatique du format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={parsing}>
                <FileText className="mr-2 h-4 w-4" />
                {parsing ? 'Analyse…' : 'Sélectionner un fichier'}
              </Button>
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
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucune donnée. Importez un fichier pour lancer l'analyse.</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            {/* Summary */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Résultats de l'analyse
                    </CardTitle>
                    <CardDescription>
                      {result.sampleCount} échantillons · {result.durationHours} h ·
                      PRx = corrélation glissante PIC/PAM (fenêtre 30 échantillons)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Exporter CSV
                  </Button>
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

            {/* U-curve */}
            <Card className="mb-6">
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
                        formatter={(v: any, name: string) => [v, name]}
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

            {/* Rolling optimal PPC */}
            {rollingChartData.length > 0 && (
              <Card className="mb-6">
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

            {/* Time series PIC/PAM/PPC */}
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

            {/* Curve table */}
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
          Cet outil est fourni à des fins de recherche clinique. Il ne remplace pas
          l'évaluation médicale et n'est pas un dispositif médical homologué.
        </p>
      </main>
    </div>
  );
};

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
  <div
    className={`rounded-lg border p-4 ${
      highlight ? 'bg-primary/5 border-primary/30' : 'bg-card'
    }`}
  >
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
