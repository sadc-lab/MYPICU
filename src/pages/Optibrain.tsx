import { useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { PatientHeader } from "@/components/PatientHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatient } from '@/hooks/usePatients';
import { toast } from "sonner";

import {
  Info,
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Brain,
  Activity,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from "recharts";

import { KpiCircle } from "@/components/KpiCircle";
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
  computeNeurologicalState,
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
import { UnifiedBrainChart } from "@/components/UnifiedBrainChart";
import { TimeWindowSelector, TimeWindowValue } from "@/components/ui/TimeWindowSelector";
import { DataLoadingOverlay } from "@/components/DataLoadingOverlay";
import { MetricRangeBar } from "@/components/MetricRangeBar";
import { VitalSignsPanel } from "@/components/VitalSignsPanel";
import { CollapsibleModuleCard, CountCircle, StatusIconCircle } from "@/components/CollapsibleModuleCard";
import { SelectableMetricTile, TileStatus } from "@/components/SelectableMetricTile";


const Optibrain = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient") || "#25";
  const metricParam = searchParams.get("metric");
  const { data: patient, isLoading: patientLoading } = usePatient(patientId);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [clinicalExpanded, setClinicalExpanded] = useState(!!metricParam);
  const [optimisationExpanded, setOptimisationExpanded] = useState(true);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(metricParam ? [metricParam] : []);
  // Track whether the auto-selection of problematic indicators has already
  // run, so the user can later deselect them without us re-adding them.
  const clinicalAutoSelectedRef = useRef(false);
  const brainAutoSelectedRef = useRef(false);
  const { timeRange, setTimeRange, getTimeRangeLabel, timeRanges } = useTimeRange();
  // Objectives and interventions are now handled by ObjectivesInterventionsCard component
  const [picDialogTimeRange, setPicDialogTimeRange] = useState<TimeWindowValue>("24h");
  const [selectedBrainIndicators, setSelectedBrainIndicators] = useState<string[]>([]);
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
      case "24h":
        return 24;
      case "stay":
        return 96;
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

  const showPatientNotFound = !patient && !patientLoading;


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

  // Dynamic neurological state computed from real PIC + PPC data
  const neurologicalStateConfig = useMemo(() => {
    if (!patientFileData) {
      return {
        currentState: "Contrôlé",
        currentStateColor: "text-muted-foreground",
        currentStateSince: null as string | null,
        history: {
          hyperemia: 0,
          hticWithIschemia: 0,
          htic: 0,
          ischemia: 0,
          controlled: 100,
        },
        hasData: false,
      };
    }

    const result = computeNeurologicalState(patientFileData, hoursForAdherence);

    // Map state to color
    const stateColors: Record<string, string> = {
      controlled: "text-muted-foreground",
      htic: "text-status-warning",
      htic_ischemia: "text-status-critical",
      ischemia: "text-status-critical",
      hyperemia: "text-status-warning",
    };

    return {
      currentState: result.currentStateLabel,
      currentStateColor: stateColors[result.currentState] || "text-muted-foreground",
      currentStateSince: result.currentStateSince,
      history: result.history,
      hasData: result.hasData,
    };
  }, [patientFileData, hoursForAdherence]);

  // Calculate time spent in each PIC range from real data
  const picRangeData = useMemo(() => {
    const getHoursForPicDialog = (range: string): number => {
      switch (range) {
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

    const picTimeSeries = getTimeSeriesForRange(patientFileData, "Variable_PIC", hoursBack, 1);

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

    const MIN_VALID_PIC = 5;
    const validData = picTimeSeries.filter((d) => d.valeur >= MIN_VALID_PIC);

    const counts = { below20: 0, range20_25: 0, range25_30: 0, above30: 0 };
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
        { label: "25 - 30 mmHg", minutes: counts.range25_30, percentage: total > 0 ? Math.round((counts.range25_30 / total) * 100) : 0, color: "orange", status: "warning" },
        { label: "20 - 25 mmHg", minutes: counts.range20_25, percentage: total > 0 ? Math.round((counts.range20_25 / total) * 100) : 0, color: "orange", status: "warning" },
        { label: "> 30 mmHg", minutes: counts.above30, percentage: total > 0 ? Math.round((counts.above30 / total) * 100) : 0, color: "red", status: "critical" },
        { label: "< 20 mmHg", minutes: counts.below20, percentage: total > 0 ? Math.round((counts.below20 / total) * 100) : 0, color: "gray", status: "normal" },
      ],
      currentPic: realBrainValues.pic,
      averagePic,
      totalMinutes: total,
    };
  }, [patientFileData, realBrainValues.pic, picDialogTimeRange]);

  const brainOptimisationMetrics = [
    (() => {
      // Conversion % → durée pour le sous-titre HTIC / HTIC+Ischémie
      const totalMinutes = Math.round(hoursForAdherence * 60);
      const formatDuration = (mins: number): string => {
        if (mins <= 0) return "0 min";
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
      };
      const hticIschPct = neurologicalStateConfig.history.hticWithIschemia;
      const hticPct = neurologicalStateConfig.history.htic;

      // Top label = état problématique ; bottom (grand rouge) = durée + %
      const problemState = hticIschPct > 0
        ? { name: "HTIC + Ischémie", pct: hticIschPct }
        : hticPct > 0
          ? { name: "HTIC", pct: hticPct }
          : null;

      const topLabel = problemState ? problemState.name : neurologicalStateConfig.currentState;
      const bigValue = problemState
        ? `${formatDuration(Math.round((problemState.pct / 100) * totalMinutes))} (${problemState.pct}%)`
        : neurologicalStateConfig.currentState;

      return {
        label: "État neurologique",
        value: bigValue,
        displayValue: bigValue,
        unit: "",
        status: neurologicalStateConfig.currentState === "Contrôlé" ? "normal" : "critical",
        hasDetails: true,
        dialogKey: "neuro",
        topLabel,
        criticalColor: hticIschPct > 0 ? "text-status-critical" : "text-status-warning",
        metricKey: "neuro",
      };
    })(),
    (() => {
      // Indicateur d'intensité de PIC = % du temps passé au-dessus de la cible (> 20 mmHg) sur la fenêtre
      const above20 = picRangeData.ranges
        .filter((r) => r.label !== "< 20 mmHg")
        .reduce((acc, r) => acc + (r.percentage || 0), 0);
      const above25 = picRangeData.ranges
        .filter((r) => r.label === "25 - 30 mmHg" || r.label === "> 30 mmHg")
        .reduce((acc, r) => acc + (r.percentage || 0), 0);
      const intensityStatus: "normal" | "warning" | "critical" =
        above25 >= 5 || above20 >= 25 ? "critical" : above20 >= 5 ? "warning" : "normal";

      // Conversion en durée concrète (sur la fenêtre observée)
      const totalMinutes = Math.round(hoursForAdherence * 60);
      const minutesAbove20 = Math.round((above20 / 100) * totalMinutes);
      const formatDuration = (mins: number): string => {
        if (mins <= 0) return "0 min";
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
      };
      const durationLabel = formatDuration(minutesAbove20);

      // Top = valeur PIC actuelle ; bottom (grand rouge) = durée > 20 mmHg
      const topLabel = picValue !== null
        ? `PIC ${Math.round(picValue * 10) / 10} mmHg`
        : "PIC --";
      const bigValue = above20 > 0
        ? `${durationLabel} > 20 mmHg`
        : "Dans la cible";

      return {
        label: "PIC",
        value: bigValue,
        displayValue: bigValue,
        unit: "",
        status: intensityStatus,
        hasDetails: true,
        dialogKey: "pic",
        topLabel,
        criticalColor: intensityStatus === "critical" ? "text-status-critical" : "text-status-warning",
        metricKey: "pic",
      };
    })(),
    {
      label: "PPC",
      value: realBrainValues.ppc !== null ? Math.round(realBrainValues.ppc) : "--",
      displayValue: realBrainValues.ppc !== null ? Math.round(realBrainValues.ppc).toString() : "--",
      unit: "mmHg",
      status: getPpcStatus(realBrainValues.ppc) as TileStatus,
      hasDetails: false,
      topLabel: realBrainValues.ppc !== null ? `PPC ${Math.round(realBrainValues.ppc)} mmHg` : "PPC --",
      metricKey: "ppc",
    },
    {
      label: "Glasgow (GCS)",
      value: patient?.gcs ?? "--",
      displayValue: patient?.gcs ?? "--",
      unit: "",
      status: (() => {
        const gcs = patient?.gcs;
        if (gcs === undefined || gcs === null) return "normal";
        if (gcs >= 13) return "normal";
        if (gcs >= 9) return "warning";
        return "critical";
      })() as TileStatus,
      hasDetails: false,
      metricKey: "glasgow",
    },
    {
      label: "PaCO2",
      value: realBrainValues.paco2 !== null ? Math.round(realBrainValues.paco2) : "--",
      displayValue: realBrainValues.paco2 !== null ? Math.round(realBrainValues.paco2).toString() : "--",
      unit: "mmHg",
      status: (() => {
        const v = realBrainValues.paco2;
        if (v === null) return "normal";
        if (v >= 35 && v <= 45) return "normal";
        if ((v >= 30 && v < 35) || (v > 45 && v <= 50)) return "warning";
        return "critical";
      })() as TileStatus,
      hasDetails: false,
      metricKey: "paco2",
    },
    {
      label: "Autorégulation",
      value: optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null 
        ? `${Math.round(optimalPPCResult.optimalPPC)}` 
        : "--",
      displayValue: optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null 
        ? `${Math.round(optimalPPCResult.optimalPPC)}` 
        : "--",
      unit: isNirsBased ? "PAM Opt" : "PPC Opt",
      status: (() => {
        if (!optimalPPCResult.hasData || optimalPPCResult.prxScore === null) return "normal";
        if (optimalPPCResult.prxScore >= 0.5) return "critical";
        if (optimalPPCResult.prxScore >= 0.3) return "warning";
        return "normal";
      })(),
      hasDetails: true,
      dialogKey: "autoregulation",
      description: optimalPPCResult.hasData && optimalPPCResult.lowerLimit !== null && optimalPPCResult.upperLimit !== null
        ? `Zone: ${Math.round(optimalPPCResult.lowerLimit)}-${Math.round(optimalPPCResult.upperLimit)} mmHg`
        : isNirsBased ? "PAM optimale individuelle" : "PPC optimale individuelle",
      criticalLabel: optimalPPCResult.hasData && optimalPPCResult.prxScore !== null
        ? optimalPPCResult.prxScore < 0.3 
          ? "Autorégulation intacte" 
          : optimalPPCResult.prxScore < 0.5 
            ? "Autorégulation altérée" 
            : "Autorégulation absente"
        : null,
      criticalColor: optimalPPCResult.hasData && optimalPPCResult.prxScore !== null
        ? optimalPPCResult.prxScore < 0.3 
          ? "text-status-normal" 
          : optimalPPCResult.prxScore < 0.5 
            ? "text-status-warning" 
            : "text-status-critical"
        : "text-muted-foreground",
    },
  ];

  // Auto-select all problematic clinical indicators by default (once data arrives)
  useEffect(() => {
    if (clinicalAutoSelectedRef.current) return;
    if (!patientFileData) return;
    const problematic = clinicalIndicators
      .filter((i) => i.status === "warning" || i.status === "critical")
      .map((i) => i.label);
    if (problematic.length === 0) return;
    clinicalAutoSelectedRef.current = true;
    setSelectedIndicators((prev) => {
      const merged = Array.from(new Set([...prev, ...problematic]));
      return merged.slice(0, 3);
    });
  }, [patientFileData, clinicalIndicators]);

  // Auto-select all problematic brain optimisation metrics by default
  useEffect(() => {
    if (brainAutoSelectedRef.current) return;
    if (!patientFileData) return;
    const problematic = brainOptimisationMetrics
      .filter((m) => m.hasDetails && (m.status === "warning" || m.status === "critical"))
      .map((m) => m.label);
    if (problematic.length === 0) return;
    brainAutoSelectedRef.current = true;
    setSelectedBrainIndicators((prev) => {
      const merged = new Set([...prev, ...problematic]);
      return Array.from(merged);
    });
  }, [patientFileData, brainOptimisationMetrics]);


  // Calculate clinical adherence (average of indicators with real data only)
  const clinicalAdherence = useMemo(() => {
    const indicatorsWithData = clinicalIndicators.filter((i) => i.adherencePercentage !== null);
    if (indicatorsWithData.length === 0) return null;
    const totalPercentage = indicatorsWithData.reduce((sum, i) => sum + (i.adherencePercentage ?? 0), 0);
    return Math.round(totalPercentage / indicatorsWithData.length);
  }, [clinicalIndicators]);

  const outOfRangeCount = clinicalIndicators.filter((i) => i.status !== null && i.status !== "normal").length;

  // (picRangeData a été déplacé plus haut pour être consommé par brainOptimisationMetrics)

  // Map time range to hours
  const getHoursFromTimeRange = (range: string): number => {
    switch (range) {
      case "24h":
        return 24;
      case "stay":
        return 96;
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

  // Palette UX optimisée : couleurs distinctes, accessibles (WCAG), harmonieuses
  // Évite le rouge pur (réservé aux alertes critiques) et le vert (réservé au statut normal)
  const CHART_COLORS = [
    "#2563eb", // blue-600 — primaire, très lisible
    "#9333ea", // purple-600 — fort contraste avec le bleu
    "#0891b2", // cyan-600 — frais, distinct
    "#db2777", // pink-600 — accent chaud
    "#7c3aed", // violet-600
    "#0d9488", // teal-600
  ];

  // Attribuer une couleur unique à chaque indicateur sélectionné
  const getIndicatorColor = (label: string) => {
    const index = selectedIndicators.indexOf(label);
    if (index === -1) return "#9ca3af";
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  if (patientLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8 space-y-4">
          <DataLoadingOverlay isLoading={true} label="Chargement du patient..." variant="skeleton">
            <div />
          </DataLoadingOverlay>
        </div>
      </div>
    );
  }

  if (showPatientNotFound) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p className="text-foreground">Patient non trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optibrain" />

      <main className="container mx-auto px-4 sm:px-6 pb-8 max-w-[1600px] space-y-6">
        <VitalSignsPanel />

        {(() => {
          const brainProblemCount = brainOptimisationMetrics.filter(
            (m) => m.status === "critical" || m.status === "warning"
          ).length;
          const brainHasCritical = brainOptimisationMetrics.some((m) => m.status === "critical");
          return (
            <CollapsibleModuleCard
              expanded={optimisationExpanded}
              onToggle={() => setOptimisationExpanded((p) => !p)}
              headerIcon={
                <StatusIconCircle status={brainHasCritical ? "critical" : brainProblemCount > 0 ? "warning" : "normal"}>
                  <img
                    src={brainIcon}
                    alt="cerveau"
                    className="h-6 w-6 sm:h-8 sm:w-8"
                    style={{
                      filter:
                        'invert(60%) sepia(80%) saturate(600%) hue-rotate(0deg) brightness(95%) contrast(90%)',
                    }}
                  />
                </StatusIconCircle>
              }
              title="Optimisation cérébrale actuelle"
              subtitle={(() => {
                const ppcLabel = isNirsBased ? "PAM" : "PPC";
                const picStr = realBrainValues.pic !== null ? `PIC ${Math.round(realBrainValues.pic)}` : "PIC --";
                const optStr = optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null
                  ? `${ppcLabel}opt ${Math.round(optimalPPCResult.optimalPPC)}`
                  : realBrainValues.ppc !== null
                    ? `PPC ${Math.round(realBrainValues.ppc)}`
                    : null;
                const compact = [picStr, optStr].filter(Boolean).join(" • ");

                const fullParts: string[] = [];
                if (realBrainValues.pic !== null) fullParts.push(`PIC ${Math.round(realBrainValues.pic)} mmHg`);
                if (optimalPPCResult.hasData && optimalPPCResult.optimalPPC !== null) {
                  fullParts.push(`${ppcLabel} optimale ${Math.round(optimalPPCResult.optimalPPC)} mmHg`);
                } else if (realBrainValues.ppc !== null) {
                  fullParts.push(`PPC ${Math.round(realBrainValues.ppc)} mmHg`);
                }
                if (realBrainValues.pam !== null && realBrainValues.pam !== undefined) {
                  fullParts.push(`PAM ${Math.round(realBrainValues.pam)} mmHg`);
                }
                const zoneLine = optimalPPCResult.hasData && optimalPPCResult.lowerLimit !== null && optimalPPCResult.upperLimit !== null
                  ? `Zone d'autorégulation : ${Math.round(optimalPPCResult.lowerLimit)}–${Math.round(optimalPPCResult.upperLimit)} mmHg`
                  : null;

                return (
                  <TooltipProvider delayDuration={150}>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate cursor-help">{compact || "—"}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="p-2.5 max-w-[320px]">
                        <div className="text-xs font-semibold text-foreground mb-1.5">Optimisation cérébrale</div>
                        <div className="flex flex-col gap-1 text-xs">
                          {fullParts.map((p) => (
                            <div key={p} className="text-foreground tabular-nums">{p}</div>
                          ))}
                          {zoneLine && (
                            <div className="text-muted-foreground mt-1 pt-1 border-t border-border/50 tabular-nums">{zoneLine}</div>
                          )}
                          {!fullParts.length && (
                            <div className="text-muted-foreground">Aucune donnée disponible</div>
                          )}
                        </div>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                );
              })()}
              contentClassName="pt-0 px-4 sm:px-6 pb-4 space-y-5"
            >

              {/* Alert if no autoregulation data available yet */}
              {!optimalPPCResult.hasData && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 mt-4">
                  <AlertCircle className="h-5 w-5 text-status-warning shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Données d'autorégulation en cours de calcul</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Les résultats d'optimisation cérébrale seront disponibles après environ 30 minutes de monitorage continu.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Selectable Brain Metrics */}
              <div className="grid grid-cols-3 gap-2 sm:gap-6 pt-4">
                {brainOptimisationMetrics.map((metric) => {
                  const topLabel = (metric as any).topLabel as string | undefined;
                  const criticalLabel =
                    (metric as any).criticalLabel ||
                    (topLabel && topLabel !== metric.displayValue ? topLabel : undefined);
                  return (
                    <SelectableMetricTile
                      key={metric.label}
                      label={metric.label}
                      displayValue={metric.displayValue}
                      unit={metric.unit}
                      status={(metric.status as TileStatus) || 'normal'}
                      criticalLabel={criticalLabel}
                      criticalColor={(metric as any).criticalColor || 'text-muted-foreground'}
                      isSelected={selectedBrainIndicators.includes(metric.label)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (metric.hasDetails) {
                          setSelectedBrainIndicators((prev) =>
                            prev.includes(metric.label)
                              ? prev.filter((l) => l !== metric.label)
                              : [...prev, metric.label]
                          );
                        }
                      }}
                    />
                  );
                })}
              </div>

              {/* Embedded Charts */}
              {selectedBrainIndicators.length > 0 && (
                <div className="border-t border-border pt-4 space-y-4">
                  <div className="text-sm font-semibold text-foreground">
                    {selectedBrainIndicators.includes("Autorégulation") 
                      ? "Courbe d'autorégulation" 
                      : "Évolution temporelle"}
                  </div>
                  
                  {/* Show AutoregulationChart when Autorégulation is selected */}
                  {selectedBrainIndicators.includes("Autorégulation") && (
                    <AutoregulationChart
                      patientId={patientId}
                      currentPPC={realBrainValues.ppc}
                      currentPAM={realBrainValues.pam}
                      pamMin={realBrainValues.pamMin}
                      pamMax={realBrainValues.pamMax}
                      timeRange={picDialogTimeRange}
                      onTimeRangeChange={setPicDialogTimeRange}
                      optimalPPC={optimalPPCResult.optimalPPC}
                      lowerLimit={optimalPPCResult.lowerLimit}
                      upperLimit={optimalPPCResult.upperLimit}
                      hasData={optimalPPCResult.hasData}
                      isNirsBased={isNirsBased}
                    />
                  )}
                  
                  {/* Show UnifiedBrainChart for other indicators */}
                  {selectedBrainIndicators.some(i => i !== "Autorégulation") && (
                    <UnifiedBrainChart
                      patientId={patientId}
                      timeRange={picDialogTimeRange}
                      currentPIC={realBrainValues.pic}
                      currentPAM={realBrainValues.pam}
                      optimalPAM={optimalPPCResult.optimalPPC}
                      lowerLimit={optimalPPCResult.lowerLimit}
                      upperLimit={optimalPPCResult.upperLimit}
                      autoregulationScore={optimalPPCResult.prxScore}
                      isNirsBased={isNirsBased}
                      selectedIndicators={selectedBrainIndicators.filter(i => i !== "Autorégulation")}
                    />
                  )}

                  {/* Distribution bars under the chart, based on selected indicators */}
                  {neurologicalStateConfig.hasData && (() => {
                    const formatDur = (mins: number) =>
                      mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60).toString().padStart(2, '0') : ''}` : `${mins} min`;
                    const totalMinutes = Math.round(hoursForAdherence * 60);

                    const neuroSegments = [
                      { key: 'controlled', label: 'Contrôlé', pct: neurologicalStateConfig.history.controlled, colorClass: 'bg-status-normal' },
                      { key: 'ischemia', label: 'Ischémie', pct: neurologicalStateConfig.history.ischemia, colorClass: 'bg-status-warning' },
                      { key: 'hyperemia', label: 'Hypérémie', pct: neurologicalStateConfig.history.hyperemia, colorClass: 'bg-amber-400' },
                      { key: 'htic', label: 'HTIC', pct: neurologicalStateConfig.history.htic, colorClass: 'bg-status-warning' },
                      { key: 'htic_ischemia', label: 'HTIC+Isch.', pct: neurologicalStateConfig.history.hticWithIschemia, colorClass: 'bg-status-critical' },
                    ].filter(s => s.pct > 0);

                    const picSegments = [
                      { key: 'below20', label: '< 20 mmHg', pct: picRangeData.ranges.find(r => r.label === '< 20 mmHg')?.percentage || 0, minutes: picRangeData.ranges.find(r => r.label === '< 20 mmHg')?.minutes || 0, colorClass: 'bg-status-normal' },
                      { key: 'range20_25', label: '20–25 mmHg', pct: picRangeData.ranges.find(r => r.label === '20 - 25 mmHg')?.percentage || 0, minutes: picRangeData.ranges.find(r => r.label === '20 - 25 mmHg')?.minutes || 0, colorClass: 'bg-status-warning' },
                      { key: 'range25_30', label: '25–30 mmHg', pct: picRangeData.ranges.find(r => r.label === '25 - 30 mmHg')?.percentage || 0, minutes: picRangeData.ranges.find(r => r.label === '25 - 30 mmHg')?.minutes || 0, colorClass: 'bg-status-critical/80' },
                      { key: 'above30', label: '> 30 mmHg', pct: picRangeData.ranges.find(r => r.label === '> 30 mmHg')?.percentage || 0, minutes: picRangeData.ranges.find(r => r.label === '> 30 mmHg')?.minutes || 0, colorClass: 'bg-status-critical' },
                    ].filter(s => s.pct > 0);

                    const showNeuro = selectedBrainIndicators.includes("État actuel");
                    const showPic = selectedBrainIndicators.includes("PIC");

                    if (!showNeuro && !showPic) return null;

                    const renderBar = (title: string, segments: Array<{key: string; label: string; pct: number; minutes?: number; colorClass: string}>) => (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{title}</span>
                          <span className="text-[10px] text-muted-foreground">Répartition temporelle</span>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                          {segments.map(s => (
                            <div key={s.key} className={s.colorClass} style={{ width: `${s.pct}%` }} title={`${s.label} : ${s.pct}%`} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                          {segments.map(s => {
                            const mins = s.minutes ?? Math.round(totalMinutes * s.pct / 100);
                            return (
                              <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
                                <span className={`w-2 h-2 rounded-full ${s.colorClass} shrink-0`} />
                                <span className="text-muted-foreground">{s.label}</span>
                                <span className="font-medium tabular-nums text-foreground">{s.pct}%</span>
                                <span className="text-muted-foreground tabular-nums">({formatDur(mins)})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );

                    return (
                      <div className="space-y-3 pt-2 border-t border-border">
                        {showNeuro && neuroSegments.length > 0 && renderBar("État neurologique", neuroSegments)}
                        {showPic && picSegments.length > 0 && renderBar("PIC", picSegments)}
                      </div>
                    );
                  })()}
                </div>
              )}
            </CollapsibleModuleCard>
          );
        })()}


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
            <CollapsibleModuleCard
              variant="nested"
              expanded={checklistExpanded}
              onToggle={() => setChecklistExpanded(!checklistExpanded)}
              headerIcon={
                <KpiCircle
                  count={monitoringAdherence !== null ? nonAdherentCount : 0}
                  hasCritical={monitoringAdherence !== null && nonAdherentCount >= 3}
                  groupLabel="Monitorage et interventions"
                  itemLabel="indicateur"
                />
              }
              title="Monitorage et interventions en place"
              subtitle={
                patientFileData
                  ? (() => {
                      const abnormal = monitoringTargets.filter(
                        (t) => t.status !== null && t.status !== "normal"
                      );
                      if (abnormal.length > 0) {
                        return (
                          <span className="text-xs text-muted-foreground truncate">
                            {abnormal.map((t, idx) => (
                              <span key={t.label}>
                                <span className={t.status === "critical" ? "text-status-critical font-semibold" : "text-status-warning font-semibold"}>
                                  {t.label}
                                </span>
                                {idx < abnormal.length - 1 ? " • " : ""}
                              </span>
                            ))}
                            {monitoringAdherence !== null ? ` · ${monitoringAdherence}% d'adhérence` : ""}
                          </span>
                        );
                      }
                      return `Tous les paramètres adhérents${monitoringAdherence !== null ? ` · ${monitoringAdherence}% d'adhérence` : ""}`;
                    })()
                  : "Pas de données disponibles"
              }
              contentClassName="pt-0 px-3 sm:px-6 pb-4"
            >

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
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-all"
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
                                      <div className="text-muted-foreground mt-1">{target.adherencePercentage}% adhérence aux cibles</div>
                                    )}
                                  </div>
                                ) : target.adherencePercentage !== null ? (
                                  <div>
                                    <div className="font-semibold">{target.adherencePercentage}% adhérence</div>
                                    <div className="text-muted-foreground mt-1">% du temps passé dans la cible recommandée</div>
                                  </div>
                                ) : (
                                  "Pas de données"
                                )}
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{target.label}</p>
                            <p className="text-xs text-muted-foreground">{target.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            </CollapsibleModuleCard>


            <CollapsibleModuleCard
              variant="nested"
              expanded={clinicalExpanded}
              onToggle={() => setClinicalExpanded(!clinicalExpanded)}
              headerIcon={
                <KpiCircle
                  count={clinicalAdherence !== null ? outOfRangeCount : 0}
                  hasCritical={clinicalAdherence !== null && outOfRangeCount >= 3}
                  groupLabel="Adhérence aux cibles"
                  itemLabel="indicateur"
                />
              }
              title="Adhérence aux cibles recommandées"
              subtitle={
                patientFileData
                  ? (() => {
                      const abnormal = clinicalIndicators.filter(
                        (i) => i.status !== null && i.status !== "normal"
                      );
                      if (abnormal.length > 0) {
                        return (
                          <span className="text-xs text-muted-foreground truncate">
                            {abnormal.map((i, idx) => (
                              <span key={i.label}>
                                <span className={i.status === "critical" ? "text-status-critical font-semibold" : "text-status-warning font-semibold"}>
                                  {i.label}
                                </span>
                                {idx < abnormal.length - 1 ? " • " : ""}
                              </span>
                            ))}
                            {clinicalAdherence !== null ? ` · ${clinicalAdherence}% d'adhérence` : ""}
                          </span>
                        );
                      }
                      return `Tous les indicateurs dans la cible${clinicalAdherence !== null ? ` · ${clinicalAdherence}% d'adhérence` : ""}`;
                    })()
                  : "Pas de données disponibles"
              }
              contentClassName="pt-0 px-3 sm:px-6 pb-4"
            >

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4 pt-4">
                    {clinicalIndicators.map((indicator, index) => {
                      const isSelected = selectedIndicators.includes(indicator.label);
                      const chartColor = isSelected ? getIndicatorColor(indicator.label) : null;
                      // Pastille de couleur d'adhérence: vert doux (≥90%), orange (80-89%), rouge (<80%), gris (sans données)
                      const adherenceDotColor =
                        indicator.adherencePercentage === null
                          ? "bg-status-inactive/40"
                          : indicator.adherencePercentage >= 90
                            ? "bg-status-normal"
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
                            setSelectedIndicators((prev) => {
                              if (prev.includes(indicator.label)) {
                                return prev.filter((label) => label !== indicator.label);
                              }
                              if (prev.length >= 3) {
                                toast.warning("Maximum 3 indicateurs", {
                                  description: "Désélectionnez un indicateur pour en ajouter un nouveau.",
                                });
                                return prev;
                              }
                              return [...prev, indicator.label];
                            });
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
            </CollapsibleModuleCard>


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
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 self-start sm:self-auto">
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
                        Sélectionnez des indicateurs ci-dessus pour afficher leur évolution
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
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            stroke="hsl(var(--muted-foreground))"
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            stroke="hsl(var(--muted-foreground))"
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              padding: "12px",
                              color: "hsl(var(--popover-foreground))",
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
                            const showDots = false;
                            return (
                              <Line
                                key={label}
                                type="monotone"
                                dataKey={label}
                                stroke={color}
                                strokeWidth={isSparse ? 0 : 2.5}
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
