// Bilinguisme français / anglais de MyPICU.
//
// Chaque texte affiché porte ses deux versions côte à côte, à l'endroit où il
// est utilisé : t("Liste des patients", "Patient list"). Pas de fichier de clés
// à synchroniser, et un texte oublié reste simplement en français.
//
// - Dans un composant : const { t } = useI18n();
// - Hors composant (service, utilitaire, constante calculée à l'affichage) :
//   tr("…", "…"), qui lit la langue courante.
//
// Changer de langue remonte l'arbre sous <LanguageRoot> : tous les textes, y
// compris ceux produits par tr() dans des services ou des useMemo, sont donc
// recalculés. L'URL est conservée (sélection du patient, plage de temps) et le
// cache des requêtes aussi, puisque le QueryClient est au-dessus.
//
// Attention : ne traduire que l'affichage. Certains libellés servent aussi
// d'identifiants (indicateurs sélectionnés, clés de variables) : ceux-là
// restent tels quels et sont traduits au moment de l'afficher.

import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import { fr as frLocale, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

export type Lang = "fr" | "en";

const STORAGE_KEY = "mypicu-lang";

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "fr") return v;
  } catch {
    /* stockage indisponible : français par défaut */
  }
  return "fr";
}

let current: Lang = readStoredLang();
if (typeof document !== "undefined") document.documentElement.lang = current;

const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* préférence non mémorisée, mais appliquée pour la session */
  }
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Texte dans la langue courante (utilisable hors composant). */
export function tr(fr: string, en: string): string {
  return current === "en" ? en : fr;
}

/** Locale date-fns de la langue courante. */
export function dateLocale(): Locale {
  return current === "en" ? enUS : frLocale;
}

/** Locale Intl / toLocale*String de la langue courante. */
export function intlLocale(): string {
  return current === "en" ? "en-CA" : "fr-CA";
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export function useI18n() {
  const lang = useLang();
  return {
    lang,
    setLang,
    t: (fr: string, en: string) => (lang === "en" ? en : fr),
    dateLocale: lang === "en" ? enUS : frLocale,
    intlLocale: lang === "en" ? "en-CA" : "fr-CA",
  };
}

/** Remonte ses enfants à chaque changement de langue. */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const lang = useLang();
  return <Fragment key={lang}>{children}</Fragment>;
}
