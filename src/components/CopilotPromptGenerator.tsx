import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Loader2,
  FileDown,
} from "lucide-react";
import { HeartIcon } from "@/components/icons/HeartIcon";
import brainIcon from "@/assets/brain-icon.svg";
import lungsIcon from "@/assets/lungs-icon.svg";
import kidneyIcon from "@/assets/kidney-icon.svg";
import intestineIcon from "@/assets/intestine-icon.svg";
import stateIcon from "@/assets/stats-icon.svg";
import {
  PROMPT_TEMPLATES,
  COPILOT_URL,
  buildDeidentifiedContext,
  type DeidentifiedContext,
} from "@/services/copilotPrompt.service";
import {
  exportMultiDashboardPDF,
  ORGAN_OPTIONS,
} from "@/services/dashboardExport.service";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ExportImageButton } from "@/components/ExportImageButton";
import { tr } from '@/i18n';

interface CopilotPromptGeneratorProps {
  patientId?: string;
  organ?: string;
  inline?: boolean;
  className?: string;
  defaultOrgans?: string[];
  defaultTemplateIds?: string[];
  hideHeader?: boolean;
  heightClassName?: string;
  /** Map of organ value -> severity score (>=1 problematic). Used to color cage/icon. */
  organSeverities?: Record<string, number>;
}

// Severity helpers — score 1 = warning (orange), score >= 2 = critical (red).
type Severity = "critical" | "warning" | null;
const getSeverity = (score?: number): Severity => {
  if (!score || score < 1) return null;
  if (score >= 2) return "critical";
  return "warning";
};

// Filter to tint a black/dark SVG icon to a target color.
// status-critical (red) and status-warning (orange) approximations.
const SVG_TINT: Record<NonNullable<Severity>, string> = {
  critical:
    "invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)",
  warning:
    "invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)",
};

// Cage (rounded background) classes per state.
const CAGE_CLASSES = (severity: Severity, active: boolean) => {
  if (severity === "critical") {
    return "bg-status-critical/15 ring-1 ring-status-critical/40";
  }
  if (severity === "warning") {
    return "bg-status-warning/15 ring-1 ring-status-warning/40";
  }
  return active ? "bg-primary/10" : "bg-muted/60";
};

// Border classes for the outer pastille button.
// Borders stay neutral — severity is conveyed via icon + cage only.
const BORDER_CLASSES = (_severity: Severity, active: boolean) => {
  return active
    ? "bg-primary/5 border-primary shadow-sm"
    : "bg-background border-border hover:border-primary/40 hover:bg-accent/40";
};

// Heart icon color per severity / active.
const heartColor = (severity: Severity, active: boolean) => {
  if (severity === "critical") return "text-status-critical";
  if (severity === "warning") return "text-status-warning";
  return active ? "text-destructive" : "text-muted-foreground";
};

// Render an SVG image with optional severity tint.
const renderSvgIcon = (
  src: string,
  active: boolean,
  severity: Severity,
) => (
  <img
    src={src}
    alt=""
    className={cn(
      "h-6 w-6 transition-opacity",
      active || severity ? "opacity-100" : "opacity-50",
    )}
    style={severity ? { filter: SVG_TINT[severity] } : undefined}
  />
);

// Organ pastille definitions matching the rest of the app.
const ORGAN_PASTILLES: Array<{
  value: string;
  short: string;
  full: string;
  render: (active: boolean, severity: Severity) => JSX.Element;
}> = [
  {
    value: "cerveau",
    short: "OptiBrain",
    get full() { return tr("OptiBrain (neurologique)", "OptiBrain (neurological)"); },
    render: (active, severity) => renderSvgIcon(brainIcon, active, severity),
  },
  {
    value: "coeur",
    short: "OptiHeart",
    get full() { return tr("OptiHeart (cardiovasculaire)", "OptiHeart (cardiovascular)"); },
    render: (active, severity) => (
      <HeartIcon
        className={cn("h-6 w-6 transition-colors", heartColor(severity, active))}
      />
    ),
  },
  {
    value: "poumons",
    short: "OptiLungs",
    get full() { return tr("OptiLungs (respiratoire)", "OptiLungs (respiratory)"); },
    render: (active, severity) => renderSvgIcon(lungsIcon, active, severity),
  },
  {
    value: "renal",
    short: "OptiRenal",
    get full() { return tr("OptiRenal (rénal)", "OptiRenal (renal)"); },
    render: (active, severity) => renderSvgIcon(kidneyIcon, active, severity),
  },
  {
    value: "gastro",
    short: "OptiGastro",
    get full() { return tr("OptiGastro (gastro-intestinal)", "OptiGastro (gastrointestinal)"); },
    render: (active, severity) => renderSvgIcon(intestineIcon, active, severity),
  },
  {
    value: "general",
    short: "OptiState",
    get full() { return tr("OptiState (global)", "OptiState (overall)"); },
    render: (active, severity) => renderSvgIcon(stateIcon, active, severity),
  },
];

// Ensure we only show pastilles for organs that exist in ORGAN_OPTIONS
const visiblePastilles = ORGAN_PASTILLES.filter((p) =>
  ORGAN_OPTIONS.some((o) => o.value === p.value)
);

export const CopilotPromptGenerator = ({
  patientId,
  organ,
  inline = false,
  className,
  defaultOrgans,
  defaultTemplateIds,
  hideHeader = false,
  heightClassName = "h-[600px]",
  organSeverities = {},
}: CopilotPromptGeneratorProps) => {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<DeidentifiedContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>(
    defaultOrgans && defaultOrgans.length ? defaultOrgans : organ ? [organ] : []
  );
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    defaultTemplateIds ?? []
  );
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  useEffect(() => {
    if (!patientId) return;
    if (!inline && !open) return;
    setLoading(true);
    buildDeidentifiedContext(patientId, organ)
      .then((ctx) => setContext(ctx))
      .catch(() => setContext(null))
      .finally(() => setLoading(false));
  }, [patientId, organ, open, inline]);

  // Re-apply default organ selection when patient changes (auto-track critical systems)
  useEffect(() => {
    const next =
      defaultOrgans && defaultOrgans.length ? defaultOrgans : organ ? [organ] : [];
    if (next.length) setSelectedOrgans(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, defaultOrgans?.join(",")]);

  // Build live preview prompt
  useEffect(() => {
    if (!context || !selectedTemplateIds.length) {
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
      toast({ title: tr("Copié", "Copied"), description: tr("Le prompt est dans votre presse-papiers.", "The prompt is in your clipboard.") });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: tr("Erreur", "Error"),
        description: tr("Impossible de copier. Sélectionnez le texte manuellement.", "Unable to copy. Select the text manually."),
        variant: "destructive",
      });
    }
  };

  const handleGeneratePDF = async (openCopilot: boolean) => {
    if (!patientId || !selectedOrgans.length) {
      toast({
        title: tr("Sélection requise", "Selection required"),
        description: tr("Choisissez au moins un module à exporter.", "Choose at least one module to export."),
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
          title: tr("Export impossible", "Export impossible"),
          description: tr("Données patient indisponibles.", "Patient data unavailable."),
          variant: "destructive",
        });
        return;
      }
      await copyToClipboard(result.promptText);
      toast({
        title: tr("Dashboard exporté", "Dashboard exported"),
        description: tr(`${result.filename} · prompt copié.`, `${result.filename} · prompt copied.`),
      });
      if (openCopilot) {
        window.open(COPILOT_URL, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      toast({
        title: tr("Erreur", "Error"),
        description: tr("Échec de la génération du PDF.", "PDF generation failed."),
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
          {tr('Contenus', 'Content is')} <strong>{tr('dé-identifiés', 'de-identified')}</strong>{' '}
          {tr('(sans nom ni ID patient). Vérifiez avant partage avec un assistant IA externe.', '(no patient name or ID). Check before sharing with an external AI assistant.')}
        </p>
      </div>

      {!patientId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          {tr('Sélectionnez un patient pour générer un export.', 'Select a patient to generate an export.')}
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {tr('Chargement du contexte...', 'Loading context...')}
        </div>
      ) : !context ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
          {tr('Données patient indisponibles.', 'Patient data unavailable.')}
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5">
            {/* Step 1: Organ pastilles */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  {tr('1. Modules à inclure', '1. Modules to include')}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedOrgans.length}/{visiblePastilles.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {tr("Cliquez sur une pastille pour l'activer ou la désactiver.", 'Click a badge to turn it on or off.')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {visiblePastilles.map((p) => {
                  const active = selectedOrgans.includes(p.value);
                  const severity = getSeverity(organSeverities[p.value]);
                  const checkColor =
                    severity === "critical"
                      ? "bg-status-critical text-white"
                      : severity === "warning"
                      ? "bg-status-warning text-white"
                      : "bg-primary text-primary-foreground";
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => toggleOrgan(p.value)}
                      aria-pressed={active}
                      title={
                        severity
                          ? `${p.full} — ${severity === "critical" ? tr("Critique", "Critical") : tr("À surveiller", "To watch")}`
                          : p.full
                      }
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                        BORDER_CLASSES(severity, active),
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center h-10 w-10 rounded-full transition-colors",
                          CAGE_CLASSES(severity, active),
                        )}
                      >
                        {p.render(active, severity)}
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium leading-tight text-center",
                          severity === "critical"
                            ? "text-status-critical font-semibold"
                            : severity === "warning"
                            ? "text-status-warning font-semibold"
                            : active
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {p.short}
                      </span>
                      {active && (
                        <span
                          className={cn(
                            "absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center shadow-sm",
                            checkColor,
                          )}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 2: Prompts (no tabs, full list) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  {tr('2. Prompts cliniques à inclure', '2. Clinical prompts to include')}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {selectedTemplateIds.length} {tr('sélectionné', 'selected')}
                  {selectedTemplateIds.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {tr("Optionnel — laissez vide pour un prompt d'analyse générique.", 'Optional — leave empty for a generic analysis prompt.')}
              </p>
              <div className="space-y-1.5">
                {PROMPT_TEMPLATES.map((t) => {
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
                        <div className="text-sm font-medium text-foreground">
                          {t.label}
                        </div>
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
                  {tr('3. Aperçu du prompt (modifiable)', '3. Prompt preview (editable)')}
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
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? tr("Prompt copié", "Prompt copied") : tr("Copier le prompt seul", "Copy prompt only")}
                </Button>
              </section>
            )}

            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              <strong>{tr("Comment l'utiliser :", 'How to use it:')}</strong>
              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                <li>{tr('Téléchargez le PDF (modules + prompts inclus)', 'Download the PDF (modules + prompts included)')}</li>
                <li>{tr('Ouvrez votre agent Copilot', 'Open your Copilot agent')}</li>
                <li>{tr('Glissez-déposez le PDF dans la conversation', 'Drag and drop the PDF into the conversation')}</li>
                <li>{tr('Le prompt est déjà copié — collez-le pour démarrer', 'The prompt is already copied — paste it to start')}</li>
              </ol>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Action bar */}
      {patientId && context && (
        <div className="p-3 border-t flex flex-col gap-2 shrink-0 bg-background">
          <div className="flex gap-2">
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
              {tr('Télécharger PDF', 'Download PDF')}
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
          <ExportImageButton
            filenamePrefix={`mypicu_copilot_${organ ?? "patient"}`}
            label={tr("Exporter en image (dé-identifié)", "Export as image (de-identified)")}
          />
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <Card className={cn("flex flex-col overflow-hidden", className)}>
        {!hideHeader && (
          <div className="flex items-center justify-between px-3 py-2 border-b bg-primary/5 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Assistant Copilot</span>
            </div>
          </div>
        )}
        <div className={cn(heightClassName, "flex flex-col")}>{body}</div>
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b shrink-0 space-y-1 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Export Copilot
            </SheetTitle>
            <SheetDescription className="text-xs">
              {tr('Sélectionnez les modules et les questions cliniques à combiner dans un seul PDF dé-identifié.', 'Select the modules and clinical questions to combine into a single de-identified PDF.')}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
        </SheetContent>
      </Sheet>
    </>
  );
};
