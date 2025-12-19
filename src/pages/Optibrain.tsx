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

// ===== Déclaration UNIQUE de Optibrain - SUPPRIMEZ l'autre =====
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

  // ===== Fonctions utilitaires (placez-les ici, à l'intérieur du composant) =====

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
  const getChartDataForAdherence = (
    data: PatientFileData,
    variableKey: string,
    hoursBack: number,
  ): { values: number[]; timestamps: Date[]; count: number } => {
    if (!data || !data[variableKey]) {
      return { values: [], timestamps: [], count: 0 };
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    // Obtenir les données brutes exactement comme pour le graphique
    const rawData = data[variableKey]
      .filter((point) => {
        const pointTime = new Date(point.charttime);
        return pointTime >= startTime && pointTime <= now;
      })
      .sort((a, b) => new Date(a.charttime).getTime() - new Date(b.charttime).getTime());

    return {
      values: rawData.map((d) => d.valeur),
      timestamps: rawData.map((d) => new Date(d.charttime)),
      count: rawData.length,
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

  // ===== Le reste de votre code existant continue ici =====

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

  // ===== ÉTAPE 2 : Remplacer monitoringTargets avec la nouvelle logique =====
  const monitoringTargets = useMemo(() => {
    const defaultIndicators = [
      { label: "Opioide", description: "En cours", target: "normal" },
      { label: "Hypnotique", description: "En cours", target: "normal" },
      { label: "Propofol 48h", description: "<48h", target: "normal" },
      { label: "Anti-Epileptique", description: "Monitorée", target: "normal" },
      { label: "PIC", description: "Monitorée", target: "< 20mmHg" },
      { label: "PAM", description: "Monitorée", target: "normal" },
      { label: "PVC", description: "Monitorée", target: "normal" },
      { label: "ETCO2", description: "Monitorée", target: "normal" },
      { label: "Température", description: "Monitorée", target: "35-38°C" },
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
  }, [patientFileData, hoursForAdherence]); // ===== CORRECTION : Une seule déclaration pour clinicalIndicatorsData =====
  const clinicalIndicatorsData = useMemo(() => {
    if (!patientFileData) return null;
    return getClinicalIndicatorsStatus(patientFileData, hoursForAdherence);
  }, [patientFileData, hoursForAdherence]);

  // ===== CORRECTION : Une seule déclaration pour clinicalIndicators =====
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

  // ===== Le reste de votre code continue normalement =====
  // [Insérez ici le reste de votre code existant - tout ce qui vient après dans votre version originale]

  // N'OUBLIEZ PAS de fermer le composant avec :
  return <div className="min-h-screen bg-[#EDF2F9]">{/* Votre JSX existant */}</div>;
};

export default Optibrain;
