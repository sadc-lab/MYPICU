// Bascules de langue (FR / EN) et de thème (clair / sombre), affichées à côté du
// nom de l'utilisateur dans la barre de navigation.

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n, type Lang } from "@/i18n";
import { cn } from "@/lib/utils";

export const PreferenceToggles = ({ className }: { className?: string }) => {
  const { lang, setLang, t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        role="group"
        aria-label={t("Langue", "Language")}
        className="flex items-center rounded-md border bg-muted p-0.5 text-xs font-semibold"
      >
        {(["fr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={cn(
              "rounded px-2 py-1 uppercase transition-colors",
              lang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? t("Passer en mode clair", "Switch to light mode") : t("Passer en mode sombre", "Switch to dark mode")}
        title={isDark ? t("Mode clair", "Light mode") : t("Mode sombre", "Dark mode")}
        className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-muted-foreground transition-colors hover:text-foreground"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
};
