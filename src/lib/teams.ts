// Intégration onglet Microsoft Teams.
//
// Tout ici est sans effet dans un navigateur ordinaire : l'application continue
// de fonctionner à l'identique hors de Teams. Le SDK est importé dynamiquement,
// donc il n'est jamais téléchargé par les visiteurs hors Teams.
//
// NOTE : le courriel renvoyé provient du contexte du client Teams, fourni par la
// page hôte — c'est une indication pratique, PAS une preuve d'identité. Ne pas
// l'utiliser comme authentification : cela demanderait un SSO Entra ID avec un
// jeton validé côté serveur. MYPICU garde sa connexion Supabase.

export type TeamsTheme = 'default' | 'dark' | 'contrast';

export interface TeamsSession {
  email: string | null;
  theme: TeamsTheme;
}

const HOST_TIMEOUT_MS = 1500;

let sessionPromise: Promise<TeamsSession | null> | undefined;

/**
 * Résout la session Teams, ou null hors de Teams.
 * Mise en cache : les appels répétés ne réinitialisent pas le SDK.
 */
export function getTeamsSession(): Promise<TeamsSession | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!sessionPromise) sessionPromise = resolveSession();
  return sessionPromise;
}

async function resolveSession(): Promise<TeamsSession | null> {
  // Teams héberge toujours un onglet dans une iframe/webview. Sortir tôt évite
  // tout téléchargement du SDK lors d'une visite navigateur normale.
  if (window.parent === window && !window.opener) return null;

  try {
    const { app } = await import('@microsoft/teams-js');
    await withTimeout(app.initialize());
    const context = await withTimeout(app.getContext());

    // Demande à Teams de masquer son indicateur de chargement.
    app.notifySuccess();

    return {
      email: context.user?.userPrincipalName ?? context.user?.loginHint ?? null,
      theme: (context.app?.theme as TeamsTheme) ?? 'default',
    };
  } catch {
    // Soit nous ne sommes pas dans Teams, soit l'hôte n'a jamais répondu.
    return null;
  }
}

/**
 * Le thème contrasté de Teams est sombre, donc traité comme `dark`.
 * La bascule elle-même passe par next-themes (voir TeamsHostBridge), qui possède
 * la classe `dark` sur <html>.
 */
export function themeToAppTheme(theme: TeamsTheme): 'light' | 'dark' {
  return theme === 'dark' || theme === 'contrast' ? 'dark' : 'light';
}

/** S'abonne aux changements de thème Teams. Renvoie une fonction de nettoyage. */
export function watchTeamsTheme(onChange: (theme: TeamsTheme) => void): () => void {
  let cancelled = false;
  void getTeamsSession().then(async (session) => {
    if (cancelled || !session) return;
    const { app } = await import('@microsoft/teams-js');
    app.registerOnThemeChangeHandler((theme) => {
      if (!cancelled) onChange(theme as TeamsTheme);
    });
  });
  return () => {
    cancelled = true;
  };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('teams-host-timeout')), HOST_TIMEOUT_MS),
    ),
  ]);
}
