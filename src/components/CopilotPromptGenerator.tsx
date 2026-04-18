import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  X,
} from "lucide-react";
import {
  PROMPT_TEMPLATES,
  CATEGORY_LABELS,
  COPILOT_URL,
  buildDeidentifiedContext,
  getTemplatesForOrgan,
  type DeidentifiedContext,
  type PromptCategory,
  type PromptTemplate,
} from "@/services/copilotPrompt.service";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface CopilotPromptGeneratorProps {
  patientId?: string;
  organ?: string;
  /** When true, renders inline (for organ pages). When false, renders as floating button + dialog. */
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PromptCategory | "all">("all");
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const templates = useMemo(() => getTemplatesForOrgan(organ), [organ]);

  const filteredTemplates = useMemo(() => {
    if (activeCategory === "all") return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

  // Load de-identified context when opened
  useEffect(() => {
    if (!patientId) return;
    if (!inline && !open) return;

    setLoading(true);
    buildDeidentifiedContext(patientId, organ)
      .then((ctx) => setContext(ctx))
      .catch(() => setContext(null))
      .finally(() => setLoading(false));
  }, [patientId, organ, open, inline]);

  const handleSelectTemplate = (template: PromptTemplate) => {
    if (!context) return;
    setSelectedId(template.id);
    setGeneratedPrompt(template.build(context));
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!generatedPrompt) return false;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(generatedPrompt);
        success = true;
      }
    } catch {
      success = false;
    }
    if (!success) {
      try {
        const ta = document.createElement("textarea");
        ta.value = generatedPrompt;
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
    if (success) {
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
    return success;
  };

  const handleOpenCopilot = async () => {
    if (generatedPrompt) await handleCopy();
    window.open(COPILOT_URL, "_blank", "noopener,noreferrer");
  };

  const content = (
    <div className="flex flex-col h-full min-h-0">
      {/* Privacy banner */}
      <div className="flex items-start gap-2 px-3 py-2 bg-primary/5 border-b text-xs text-muted-foreground shrink-0">
        <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p>
          Les prompts générés sont <strong>dé-identifiés</strong> (aucun nom ni
          ID patient). Vérifiez le contenu avant de l'envoyer à Copilot.
        </p>
      </div>

      {!patientId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          Sélectionnez un patient pour générer des prompts contextualisés.
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
        <>
          {/* Category filters */}
          <div className="flex gap-1.5 flex-wrap p-2 border-b shrink-0">
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

          {/* Templates list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1.5">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md border transition-colors",
                    selectedId === t.id
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover:bg-accent border-border"
                  )}
                >
                  <div className="text-sm font-medium text-foreground">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Generated prompt */}
            {generatedPrompt && (
              <div className="p-2 border-t">
                <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                  Prompt généré (modifiable)
                </div>
                <Textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="text-xs font-mono min-h-[180px] resize-y"
                />
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          {generatedPrompt && (
            <div className="p-2 border-t flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copié" : "Copier"}
              </Button>
              <Button size="sm" onClick={handleOpenCopilot} className="flex-1">
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir Copilot
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Inline version for organ pages
  if (inline) {
    return (
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        <div className="flex items-center justify-between px-3 py-2 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Assistant Copilot — Prompts cliniques</span>
          </div>
        </div>
        <div className="h-[480px] flex flex-col">{content}</div>
      </Card>
    );
  }

  // Floating button + dialog version
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        title="Générer un prompt Copilot"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Générateur de prompts Copilot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sélectionnez un template pour générer un prompt clinique dé-identifié.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};
