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

    if (!patientFileData) {
      return defaultIndicators.map((indicator) => ({
        ...indicator,
        adherencePercentage: 100,
        status: "normal" as const,
      }));
    }

    const realStatus = getMonitoringInterventionsStatus(patientFileData, hoursForAdherence);

    return defaultIndicators.map((indicator) => {
      const realData = realStatus.find((s) => s.label === indicator.label);

      return {
        ...indicator, // keep label + description
        adherencePercentage: realData?.adherencePercentage ?? 100,
        status: realData?.status ?? "normal",
      };
    });
  }, [patientFileData, hoursForAdherence]);

  // Get real clinical indicators status from JSON data
  const clinicalIndicatorsData = useMemo(() => {
    if (!patientFileData) return null;
    return getClinicalIndicatorsStatus(patientFileData, hoursForAdherence);
  }, [patientFileData, hoursForAdherence]);

  // Calculate overall monitoring adherence (average of all targets)
  const monitoringAdherence = useMemo(() => {
    const totalPercentage = monitoringTargets.reduce((sum, t) => sum + t.adherencePercentage, 0);
    return Math.round(totalPercentage / monitoringTargets.length);
  }, [monitoringTargets]);

  const nonAdherentCount = monitoringTargets.filter((t) => t.status !== "normal").length;

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
    // Patient #8448 (John Doe) - specific configuration
    if (patientId === "#8448") {
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
      currentState: "Hypertension intracranienne",
      currentStateColor: "text-red-500",
      currentStateSince: "depuis 6am",
      history: {
        hyperemia: 20,
        hticWithIschemia: 0,
        htic: 0,
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

  // Merge with real data from JSON
  const clinicalIndicators = useMemo(() => {
    return baseClinicalIndicators.map((base) => {
      const realData = clinicalIndicatorsData?.find((d) => d.label === base.label);
      return {
        label: base.label,
        target: base.target,
        status: realData?.status ?? "normal",
        adherencePercentage: realData?.adherencePercentage ?? 100,
      };
    });
  }, [clinicalIndicatorsData]);

  // Calculate clinical adherence (average of all indicators)
  const clinicalAdherence = useMemo(() => {
    const totalPercentage = clinicalIndicators.reduce((sum, i) => sum + i.adherencePercentage, 0);
    return Math.round(totalPercentage / clinicalIndicators.length);
  }, [clinicalIndicators]);
  const outOfRangeCount = clinicalIndicators.filter((i) => i.status !== "normal").length;

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
      Variable_temperature: "Température",
      Variable_ETCO2: "ETCO2",
      Variable_position_tete: "Tête",
      Variable_paco2: "PaCO2",
      Variable_glycemie: "Glycémie",
      Variable_INR: "INR",
      Variable_plaquettes: "Plaquettes",
      Variable_hemoglobine: "Hémoglobine",
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
              const seed = time.getTime() / 1000 + indicator.label.charCodeAt(0);
              const x = Math.sin(seed) * 10000;
              const variation = (x - Math.floor(x) - 0.5) * 10;
              dataPoint[indicator.label] = Math.round(variation * 100) / 100;
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
        const seed = time.getTime() / 1000 + indicator.label.charCodeAt(0);
        const variation = (getSeededRandom(seed) - 0.5) * 10;
        dataPoint[indicator.label] = Math.round(variation * 100) / 100;
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
                        className="bg-green-400 h-3 rounded-full"
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
                  <div className="grid grid-cols-5 gap-4 pt-4">
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
                              <p className="text-sm font-medium text-gray-700">{indicator.label}</p>
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
                  <div className="grid grid-cols-5 gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      const dotColor =
                        target.status === "normal"
                          ? "bg-gray-400"
                          : target.status === "warning"
                            ? "bg-orange-400"
                            : "bg-red-500";
                      const textColor =
                        target.status === "normal"
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
                            <p className="text-sm font-medium text-gray-700">{target.label} </p>
                            <p className={`text-xs font-medium ${textColor}`}>{target.description}</p>
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
