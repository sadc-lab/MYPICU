import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { getCdssRecommendations } from "@/services/cdss.service";
import { cn } from "@/lib/utils";

interface CdssRecommendationsProps {
  patientId: string;
  organ?: string;
  className?: string;
}

export const CdssRecommendations = ({
  patientId,
  organ,
  className,
}: CdssRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCdssRecommendations(patientId, organ);
      setRecommendations(result);
      setExpanded(true);
    } catch (e: any) {
      setError(e.message || "Erreur lors de la récupération des recommandations");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader
        className="py-3 px-4 cursor-pointer"
        onClick={() => {
          if (recommendations) setExpanded(!expanded);
          else if (!loading) fetchRecommendations();
        }}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span>Recommandations IA</span>
            <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              CDSS
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {recommendations && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  fetchRecommendations();
                }}
                disabled={loading}
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              </Button>
            )}
            {recommendations ? (
              expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )
            ) : null}
          </div>
        </div>
      </CardHeader>

      {!recommendations && !loading && !error && (
        <CardContent className="pt-0 pb-3 px-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={fetchRecommendations}
          >
            <Bot className="h-3 w-3 mr-1.5" />
            Générer les recommandations
          </Button>
        </CardContent>
      )}

      {loading && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse des données patient en cours...
          </div>
        </CardContent>
      )}

      {error && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        </CardContent>
      )}

      {recommendations && expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed border-t pt-2">
            {recommendations}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 italic">
            ⚠️ Ces recommandations sont générées par IA et doivent être validées par l'équipe médicale.
          </p>
        </CardContent>
      )}
    </Card>
  );
};
