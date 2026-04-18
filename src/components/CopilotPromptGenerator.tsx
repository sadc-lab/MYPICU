import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  getTemplatesForOrgan,
  type DeidentifiedContext,
  type PromptCategory,
  type PromptTemplate,
} from "@/services/copilotPrompt.service";
import {
  exportOrganDashboardPDF,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PromptCategory | "all">("all");
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Dashboard export state
  const [exportOrgan, setExportOrgan] = useState<string>(organ || "general");
  const [exportTemplateId, setExportTemplateId] = useState<string>("__auto__");
  const [exporting, setExporting] = useState(false);

  const templates = useMemo(() => getTemplatesForOrgan(organ), [organ]);

  const filteredTemplates = useMemo(() => {
    if (activeCategory === "all") return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

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
    if (organ) setExportOrgan(organ);
  }, [organ]);

  const handleSelectTemplate = (template: PromptTemplate) => {
    if (!context) return;
    setSelectedId(template.id);
    setGeneratedPrompt(template.build(context));
    setCopied(false);
  };

  const handleCopy = async (text?: string) => {
    const value = text ?? generatedPrompt;
    if (!value) return false;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        success = true;
      }
    } catch {
      success = false;
    }
    if (!success) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
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

  const handleExportDashboard = async () => {
    if (!patientId) return;
    setExporting(true);
    try {
      const result = await exportOrganDashboardPDF({
        patientId,
        organ: exportOrgan,
        hoursBack: 24,
        promptTemplateId:
          exportTemplateId && exportTemplateId !== "__auto__" ? exportTemplateId : undefined,
      });
      if (!result) {
        toast({
          title: "Export impossible",
          description: "Données patient indisponibles.",
          variant: "destructive",
        });
        return;
      }
      // Copy associated prompt for convenience
      await handleCopy(result.promptText);
      toast({
        title: "Dashboard exporté",
        description: `${result.filename} · prompt copié dans le presse-papiers.`,
      });
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

  const handleExportAndOpenCopilot = async () => {
    await handleExportDashboard();
    window.open(COPILOT_URL, "_blank", "noopener,noreferrer");
  };

  // ---------------- Prompts tab content ----------------
  const promptsContent = !patientId ? (
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
    <div className="flex flex-col flex-1 min-h-0">
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
              <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>

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

      {generatedPrompt && (
        <div className="p-2 border-t flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => handleCopy()} className="flex-1">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button size="sm" onClick={handleOpenCopilot} className="flex-1">
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir Copilot
          </Button>
        </div>
      )}
    </div>
  );

  // ---------------- Dashboard tab content ----------------
  const dashboardContent = !patientId ? (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
      Sélectionnez un patient pour exporter un dashboard.
    </div>
  ) : (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-4 overflow-y-auto">
      <div className="text-sm text-muted-foreground">
        Génère un PDF dé-identifié contenant la synthèse des paramètres, les données brutes (24h)
        et un prompt suggéré, prêt à téléverser dans Copilot.
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Module à exporter</label>
        <Select value={exportOrgan} onValueChange={setExportOrgan}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORGAN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Prompt à inclure dans le PDF</label>
        <Select value={exportTemplateId} onValueChange={setExportTemplateId}>
          <SelectTrigger>
            <SelectValue placeholder="Prompt automatique (analyse globale)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">Prompt automatique (analyse globale)</SelectItem>
            {PROMPT_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleExportDashboard}
          disabled={exporting}
          className="flex-1"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Télécharger le PDF
        </Button>
        <Button onClick={handleExportAndOpenCopilot} disabled={exporting} className="flex-1">
          <ExternalLink className="h-4 w-4" />
          PDF + Ouvrir Copilot
        </Button>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 mt-2">
        <strong>Comment l'utiliser :</strong>
        <ol className="list-decimal list-inside mt-1 space-y-0.5">
          <li>Téléchargez le PDF</li>
          <li>Ouvrez votre agent Copilot</li>
          <li>Glissez-déposez le PDF dans la conversation</li>
          <li>Le prompt est déjà copié — collez-le pour démarrer l'analyse</li>
        </ol>
      </div>
    </div>
  );

  // ---------------- Wrapper layout ----------------
  const body = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start gap-2 px-3 py-2 bg-primary/5 border-b text-xs text-muted-foreground shrink-0">
        <Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <p>
          Contenus <strong>dé-identifiés</strong> (sans nom ni ID patient). Vérifiez avant
          partage avec un assistant IA externe.
        </p>
      </div>

      <Tabs defaultValue="prompts" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-2 mt-2 shrink-0 grid grid-cols-2">
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="prompts" className="flex-1 min-h-0 mt-0 flex flex-col">
          {promptsContent}
        </TabsContent>
        <TabsContent value="dashboard" className="flex-1 min-h-0 mt-0 flex flex-col">
          {dashboardContent}
        </TabsContent>
      </Tabs>
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
        <div className="h-[520px] flex flex-col">{body}</div>
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
        <DialogContent className="max-w-2xl p-0 gap-0 h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Assistant Copilot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Générez des prompts ou exportez un dashboard PDF dé-identifié.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};
