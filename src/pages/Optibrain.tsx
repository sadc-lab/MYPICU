import { useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/Header";
import { PatientHeader } from "@/components/PatientHeader";
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
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { brainMetrics as importedBrainMetrics } from "@/utils/organMetrics";
import { useTimeRange } from "@/hooks/useTimeRange";
import { getStatusHexColor } from "@/utils/colorUtils";
import brainIcon from "@/assets/brain-icon.svg";
import {
  loadPatientFileData,
  hasPatientFileData,
  getTimeSeriesForRange,
  getLatestValue,
  calculateAverage,
  calculateTimeInRanges,
  getAvailableVariables,
  getMonitoringInterventionsStatus,
  PatientFileData,
  TimeSeriesDataPoint,
} from "@/services/patientFileData.service";

const Optibrain = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient") || "#25";
  const metricParam = searchParams.get("metric");
  const patient = getPatientById(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
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

  // Patient file data state
  const [patientFileData, setPatientFileData] = useState<PatientFileData | null>(null);
  const [fileDataLoading, setFileDataLoading] = useState(false);
  const hasFileData = hasPatientFileData(patientId);

  // Load patient file data
  useEffect(() => {
    if (hasFileData) {
      setFileDataLoading(true);
      loadPatientFileData(patientId)
        .then((data) => setPatientFileData(data))
        .finally(() => setFileDataLoading(false));
    } else {
      setPatientFileData(null);
    }
  }, [patientId, hasFileData]);

  // Get real monitoring interventions status from JSON data (binary: adherent or not)
  const monitoringTargets = useMemo(() => {
    const defaultLabels = ["Opioide", "Hypnotique", "Propofol 48h", "PIC", "PAM", "PVC", "ETCO2", "Température"];

    if (!patientFileData) {
      return defaultLabels.map((label) => ({ label, isAdherent: true }));
    }

    // Get real status from JSON validity data - binary adherent/non-adherent
    const realStatus = getMonitoringInterventionsStatus(patientFileData);

    return defaultLabels.map((label) => {
      const realData = realStatus.find((s) => s.label === label);
      // Adherent if percentage is 100% (or status is normal)
      const isAdherent = realData ? realData.adherencePercentage >= 80 : true;
      return { label, isAdherent };
    });
  }, [patientFileData]);

  const totalTargets = monitoringTargets.length;
  const adherentCount = monitoringTargets.filter((t) => t.isAdherent).length;
  const monitoringAdherence = Math.round((adherentCount / totalTargets) * 100);
  const nonAdherentCount = monitoringTargets.filter((t) => !t.isAdherent).length;
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
      value: "",
      unit: "",
      target: "0-30°",
      status: "warning",
      trend: "stable",
      change: 0,
    },
    {
      label: "PIC",
      value: "",
      unit: "",
      target: "< 20mmHg",
      status: "critical",
      trend: "down",
      change: -2,
    },
    {
      label: "PPC",
      value: "",
      unit: "",
      target: "60-70 mmHg",
      status: "warning",
      trend: "up",
      change: 4,
    },
    {
      label: "Temp.",
      value: "",
      unit: "",
      target: "35-38°C",
      status: "normal",
      trend: "up",
      change: 0.3,
    },
    {
      label: "PaCO2",
      value: "",
      unit: "",
      target: "35-45mmHg",
      status: "normal",
      trend: "down",
      change: -1,
    },
    {
      label: "Glycémie",
      value: "",
      unit: "",
      target: "6-11 mmol/L",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "Hb",
      value: "",
      unit: "",
      target: "> 7g/dl",
      status: "normal",
      trend: "stable",
      change: 0,
    },
    {
      label: "INR",
      value: "",
      unit: "",
      target: "< 1.2",
      status: "critical",
      trend: "up",
      change: 0.12,
    },
    {
      label: "Plaquettes",
      value: "",
      unit: "",
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

  // Map time range to hours
  const getHoursFromTimeRange = (range: string): number => {
    switch (range) {
      case "3h":
        return 3;
      case "6h":
        return 6;
      case "12h":
        return 12;
      case "24h":
        return 24;
      case "stay":
        return 96; // ~4 days
      default:
        return 24;
    }
  };

  // Real data time series for charts (when patient file data is available)
  const realTimeSeriesData = useMemo(() => {
    if (!patientFileData) return null;

    const hoursBack = getHoursFromTimeRange(timeRange);
    const availableVars = getAvailableVariables(patientFileData);

    // Map variable names to our indicator labels
    const varMapping: Record<string, string> = {
      Variable_FC: "FC",
      Variable_PIC: "PIC",
      Variable_PPC: "PPC",
      Variable_PAM: "PAM",
      Variable_PVC: "PVC",
      Variable_Temperature: "Temp.",
      Variable_ETCO2: "ETCO2",
      Variable_Hemoglobin: "hb",
    };

    const result: Record<string, TimeSeriesDataPoint[]> = {};

    Object.entries(varMapping).forEach(([varKey, label]) => {
      if (availableVars.includes(varKey)) {
        result[label] = getTimeSeriesForRange(patientFileData, varKey, hoursBack, 15);
      }
    });

    return result;
  }, [patientFileData, timeRange]);

  // Chart data - use real data when available, otherwise use mock
  const chartData = useMemo(() => {
    // If we have real data, use it
    if (realTimeSeriesData && Object.keys(realTimeSeriesData).length > 0) {
      // Find the variable with the most data points to use as base timeline
      const baseVar = Object.entries(realTimeSeriesData).sort((a, b) => b[1].length - a[1].length)[0];

      if (baseVar && baseVar[1].length > 0) {
        return baseVar[1].map((point, idx) => {
          const time = new Date(point.charttime);
          const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

          const dataPoint: any = {
            time: timeStr,
            timestamp: time.getTime(),
          };

          // Add all available variables
          Object.entries(realTimeSeriesData).forEach(([label, data]) => {
            // Find closest data point by time
            const closest = data.find((d, i) => i === idx) || data[data.length - 1];
            if (closest) {
              dataPoint[label] = closest.valeur;
            }
          });

          // Add mock data for indicators without real data
          clinicalIndicators.forEach((indicator) => {
            if (!(indicator.label in dataPoint)) {
              const baseValue = typeof indicator.value === "number" ? indicator.value : 0;
              const seed = time.getTime() / 1000 + indicator.label.charCodeAt(0);
              const x = Math.sin(seed) * 10000;
              const variation = (x - Math.floor(x) - 0.5) * (baseValue * 0.2);
              dataPoint[indicator.label] = Math.round((baseValue + variation) * 100) / 100;
            }
          });

          return dataPoint;
        });
      }
    }

    // Fallback to mock data generation
    const data = [];
    const now = new Date();

    // Determine number of data points and time intervals based on time range
    let dataPoints: number;
    let intervalMinutes: number;

    switch (timeRange) {
      case "3h":
        dataPoints = 12;
        intervalMinutes = 15;
        break;
      case "6h":
        dataPoints = 24;
        intervalMinutes = 15;
        break;
      case "12h":
        dataPoints = 48;
        intervalMinutes = 15;
        break;
      case "24h":
        dataPoints = 96;
        intervalMinutes = 15;
        break;
      case "stay":
        dataPoints = 192;
        intervalMinutes = 15;
        break;
      default:
        dataPoints = 96;
        intervalMinutes = 15;
        break;
    }

    const getSeededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
      time.setMinutes(Math.floor(time.getMinutes() / 15) * 15);
      time.setSeconds(0);
      time.setMilliseconds(0);

      const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

      const dataPoint: any = {
        time: timeStr,
        timestamp: time.getTime(),
      };

      clinicalIndicators.forEach((indicator) => {
        const baseValue = typeof indicator.value === "number" ? indicator.value : 0;
        const seed = time.getTime() / 1000 + indicator.label.charCodeAt(0);
        const variation = (getSeededRandom(seed) - 0.5) * (baseValue * 0.2);
        dataPoint[indicator.label] = Math.round((baseValue + variation) * 100) / 100;
      });

      data.push(dataPoint);
    }

    const uniqueData = data.filter(
      (item, index, self) => index === self.findIndex((t) => t.timestamp === item.timestamp),
    );

    return uniqueData;
  }, [timeRange, realTimeSeriesData, clinicalIndicators]);

  // Color mapping for chart lines based on status
  const getIndicatorColor = (label: string) => {
    const indicator = clinicalIndicators.find((i) => i.label === label);
    if (!indicator) return "#9ca3af";
    return getStatusHexColor(indicator.status);
  };
  return (
    <div className="min-h-screen bg-[#EDF2F9]">
      <Header />
      <PatientHeader currentPage="optibrain" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px]">
        <Card className="bg-white shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Métriques cérébrales</CardTitle>
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
          <CardHeader
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setOptimisationExpanded(!optimisationExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 border-blue-400 text-blue-600 bg-blue-50">
                  <img
                    src={brainIcon}
                    alt="brain"
                    className="h-8 w-8"
                    style={{
                      filter: "invert(39%) sepia(95%) saturate(1095%) hue-rotate(196deg) brightness(97%) contrast(94%)",
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Optimisation cérébrale actuelle</h3>
                  <p className="text-xs text-gray-500 mt-1">Hyperhémie, PIC 26 et PPC optimale 65</p>
                </div>
              </div>
              {optimisationExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </CardHeader>
          {optimisationExpanded && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-8 pt-4">
                {brainOptimisationMetrics.map((metric, index) => {
                  const statusColor = metric.status === "warning" ? "text-orange-500" : "text-gray-600";
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        metric.hasDetails && setOpenDialog(metric.dialogKey || null);
                      }}
                    >
                      <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                        {metric.label}
                      </div>
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
          )}
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
                      État : <span className="font-semibold text-red-500">Hyperhémie</span>{" "}
                      <span className="text-gray-500">depuis 3am</span>
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
              <DialogTitle>PIC (Pression intracrânienne)</DialogTitle>
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
              <DialogTitle>PPC optimale - Étude sur 6 heures</DialogTitle>
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
              <CardTitle className="text-lg">
                Adhérence & Monitorage {timeRange === "stay" ? "sur le séjour" : `moyen sur ${timeRange}`}
              </CardTitle>
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
                      <p className="text-xs text-gray-500 mt-1">
                        {nonAdherentCount} non adhérent{nonAdherentCount > 1 ? "s" : ""}
                      </p>
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
                  <div className="grid grid-cols-4 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all"
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${target.isAdherent ? "bg-gray-400" : "bg-red-500"}`}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">{target.label}</p>
                          <p className={`text-xs font-medium ${target.isAdherent ? "text-gray-400" : "text-red-600"}`}>
                            {target.isAdherent ? "Adhérent" : "Non adhérent"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {timeRange === "stay" ? "Monitorage (Séjour complet)" : `Monitorage (${timeRange.toUpperCase()})`}
                  </CardTitle>
                  {hasFileData && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {fileDataLoading ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Chargement...
                        </span>
                      ) : patientFileData ? (
                        "Données réelles"
                      ) : (
                        "Données simulées"
                      )}
                    </Badge>
                  )}
                </div>
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
