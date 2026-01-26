import { useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { PatientHeader } from "@/components/PatientHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";
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
import {
  loadAutoregulationData,
  hasAutoregulationData,
  getOptimalPPC,
  getPPCStatusVsOptimal,
  OptimalPPCResult,
  isNirsBasedPatient,
} from "@/services/autoregulation.service";
import { getOptimalPAMFromNirs } from "@/services/nirsAutoregulation.service";
import { AutoregulationChart } from "@/components/AutoregulationChart";
import { TimeWindowSelector, TimeWindowValue } from "@/components/ui/TimeWindowSelector";

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
  const [picDialogTimeRange, setPicDialogTimeRange] = useState<TimeWindowValue>("24h");
  const [showTargetZones, setShowTargetZones] = useState(true);
  
  // Ref pour le graphique de monitorage
  const chartRef = useRef<HTMLDivElement>(null);

  // Patient file data state
  const [patientFileData, setPatientFileData] = useState<PatientFileData | null>(null);
  const [fileDataLoading, setFileDataLoading] = useState(false);
  const hasFileData = hasPatientFileData(patientId);

  // Autoregulation data state for optimal PPC
  const [optimalPPCResult, setOptimalPPCResult] = useState<OptimalPPCResult>({
    optimalPPC: null,
    lowerLimit: null,
    upperLimit: null,
    prxScore: null,
    timestamp: null,
    hasData: false,
  });
  const hasAutoregData = hasAutoregulationData(patientId);
  const isNirsBased = isNirsBasedPatient(patientId);

  // ===== Fonctions utilitaires pour la synchronisation =====

  // Fonction helper pour obtenir la clé de variable depuis le label
  const getVariableKeyFromLabel = (label: string): string => {
    const mapping: Record<string, string> = {
      FC: "Variable_FC",
      PIC: "Variable_PIC",
      PPC: "Variable_PPC",
      PAM: "Variable_PAM",
      PVC: "Variable_PVC",
      Température: "Variable_temperature",
      ETCO2: "Variable_ETCO2",
      PaCO2: "Variable_paco2",
      Tête: "Variable_position_tete",
      Glycémie: "Variable_glycemie",
      INR: "Variable_INR",
      Plaquettes: "Variable_plaquettes",
      Hémoglobine: "Variable_hemoglobine",
    };
    return mapping[label] || "";
  };

  // Fonction pour obtenir les données EXACTEMENT comme elles sont affichées dans le graphique
  // IMPORTANT: les timestamps des JSON sont anciens (données statiques). On normalise donc "comme si c'était aujourd'hui"
  // via getTimeSeriesForRange/getAllTimeSeriesData (normalizeToToday=true), sinon l'adhérence tombe à 0 (hors fenêtre temporelle).
  const getChartDataForAdherence = (
    data: PatientFileData,
    variableKey: string,
    hoursBack: number,
  ): { values: number[]; timestamps: Date[]; count: number } => {
    if (!data || !variableKey) {
      return { values: [], timestamps: [], count: 0 };
    }

    const sparse = isVariableSparse(data, variableKey, 20);

    // Même logique que le graphe principal:
    // - données denses: échantillonnage (15 min)
    // - données rares: aucun échantillonnage (points exacts)
    const series = sparse
      ? getAllTimeSeriesData(data, variableKey, hoursBack, true)
      : getTimeSeriesForRange(data, variableKey, hoursBack, 15, true);

    return {
      values: series.map((d) => d.valeur),
      timestamps: series.map((d) => new Date(d.charttime)),
      count: series.length,
    };
  };

  // Fonction améliorée pour parser les plages cibles avec plus de robustesse
  const parseTargetRange = (target: string): { min: number; max: number } => {
    const cleanTarget = target.toLowerCase().replace(/°/g, "").trim();

    // Plage avec tiret
    const rangeMatch = cleanTarget.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      return {
        min: parseFloat(rangeMatch[1]),
        max: parseFloat(rangeMatch[2]),
      };
    }

    // Inférieur à
    const lessThanMatch = cleanTarget.match(/<\s*(\d+(?:\.\d+)?)/);
    if (lessThanMatch) {
      return {
        min: -Infinity,
        max: parseFloat(lessThanMatch[1]),
      };
    }

    // Supérieur à
    const greaterThanMatch = cleanTarget.match(/>\s*(\d+(?:\.\d+)?)/);
    if (greaterThanMatch) {
      return {
        min: parseFloat(greaterThanMatch[1]),
        max: Infinity,
      };
    }

    return { min: -Infinity, max: Infinity };
  };

  // Fonction de calcul d'adhérence basée sur les données VISIBLES du graphique
  const calculateAdherenceFromChartData = (
    data: PatientFileData,
    variableKey: string,
    hoursBack: number,
    targetRange: string,
  ): {
    percentage: number;
    inRangeCount: number;
    totalCount: number;
    avgValue: number;
  } => {
    const chartData = getChartDataForAdherence(data, variableKey, hoursBack);

    if (chartData.count === 0) {
      return { percentage: 0, inRangeCount: 0, totalCount: 0, avgValue: 0 };
    }

    const target = parseTargetRange(targetRange);
    let inRangeCount = 0;
    let totalValue = 0;

    chartData.values.forEach((value) => {
      if (value >= target.min && value <= target.max) {
        inRangeCount++;
      }
      totalValue += value;
    });

    const percentage = Math.round((inRangeCount / chartData.count) * 100);
    const avgValue = Math.round((totalValue / chartData.count) * 10) / 10;

    return {
      percentage,
      inRangeCount,
      totalCount: chartData.count,
      avgValue,
    };
  };

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

  // Load autoregulation data for optimal PPC/PAM calculation
  useEffect(() => {
    if (hasAutoregData) {
      if (isNirsBased) {
        // Use NIRS-based calculation for patient #8749
        getOptimalPAMFromNirs(patientId, 30)
          .then((result) => {
            setOptimalPPCResult(result);
          })
          .catch((err) => {
            console.error("Failed to load NIRS autoregulation data:", err);
          });
      } else {
        // Use PRx-based calculation for other patients
        loadAutoregulationData(patientId)
          .then((data) => {
            if (data) {
              // Use 30min window with 4h lookback as default
              const result = getOptimalPPC(data, 30, 4);
              setOptimalPPCResult(result);
            }
          })
          .catch((err) => {
            console.error("Failed to load autoregulation data:", err);
          });
      }
    } else {
      setOptimalPPCResult({
        optimalPPC: null,
        lowerLimit: null,
        upperLimit: null,
        prxScore: null,
        timestamp: null,
        hasData: false,
      });
    }
  }, [patientId, hasAutoregData, isNirsBased]);

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

  // Helper pour calculer la durée depuis la première administration d'un médicament
  const getMedicationDuration = (variableKey: string): { hours: number; drugName: string | null } | null => {
    if (!patientFileData) return null;
    
    const data = patientFileData[variableKey] as Array<{ charttime: string; drugname?: string }> | undefined;
    if (!data || data.length === 0) return null;
    
    // Trier par date pour trouver la première administration
    const sortedData = [...data].sort((a, b) => 
      new Date(a.charttime).getTime() - new Date(b.charttime).getTime()
    );
    
    const firstDate = new Date(sortedData[0].charttime);
    const lastDate = new Date(sortedData[sortedData.length - 1].charttime);
    const durationMs = lastDate.getTime() - firstDate.getTime();
    const hours = Math.round(durationMs / (1000 * 60 * 60));
    
    return { 
      hours, 
      drugName: sortedData[0].drugname || null 
    };
  };

  // Helper pour formater la durée en texte lisible
  const formatDuration = (hours: number): string => {
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}j`;
    return `${days}j ${remainingHours}h`;
  };

  // Monitoring targets avec synchronisation des données visibles
  const monitoringTargets = useMemo(() => {
    // Calculer les durées pour les médicaments
    const propofolDuration = getMedicationDuration("Variable_hypnotiques");
    const opioideDuration = getMedicationDuration("Variable_opioides");
    const antiEpileptiqueDuration = getMedicationDuration("Variable_anti_epileptique");

    // Trouver le nom du propofol dans les hypnotiques
    const hypnotiquesData = patientFileData?.Variable_hypnotiques as Array<{ drugname?: string }> | undefined;
    const propofolEntry = hypnotiquesData?.find(h => h.drugname?.toLowerCase().includes("propofol"));
    const isOnPropofol = !!propofolEntry;

    const defaultIndicators = [
      { 
        label: "Opioide", 
        description: opioideDuration ? `${opioideDuration.drugName || "En cours"}` : "En cours", 
        target: "normal",
        contextInfo: opioideDuration 
          ? `Sous ${opioideDuration.drugName || "opioïde"} depuis ${formatDuration(opioideDuration.hours)}`
          : null
      },
      { 
        label: "Hypnotique", 
        description: propofolDuration ? `${propofolDuration.drugName || "En cours"}` : "En cours", 
        target: "normal",
        contextInfo: propofolDuration 
          ? `Sous ${propofolDuration.drugName || "hypnotique"} depuis ${formatDuration(propofolDuration.hours)}`
          : null
      },
      { 
        label: "Propofol 48h", 
        description: isOnPropofol ? (propofolDuration && propofolDuration.hours > 48 ? "> 48h" : "< 48h") : "Non administré", 
        target: "normal",
        contextInfo: isOnPropofol && propofolDuration
          ? `Propofol administré depuis ${formatDuration(propofolDuration.hours)}${propofolDuration.hours > 48 ? " ⚠️" : ""}`
          : "Pas de propofol administré"
      },
      { 
        label: "Anti-Epileptique", 
        description: antiEpileptiqueDuration ? `${antiEpileptiqueDuration.drugName || "Monitorée"}` : "Monitorée", 
        target: "normal",
        contextInfo: antiEpileptiqueDuration 
          ? `Sous ${antiEpileptiqueDuration.drugName || "anti-épileptique"} depuis ${formatDuration(antiEpileptiqueDuration.hours)}`
          : null
      },
      { label: "PIC", description: "Monitorée", target: "< 20mmHg", contextInfo: null },
      { label: "PAM", description: "Monitorée", target: "normal", contextInfo: null },
      { label: "PVC", description: "Monitorée", target: "normal", contextInfo: null },
      { label: "ETCO2", description: "Monitorée", target: "normal", contextInfo: null },
      { label: "Température", description: "Monitorée", target: "35-38°C", contextInfo: null },
    ];

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
      const variableKey = getVariableKeyFromLabel(indicator.label);

      // Utiliser la nouvelle fonction de calcul basée sur les données du graphique
      if (variableKey && patientFileData[variableKey]) {
        const adherenceData = calculateAdherenceFromChartData(
          patientFileData,
          variableKey,
          hoursForAdherence,
          indicator.target,
        );

        // Debug: logguer les informations pour vérifier la cohérence
        console.log(`[ADHERENCE DEBUG] ${indicator.label}:`, {
          target: indicator.target,
          percentage: adherenceData.percentage,
          totalPoints: adherenceData.totalCount,
          inRangePoints: adherenceData.inRangeCount,
          avgValue: adherenceData.avgValue,
        });

        return {
          ...indicator,
          adherencePercentage: adherenceData.percentage,
          status: realData?.status ?? null,
          hasRealData: true,
        };
      }

      return {
        ...indicator,
        adherencePercentage: realData?.adherencePercentage ?? null,
        status: realData?.status ?? null,
        hasRealData: realData !== undefined,
      };
    });
  }, [patientFileData, hoursForAdherence]);

  // Déclaration pour clinicalIndicatorsData
  const clinicalIndicatorsData = useMemo(() => {
    if (!patientFileData) return null;
    return getClinicalIndicatorsStatus(patientFileData, hoursForAdherence);
  }, [patientFileData, hoursForAdherence]);

  // Déclaration baseClinicalIndicators
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

  // Clinical indicators avec synchronisation des données visibles
  const clinicalIndicators = useMemo(() => {
    return baseClinicalIndicators.map((base) => {
      const realData = clinicalIndicatorsData?.find((d) => d.label === base.label);
      const variableKey = getVariableKeyFromLabel(base.label);

      // Utiliser la nouvelle fonction de calcul basée sur les données du graphique
      if (variableKey && patientFileData && patientFileData[variableKey]) {
        const adherenceData = calculateAdherenceFromChartData(
          patientFileData,
          variableKey,
          hoursForAdherence,
          base.target,
        );

        console.log(`[CLINICAL DEBUG] ${base.label}:`, {
          target: base.target,
          percentage: adherenceData.percentage,
          totalPoints: adherenceData.totalCount,
          avgValue: adherenceData.avgValue,
        });

        return {
          label: base.label,
          target: base.target,
          status: realData?.status ?? null,
          adherencePercentage: adherenceData.percentage,
          hasRealData: true,
        };
      }

      return {
        label: base.label,
        target: base.target,
        status: realData?.status ?? null,
        adherencePercentage: realData?.adherencePercentage ?? null,
        hasRealData: realData !== undefined,
      };
    });
  }, [clinicalIndicatorsData, patientFileData, hoursForAdherence]);

  // Calculate overall monitoring adherence (average of targets with real data only)
  const monitoringAdherence = useMemo(() => {
    const targetsWithData = monitoringTargets.filter((t) => t.adherencePercentage !== null);
    if (targetsWithData.length === 0) return null;
    const totalPercentage = targetsWithData.reduce((sum, t) => sum + (t.adherencePercentage ?? 0), 0);
    return Math.round(totalPercentage / targetsWithData.length);
  }, [monitoringTargets]);

  const nonAdherentCount = monitoringTargets.filter((t) => t.status !== null && t.status !== "normal").length;

  // Get real PIC, PPC, PAM and PACO2 values from patient file data
  const realBrainValues = useMemo(() => {
    if (!patientFileData) {
      return { pic: null, ppc: null, pam: null, paco2: null, picMax: null, ppcMin: null, ppcMax: null, pamMin: null, pamMax: null };
    }
    const picLatest = getLatestValue(patientFileData, "Variable_PIC");
    const ppcLatest = getLatestValue(patientFileData, "Variable_PPC");
    const pamLatest = getLatestValue(patientFileData, "Variable_PAM");
    const paco2Latest = getLatestValue(patientFileData, "Variable_paco2");
    
    // Calculer le PIC max (valeur problématique) sur les dernières 24h
    const picData = getTimeSeriesForRange(patientFileData, "Variable_PIC", 24, 15, true);
    const picMax = picData.length > 0 
      ? Math.max(...picData.map(d => d.valeur))
      : null;
    
    // Calculer le PPC min et max sur les dernières 24h
    const ppcData = getTimeSeriesForRange(patientFileData, "Variable_PPC", 24, 15, true);
    const ppcMin = ppcData.length > 0 
      ? Math.min(...ppcData.map(d => d.valeur))
      : null;
    const ppcMax = ppcData.length > 0 
      ? Math.max(...ppcData.map(d => d.valeur))
      : null;
    
    // Calculer la PAM min et max sur les dernières 24h
    const pamData = getTimeSeriesForRange(patientFileData, "Variable_PAM", 24, 15, true);
    const pamMin = pamData.length > 0 
      ? Math.min(...pamData.map(d => d.valeur))
      : null;
    const pamMax = pamData.length > 0 
      ? Math.max(...pamData.map(d => d.valeur))
      : null;
    
    return {
      pic: picLatest?.value ?? null,
      ppc: ppcLatest?.value ?? null,
      pam: pamLatest?.value ?? null,
      paco2: paco2Latest?.value ?? null,
      picMax: picMax,
      ppcMin: ppcMin,
      ppcMax: ppcMax,
      pamMin: pamMin,
      pamMax: pamMax,
    };
  }, [patientFileData]);

  if (!patient) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p className="text-foreground">Patient not found</p>
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
      // Use patient-specific GCS value
      if (metric.label === "GCS" && patient?.gcs !== undefined) {
        return {
          ...metric,
          value: patient.gcs,
        };
      }
      return metric;
    });
  }, [realBrainValues.pic, realBrainValues.ppc, realBrainValues.paco2, patient?.gcs]);

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
          htic: 30,
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
      // Dernière valeur critique: le % HTIC le plus élevé
      criticalLabel: neurologicalStateConfig.history.hticWithIschemia > 0 
        ? `${neurologicalStateConfig.history.hticWithIschemia}% HTIC+Ischémie`
        : neurologicalStateConfig.history.htic > 0 
          ? `${neurologicalStateConfig.history.htic}% HTIC`
          : null,
      criticalColor: neurologicalStateConfig.history.hticWithIschemia > 0 ? "text-red-500" : "text-orange-500",
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
      // Dernière valeur problématique: PIC max dans les dernières 24h si >= 20
      criticalLabel: realBrainValues.picMax !== null && realBrainValues.picMax >= 20 
        ? `Max 24h: ${Math.round(realBrainValues.picMax)} mmHg` 
        : null,
      criticalColor: realBrainValues.picMax !== null && realBrainValues.picMax >= 25 ? "text-red-500" : "text-orange-500",
    },
    {
      label: isNirsBased ? "PAM Opt" : "PPC Opt",
      value: optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null 
        ? `${Math.round(optimalPPCResult.optimalPPC)} mmHg` 
        : "-- mmHg",
      displayValue: optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null 
        ? `${Math.round(optimalPPCResult.optimalPPC)}` 
        : "--",
      unit: "mmHg",
      status: (() => {
        if (!optimalPPCResult.hasData || optimalPPCResult.optimalPPC === null) return "normal";
        // For NIRS patients, compare PAM to optimal PAM
        const valueToCompare = isNirsBased ? realBrainValues.pam : realBrainValues.ppc;
        if (valueToCompare === null) return "normal";
        const ppcStatus = getPPCStatusVsOptimal(valueToCompare, optimalPPCResult);
        if (ppcStatus === "below" || ppcStatus === "above") return "warning";
        return "normal";
      })(),
      hasDetails: true,
      dialogKey: "ppc",
      trend: "stable",
      change: 0,
      description: optimalPPCResult.hasData && optimalPPCResult.lowerLimit !== null && optimalPPCResult.upperLimit !== null
        ? `Zone: ${Math.round(optimalPPCResult.lowerLimit)}-${Math.round(optimalPPCResult.upperLimit)} mmHg`
        : isNirsBased ? "Cible PAM individuelle" : "Cible 60-70 mmHg",
      // Afficher la zone d'autorégulation quand disponible
      criticalLabel: (() => {
        // Si on a les données d'autorégulation, afficher le statut vs optimal
        if (optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null) {
          const valueToCompare = isNirsBased ? realBrainValues.pam : realBrainValues.ppc;
          if (valueToCompare === null) return null;
          const ppcStatus = getPPCStatusVsOptimal(valueToCompare, optimalPPCResult);
          const label = isNirsBased ? "PAM" : "PPC";
          if (ppcStatus === "below") {
            const diff = Math.round((optimalPPCResult.lowerLimit ?? optimalPPCResult.optimalPPC) - valueToCompare);
            return `${label} actuelle ${diff} mmHg sous la zone`;
          }
          if (ppcStatus === "above") {
            const diff = Math.round(valueToCompare - (optimalPPCResult.upperLimit ?? optimalPPCResult.optimalPPC));
            return `${label} actuelle ${diff} mmHg au-dessus`;
          }
          return null; // Dans la zone optimale
        }
        // Fallback: afficher min/max hors cible standard
        const { ppcMin, ppcMax } = realBrainValues;
        if (ppcMin !== null && ppcMin < 60) {
          return `Min 24h: ${Math.round(ppcMin)} mmHg`;
        }
        if (ppcMax !== null && ppcMax > 70) {
          return `Max 24h: ${Math.round(ppcMax)} mmHg`;
        }
        return null;
      })(),
      criticalColor: (() => {
        if (optimalPPCResult.hasData && realBrainValues.ppc !== null) {
          const ppcStatus = getPPCStatusVsOptimal(realBrainValues.ppc, optimalPPCResult);
          if (ppcStatus === "below" || ppcStatus === "above") return "text-status-warning";
        }
        const { ppcMin, ppcMax } = realBrainValues;
        if (ppcMin !== null && ppcMin < 50) return "text-status-critical";
        if (ppcMax !== null && ppcMax > 80) return "text-status-critical";
        return "text-status-warning";
      })(),
    },
  ];

  const isInRange = (value: number, min: number, max: number) => {
    return value >= min && value <= max;
  };

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
        currentPic: realBrainValues.pic,
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

  // Palette de couleurs distinctes pour différencier les indicateurs sur le graphique
  const CHART_COLORS = [
    "#3b82f6", // blue-500
    "#ef4444", // red-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#84cc16", // lime-500
    "#f97316", // orange-500
  ];

  // Attribuer une couleur unique à chaque indicateur sélectionné
  const getIndicatorColor = (label: string) => {
    const index = selectedIndicators.indexOf(label);
    if (index === -1) return "#9ca3af";
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optibrain" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px]">

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Métriques cérébrales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
              {brainMetrics.map((metric, index) => {
                const inRange = isInRange(metric.value, metric.targetMin, metric.targetMax);
                const valueColor = inRange ? "text-muted-foreground" : "text-status-critical";
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{metric.label}</div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`text-2xl sm:text-4xl font-bold ${valueColor}`}>{metric.value}</div>
                    </div>

                    <div className="w-full max-w-[180px]">
                        <div className="relative h-3 bg-muted rounded-full overflow-visible">
                          <div
                            className="absolute top-0 bottom-0 bg-muted-foreground/30 rounded-full"
                            style={{
                              left: `${((metric.targetMin - metric.min) / (metric.max - metric.min)) * 100}%`,
                              width: `${((metric.targetMax - metric.targetMin) / (metric.max - metric.min)) * 100}%`,
                            }}
                          ></div>
                          <div
                            className={`absolute w-3 h-3 rounded-full border-2 ${inRange ? "bg-muted-foreground border-muted-foreground" : "bg-status-critical border-status-critical"} z-10 top-0`}
                          style={{
                            left: `${Math.max(0, Math.min(100, ((metric.value - metric.min) / (metric.max - metric.min)) * 100))}%`,
                            transform: "translateX(-50%)",
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center mt-1.5 text-xs text-muted-foreground">
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

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setOptimisationExpanded(!optimisationExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 border-primary text-primary bg-primary/10 shrink-0">
                  <img
                    src={brainIcon}
                    alt="brain"
                    className="h-6 w-6 sm:h-8 sm:w-8"
                    style={{
                      filter: "invert(39%) sepia(95%) saturate(1095%) hue-rotate(196deg) brightness(97%) contrast(94%)",
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">Optimisation cérébrale actuelle</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {realBrainValues.pic !== null ? `PIC ${Math.round(realBrainValues.pic)} mmHg` : "PIC --"}
                    {optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null 
                      ? ` • ${isNirsBased ? "PAM" : "PPC"} optimale ${Math.round(optimalPPCResult.optimalPPC)} mmHg`
                      : realBrainValues.ppc !== null 
                        ? ` • PPC ${Math.round(realBrainValues.ppc)} mmHg`
                        : ""}
                    {optimalPPCResult.hasData && optimalPPCResult.lowerLimit !== null && optimalPPCResult.upperLimit !== null
                      ? ` (zone ${Math.round(optimalPPCResult.lowerLimit)}-${Math.round(optimalPPCResult.upperLimit)})`
                      : ""}
                  </p>
                </div>
              </div>
              {optimisationExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
              )}
            </div>
          </CardHeader>
          {optimisationExpanded && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-2 sm:gap-8 pt-4">
              {brainOptimisationMetrics.map((metric, index) => {
                  const statusColor = metric.status === "warning" ? "text-orange-500" : "text-gray-600";
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center cursor-pointer hover:bg-gray-50 p-2 sm:p-4 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        metric.hasDetails && setOpenDialog(metric.dialogKey || null);
                      }}
                    >
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1 sm:mb-2 uppercase tracking-wide text-center">
                        {metric.label}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-xl sm:text-4xl font-bold ${statusColor}`}>{metric.displayValue}</div>
                      </div>
                      {/* Dernière valeur critique */}
                      {metric.criticalLabel && (
                        <div className={`text-xs font-medium ${metric.criticalColor} mb-1`}>
                          {metric.criticalLabel}
                        </div>
                      )}
                      {metric.hasDetails && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
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
              <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
                {/* Individual Bars */}
                <div className="space-y-6">
                  {/* HTIC (sans ischémie ni hyperhémie) */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">HTIC</span>
                      <span className="text-xl font-semibold text-status-warning">
                        {neurologicalStateConfig.history.htic}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-status-warning h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.htic}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground">Sans ischémie ni hyperhémie</span>
                  </div>

                  {/* HTIC avec ischémie */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">HTIC avec ischémie</span>
                      <span className="text-xl font-semibold text-status-critical">
                        {neurologicalStateConfig.history.hticWithIschemia}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-status-critical h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.hticWithIschemia}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Contrôlé */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-foreground">Contrôlé</span>
                      <span className="text-xl font-semibold text-foreground">
                        {neurologicalStateConfig.history.controlled}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-muted-foreground h-3 rounded-full"
                        style={{ width: `${neurologicalStateConfig.history.controlled}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="border-t border-border mt-6 pt-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      État :{" "}
                      <span className={`font-semibold ${neurologicalStateConfig.currentStateColor}`}>
                        {neurologicalStateConfig.currentState}
                      </span>{" "}
                      <span className="text-muted-foreground">{neurologicalStateConfig.currentStateSince}</span>
                    </div>
                    <div>
                      PPC actuel : <span className="font-semibold text-foreground">65 mmHg</span>
                      <span className="mx-2">|</span>
                      PPC moyen : <span className="font-semibold text-foreground">68 mmHg</span>
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
              <div className="flex items-center justify-end">
                <TimeWindowSelector
                  value={picDialogTimeRange}
                  onChange={setPicDialogTimeRange}
                  includeStay={true}
                  label="Période :"
                />
              </div>

              {/* PIC Card */}
              <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-foreground">
                    <span className="text-status-warning">Répartition du temps</span> par niveau de PIC
                  </h3>
                  {picRangeData.totalMinutes > 0 && (
                    <span className="text-sm text-muted-foreground">Total: {picRangeData.totalMinutes} min</span>
                  )}
                </div>

                {/* Individual Bars */}
                <div className="space-y-6">
                  {picRangeData.ranges.map((range, idx) => {
                    const textColor =
                      range.color === "red"
                        ? "text-status-critical"
                        : range.color === "orange"
                          ? "text-status-warning"
                          : "text-muted-foreground";
                    const bgColor =
                      range.color === "red" ? "bg-status-critical" : range.color === "orange" ? "bg-status-warning" : "bg-muted-foreground";
                    return (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-foreground">{range.label}</span>
                          <span className={`text-xl font-semibold ${textColor}`}>{range.minutes} min</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
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
                <div className="border-t border-border mt-6 pt-4">
                  <div className="text-sm text-muted-foreground">
                    PIC actuelle :{" "}
                    <span className="font-semibold text-foreground">
                      {picRangeData.currentPic !== null ? `${Math.round(picRangeData.currentPic)} mmHg` : "-- mmHg"}
                    </span>
                    <span className="mx-2">|</span>
                    PIC moyenne :{" "}
                    <span className="font-semibold text-foreground">
                      {picRangeData.averagePic !== null ? `${Math.round(picRangeData.averagePic)} mmHg` : "-- mmHg"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* PPC/PAM Optimal Dialog - Courbe d'autorégulation */}
        <Dialog open={openDialog === "ppc"} onOpenChange={(open) => !open && setOpenDialog(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{isNirsBased ? "PAM Optimale (Autorégulation NIRS)" : "PPC Optimale (Autorégulation cérébrale)"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Time Range Selector - same UX as PIC dialog */}
              <div className="flex items-center justify-end">
                <TimeWindowSelector
                  value={timeRange === "stay" ? "24h" : timeRange as any}
                  onChange={(value) => setTimeRange(value as any)}
                  includeStay={false}
                  label="Période :"
                />
              </div>

              {/* Autoregulation Chart with integrated footer */}
              <AutoregulationChart 
                patientId={patientId} 
                currentPPC={realBrainValues.ppc}
                currentPAM={realBrainValues.pam}
                pamMin={realBrainValues.pamMin}
                pamMax={realBrainValues.pamMax}
                windowMinutes={30}
                timeRange={timeRange === "stay" ? "24h" : timeRange as any}
                onTimeRangeChange={(value) => setTimeRange(value as any)}
                optimalPPC={optimalPPCResult.optimalPPC}
                lowerLimit={optimalPPCResult.lowerLimit}
                upperLimit={optimalPPCResult.upperLimit}
                hasData={optimalPPCResult.hasData}
                isNirsBased={isNirsBased}
              />

              {/* Fallback info when no autoregulation data */}
              {!hasAutoregData && (
                <div className="text-sm text-muted-foreground text-center">
                  Données d'autorégulation non disponibles pour ce patient. 
                  Utilisation de la cible standard : <span className="font-medium">60-70 mmHg</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-card shadow-sm mb-6">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">
                Adhérence & Monitorage {timeRange === "stay" ? "sur le séjour" : `sur ${timeRange}`}
              </CardTitle>
              <TimeWindowSelector
                value={timeRange}
                onChange={(value) => setTimeRange(value as any)}
                includeStay={true}
                size="sm"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Monitoring Targets - Moved to top */}
            <Card className="border-2 border-border">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setChecklistExpanded(!checklistExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold border-4 shrink-0 ${
                        monitoringAdherence === null
                          ? "border-muted-foreground/30 text-muted-foreground bg-muted"
                          : monitoringAdherence >= 90
                            ? "border-muted-foreground text-muted-foreground bg-muted"
                            : monitoringAdherence >= 80
                              ? "border-status-warning text-status-warning bg-status-warning/10"
                              : "border-status-critical text-status-critical bg-status-critical/10"
                      }`}
                    >
                      {monitoringAdherence !== null ? `${monitoringAdherence}%` : "--"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-foreground">Monitorage et interventions en place</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {patientFileData
                          ? `${nonAdherentCount} non adhérent${nonAdherentCount > 1 ? "s" : ""}`
                          : "Pas de données disponibles"}
                      </p>
                    </div>
                  </div>
                  {checklistExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </div>
              </CardHeader>
              {checklistExpanded && (
                <CardContent className="pt-0 px-3 sm:px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 pt-4">
                    {monitoringTargets.map((target, index) => {
                      // Couleur basée sur le pourcentage d'adhérence: gris (≥90%), orange (80-89%), rouge (<80%)
                      const dotColor =
                        target.adherencePercentage === null
                          ? "bg-muted-foreground/30"
                          : target.adherencePercentage >= 90
                            ? "bg-muted-foreground"
                            : target.adherencePercentage >= 80
                              ? "bg-status-warning"
                              : "bg-status-critical";
                      const textColor =
                        target.adherencePercentage === null
                          ? "text-muted-foreground"
                          : target.adherencePercentage >= 90
                            ? "text-muted-foreground"
                            : target.adherencePercentage >= 80
                              ? "text-status-warning"
                              : "text-status-critical";
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-all"
                        >
                          <TooltipProvider delayDuration={200}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-3 h-3 rounded-full ${dotColor} cursor-help`}></div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-56">
                                {target.contextInfo ? (
                                  <div>
                                    <div className="font-semibold">{target.contextInfo}</div>
                                    {target.adherencePercentage !== null && (
                                      <div className="text-gray-400 mt-1">{target.adherencePercentage}% adhérence aux cibles</div>
                                    )}
                                  </div>
                                ) : target.adherencePercentage !== null ? (
                                  <div>
                                    <div className="font-semibold">{target.adherencePercentage}% adhérence</div>
                                    <div className="text-gray-400 mt-1">% du temps passé dans la cible recommandée</div>
                                  </div>
                                ) : (
                                  "Pas de données"
                                )}
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">{target.label}</p>
                            <p className="text-xs text-gray-500">{target.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            <Card className="border-2 border-border">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setClinicalExpanded(!clinicalExpanded)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold border-4 shrink-0 ${
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
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-700">Adhérence aux cibles recommandées</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {patientFileData ? `${outOfRangeCount} Indicateurs à surveiller` : "Pas de données disponibles"}
                      </p>
                    </div>
                  </div>
                  {clinicalExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                  )}
                </div>
              </CardHeader>
              {clinicalExpanded && (
                <CardContent className="pt-0 px-3 sm:px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const chartColor = isSelected ? getIndicatorColor(indicator.label) : null;
                      // Pastille de couleur d'adhérence: gris (≥90%), orange (80-89%), rouge (<80%)
                      const adherenceDotColor =
                        indicator.adherencePercentage === null
                          ? "bg-muted-foreground/30"
                          : indicator.adherencePercentage >= 90
                            ? "bg-muted-foreground"
                            : indicator.adherencePercentage >= 80
                              ? "bg-status-warning"
                              : "bg-status-critical";
                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all border-2 ${
                            isSelected 
                              ? "bg-card shadow-sm" 
                              : "border-transparent hover:bg-muted/50"
                          }`}
                          style={isSelected ? { borderColor: chartColor || undefined } : undefined}
                          onClick={() => {
                            setSelectedIndicators((prev) =>
                              prev.includes(indicator.label)
                                ? prev.filter((label) => label !== indicator.label)
                                : [...prev, indicator.label],
                            );
                            // Scroll vers le graphique
                            setTimeout(() => {
                              chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }}
                        >
                          <TooltipProvider delayDuration={200}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div className={`w-3 h-3 rounded-full mt-1 ${adherenceDotColor} cursor-help`}></div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-48">
                                {indicator.adherencePercentage !== null 
                                  ? (
                                    <div>
                                      <div className="font-semibold">{indicator.adherencePercentage}% adhérence</div>
                                      <div className="text-muted-foreground mt-1">% du temps passé dans la cible recommandée</div>
                                    </div>
                                  )
                                  : "Pas de données"
                                }
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{indicator.label}</p>
                            <p className="text-xs text-muted-foreground">{indicator.target}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Cliquez sur un indicateur pour l'afficher dans le graphique
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Monitoring Chart */}
            <Card ref={chartRef} className="border-2 border-border">
              <CardHeader className="px-3 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <CardTitle className="text-sm sm:text-lg">
                      {timeRange === "stay" ? "Monitorage (Séjour)" : `Monitorage (${timeRange.toUpperCase()})`}
                    </CardTitle>
                    <label className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTargetZones}
                        onChange={(e) => setShowTargetZones(e.target.checked)}
                        className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="hidden sm:inline">Zones cibles</span>
                      <span className="sm:hidden">Cibles</span>
                    </label>
                  </div>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 self-start sm:self-auto">
                    {fileDataLoading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="hidden sm:inline">Chargement...</span>
                      </span>
                    ) : (
                      getTimeRangeDisplayLabel(timeRange)
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div
                  className={`border-2 border-border rounded-lg p-2 sm:p-4 ${
                    selectedIndicators.length === 0 ? "h-24 sm:h-32" : "h-[250px] sm:h-[300px]"
                  }`}
                >
                  {selectedIndicators.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-xs sm:text-base text-center px-2">
                        Sélectionnez des indicateurs ci-dessus pour afficher leurs tendances
                      </p>
                    </div>
                  ) : (
                    <div className="h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          {/* Zones cibles en arrière-plan */}
                          {showTargetZones && selectedIndicators.map((label) => {
                            const indicator = clinicalIndicators.find((i) => i.label === label);
                            if (!indicator) return null;
                            const target = parseTargetRange(indicator.target);
                            if (target.min === -Infinity && target.max === Infinity) return null;
                            const color = getIndicatorColor(label);
                            const yMin = target.min === -Infinity ? 0 : target.min;
                            const yMax = target.max === Infinity ? target.min * 2 : target.max;
                            return (
                              <ReferenceArea
                                key={`zone-${label}`}
                                y1={yMin}
                                y2={yMax}
                                fill={color}
                                fillOpacity={0.08}
                                stroke={color}
                                strokeOpacity={0.3}
                                strokeDasharray="4 2"
                              />
                            );
                          })}
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(255, 255, 255, 0.98)",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              fontSize: "12px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              padding: "12px",
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: 8 }}
                            formatter={(value: number, name: string) => {
                              const color = getIndicatorColor(name);
                              const indicator = clinicalIndicators.find((i) => i.label === name);
                              const unit = indicator?.target.match(/[a-zA-Z°%/]+$/)?.[0] || "";
                              return [
                                <span key={name} style={{ color, fontWeight: 600 }}>
                                  {name}: {value.toFixed(1)} {unit}
                                </span>,
                                null
                              ];
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                            iconType="plainline"
                            formatter={(value: string) => (
                              <span style={{ color: getIndicatorColor(value), fontWeight: 500 }}>
                                {value}
                              </span>
                            )}
                          />
                          {selectedIndicators.map((label, idx) => {
                            const isSparse = sparseIndicators.has(label);
                            const color = getIndicatorColor(label);
                            const showDots = timeRange === "3h";
                            return (
                              <Line
                                key={label}
                                type="monotone"
                                dataKey={label}
                                stroke={color}
                                strokeWidth={isSparse ? 0 : 2.5}
                                strokeDasharray={idx > 0 && !isSparse ? (idx % 2 === 1 ? "8 4" : undefined) : undefined}
                                dot={
                                  isSparse
                                    ? {
                                        r: 7,
                                        fill: color,
                                        stroke: "#fff",
                                        strokeWidth: 2,
                                      }
                                    : showDots 
                                      ? { r: 2, fill: color }
                                      : false
                                }
                                activeDot={{
                                  r: isSparse ? 10 : 6,
                                  stroke: "#fff",
                                  strokeWidth: 2,
                                  fill: color,
                                }}
                                connectNulls={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
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
