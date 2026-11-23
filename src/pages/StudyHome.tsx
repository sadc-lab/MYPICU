// Accueil du déploiement d'étude (VITE_STUDY_ONLY) : le tableau de bord de
// l'unité, où les patients disposant de signaux d'autorégulation sont mis en
// évidence. Un clic sur un patient réduit le tableau à gauche et affiche son
// autorégulation cérébrale à droite, sans quitter la page.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { PatientTable } from "@/components/PatientTable";
import { CerebralAutoregView } from "@/components/autoreg/CerebralAutoregView";
import { RetroPatientsSection, useRetroPatients } from "@/components/autoreg/RetroPatients";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatients } from "@/hooks/usePatients";
import { useRealtimePatients } from "@/hooks/useRealtimePatients";
import { getAutoregAvailability } from "@/services/autoregAvailability.service";
import { cn } from "@/lib/utils";
import { useI18n } from '@/i18n';

const StudyHome = () => {
  const [selectedPed, setSelectedPed] = useState<"A" | "B" | "C">("A");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("patient");
  const retroId = searchParams.get("retro");
  const { t, intlLocale } = useI18n();
  const { data: retroPatients = [] } = useRetroPatients();

  useRealtimePatients();
  const { data: patientResponse, isLoading } = usePatients();
  const allPatients = useMemo(() => patientResponse?.patients ?? [], [patientResponse]);

  const displayedPatients = useMemo(
    () =>
      allPatients.filter((p) => {
        if (selectedPed === "A") return p.ward === "pedA" || !p.ward;
        if (selectedPed === "B") return p.ward === "pedB";
        return false;
      }),
    [allPatients, selectedPed],
  );

  const averagePelod =
    displayedPatients.length > 0
      ? Math.round(displayedPatients.reduce((sum, p) => sum + p.pelodScore, 0) / displayedPatients.length)
      : 0;

  const ids = useMemo(() => allPatients.map((p) => p.id).sort(), [allPatients]);
  const { data: availability = {}, isLoading: availabilityLoading } = useQuery({
    queryKey: ["autoreg-availability", ids],
    queryFn: () => getAutoregAvailability(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const highlighted = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(availability).map(([id, mode]) => [id, mode === "cox" ? "COx" : "PRx"]),
      ),
    [availability],
  );
  const studyCount = displayedPatients.filter((p) => highlighted[p.id]).length;

  const selected = allPatients.find((p) => p.id === selectedId) ?? null;
  const selectedRetro = retroPatients.find((p) => p.id === retroId) ?? null;
  const panelOpen = Boolean(selected || selectedRetro);

  // Un patient sélectionné hors de l'unité affichée (recherche, flèches de la
  // barre de navigation) fait basculer l'unité.
  useEffect(() => {
    if (!selected) return;
    const ped = selected.ward === "pedB" ? "B" : "A";
    if (ped !== selectedPed) setSelectedPed(ped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Le patient sélectionné reste visible dans le tableau réduit.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-patient-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, displayedPatients]);

  // Un seul patient ouvert à la fois : de l'unité (?patient=) ou rétrospectif (?retro=).
  const openPanel = (key: "patient" | "retro", id: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.delete("patient");
    params.delete("retro");
    if (id) params.set(key, id);
    setSearchParams(params);
  };
  const setPatient = (id: string | null) => openPanel("patient", id);

  return (
    <div className="min-h-screen bg-background">
      <Header selectedPed={selectedPed} patients={displayedPatients} />

      <main className="container mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
        <div className={cn("grid gap-4", panelOpen && "lg:grid-cols-[minmax(300px,380px)_1fr]")}>
          {/* Tableau de l'unité — pleine largeur, ou réduit à gauche quand un patient est ouvert */}
          <div className={cn("min-w-0", panelOpen && "lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto")}>
            <div className="mb-1 flex items-center gap-1">
              <h2 className="text-lg font-medium text-primary sm:text-xl">{t("Liste des patients -", "Patient list -")}</h2>
              <Select value={selectedPed} onValueChange={(v) => setSelectedPed(v as "A" | "B" | "C")}>
                <SelectTrigger className="h-auto w-auto gap-1 border-0 bg-transparent p-0 text-lg font-medium text-primary hover:opacity-80 focus:ring-0 sm:text-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="A">PED A</SelectItem>
                  <SelectItem value="B">PED B</SelectItem>
                  <SelectItem value="C">PED C</SelectItem>
                </SelectContent>
              </Select>
              {(isLoading || availabilityLoading) && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-3 rounded-sm border-l-4 border-primary bg-primary/10" />
              {t("En surbrillance : autorégulation disponible", "Highlighted: autoregulation available")} · {studyCount} patient{studyCount > 1 ? "s" : ""}
            </p>

            {displayedPatients.length > 0 ? (
              <div
                ref={listRef}
                
              >
                <PatientTable
                  patients={displayedPatients}
                  pedName={`PED ${selectedPed}`}
                  averagePelod={averagePelod}
                  showTitle={false}
                  onSelectPatient={(id) => setPatient(id)}
                  selectedPatientId={selectedId}
                  highlighted={highlighted}
                  compact={panelOpen}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-muted-foreground">
                <p className="text-lg font-medium">{t("Aucun patient dans cette unité", "No patients in this unit")}</p>
                <p className="mt-1 text-sm">{t("Il n'y a actuellement aucun patient en PED", 'There are currently no patients in PED')} {selectedPed}.</p>
              </div>
            )}

            <RetroPatientsSection
              selectedId={retroId}
              onSelect={(id) => openPanel("retro", id)}
              compact={panelOpen}
            />
          </div>

          {/* Autorégulation d'un patient rétrospectif */}
          {selectedRetro && (
            <section className="min-w-0 rounded-lg border bg-card p-4 md:p-6">
              <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold">
                    {selectedRetro.code} <span>{selectedRetro.label}</span>
                  </h1>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FileUp className="h-3.5 w-3.5" />
                    {t("Données rétrospectives", "Retrospective data")} · {selectedRetro.fileName} ·{" "}
                    {t("ajouté le", "added on")} {new Date(selectedRetro.createdAt).toLocaleDateString(intlLocale)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openPanel("retro", null)} title={t("Fermer l'analyse", "Close analysis")} aria-label={t("Fermer l'analyse", "Close analysis")}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <CerebralAutoregView key={selectedRetro.id} retroId={selectedRetro.id} />
            </section>
          )}

          {/* Autorégulation du patient sélectionné */}
          {selected && (
            <section className="min-w-0 rounded-lg border bg-card p-4 md:p-6">
              <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4">
                <div>
                  <h1 className="text-xl font-bold">
                    #{(selected.picuId ?? "").replace(/\D/g, "").padStart(2, "0")} <span>{selected.name}</span>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {selected.age} • {selected.weight}
                  </p>
                  <p className="mt-1 text-sm">
                    <strong>{t("Diagnostic :", "Diagnosis:")}</strong> {selected.diagnosis}
                  </p>
                  {selected.allergies && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="font-medium">{t("Allergies :", "Allergies:")}</span> {selected.allergies}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPatient(null)} title={t("Fermer l'analyse", "Close analysis")} aria-label={t("Fermer l'analyse", "Close analysis")}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <CerebralAutoregView key={selected.id} patientId={selected.id} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudyHome;
