import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Bell } from "lucide-react";
import { useTourNavigation } from "@/hooks/useTourNavigation";

const reminders = [
  "Objectif de Bilan Entrée/Sortie",
  "Prophylaxie Thrombose veineuse",
  "Prophylaxie Ulcère de stress",
  "Fréquence des radios",
  "Fréquence des labos",
  "Équipement à retirer",
  "Limites d'alarmes et fréquence de surveillance",
  "Mesures d'isolement",
];

interface TourChecklistProps {
  compact?: boolean;
  patientId?: string;
}

export const TourChecklist = ({ compact = false, patientId }: TourChecklistProps) => {
  const { activeTour, isInTour } = useTourNavigation();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show if there's an active tour and the patient is in the tour
  if (patientId && (!activeTour || !isInTour(patientId))) {
    return null;
  }

  if (compact) {
    return (
      <div className="border rounded-lg border-primary/20 bg-card mb-4">
        <div className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Rappels</span>
              <span className="text-xs text-muted-foreground">
                ({reminders.length} éléments)
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-6 w-6 p-0">
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-2 pb-2">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {reminders.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center gap-1 py-0.5 px-1 text-[10px] text-muted-foreground"
                >
                  <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                  <span className="leading-tight truncate">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="mb-6 border-primary/20 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium text-primary">Rappels pour la tournée</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({reminders.length} éléments)
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 px-2">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-2 pb-3">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
            {reminders.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-1.5 py-1 px-1.5 text-xs text-muted-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                <span className="leading-tight">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
};
