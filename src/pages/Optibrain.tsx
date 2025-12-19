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
import { getTimeRangeDisplayLabel } from "@/utils/timeRangeUtils";
import {
  loadPatientFileData,
  hasPatientFileData,
  getTimeSeriesForRange,
  getAllTimeSeriesData,
  isVariableSparse,
  getLatestValue,
  calculateAverage,
  calculateTimeInRanges,
  getAvailableVariables,
  getMonitoringInterventionsStatus,
  getClinicalIndicatorsStatus,
  getAdherenceStatus,
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
  const [picDialogTimeRange, setPicDialogTimeRange] = useState<string>("24h");

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

  // Map time range to hours for adherence calculation
  const getHoursFromTimeRangeForAdherence = (range: string): number => {
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
        return 96; // ~4 days, or use undefined for all data
      default:
        return 24;
    }
  };

  const hoursForAdherence = getHoursFromTimeRangeForAdherence(timeRange);
  const monitoringTargets = useMemo(() => {
    const defaultIndicators = [
      { label: "Opioide", description: "En cours" },
      { label: "Hypnotique", description: "En cours" },
      { label: "Propofol 48h", description: "<48h" },
      { label: "Anti-Epileptique", description: "Monitorée" },
      { label: "PIC", description: "Monitorée" },
      { label: "PAM", description: "Monitorée" },
      { label: "PVC", description: "Monitorée" },
      { label: "ETCO2", description: "Monitorée" },
      { label: "Température", description: "Monitorée" },
    ];

    // Si pas de données patient, retourner null pour indiquer l'absence de données réelles
    if (!patientFileData) {
      return defaultIndicators.map((indicator) => ({
        ...indicator,
        adherencePercentage: null as number | null,
        status: null as "normal" | "warning" | "critical" | null,
        hasRealData: false,
      }));
    }

    const realStatus = getMonitoringInterventionsStatus(patientFileData, hoursForAdherence);

    return defaultIndicators.map((indicator) => {
      const realData = realStatus.find((s) => s.label === indicator.label);

      return {
        ...indicator,
        adherencePercentage: realData?.adherencePercentage ?? null,
        status: realData?.status ?? null,
        hasRealData: realData !== undefined,
      };
    });
  }, [patientFileData, hoursForAdherence]);

  // Get real clinical indicators status from JSON data
  const clinicalIndicatorsData = useMemo(() => {
    if (!patientFileData) return null;
    return getClinicalIndicatorsStatus(patientFileData, hoursForAdherence);
  }, [patientFileData, hoursForAdherence]);

  // Calculate overall monitoring adherence (average of targets with real data only)
  const monitoringAdherence = useMemo(() => {
    const targetsWithData = monitoringTargets.filter((t) => t.adherencePercentage !== null);
    if (targetsWithData.length === 0) return null;
    const totalPercentage = targetsWithData.reduce((sum, t) => sum + (t.adherencePercentage ?? 0), 0);
    return Math.round(totalPercentage / targetsWithData.length);
  }, [monitoringTargets]);

  const nonAdherentCount = monitoringTargets.filter((t) => t.status !== null && t.status !== "normal").length;

  // Get real PIC, PPC and PACO2 values from patient file data
  const realBrainValues = useMemo(() => {
    if (!patientFileData) {
      return { pic: null, ppc: null, paco2: null };
    }
    const picLatest = getLatestValue(patientFileData, "Variable_PIC");
    const ppcLatest = getLatestValue(patientFileData, "Variable_PPC");
    const paco2Latest = getLatestValue(patientFileData, "Variable_paco2");
    return {
      pic: picLatest?.value ?? null,
      ppc: ppcLatest?.value ?? null,
      paco2: paco2Latest?.value ?? null,
    };
  }, [patientFileData]);

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
  // Override brainMetrics with real data when available
  const brainMetrics = useMemo(() => {
    return importedBrainMetrics.map((metric) => {
      if (metric.label === "PIC" && realBrainValues.pic !== null) {
        return {
          ...metric,
          value: Math.round(realBrainValues.pic * 10) / 10,
        };
      }
      if (metric.label === "PPC" && realBrainValues.ppc !== null) {
        return {
          ...metric,
          value: Math.round(realBrainValues.ppc * 10) / 10,
        };
      }
      if (metric.label === "PaCO2" && realBrainValues.paco2 !== null) {
        return {
          ...metric,
          value: Math.round(realBrainValues.paco2 * 10) / 10,
        };
      }
      return metric;
    });
  }, [realBrainValues.pic, realBrainValues.ppc, realBrainValues.paco2]);

  // Get PIC status based on value (target < 20 mmHg)
  const getPicStatus = (value: number | null): string => {
    if (value === null) return "normal";
    if (value >= 25) return "critical";
    if (value >= 20) return "warning";
    return "normal";
  };

  // Get PPC status based on value (target 60-70 mmHg)
  const getPpcStatus = (value: number | null): string => {
    if (value === null) return "normal";
    if (value < 50 || value > 80) return "critical";
    if (value < 60 || value > 70) return "warning";
    return "normal";
  };

  // PIC displayed in "Optimisation cérébrale" should reflect the real (non-zero) latest PIC value
  // (same source as other real-value widgets: getLatestValue excludes sensor 0s).
  const picValue = realBrainValues.pic;
  const ppcValue = realBrainValues.ppc;

  // Neurological state configuration per patient
  const neurologicalStateConfig = useMemo(() => {
    // Patient #8749 (John Doe) - specific configuration
    if (patientId === "#8749") {
      return {
        currentState: "Contrôlé",
        currentStateColor: "text-grey-600",
        currentStateSince: "depuis 5h du matin",
        history: {
          hyperemia: 0,
          hticWithIschemia: 10,
          htic: 30, // HTIC sans ischémie ni hyperhémie
          ischemia: 0,
          controlled: 60,
        },
      };
    }
    // Default configuration (patient #6312)
    return {
      currentState: "Contrôlé",
      currentStateColor: "text-red-500",
      currentStateSince: "depuis 6am",
      history: {
        hyperemia: 0,
        hticWithIschemia: 0,
        htic: 20,
        ischemia: 0,
        controlled: 80,
      },
    };
  }, [patientId]);

  const brainOptimisationMetrics = [
    {
      label: "État Neuro",
      value: neurologicalStateConfig.currentState,
      displayValue: neurologicalStateConfig.currentState,
      unit: "",
      status: neurologicalStateConfig.currentState === "Contrôlé" ? "normal" : "critical",
      hasDetails: true,
      dialogKey: "neuro",
      trend: "stable",
    },
    {
      label: "PIC",
      value: picValue !== null ? `${Math.round(picValue * 10) / 10} mmHg` : "-- mmHg",
      displayValue: picValue !== null ? `${Math.round(picValue * 10) / 10}` : "--",
      unit: "mmHg",
      status: getPicStatus(picValue),
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
      trend: "stable",
      change: 0,
      description: "Cible 60-70 mmHg",
    },
  ];
  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

  // Base clinical indicators with targets
  const baseClinicalIndicators = [
    { label: "Tête", target: "0-30°" },
    { label: "PIC", target: "< 20mmHg" },
    { label: "PPC", target: "60-70 mmHg" },
    { label: "Température", target: "35-38°C" },
    { label: "PaCO2", target: "35-45mmHg" },
    { label: "Glycémie", target: "6-11 mmol/L" },
    { label: "Hémoglobine", target: "> 7g/dl" },
    { label: "INR", target: "< 1.2" },
    { label: "Plaquettes", target: "> 100 g/L" },
  ];

  // Merge with real data from JSON - ne pas utiliser de fallback mock
  const clinicalIndicators = useMemo(() => {
    return baseClinicalIndicators.map((base) => {
      const realData = clinicalIndicatorsData?.find((d) => d.label === base.label);
      return {
        label: base.label,
        target: base.target,
        status: realData?.status ?? null,
        adherencePercentage: realData?.adherencePercentage ?? null,
        hasRealData: realData !== undefined,
      };
    });
  }, [clinicalIndicatorsData]);

  // Calculate clinical adherence (average of indicators with real data only)
  const clinicalAdherence = useMemo(() => {
    const indicatorsWithData = clinicalIndicators.filter((i) => i.adherencePercentage !== null);
    if (indicatorsWithData.length === 0) return null;
    const totalPercentage = indicatorsWithData.reduce((sum, i) => sum + (i.adherencePercentage ?? 0), 0);
    return Math.round(totalPercentage / indicatorsWithData.length);
  }, [clinicalIndicators]);
  const outOfRangeCount = clinicalIndicators.filter((i) => i.status !== null && i.status !== "normal").length;

  // Calculate time spent in each PIC range from real data
  const picRangeData = useMemo(() => {
    // Map picDialogTimeRange to hours
    const getHoursForPicDialog = (range: string): number => {
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
          return 96;
        default:
          return 24;
      }
    };
    const hoursBack = getHoursForPicDialog(picDialogTimeRange);

    if (!patientFileData) {
      return {
        ranges: [
          { label: "25 - 30 mmHg", minutes: 0, percentage: 0, color: "orange", status: "warning" },
          { label: "20 - 25 mmHg", minutes: 0, percentage: 0, color: "orange", status: "warning" },
          { label: "> 30 mmHg", minutes: 0, percentage: 0, color: "red", status: "critical" },
          { label: "< 20 mmHg", minutes: 0, percentage: 0, color: "gray", status: "normal" },
        ],
        currentPic: null,
        averagePic: null,
        totalMinutes: 0,
      };
    }

    const picTimeSeries = getTimeSeriesForRange(patientFileData, "Variable_PIC", hoursBack, 1); // Use selected time range

    if (picTimeSeries.length === 0) {
      return {
        ranges: [
          { label: "25 - 30 mmHg", minutes: 0, percentage: 0, color: "orange", status: "warning" },
          { label: "20 - 25 mmHg", minutes: 0, percentage: 0, color: "orange", status: "warning" },
          { label: "> 30 mmHg", minutes: 0, percentage: 0, color: "red", status: "critical" },
          { label: "< 20 mmHg", minutes: 0, percentage: 0, color: "gray", status: "normal" },
        ],
        currentPic: null,
        averagePic: null,
        totalMinutes: 0,
      };
    }

    // Filter out aberrant values (< 5 mmHg are sensor errors)
    const MIN_VALID_PIC = 5;
    const validData = picTimeSeries.filter((d) => d.valeur >= MIN_VALID_PIC);

    // Count time in each range
    const counts = {
      below20: 0,
      range20_25: 0,
      range25_30: 0,
      above30: 0,
    };

    validData.forEach((d) => {
      if (d.valeur < 20) counts.below20++;
      else if (d.valeur >= 20 && d.valeur < 25) counts.range20_25++;
      else if (d.valeur >= 25 && d.valeur <= 30) counts.range25_30++;
      else if (d.valeur > 30) counts.above30++;
    });

    const total = validData.length;
    const averagePic = total > 0 ? calculateAverage(validData) : null;

    return {
      ranges: [
        {
          label: "25 - 30 mmHg",
          minutes: counts.range25_30,
          percentage: total > 0 ? Math.round((counts.range25_30 / total) * 100) : 0,
          color: "orange",
          status: "warning",
        },
        {
          label: "20 - 25 mmHg",
          minutes: counts.range20_25,
          percentage: total > 0 ? Math.round((counts.range20_25 / total) * 100) : 0,
          color: "orange",
          status: "warning",
        },
        {
          label: "> 30 mmHg",
          minutes: counts.above30,
          percentage: total > 0 ? Math.round((counts.above30 / total) * 100) : 0,
          color: "red",
          status: "critical",
        },
        {
          label: "< 20 mmHg",
          minutes: counts.below20,
          percentage: total > 0 ? Math.round((counts.below20 / total) * 100) : 0,
          color: "gray",
          status: "normal",
        },
      ],
      currentPic: realBrainValues.pic,
      averagePic,
      totalMinutes: total,
    };
  }, [patientFileData, realBrainValues.pic, picDialogTimeRange]);

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
  // Inclut l'information sur la densité des données pour l'affichage
  const realTimeSeriesData = useMemo(() => {
    if (!patientFileData) return null;

    const hoursBack = getHoursFromTimeRange(timeRange);
    const availableVars = getAvailableVariables(patientFileData);

    // Map variable names to our indicator labels (case-sensitive, must match JSON exactly)
    const varMapping: Record<string, string> = {
      Variable_FC: "FC",
      Variable_PIC: "PIC",
      Variable_PPC: "PPC",
      Variable_PAM: "PAM",
      Variable_PVC: "PVC",
      Variable_temperature: "Température",
      Variable_ETCO2: "ETCO2",
      Variable_paco2: "PaCO2",
      Variable_position_tete: "Tête",
      Variable_glycemie: "Glycémie",
      Variable_INR: "INR",
      Variable_plaquettes: "Plaquettes",
      Variable_hemoglobine: "Hémoglobine",
    };

    const result: Record<string, { data: TimeSeriesDataPoint[]; isSparse: boolean }> = {};

    Object.entries(varMapping).forEach(([varKey, label]) => {
      if (availableVars.includes(varKey)) {
        const isSparse = isVariableSparse(patientFileData, varKey, 20);
        // Pour les données rares, ne pas échantillonner pour garder tous les points
        const data = isSparse
          ? getAllTimeSeriesData(patientFileData, varKey, hoursBack, true)
          : getTimeSeriesForRange(patientFileData, varKey, hoursBack, 15, true);
        result[label] = { data, isSparse };
      }
    });

    return result;
  }, [patientFileData, timeRange]);

  // Chart data - utiliser UNIQUEMENT les données réelles
  // Combine toutes les séries temporelles en un seul dataset pour le graphique
  const chartData = useMemo(() => {
    if (!realTimeSeriesData || Object.keys(realTimeSeriesData).length === 0) {
      return [];
    }

    // Collecter tous les timestamps uniques de toutes les séries
    const allTimestamps = new Set<number>();
    Object.values(realTimeSeriesData).forEach(({ data }) => {
      data.forEach((point) => {
        allTimestamps.add(new Date(point.charttime).getTime());
      });
    });

    // Trier les timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    if (sortedTimestamps.length === 0) return [];

    // Créer les points de données
    return sortedTimestamps.map((timestamp) => {
      const time = new Date(timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

      const dataPoint: any = {
        time: timeStr,
        timestamp,
      };

      // Pour chaque indicateur, trouver la valeur exacte ou la plus proche
      Object.entries(realTimeSeriesData).forEach(([label, { data, isSparse }]) => {
        // Pour les données rares, ne mettre la valeur que si on a un point exact
        if (isSparse) {
          const exactPoint = data.find((d) => new Date(d.charttime).getTime() === timestamp);
          if (exactPoint) {
            dataPoint[label] = exactPoint.valeur;
          }
        } else {
          // Pour les données denses, interpoler ou prendre le plus proche
          const closestPoint = data.reduce(
            (closest, point) => {
              const pointTime = new Date(point.charttime).getTime();
              const closestTime = closest ? new Date(closest.charttime).getTime() : Infinity;
              return Math.abs(pointTime - timestamp) < Math.abs(closestTime - timestamp) ? point : closest;
            },
            null as TimeSeriesDataPoint | null,
          );

          if (closestPoint && Math.abs(new Date(closestPoint.charttime).getTime() - timestamp) < 30 * 60 * 1000) {
            dataPoint[label] = closestPoint.valeur;
          }
        }
      });

      return dataPoint;
    });
  }, [realTimeSeriesData]);

  // Déterminer quels indicateurs ont des données rares (pour afficher des points au lieu de lignes)
  const sparseIndicators = useMemo(() => {
    if (!realTimeSeriesData) return new Set<string>();
    return new Set(
      Object.entries(realTimeSeriesData)
        .filter(([_, { isSparse }]) => isSparse)
        .map(([label]) => label),
    );
  }, [realTimeSeriesData]);

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
                  {/* HTIC (sans ischémie ni hyperhémie) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">HTIC</span>
                      <span className="text-xl font-semibold text-orange-500">
                        {neurologicalStateConfig.history.htic}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-orange-400 h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.htic}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">Sans ischémie ni hyperhémie</span>
                  </div>

                  {/* HTIC avec ischémie */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">HTIC avec ischémie</span>
                      <span className="text-xl font-semibold text-red-500">
                        {neurologicalStateConfig.history.hticWithIschemia}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-red-400 h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.hticWithIschemia}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Contrôlé */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Contrôlé</span>
                      <span className="text-xl font-semibold text-gray-700">
                        {neurologicalStateConfig.history.controlled}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gray-400 h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.controlled}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="border-t mt-6 pt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div>
                      État :{" "}
                      <span className={`font-semibold ${neurologicalStateConfig.currentStateColor}`}>
                        {neurologicalStateConfig.currentState}
                      </span>{" "}
                      <span className="text-gray-500">{neurologicalStateConfig.currentStateSince}</span>
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
              {/* Time Range Selector */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Période :</span>
                <div className="flex gap-2">
                  {["3h", "6h", "12h", "24h", "stay"].map((range) => (
                    <button
                      key={range}
                      onClick={() => setPicDialogTimeRange(range)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        picDialogTimeRange === range
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {range === "stay" ? "Séjour" : range}
                    </button>
                  ))}
                </div>
              </div>

              {/* PIC Card */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-700">
                    <span className="text-orange-500">Répartition du temps</span> par niveau de PIC
                  </h3>
                  {picRangeData.totalMinutes > 0 && (
                    <span className="text-sm text-gray-500">Total: {picRangeData.totalMinutes} min</span>
                  )}
                </div>

                {/* Individual Bars */}
                <div className="space-y-6">
                  {picRangeData.ranges.map((range, idx) => {
                    const textColor =
                      range.color === "red"
                        ? "text-red-500"
                        : range.color === "orange"
                          ? "text-orange-500"
                          : "text-gray-500";
                    const bgColor =
                      range.color === "red" ? "bg-red-400" : range.color === "orange" ? "bg-orange-400" : "bg-gray-400";
                    return (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">{range.label}</span>
                          <span className={`text-xl font-semibold ${textColor}`}>{range.minutes} min</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`${bgColor} h-3 rounded-full`}
                            style={{ width: `${Math.max(range.percentage, 1)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics Footer */}
                <div className="border-t mt-6 pt-4">
                  <div className="text-sm text-gray-600">
                    PIC actuelle :{" "}
                    <span className="font-semibold">
                      {picRangeData.currentPic !== null ? `${Math.round(picRangeData.currentPic)} mmHg` : "-- mmHg"}
                    </span>
                    <span className="mx-2">|</span>
                    PIC moyenne :{" "}
                    <span className="font-semibold">
                      {picRangeData.averagePic !== null ? `${Math.round(picRangeData.averagePic)} mmHg` : "-- mmHg"}
                    </span>
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
                Adhérence & Monitorage {timeRange === "stay" ? "sur le séjour" : `sur ${timeRange}`}
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
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                        clinicalAdherence === null
                          ? "border-gray-300 text-gray-400 bg-gray-50"
                          : clinicalAdherence >= 90
                            ? "border-gray-400 text-gray-600 bg-gray-50"
                            : clinicalAdherence >= 80
                              ? "border-orange-400 text-orange-600 bg-orange-50"
                              : "border-red-400 text-red-600 bg-red-50"
                      }`}
                    >
                      {clinicalAdherence !== null ? `${clinicalAdherence}%` : "--"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Adhérence aux cibles recommandées</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {patientFileData ? `${outOfRangeCount} Indicateurs à surveiller` : "Pas de données disponibles"}
                      </p>
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
                  <div className="grid grid-cols-5 gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const statusColor =
                        indicator.status === null
                          ? "bg-gray-300"
                          : indicator.status === "critical"
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
                              <p className="text-sm font-medium text-gray-700">{indicator.label}</p>
                            </div>
                            <p className="text-xs text-gray-500">{indicator.target}</p>
                            {indicator.adherencePercentage !== null && (
                              <p className="text-xs text-gray-400">{indicator.adherencePercentage}% adhérence</p>
                            )}
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

            {/* Monitoring Chart */}
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {timeRange === "stay" ? "Monitorage (Séjour complet)" : `Monitorage (${timeRange.toUpperCase()})`}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {fileDataLoading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement...
                      </span>
                    ) : (
                      getTimeRangeDisplayLabel(timeRange)
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-gray-200 rounded-lg p-4 ${
                    selectedIndicators.length === 0 ? "h-32" : "h-[300px]"
                  }`}
                >
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-400">
                        Sélectionnez des indicateurs ci-dessus pour afficher leurs tendances
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedIndicators.map((label) => {
                          const indicator = clinicalIndicators.find((i) => i.label === label);
                          if (!indicator) return null;
                          const isSparse = sparseIndicators.has(label);
                          const statusColor =
                            indicator.status === null
                              ? "bg-gray-300"
                              : indicator.status === "critical"
                                ? "bg-red-500"
                                : indicator.status === "warning"
                                  ? "bg-orange-400"
                                  : "bg-gray-400";
                          return (
                            <div
                              key={label}
                              className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full border border-gray-200"
                            >
                              {isSparse ? (
                                <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
                              ) : (
                                <div className={`w-4 h-0.5 ${statusColor}`}></div>
                              )}
                              <span className="text-xs text-gray-700">
                                {label} {isSparse && "(points)"}
                              </span>
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
                            {selectedIndicators.map((label) => {
                              const isSparse = sparseIndicators.has(label);
                              return (
                                <Line
                                  key={label}
                                  type="monotone"
                                  dataKey={label}
                                  stroke={getIndicatorColor(label)}
                                  strokeWidth={isSparse ? 0 : 2}
                                  dot={
                                    isSparse
                                      ? { r: 6, fill: getIndicatorColor(label), stroke: getIndicatorColor(label) }
                                      : false
                                  }
                                  activeDot={{ r: isSparse ? 8 : 4 }}
                                  connectNulls={false}
                                />
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
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
                        monitoringAdherence === null
                          ? "border-gray-300 text-gray-400 bg-gray-50"
                          : monitoringAdherence >= 90
                            ? "border-gray-400 text-gray-600 bg-gray-50"
                            : monitoringAdherence >= 80
                              ? "border-orange-400 text-orange-600 bg-orange-50"
                              : "border-red-400 text-red-600 bg-red-50"
                      }`}
                    >
                      {monitoringAdherence !== null ? `${monitoringAdherence}%` : "--"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Monitorage et interventions en place</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {patientFileData
                          ? `${nonAdherentCount} non adhérent${nonAdherentCount > 1 ? "s" : ""}`
                          : "Pas de données disponibles"}
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
                  <div className="grid grid-cols-5 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      const dotColor =
                        target.status === null
                          ? "bg-gray-300"
                          : target.status === "normal"
                            ? "bg-gray-400"
                            : target.status === "warning"
                              ? "bg-orange-400"
                              : "bg-red-500";
                      const textColor =
                        target.status === null
                          ? "text-gray-400"
                          : target.status === "normal"
                            ? "text-gray-500"
                            : target.status === "warning"
                              ? "text-orange-600"
                              : "text-red-600";
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">{target.label}</p>
                            <p className={`text-xs font-medium ${textColor}`}>
                              {target.adherencePercentage !== null
                                ? `${target.adherencePercentage}% - ${target.description}`
                                : "Pas de données"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
export default Optibrain;
