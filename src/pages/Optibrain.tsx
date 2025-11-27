import { useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { PatientHeader } from "@/components/PatientHeader";
import { TourChecklist } from "@/components/TourChecklist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPatientById } from "@/utils/patientData";
import {
  Info,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { brainMetrics as importedBrainMetrics } from "@/utils/organMetrics";
import { useTimeRange } from "@/hooks/useTimeRange";

const Optibrain = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient") || "#25";
  const metricParam = searchParams.get("metric");
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  const [objectives, setObjectives] = useState<string[]>([
    "Maintain ICP < 20 mmHg",
    "Maintain CPP 50-70 mmHg",
    "Normocapnia (PaCO2 35-45 mmHg)",
    "Head of bed elevated 30°",
  ]);
  const [interventions, setInterventions] = useState<string[]>([
    "Osmotherapy with mannitol administered",
    "Sedation optimized",
    "Continuous ICP monitorage",
  ]);
  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [isEditingInterventions, setIsEditingInterventions] = useState(false);
  const [editedInterventions, setEditedInterventions] = useState<string[]>([]);
  const monitoringTargets = [
    {
      label: "Opioide",
      value: 150,
      unit: "mcg/h",
      target: "100-200 mcg/h",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "Hypnotique",
      value: 220,
      unit: "mg/h",
      target: "150-250 mg/h",
      status: "normal",
      trend: "down",
      change: -10,
    },
    {
      label: "AntiEpileptique",
      value: "Non",
      target: "Aucune",
      status: "normal",
      trend: "stable",
    },
    {
      label: "Propofol 48h",
      value: "10.5",
      unit: "g",
      target: "< 12g",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "Nutrition",
      value: "Entérale",
      target: "Entérale/Parentérale",
      status: "normal",
      trend: "stable",
    },
    {
      label: "PIC",
      value: 26,
      unit: "mmHg",
      target: "< 20 mmHg",
      status: "warning",
      trend: "down",
      change: -3,
    },
    {
      label: "PAM",
      value: 85,
      unit: "mmHg",
      target: "> 65 mmHg",
      status: "normal",
      trend: "up",
      change: 2,
    },
    {
      label: "PVC",
      value: 8,
      unit: "mmHg",
      target: "2-8 mmHg",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "ETCO2",
      value: 38,
      unit: "mmHg",
      target: "35-45 mmHg",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "Pupille droite",
      value: "3mm",
      target: "Réactive",
      status: "normal",
      trend: "stable",
    },
    {
      label: "Pupille gauche",
      value: "3mm",
      target: "Réactive",
      status: "normal",
      trend: "stable",
    },
  ];

  const totalTargets = monitoringTargets.length;
  const normalTargets = monitoringTargets.filter((t) => t.status === "normal").length;
  const monitoringAdherence = Math.round((normalTargets / totalTargets) * 100);
  const targetOutOfRangeCount = monitoringTargets.filter((t) => t.status !== "normal").length;
  if (!patient) {
    return (
      <div className="min-h-screen bg-[#EDF2F9]">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>Patient not found</p>
        </div>
      </div>
    );
  }
  const brainMetrics = importedBrainMetrics;
  const brainOptimisationMetrics = [
    {
      label: "État Neuro",
      value: "Hyperhémie",
      displayValue: "Hyperhémie",
      unit: "",
      status: "warning",
      hasDetails: true,
      dialogKey: "neuro",
      trend: "stable",
    },
    {
      label: "PIC",
      value: "26 mmHg",
      displayValue: "26",
      unit: "mmHg",
      status: "warning",
      hasDetails: true,
      dialogKey: "pic",
      trend: "down",
      change: -3,
    },
    {
      label: "PPC Opt",
      value: "65 mmHg",
      displayValue: "65",
      unit: "mmHg",
      status: "normal",
      hasDetails: true,
      dialogKey: "ppc",
      trend: "up",
      change: 2,
    },
  ];
  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };
  const clinicalIndicators = [
    {
      label: "Tête",
      value: 32,
      unit: "°",
      target: "0-30°",
      status: "warning",
      trend: "stable",
      change: 0,
    },
    {
      label: "PIC",
      value: 27,
      unit: "mmHg",
      target: "< 20mmHg",
      status: "critical",
      trend: "down",
      change: -2,
    },
    {
      label: "PPC",
      value: 73,
      unit: "mmHg",
      target: "60-70 mmHg",
      status: "warning",
      trend: "up",
      change: 4,
    },
    {
      label: "Temp.",
      value: 35.8,
      unit: "°C",
      target: "35-38°C",
      status: "normal",
      trend: "up",
      change: 0.3,
    },
    {
      label: "PaCO2",
      value: 38,
      unit: "mmHg",
      target: "35-45mmHg",
      status: "normal",
      trend: "down",
      change: -1,
    },
    {
      label: "Glycémie",
      value: 5.9,
      unit: "mmol/L",
      target: "5-11 mmol/L",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "Hb",
      value: 8,
      unit: "g/dL",
      target: "> 7g/dl",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "INR",
      value: 1.54,
      unit: "",
      target: "< 1.2",
      status: "critical",
      trend: "up",
      change: 0.12,
    },
    {
      label: "Plaquettes",
      value: 179,
      unit: "g/L",
      target: "> 100 g/L",
      status: "normal",
      trend: "down",
      change: -8,
    },
  ];

  // Calculate clinical adherence
  const totalIndicators = clinicalIndicators.length;
  const normalIndicators = clinicalIndicators.filter((i) => i.status === "normal").length;
  const clinicalAdherence = Math.round((normalIndicators / totalIndicators) * 100);
  const outOfRangeCount = clinicalIndicators.filter((i) => i.status !== "normal").length;

  // Generate mock chart data based on selected time range
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();

    // Determine number of data points and time intervals based on time range
    let dataPoints: number;
    let intervalMinutes: number;

    switch (timeRange) {
      case "now":
        dataPoints = 1;
        intervalMinutes = 0;
        break;
      case "3h":
        dataPoints = 18; // One point every 10 minutes
        intervalMinutes = 10;
        break;
      case "6h":
        dataPoints = 24; // One point every 15 minutes
        intervalMinutes = 15;
        break;
      case "12h":
        dataPoints = 24; // One point every 30 minutes
        intervalMinutes = 30;
        break;
      case "24h":
        dataPoints = 24; // One point every hour
        intervalMinutes = 60;
        break;
      case "stay":
        dataPoints = 48; // One point every 2 hours for a typical ICU stay
        intervalMinutes = 120;
        break;
      default:
        dataPoints = 24;
        intervalMinutes = 60;
        break;
    }

    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      const timeStr =
        timeRange === "now"
          ? "Now"
          : `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

      const dataPoint: any = {
        time: timeStr,
      };

      clinicalIndicators.forEach((indicator) => {
        const baseValue = indicator.value;
        // Add some random variation to make it look realistic
        const variation = (Math.random() - 0.5) * (baseValue * 0.2);
        dataPoint[indicator.label] = Math.round((baseValue + variation) * 100) / 100;
      });

      data.push(dataPoint);
    }

    return data;
  }, [timeRange]);

  // Color mapping for chart lines based on status
  const getIndicatorColor = (label: string) => {
    const indicator = clinicalIndicators.find((i) => i.label === label);
    if (!indicator) return "#9ca3af";
    return indicator.status === "critical" ? "#ef4444" : indicator.status === "warning" ? "#fb923c" : "#9ca3af";
  };
  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optibrain" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <TourChecklist compact patientId={patientId} />
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Métriques Cérébrales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {brainMetrics.map((metric, index) => {
                const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                const valueColor = inRange ? "text-gray-600" : "text-red-500";
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">{metric.label}</div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`text-4xl font-bold ${valueColor}`}>{metric.value}</div>
                    </div>

                    <div className="w-full max-w-[180px]">
                      <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
                        <div
                          className="absolute top-0 bottom-0 bg-gray-300 rounded-full"
                          style={{
                            left: `${((metric.targetMin - metric.min) / (metric.max - metric.min)) * 100}%`,
                            width: `${((metric.targetMax - metric.targetMin) / (metric.max - metric.min)) * 100}%`,
                          }}
                        ></div>
                        <div
                          className={`absolute w-3 h-3 rounded-full border-2 ${inRange ? "bg-gray-500 border-gray-600" : "bg-red-500 border-red-600"} z-10 top-0`}
                          style={{
                            left: `${Math.max(0, Math.min(100, ((metric.value - metric.min) / (metric.max - metric.min)) * 100))}%`,
                            transform: "translateX(-50%)",
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                        <span>{metric.targetMin}</span>
                        <span>{metric.targetMax}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Optimisation Cérébrale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-8">
              {brainOptimisationMetrics.map((metric, index) => {
                const statusColor = metric.status === "warning" ? "text-orange-500" : "text-gray-600";
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                    onClick={() => metric.hasDetails && setOpenDialog(metric.dialogKey || null)}
                  >
                    <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">{metric.label}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`text-4xl font-bold ${statusColor}`}>{metric.displayValue}</div>
                    </div>
                    {metric.hasDetails && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <Info className="h-3 w-3" />
                        <span>Voir détails</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Neurological State Dialog */}
        <Dialog open={openDialog === "neuro"} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>État Neurologique</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* État Neurologique Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                {/* Individual Bars */}
                <div className="space-y-6">
                  {/* Hyperhémie */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Hyperhémie</span>
                      <span className="text-xl font-semibold text-red-500">40%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-red-400 h-3 rounded-full" style={{ width: "40%" }}></div>
                    </div>
                  </div>

                  {/* HTIC / Hyp. */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">HTIC / Hyp.</span>
                      <span className="text-xl font-semibold text-orange-500">30%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-400 h-3 rounded-full" style={{ width: "30%" }}></div>
                    </div>
                  </div>

                  {/* Ischémie */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Ischémie</span>
                      <span className="text-xl font-semibold text-orange-500">10%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-400 h-3 rounded-full" style={{ width: "10%" }}></div>
                    </div>
                  </div>

                  {/* Contrôlé */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Contrôlé</span>
                      <span className="text-xl font-semibold text-gray-500">20%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gray-400 h-3 rounded-full" style={{ width: "20%" }}></div>
                    </div>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="border-t mt-6 pt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div>
                      État : <span className="font-semibold text-red-500">Hyperhémie</span> <span className="text-gray-500">depuis 3am</span>
                    </div>
                    <div>
                      PPC actuel : <span className="font-semibold">65 mmHg</span>
                      <span className="mx-2">|</span>
                      PPC moyen : <span className="font-semibold">68 mmHg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PIC Dialog */}
        <Dialog open={openDialog === "pic"} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>PIC (Pression Intracrânienne)</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* PIC Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-700">
                    <span className="text-orange-500">Répartition du temps</span> par niveau de PIC
                  </h3>
                </div>

                {/* Individual Bars */}
                <div className="space-y-6">
                  {/* 25 - 30 mmHg */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">25 - 30 mmHg</span>
                      <span className="text-xl font-semibold text-orange-500">128 min</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-400 h-3 rounded-full" style={{ width: "71%" }}></div>
                    </div>
                  </div>

                  {/* 20 - 25 mmHg */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">20 - 25 mmHg</span>
                      <span className="text-xl font-semibold text-orange-500">30 min</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-orange-400 h-3 rounded-full" style={{ width: "17%" }}></div>
                    </div>
                  </div>

                  {/* > 30 mmHg */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">&gt; 30 mmHg</span>
                      <span className="text-xl font-semibold text-red-500">2 min</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-red-400 h-3 rounded-full" style={{ width: "1%" }}></div>
                    </div>
                  </div>

                  {/* < 20 mmHg */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">&lt; 20 mmHg</span>
                      <span className="text-xl font-semibold text-gray-500">20 min</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gray-400 h-3 rounded-full" style={{ width: "11%" }}></div>
                    </div>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="border-t mt-6 pt-4">
                  <div className="text-sm text-gray-600">
                    Intensité actuelle : <span className="font-semibold">26 mmHg</span>
                    <span className="mx-2">|</span>
                    Intensité moyenne : <span className="font-semibold">28 mmHg</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PPC Optimal Dialog */}
        <Dialog open={openDialog === "ppc"} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>PPC Optimale - Étude sur 6 heures</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(() => {
                      const data = [];
                      const now = new Date();
                      for (let i = 0; i <= 72; i++) {
                        const time = new Date(now.getTime() - (72 - i) * 5 * 60000);
                        const hours = time.getHours().toString().padStart(2, "0");
                        const minutes = time.getMinutes().toString().padStart(2, "0");

                        // Generate realistic PPC values with some variation
                        const baseValue = 60;
                        const variation = Math.sin(i / 10) * 8 + Math.random() * 6 - 3;
                        const ppcValue = Math.max(48, Math.min(72, baseValue + variation));

                        data.push({
                          time: `${hours}:${minutes}`,
                          ppc: Math.round(ppcValue * 10) / 10,
                          target: 60,
                          upperBound: 70,
                          lowerBound: 50,
                          current: i === 72 ? 65 : null,
                        });
                      }
                      return data;
                    })()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="time" stroke="#666" interval={11} tick={{ fontSize: 12 }} />
                    <YAxis
                      domain={[45, 75]}
                      stroke="#666"
                      label={{ value: "PPC (mmHg)", angle: -90, position: "insideLeft" }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                      }}
                    />
                    {/* Target PPC */}
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#444"
                      strokeWidth={2}
                      dot={false}
                      name="PPC visée (60 mmHg)"
                    />

                    {/* Actual PPC values */}
                    <Line
                      type="monotone"
                      dataKey="ppc"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      dot={false}
                      name="PPC actuelle"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm text-gray-600">
                  PPC actuelle : <span className="font-semibold">65 mmHg</span>
                  <span className="mx-2">|</span>
                  PPC visée : <span className="font-semibold">60 mmHg</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Adhérence & Monitorage</CardTitle>
              <div className="flex gap-2">
                {timeRanges.map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      timeRange === range ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {getTimeRangeLabel(range)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Clinical Indicators Adherence */}
            <Card className="border-2 border-gray-200">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setClinicalExpanded(!clinicalExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${clinicalAdherence >= 90 ? "border-gray-400 text-gray-600 bg-gray-50" : clinicalAdherence >= 80 ? "border-orange-400 text-orange-600 bg-orange-50" : "border-red-400 text-red-600 bg-red-50"}`}
                    >
                      {clinicalAdherence}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Adhérence aux cibles recommandées</h3>
                      <p className="text-xs text-gray-500 mt-1">{outOfRangeCount} Indicateurs à surveiller</p>
                    </div>
                  </div>
                  {clinicalExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const statusColor =
                        indicator.status === "critical"
                          ? "bg-red-500"
                          : indicator.status === "warning"
                            ? "bg-orange-400"
                            : "bg-gray-400";
                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all ${isSelected ? "bg-blue-50 border-2 border-blue-400" : "hover:bg-gray-50"}`}
                          onClick={() => {
                            setSelectedIndicators((prev) =>
                              prev.includes(indicator.label)
                                ? prev.filter((label) => label !== indicator.label)
                                : [...prev, indicator.label],
                            );
                          }}
                        >
                          <div
                            className={`w-3 h-3 rounded-full mt-1 ${statusColor} ${isSelected ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}
                          ></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-gray-700">
                                {indicator.label} : {indicator.value}
                                {indicator.unit}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Cliquez sur un indicateur pour l'afficher dans le graphique
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Targets */}
            <Card className="border-2 border-gray-200">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setChecklistExpanded(!checklistExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                        monitoringAdherence >= 90
                          ? "border-gray-400 text-gray-600 bg-gray-50"
                          : monitoringAdherence >= 80
                            ? "border-orange-400 text-orange-600 bg-orange-50"
                            : "border-red-400 text-red-600 bg-red-50"
                      }`}
                    >
                      {monitoringAdherence}%
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Monitorage et interventions en place</h3>
                      <p className="text-xs text-gray-500 mt-1">{targetOutOfRangeCount} cibles à surveiller</p>
                    </div>
                  </div>
                  {checklistExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              {checklistExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      const statusColor =
                        target.status === "critical"
                          ? "bg-red-500"
                          : target.status === "warning"
                            ? "bg-orange-400"
                            : "bg-gray-400";
                      return (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <div className={`w-3 h-3 rounded-full mt-1 ${statusColor}`}></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-gray-700">
                                {target.label} : {target.value}
                                {target.unit || ""}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500">{target.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">
                  {timeRange === "now"
                    ? "Monitoring (Maintenant)"
                    : timeRange === "stay"
                      ? "Monitoring (Séjour complet)"
                      : `Monitoring (${timeRange.toUpperCase()})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] border-2 border-gray-200 rounded-lg p-4">
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-400">
                        Sélectionnez des indicateurs ci-dessous pour afficher leurs tendances
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedIndicators.map((label) => {
                          const indicator = clinicalIndicators.find((i) => i.label === label);
                          if (!indicator) return null;
                          const statusColor =
                            indicator.status === "critical"
                              ? "bg-red-500"
                              : indicator.status === "warning"
                                ? "bg-orange-400"
                                : "bg-gray-400";
                          return (
                            <div
                              key={label}
                              className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200"
                            >
                              <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
                              <span className="text-xs text-gray-700">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="time"
                              tick={{
                                fontSize: 12,
                              }}
                              stroke="#9ca3af"
                            />
                            <YAxis
                              tick={{
                                fontSize: 12,
                              }}
                              stroke="#9ca3af"
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            />
                            <Legend
                              wrapperStyle={{
                                fontSize: "12px",
                              }}
                            />
                            {selectedIndicators.map((label) => (
                              <Line
                                key={label}
                                type="monotone"
                                dataKey={label}
                                stroke={getIndicatorColor(label)}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{
                                  r: 4,
                                }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
export default Optibrain;
