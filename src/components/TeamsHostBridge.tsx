import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getTeamsSession, themeToAppTheme, watchTeamsTheme } from '@/lib/teams';

/**
 * Relie l'application à son hôte Teams : signale la fin du chargement (sinon
 * Teams laisse tourner son indicateur) et aligne le thème clair/sombre sur celui
 * du client. Ne fait rien dans un navigateur ordinaire.
 */
export const TeamsHostBridge = () => {
  const { setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    void getTeamsSession().then((session) => {
      if (cancelled || !session) return;
      setTheme(themeToAppTheme(session.theme));
    });

    const stopWatching = watchTeamsTheme((theme) => setTheme(themeToAppTheme(theme)));

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [setTheme]);

  return null;
};
