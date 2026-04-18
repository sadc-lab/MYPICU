import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Loader2,
  FileDown,
} from "lucide-react";
import {
  PROMPT_TEMPLATES,
  CATEGORY_LABELS,
  COPILOT_URL,
  buildDeidentifiedContext,
  type DeidentifiedContext,
  type PromptCategory,
} from "@/services/copilotPrompt.service";
import {
  exportMultiDashboardPDF,
  ORGAN_OPTIONS,
} from "@/services/dashboardExport.service";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface CopilotPromptGeneratorProps {
  patientId?: string;
  organ?: string;
  inline?: boolean;
  className?: string;
}

export const CopilotPromptGenerator = ({
  patientId,
  organ,
  inline = false,
  className,
}: CopilotPromptGeneratorProps) => {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<DeidentifiedContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PromptCategory | "all">("all");
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>(organ ? [organ] : []);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  const filteredTemplates = useMemo(() => {
    if (activeCategory === "all") return PROMPT_TEMPLATES;
    return PROMPT_TEMPLATES.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!patientId) return;
    if (!inline && !open) return;
    setLoading(true);
    buildDeidentifiedContext(patientId, organ)
      .then((ctx) => setContext(ctx))
      .catch(() => setContext(null))
      .finally(() => setLoading(false));
  }, [patientId, organ, open, inline]);

  useEffect(() => {
    if (organ && !selectedOrgans.length) setSelectedOrgans([organ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organ]);

  // Build live preview prompt
  useEffect(() => {
    if (!context) {
      setGeneratedPrompt("");
      return;
    }
    if (!selectedTemplateIds.length) {
      setGeneratedPrompt("");
      return;
    }
    const tpls = selectedTemplateIds
      .map((id) => PROMPT_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is (typeof PROMPT_TEMPLATES)[number] => Boolean(t));
    const tplCtx = { ...context, organ: selectedOrgans[0] };
    const text = tpls
      .map((t, i) => `### Question ${i + 1} — ${t.label}\n\n${t.build(tplCtx)}`)
      .join("\n\n---\n\n");
    setGeneratedPrompt(text);
  }, [context, selectedTemplateIds, selectedOrgans]);

  const toggleOrgan = (value: string) => {
    setSelectedOrgans((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return false;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch {
      success = false;
    }
    if (!success) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.setAttribute("readonly", "");
        document.body.appendChild(ta);
        ta.select();
        success = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        success = false;
      }
    }
    return success;
  };

  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;
    const ok = await copyToClipboard(generatedPrompt);
    if (ok) {
      setCopied(true);
      toast({ title: "Copié", description: "Le prompt est dans votre presse-papiers." });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de copier. Sélectionnez le texte manuellement.",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePDF = async (openCopilot: boolean) => {
    if (!patientId || !selectedOrgans.length) {
      toast({
        title: "Sélection requise",
        description: "Choisissez au moins un module à exporter.",
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    try {
      const result = await exportMultiDashboardPDF({
        patientId,
        organs: selectedOrgans,
        hoursBack: 24,
        promptTemplateIds: selectedTemplateIds,
      });
      if (!result) {
        toast({
          title: "Export impossible",
          description: "Données patient indisponibles.",
          variant: "destructive",
        });
        return;
      }
      await copyToClipboard(result.promptText);
      toast({
        title: "Dashboard exporté",
        description: `${result.filename} · prompt copié.`,
      });
      if (openCopilot) {
        window.open(COPILOT_URL, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur",
        description: "Échec de la génération du PDF.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const canExport = patientId && selectedOrgans.length > 0;

  const body = (
    <div className="flex flex-col h-full min-h-0">
      {/* Privacy banner */}
      <div className="flex items-start gap-2 px-3 py-2 bg-primary/5 border-b text-xs text-muted-foreground shrink-0">
        <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p>
          Contenus <strong>dé-identifiés</strong> (sans nom ni ID patient). Vérifiez avant
          partage avec un assistant IA externe.
        </p>
      </div>

      {!patientId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          Sélectionnez un patient pour générer un export.
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Chargement du contexte...
        </div>
      ) : !context ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          Données patient indisponibles.
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-4">
            {/* Step 1: Organs */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  1. Modules à inclure dans le PDF
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedOrgans.length}/{ORGAN_OPTIONS.length} sélectionnés
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ORGAN_OPTIONS.map((o) => {
                  const checked = selectedOrgans.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer text-xs transition-colors",
                        checked
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-accent border-border"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOrgan(o.value)}
                      />
                      <span className="flex-1">{o.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Step 2: Prompts */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  2. Prompts cliniques à inclure
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedTemplateIds.length} sélectionné{selectedTemplateIds.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Optionnel — laissez vide pour un prompt d'analyse générique.
              </p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                <Badge
                  variant={activeCategory === "all" ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setActiveCategory("all")}
                >
                  Tous
                </Badge>
                {(Object.keys(CATEGORY_LABELS) as PromptCategory[]).map((cat) => (
                  <Badge
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setActiveCategory(cat)}
                  >
                    {CATEGORY_LABELS[cat]}
                  </Badge>
                ))}
              </div>
              <div className="space-y-1.5">
                {filteredTemplates.map((t) => {
                  const checked = selectedTemplateIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={cn(
                        "flex items-start gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                        checked
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-accent border-border"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleTemplate(t.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{t.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Preview */}
            {generatedPrompt && (
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  3. Aperçu du prompt (modifiable)
                </h3>
                <Textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="text-xs font-mono min-h-[160px] resize-y"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="w-full mt-2"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Prompt copié" : "Copier le prompt seul"}
                </Button>
              </section>
            )}

            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              <strong>Comment l'utiliser :</strong>
              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                <li>Téléchargez le PDF (modules + prompts inclus)</li>
                <li>Ouvrez votre agent Copilot</li>
                <li>Glissez-déposez le PDF dans la conversation</li>
                <li>Le prompt est déjà copié — collez-le pour démarrer</li>
              </ol>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Action bar */}
      {patientId && context && (
        <div className="p-2 border-t flex gap-2 shrink-0 bg-background">
          <Button
            variant="outline"
            onClick={() => handleGeneratePDF(false)}
            disabled={!canExport || exporting}
            className="flex-1"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Télécharger PDF
          </Button>
          <Button
            onClick={() => handleGeneratePDF(true)}
            disabled={!canExport || exporting}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4" />
            PDF + Copilot
          </Button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Assistant Copilot</span>
          </div>
        </div>
        <div className="h-[600px] flex flex-col">{body}</div>
      </Card>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        title="Assistant Copilot"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 h-[88vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Export Copilot — Modules &amp; prompts
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sélectionnez les modules et les questions cliniques à combiner dans un seul
              PDF dé-identifié.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};
