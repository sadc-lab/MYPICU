import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ClipboardCheck, RotateCcw } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

const defaultChecklist: ChecklistItem[] = [
  { id: "bilan", label: "Objectif de Bilan Entrée/Sortie", checked: false },
  { id: "thrombose", label: "Prophylaxie Thrombose veineuse", checked: false },
  { id: "ulcere", label: "Prophylaxie Ulcère de stress", checked: false },
  { id: "radios", label: "Fréquence des radios", checked: false },
  { id: "labos", label: "Fréquence des labos", checked: false },
  { id: "equipement", label: "Équipement à retirer", checked: false },
  { id: "alarmes", label: "Limites d'alarmes et fréquence de surveillance", checked: false },
  { id: "isolement", label: "Mesures d'isolement", checked: false },
];

const STORAGE_KEY = "tour-checklist";

export const TourChecklist = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultChecklist;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checklist));
  }, [checklist]);

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const resetChecklist = () => {
    setChecklist(defaultChecklist);
  };

  const completedCount = checklist.filter((item) => item.checked).length;
  const progress = Math.round((completedCount / checklist.length) * 100);

  return (
    <Card className="mb-6 border-primary/20 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-medium text-primary">Liste de contrôle pour la tournée</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({completedCount}/{checklist.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetChecklist}
              className="h-8 px-2 text-muted-foreground hover:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 px-2">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-2 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
            {checklist.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors text-xs ${
                  item.checked ? "bg-primary/10 text-muted-foreground line-through" : "hover:bg-muted"
                }`}
              >
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="leading-tight">{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
