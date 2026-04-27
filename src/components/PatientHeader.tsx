import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronDown, Bell } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { HeartIcon } from "@/components/icons/HeartIcon";
import { TourProgressBar } from "@/components/TourProgressBar";
import { usePatient } from "@/hooks/usePatients";
import brainIcon from "@/assets/brain-icon.svg";
import lungsIcon from "@/assets/lungs-icon.svg";
import stateIcon from "@/assets/stats-icon.svg";
import kidneyIcon from "@/assets/kidney-icon.svg";
import intestineIcon from "@/assets/intestine-icon.svg";

const reminders = [
  "Objectif de Bilan Entrée/Sortie",
  "Prophylaxie Thrombose veineuse",
  "Prophylaxie Ulcère de stress",
  "Fréquence des radios",
  "Fréquence des labos",
  "Équipement à retirer",
  "Limites d'alarmes et fréquence de surveillance",
  "Mesures d'isolement",
  "Plan de mobilisation",
  "Transition vers traitement peros",
];

interface PatientHeaderProps {
  currentPage: "optistate" | "optibrain" | "optiheart" | "optilungs" | "optirenal" | "optigastro";
}

export const PatientHeader = ({ currentPage }: PatientHeaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patient") || "#25";
  const { data: patient, isLoading } = usePatient(patientId);
  const [showReminders, setShowReminders] = useState(false);

  if (isLoading) return <div className="bg-card border-b border-border mb-4 sm:mb-6 p-4 text-center text-muted-foreground">Chargement...</div>;
  if (!patient) return null;

  // Inactive tabs: pale grey bg + colored border if problematic.
  // Active tab: tinted bg matching severity (low opacity for readability).
  const getOrganBadgeClass = (score: number | undefined, active: boolean) => {
    const base = "border";
    if (!score || score === 0) {
      return active
        ? `${base} bg-primary/10 text-foreground border-border`
        : `${base} bg-muted text-foreground border-border`;
    }
    if (score === 1) {
      return active
        ? `${base} bg-orange-500/15 text-foreground border-orange-500`
        : `${base} bg-muted text-foreground border-orange-500`;
    }
    if (score === 2) {
      return active
        ? `${base} bg-orange-600/15 text-foreground border-orange-600`
        : `${base} bg-muted text-foreground border-orange-600`;
    }
    return active
      ? `${base} bg-red-600/15 text-foreground border-red-600`
      : `${base} bg-muted text-foreground border-red-600`;
  };

  const getColorFilter = (score?: number) => {
    if (!score || score === 0)
      return "invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)"; // grey
    if (score === 1) return "invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)"; // orange
    if (score === 2) return "invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)"; // darker orange
    return "invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)"; // red
  };

  const getTextColor = (score?: number) => {
    if (!score || score === 0) return "text-muted-foreground";
    if (score === 1) return "text-orange-600 dark:text-orange-400";
    if (score === 2) return "text-orange-700 dark:text-orange-300";
    return "text-red-700 dark:text-red-400";
  };

  const getDotColors = (score?: number) => {
    if (!score || score === 0)
      return { border: "border-muted-foreground/60", fill: "bg-muted-foreground" };
    if (score === 1)
      return { border: "border-orange-500", fill: "bg-orange-500" };
    if (score === 2)
      return { border: "border-orange-600", fill: "bg-orange-600" };
    return { border: "border-red-600", fill: "bg-red-600" };
  };

  const getActiveBorderClass = (score?: number) => {
    if (!score || score === 0) return "border-2 border-primary";
    if (score === 1) return "border-2 border-orange-500";
    if (score === 2) return "border-2 border-orange-600";
    return "border-2 border-red-600";
  };

  const isActivePage = (page: string) => currentPage === page;

  return (
    <>
      <TourProgressBar currentPatientId={patientId} currentPage={currentPage} />
    <div className="bg-card border-b border-border mb-4 sm:mb-6">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground text-sm self-start"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour aux patients
          </Button>

        </div>

        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-3 sm:mb-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
              #{patient.picuId.replace(/\D/g, '').padStart(2, '0')} {patient.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>{patient.age}</span>
              <span>•</span>
              <span>{patient.weight}</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground mt-2">
              <strong>Diagnostic:</strong> {patient.diagnosis}
            </p>

            <Collapsible open={showReminders} onOpenChange={setShowReminders} className="mt-3">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors">
                <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">Rappels des objectifs quotidien({reminders.length})</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showReminders ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2.5 space-y-1.5">
                  {reminders.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2 w-full lg:w-auto">
            <div className="text-left sm:text-right sm:mr-4">
              <div className="text-xs text-muted-foreground mb-1">PELOD Score</div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{patient.pelodScore}</div>
            </div>

            <div className="flex gap-1 sm:gap-1.5 flex-wrap">
              {[
                {
                  page: "optistate" as const,
                  path: "/optistate",
                  label: "State",
                  score: patient.pelodScore,
                  showScore: false,
                  icon: (
                    <img
                      src={stateIcon}
                      alt="state"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      style={{ filter: getColorFilter(patient.pelodScore) }}
                    />
                  ),
                },
                {
                  page: "optibrain" as const,
                  path: "/optibrain",
                  label: String(patient.brainScore || 0),
                  score: patient.brainScore,
                  showScore: true,
                  icon: (
                    <img
                      src={brainIcon}
                      alt="brain"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      style={{ filter: getColorFilter(patient.brainScore) }}
                    />
                  ),
                },
                {
                  page: "optiheart" as const,
                  path: "/optiheart",
                  label: String(patient.heartScore || 0),
                  score: patient.heartScore,
                  showScore: true,
                  icon: <HeartIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${getTextColor(patient.heartScore)}`} />,
                },
                {
                  page: "optilungs" as const,
                  path: "/optilungs",
                  label: String(patient.lungsScore || 0),
                  score: patient.lungsScore,
                  showScore: true,
                  icon: (
                    <img
                      src={lungsIcon}
                      alt="lungs"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      style={{ filter: getColorFilter(patient.lungsScore) }}
                    />
                  ),
                },
                {
                  page: "optirenal" as const,
                  path: "/optirenal",
                  label: String(patient.kidneyScore || 0),
                  score: 0,
                  showScore: true,
                  icon: (
                    <img
                      src={kidneyIcon}
                      alt="kidney"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      style={{ filter: getColorFilter(0) }}
                    />
                  ),
                },
                {
                  page: "optigastro" as const,
                  path: "/optigastro",
                  label: "GI",
                  score: 0,
                  showScore: true,
                  icon: (
                    <img
                      src={intestineIcon}
                      alt="gastro"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      style={{ filter: getColorFilter(0) }}
                    />
                  ),
                },
              ].map((tab) => {
                const active = isActivePage(tab.page);
                return (
                  <button
                    key={tab.page}
                    onClick={() => {
                      const timeRange = searchParams.get("timeRange");
                      const params = new URLSearchParams();
                      params.set("patient", patientId);
                      if (timeRange) params.set("timeRange", timeRange);
                      navigate(`${tab.path}?${params.toString()}`);
                    }}
                    aria-current={active ? "page" : undefined}
                    className="relative flex items-center justify-center p-1 bg-transparent border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
                  >
                    <Badge
                      variant="outline"
                      className={`${getOrganBadgeClass(tab.score, active)} text-xs transition-all duration-150 gap-1 ${
                        active
                          ? getActiveBorderClass(tab.score)
                          : "hover:-translate-y-[1px]"
                      }`}
                    >
                      {tab.icon}
                      <span className={`font-semibold ${getTextColor(tab.score)}`}>{tab.label}</span>
                      <span
                        aria-hidden="true"
                        className={`ml-0.5 h-2 w-2 rounded-full border transition-colors ${getDotColors(tab.score).border} ${
                          active ? getDotColors(tab.score).fill : "bg-transparent"
                        }`}
                      />
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
