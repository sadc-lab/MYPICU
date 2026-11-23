import { useEffect, useState } from 'react';
import { tr } from '@/i18n';

// Page de configuration d'un onglet de canal ou de conversation. Teams l'ouvre
// dans une boîte de dialogue au moment d'ajouter l'onglet ; elle ne s'affiche
// jamais dans une session de navigateur normale. Les onglets personnels ne
// passent pas par ici : ils pointent directement vers / et /autoreg.

type Target = { path: string; label: () => string; entityId: string };

const TARGETS: Target[] = [
  { path: '/', label: () => tr('Tableau de bord', 'Dashboard'), entityId: 'mypicu-dashboard' },
  { path: '/autoreg', label: () => tr('Autorégulation', 'Autoregulation'), entityId: 'mypicu-autoreg' },
];

const TeamsConfig = () => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [target, setTarget] = useState<Target>(TARGETS[0]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { app, pages } = await import('@microsoft/teams-js');
        await app.initialize();
        if (cancelled) return;

        pages.config.registerOnSaveHandler((saveEvent) => {
          pages.config.setConfig({
            entityId: target.entityId,
            contentUrl: `${window.location.origin}${target.path}`,
            websiteUrl: `${window.location.origin}${target.path}`,
            suggestedDisplayName: target.label(),
          });
          saveEvent.notifySuccess();
        });

        pages.config.setValidityState(true);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Le gestionnaire capture `target` : il est réenregistré à chaque choix.
  }, [target]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold text-foreground">MYPICU</h1>

        {status === 'loading' && (
          <p className="mt-2 text-sm text-muted-foreground">{tr("Connexion à Teams…", "Connecting to Teams…")}</p>
        )}

        {status === 'ready' && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr('Choisissez la vue à épingler dans ce canal, puis appuyez sur Enregistrer.', 'Choose the view to pin in this channel, then press Save.')}
            </p>
            <div className="mt-4 space-y-2 text-left">
              {TARGETS.map((t) => (
                <label
                  key={t.path}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    target.path === t.path
                      ? 'border-primary/40 bg-primary/5 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mypicu-tab-target"
                    className="accent-primary"
                    checked={target.path === t.path}
                    onChange={() => setTarget(t)}
                  />
                  <span className="font-medium">{t.label()}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {status === 'unavailable' && (
          <p className="mt-2 text-sm text-muted-foreground">
            {tr("Cette page sert à Microsoft Teams lors de l'ajout de l'onglet. Il n'y a rien à configurer ici.", 'This page is used by Microsoft Teams when adding the tab. There is nothing to configure here.')}
          </p>
        )}
      </div>
    </div>
  );
};

export default TeamsConfig;
