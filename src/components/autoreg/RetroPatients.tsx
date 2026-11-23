// Patients rétrospectifs dans l'accueil de l'étude : liste + ajout par fichier.
// Voir retroPatients.service pour le stockage (local à ce navigateur).

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Brain, FileUp, Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addRetroPatient, deleteRetroPatient, listRetroPatients, type RetroPatient } from "@/services/retroPatients.service";
import type { ReadinessError } from "@/services/autoregComputation.service";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const RETRO_QUERY_KEY = ["retro-patients"];

export function useRetroPatients() {
  return useQuery({ queryKey: RETRO_QUERY_KEY, queryFn: listRetroPatients, staleTime: Infinity });
}

export function RetroPatientsSection({
  selectedId,
  onSelect,
  compact,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  compact: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const queryClient = useQueryClient();
  const { data: patients = [] } = useRetroPatients();
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: deleteRetroPatient,
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: RETRO_QUERY_KEY });
      if (id === selectedId) onSelect(null);
    },
  });

  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-primary sm:text-lg">{t("Patients rétrospectifs", "Retrospective patients")}</h2>
          {!compact && (
            <p className="text-xs text-muted-foreground">
              {t(
                "Enregistrements ajoutés par fichier, sous pseudonyme. Conservés uniquement dans ce navigateur.",
                "Recordings added from a file, under a pseudonym. Kept only in this browser.",
              )}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          {compact ? t("Ajouter", "Add") : t("Ajouter un patient rétrospectif", "Add a retrospective patient")}
        </Button>
      </div>

      {patients.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed bg-card py-6 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <FileUp className="h-5 w-5" />
          {t("Importer un enregistrement (CSV, Excel ou JSON)", "Import a recording (CSV, Excel or JSON)")}
        </button>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {patients.map((p) => {
            const active = p.id === selectedId;
            return (
              <li
                key={p.id}
                data-patient-id={p.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
                  "bg-primary/5 shadow-[inset_4px_0_0_hsl(var(--primary))] hover:bg-primary/10",
                  active && "bg-primary/15 hover:bg-primary/15",
                )}
                onClick={() => onSelect(p.id)}
              >
                <span className="text-sm font-bold text-primary">{p.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      <Brain className="h-3 w-3" /> {p.mode === "cox" ? "COx" : "PRx"}
                    </span>
                  </div>
                  {!compact && (
                    <div className="truncate text-xs text-muted-foreground">
                      {p.fileName} · {t("ajouté le", "added on")} {new Date(p.createdAt).toLocaleDateString(intlLocale)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title={t("Retirer ce patient", "Remove this patient")}
                  aria-label={t(`Retirer ${p.label}`, `Remove ${p.label}`)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t(`Retirer ${p.label} ? L'enregistrement sera effacé de ce navigateur.`, `Remove ${p.label}? The recording will be erased from this browser.`))) {
                      remove.mutate(p.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AddRetroDialog
        open={open}
        onOpenChange={setOpen}
        onAdded={(p) => {
          queryClient.invalidateQueries({ queryKey: RETRO_QUERY_KEY });
          onSelect(p.id);
        }}
      />
    </section>
  );
}

function AddRetroDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (p: RetroPatient) => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReadinessError | string | null>(null);

  const reset = () => {
    setLabel("");
    setFile(null);
    setError(null);
    setBusy(false);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addRetroPatient(label, file);
      if ("error" in res) {
        setError(res.error);
        setBusy(false);
        return;
      }
      onAdded((res as { patient: RetroPatient }).patient);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Erreur inconnue", "Unknown error"));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Ajouter un patient rétrospectif", "Add a retrospective patient")}</DialogTitle>
          <DialogDescription>
            {t(
              "Importez un enregistrement brut pour en analyser l'autorégulation : rSO₂ + PAM (COx) ou PIC + PAM + PPC (PRx). Le fichier est analysé et conservé dans ce navigateur uniquement.",
              "Import a raw recording to analyse its autoregulation: rSO₂ + MAP (COx) or ICP + MAP + CPP (PRx). The file is analysed and kept in this browser only.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="retro-label">{t("Pseudonyme", "Pseudonym")}</Label>
            <Input
              id="retro-label"
              placeholder={t("ex. Cas 2024-03", "e.g. Case 2024-03")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("N'inscrivez ni nom ni numéro de dossier.", "Do not enter a name or record number.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retro-file">{t("Fichier CSV, Excel ou JSON *", "CSV, Excel or JSON file *")}</Label>
            <Input
              id="retro-file"
              type="file"
              accept=".csv,.json,.txt,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t("Fichier non exploitable", "File not usable")}</AlertTitle>
              <AlertDescription>
                {typeof error === "string" ? (
                  error
                ) : (
                  <>
                    <p className="font-medium">{error.cause}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                      {error.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("Annuler", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Ajouter et analyser", "Add and analyse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
