import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  FileUp,
  ChevronDown,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTemporaryPatients } from "@/hooks/useTemporaryPatients";
import {
  extractTimeSeriesData,
  getLatestValue,
  type PatientFileData,
} from "@/services/patientFileData.service";
import { Header } from "@/components/Header";
import { PatientHeader } from "@/components/PatientHeader";
import { VitalSignsPanel } from "@/components/VitalSignsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MetricRangeBar } from "@/components/MetricRangeBar";
import { KpiCircle } from "@/components/KpiCircle";

const SERIES = [
  { key: "Variable_PIC", label: "PIC", unit: "mmHg", color: "hsl(var(--chart-1))" },
  { key: "Variable_PPC", label: "PPC", unit: "mmHg", color: "hsl(var(--chart-2))" },
  { key: "Variable_PAM", label: "PAM", unit: "mmHg", color: "hsl(var(--chart-3))" },
  { key: "Variable_rSO2", label: "NIRS (rSO₂)", unit: "%", color: "hsl(var(--chart-4))" },
  { key: "Variable_FC", label: "Fréquence cardiaque", unit: "bpm", color: "hsl(var(--chart-5))" },
  { key: "Variable_SPO2", label: "SpO₂", unit: "%", color: "hsl(var(--primary))" },
  { key: "Variable_PVC", label: "PVC", unit: "mmHg", color: "hsl(var(--muted-foreground))" },
  { key: "Variable_temperature", label: "Température", unit: "°C", color: "hsl(var(--destructive))" },
  { key: "Variable_EtCO2", label: "EtCO₂", unit: "mmHg", color: "hsl(var(--chart-1))" },
  { key: "Variable_plaquettes", label: "Plaquettes", unit: "×10⁹/L", color: "hsl(var(--chart-2))" },
  { key: "Variable_hemoglobine", label: "Hémoglobine", unit: "g/L", color: "hsl(var(--chart-3))" },
  { key: "Variable_glycemie", label: "Glycémie", unit: "mmol/L", color: "hsl(var(--chart-4))" },
  { key: "Variable_INR", label: "INR", unit: "", color: "hsl(var(--chart-5))" },
  { key: "Variable_paco2", label: "PaCO₂", unit: "mmHg", color: "hsl(var(--primary))" },
  { key: "Variable_position_tete", label: "Position de la tête", unit: "", color: "hsl(var(--muted-foreground))" },
  { key: "Variable_pupille_droite", label: "Pupille droite", unit: "mm", color: "hsl(var(--destructive))" },
  { key: "Variable_pupille_gauche", label: "Pupille gauche", unit: "mm", color: "hsl(var(--chart-1))" },
] as const;

const MEDICATIONS = [
  { key: "Variable_anti_epileptique", label: "Antiépileptiques" },
  { key: "Variable_opioides", label: "Opioïdes" },
  { key: "Variable_hypnotiques", label: "Hypnotiques" },
] as const;

const INDICATORS = [
  { key: "Variable_PIC", label: "PIC", unit: "mmHg", min: 0, max: 60, targetMin: 7, targetMax: 15 },
  { key: "Variable_PPC", label: "PPC", unit: "mmHg", min: 0, max: 120, targetMin: 50, targetMax: 70 },
  { key: "Variable_PAM", label: "PAM", unit: "mmHg", min: 30, max: 120, targetMin: 65, targetMax: 85 },
  { key: "Variable_rSO2", label: "NIRS (rSO₂)", unit: "%", min: 40, max: 100, targetMin: 55, targetMax: 75 },
  { key: "Variable_paco2", label: "PaCO₂", unit: "mmHg", min: 15, max: 120, targetMin: 35, targetMax: 45 },
] as const;

function isOutOfTarget(value: number, min: number, max: number) {
  return value < min || value > max;
}

function indicatorSeries(data: PatientFileData, key: string) {
  return extractTimeSeriesData(data, key)
    .map((point) => ({
      timestamp: new Date(point.charttime).getTime(),
      value: point.valeur,
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TemporaryPatient = () => {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") === "optistate" ? "optistate" : "optibrain";
  const [expanded, setExpanded] = useState(true);
  const [selectedIndicator, setSelectedIndicator] = useState<string | null>(null);
  const patient = useTemporaryPatients().find((item) => item.id === patientId);

  if (!patient) {
    return (
      <main className="container mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-xl font-semibold">Import temporaire introuvable</h1>
        <p className="text-muted-foreground">
          Les imports temporaires ne survivent pas au rechargement ou à la fermeture de l'onglet.
        </p>
        <Button onClick={() => navigate("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au tableau de bord
        </Button>
      </main>
    );
  }

  const series = SERIES.flatMap((item) => {
    const values = indicatorSeries(patient.data, item.key);
    if (values.length === 0) return [];
    return [{ ...item, values }];
  });
  const measuredIndicators = INDICATORS.flatMap((indicator) => {
    const latest = getLatestValue(patient.data, indicator.key);
    return latest
      ? [{ ...indicator, value: latest.value, timestamp: latest.timestamp }]
      : [];
  });
  const abnormalIndicators = measuredIndicators.filter((indicator) =>
    isOutOfTarget(indicator.value, indicator.targetMin, indicator.targetMax),
  );
  const activeIndicator = INDICATORS.find((indicator) => indicator.key === selectedIndicator);
  const activeSeries = activeIndicator ? indicatorSeries(patient.data, activeIndicator.key) : [];
  const medications = MEDICATIONS.flatMap((item) => {
    const rows = patient.data[item.key];
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      if (!isRecord(row) || typeof row.drugname !== "string") return [];
      return [{
        category: item.label,
        name: row.drugname,
        charttime: typeof row.charttime === "string" ? row.charttime : "",
        dose: typeof row.valeur === "string" ? row.valeur : "",
      }];
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage={section} patientIdOverride={patient.id} />
      <main className="container mx-auto max-w-[1600px] space-y-6 px-4 pb-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tableau de bord
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/import">
                <FileUp className="mr-2 h-4 w-4" />
                Importer d'autres fichiers
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Temporaire · {patient.fileName} · importé le {format(new Date(patient.importedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
          </p>
        </div>

        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-2 pt-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p>
              {patient.deidentified && !patient.synthetic
                ? "Données réelles dé-identifiées, temporaires et en lecture seule. Pas de sauvegarde ni de synchronisation OptiBrain; ne pas utiliser pour des décisions cliniques."
                : "Données synthétiques, temporaires et en lecture seule. Pas de sauvegarde ni de synchronisation OptiBrain; ne pas utiliser pour des décisions cliniques."}
            </p>
          </CardContent>
        </Card>

        <VitalSignsPanel patientFileData={patient.data} defaultOpen={section === "optistate"} />

        <Card className="bg-card shadow-sm">
          <button type="button" className="w-full" onClick={() => setExpanded((value) => !value)}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <KpiCircle count={abnormalIndicators.length} groupLabel="Indicateurs cérébraux" />
                <div className="min-w-0 text-left">
                  <h2 className="text-base font-semibold">Indicateurs cérébraux</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {abnormalIndicators.length
                      ? `${abnormalIndicators.length} indicateur(s) hors des cibles illustratives`
                      : "Valeurs synthétiques; les badges ouvrent l'historique."}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
          {expanded && (
            <CardContent className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {INDICATORS.map((indicator) => {
                const latest = measuredIndicators.find((entry) => entry.key === indicator.key);
                const outOfTarget = latest
                  ? isOutOfTarget(latest.value, indicator.targetMin, indicator.targetMax)
                  : false;
                const values = series.find((item) => item.key === indicator.key)?.values ?? [];
                return (
                  <div key={indicator.key} className="flex flex-col items-center gap-2 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedIndicator(indicator.key)}
                      aria-label={`Afficher l'historique de ${indicator.label}`}
                      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Badge variant={outOfTarget ? "destructive" : "outline"} className="cursor-pointer">
                        {indicator.label}
                        {latest ? ` · ${latest.value.toFixed(1)} ${indicator.unit}` : " · non mesuré"}
                      </Badge>
                    </button>
                    {latest ? (
                      <>
                        <MetricRangeBar
                          value={latest.value}
                          min={indicator.min}
                          max={indicator.max}
                          targetMin={indicator.targetMin}
                          targetMax={indicator.targetMax}
                          maxWidth="220px"
                        />
                        <span className="text-xs text-muted-foreground">
                          Cible illustrative : {indicator.targetMin}–{indicator.targetMax} {indicator.unit}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucune observation importée</span>
                    )}
                    {values.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedIndicator(indicator.key)}>
                        Voir l'historique
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        <section className="space-y-3" aria-labelledby="temporary-series-title">
          <h2 id="temporary-series-title" className="text-xl font-semibold">
            {section === "optistate" ? "Données cliniques importées" : "Signaux de monitorage"}
          </h2>
        {series.length === 0 ? (
          <p className="rounded-md border p-4 text-sm text-muted-foreground">
            Aucun canal de mesure reconnu n'est disponible pour l'affichage.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {series.map((item) => (
              <Card key={item.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.label} · {item.unit}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full" aria-label={`Graphique ${item.label}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={item.values} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="timestamp"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(value: number) => format(new Date(value), "HH:mm", { locale: fr })}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          width={52}
                          unit={item.unit === "%" ? "%" : ""}
                          tick={{ fontSize: 10 }}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          labelFormatter={(value) => format(new Date(Number(value)), "dd/MM HH:mm:ss", { locale: fr })}
                          formatter={(value) => [`${Number(value).toFixed(1)} ${item.unit}`, item.label]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={item.color}
                          dot={false}
                          isAnimationActive={false}
                          name={item.label}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </section>

      {medications.length > 0 && (
        <section className="space-y-3" aria-labelledby="temporary-medications-title">
          <h2 id="temporary-medications-title" className="text-xl font-semibold">
            Médications importées
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {medications.map((medication, index) => (
              <Card key={`${medication.category}-${medication.charttime}-${index}`}>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">{medication.category}</p>
                  <p className="font-medium">{medication.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {medication.dose && `${medication.dose} · `}
                    {medication.charttime
                      ? format(new Date(medication.charttime), "dd/MM/yyyy HH:mm", { locale: fr })
                      : "Horodatage indisponible"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      </main>

      <Dialog open={selectedIndicator !== null} onOpenChange={(open) => !open && setSelectedIndicator(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeIndicator?.label ?? "Indicateur"} — historique temporaire
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Données synthétiques de {patient.scenario}; aucun résultat clinique ou OptiBrain n'est calculé ici.
          </p>
          {activeSeries.length > 0 && (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(value: number) => format(new Date(value), "HH:mm", { locale: fr })}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis width={56} domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(Number(value)), "dd/MM HH:mm:ss", { locale: fr })}
                    formatter={(value) => [`${Number(value).toFixed(1)} ${activeIndicator?.unit ?? ""}`, activeIndicator?.label ?? ""]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemporaryPatient;
