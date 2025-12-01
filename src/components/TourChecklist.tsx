import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <Card className="border-2 border-gray-200 mb-4">
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors py-3"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-primary/40 bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Rappels</h3>
                <p className="text-xs text-gray-500 mt-1">{reminders.length} éléments à vérifier</p>
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {reminders.map((item, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <span className="h-2 w-2 rounded-full bg-primary/60 shrink-0 mt-1" />
                  <span className="text-xs text-gray-600 leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-2 border-gray-200">
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-primary/40 bg-primary/10">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Rappels pour la tournée</h3>
              <p className="text-xs text-gray-500 mt-1">{reminders.length} éléments à vérifier</p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {reminders.map((item, index) => (
              <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                <span className="h-2 w-2 rounded-full bg-primary/60 shrink-0 mt-1" />
                <span className="text-xs text-gray-600 leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
