// Guide interactif de MyPICU (menu Aide). Chaque étape a la même structure
// (icône, titre, texte) et s'affiche dans une infobulle aux couleurs de
// l'application, qui suit le thème clair / sombre.

import { useState, useEffect, type ReactNode } from 'react';
import Joyride, { Step, CallBackProps, STATUS, type TooltipRenderProps } from 'react-joyride';
import { ArrowLeft, ArrowRight, Check, Compass, LayoutList, ListOrdered, Search, Sparkles, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import BrainIcon from '@/assets/brain-icon.svg';
import HeartIcon from '@/assets/heart-mypicu.svg';
import LungsIcon from '@/assets/lungs-icon.svg';
import KidneyIcon from '@/assets/kidney-icon.svg';
import IntestineIcon from '@/assets/intestine-icon.svg';
import StatsIcon from '@/assets/stats-icon.svg';
import mypicuLogo from '@/assets/mypicu-logo.png';
import { useI18n } from '@/i18n';

interface InteractiveGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStepData {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}

type GuideStep = Step & { data: GuideStepData };

const iconBox = (children: ReactNode) => (
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{children}</span>
);

const GuideTooltip = ({
  index,
  size,
  step,
  isLastStep,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) => {
  const { t } = useI18n();
  const data = (step as GuideStep).data;
  const isCentered = step.placement === 'center';

  return (
    <div
      {...tooltipProps}
      className={cn(
        'rounded-xl border bg-popover text-popover-foreground shadow-xl',
        isCentered ? 'w-[min(92vw,520px)]' : 'w-[min(92vw,360px)]',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        {data.icon}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t(`Étape ${index + 1} sur ${size}`, `Step ${index + 1} of ${size}`)}
          </p>
          <h3 className="text-base font-semibold leading-snug text-foreground">{data.title}</h3>
        </div>
        <button
          {...closeProps}
          type="button"
          aria-label={t('Fermer le guide', 'Close the guide')}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-4 text-sm leading-relaxed text-foreground/90">{data.body}</div>

      {/* Progression : un segment par étape. */}
      <div className="flex gap-1 px-4" aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 p-4 pt-3">
        {!isLastStep ? (
          <button
            {...skipProps}
            type="button"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('Passer le guide', 'Skip guide')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {index > 0 && (
            <Button {...backProps} type="button" variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('Retour', 'Back')}
            </Button>
          )}
          <Button {...primaryProps} type="button" size="sm" className="gap-1">
            {isLastStep ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {t('Terminer', 'Finish')}
              </>
            ) : (
              <>
                {index === 0 ? t('Commencer', 'Start') : t('Suivant', 'Next')}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const InteractiveGuide = ({ isOpen, onClose }: InteractiveGuideProps) => {
  const [run, setRun] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (isOpen) {
      setRun(true);
    }
  }, [isOpen]);

  const modules: Array<{ icon: string; name: string; desc: string }> = [
    { icon: StatsIcon, name: 'OptiState', desc: t("Vue d'ensemble et classifications d'organes", 'Overview and organ classifications') },
    { icon: BrainIcon, name: 'OptiBrain', desc: t('PIC, PPC et autorégulation cérébrale', 'ICP, CPP and cerebral autoregulation') },
    { icon: HeartIcon, name: 'OptiHeart', desc: t('Débit cardiaque, pressions, lactates', 'Cardiac output, pressures, lactate') },
    { icon: LungsIcon, name: 'OptiLungs', desc: t('Ventilation, gaz du sang, sevrage', 'Ventilation, blood gases, weaning') },
    { icon: KidneyIcon, name: 'OptiRenal', desc: t('Bilan, diurèse, filtration, néphrotoxiques', 'Balance, urine output, filtration, nephrotoxic drugs') },
    { icon: IntestineIcon, name: 'OptiGastro', desc: t('Module en construction', 'Module under construction') },
  ];

  const stepData: Array<Omit<GuideStep, 'content'>> = [
    {
      target: 'body',
      placement: 'center',
      disableBeacon: true,
      data: {
        icon: <img src={mypicuLogo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />,
        title: t('Bienvenue dans MyPICU', 'Welcome to MyPICU'),
        body: (
          <p>
            {t(
              "En quelques étapes, découvrez les modules d'organes et les outils de la barre de navigation. Vous pouvez quitter à tout moment.",
              'In a few steps, discover the organ modules and the navigation bar tools. You can leave at any time.',
            )}
          </p>
        ),
      },
    },
    {
      target: 'body',
      placement: 'center',
      data: {
        icon: iconBox(<Compass className="h-5 w-5" />),
        title: t("Les modules d'organes", 'The organ modules'),
        body: (
          <>
            <p className="mb-3">
              {t(
                "Chaque module regroupe les indicateurs d'un système, avec leurs cibles et un graphique de monitorage dont on peut ajuster l'échelle et la période.",
                "Each module groups one system's indicators, with their targets and a monitoring chart whose scale and period can be adjusted.",
              )}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <li key={m.name} className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
                  <img src={m.icon} alt="" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ),
      },
    },
    {
      target: '[data-guide="search"]',
      placement: 'bottom',
      data: {
        icon: iconBox(<Search className="h-5 w-5" />),
        title: t('Recherche de patients', 'Patient search'),
        body: <p>{t('Retrouvez rapidement un patient par nom, identifiant ou PED.', 'Quickly find a patient by name, ID or PED.')}</p>,
      },
    },
    {
      target: '[data-guide="patient-nav"]',
      placement: 'bottom',
      data: {
        icon: iconBox(<LayoutList className="h-5 w-5" />),
        title: t('Navigation entre les modules', 'Moving between modules'),
        body: <p>{t('Passez d’un module à l’autre pour le patient affiché, sans perdre la période choisie.', 'Switch modules for the displayed patient without losing the chosen period.')}</p>,
      },
    },
    {
      target: '[data-guide="tour-info"]',
      placement: 'bottom',
      data: {
        icon: iconBox(<Users className="h-5 w-5" />),
        title: t('Tournée active', 'Active rounds'),
        body: <p>{t('Pendant une tournée, passez au patient suivant et confirmez vos visites.', 'During rounds, move to the next patient and confirm your visits.')}</p>,
      },
    },
    {
      target: '[data-guide="user-menu"]',
      placement: 'bottom',
      data: {
        icon: iconBox(<UserRound className="h-5 w-5" />),
        title: t('Menu utilisateur', 'User menu'),
        body: (
          <p>
            {t(
              'Commentaires, aide et déconnexion. Juste à côté : la langue (FR / EN) et le mode clair / sombre.',
              'Feedback, help and sign out. Right next to it: language (FR / EN) and light / dark mode.',
            )}
          </p>
        ),
      },
    },
    {
      target: '[data-guide="organize-tour"]',
      placement: 'left',
      data: {
        icon: iconBox(<ListOrdered className="h-5 w-5" />),
        title: t('Organiser une tournée', 'Organize rounds'),
        body: <p>{t('Ordonnez vos patients par glisser-déposer selon vos priorités.', 'Order your patients by drag and drop according to your priorities.')}</p>,
      },
    },
    {
      target: '[data-guide="patient-table"]',
      placement: 'bottom',
      data: {
        icon: iconBox(<LayoutList className="h-5 w-5" />),
        title: t('Liste des patients', 'Patient list'),
        body: <p>{t("Les informations clés, alarmes et scores PELOD de l'unité. Cliquez sur un patient pour ouvrir son dossier.", "The unit's key information, alarms and PELOD scores. Click a patient to open their record.")}</p>,
      },
    },
    {
      target: 'body',
      placement: 'center',
      data: {
        icon: iconBox(<Sparkles className="h-5 w-5" />),
        title: t('Vous êtes prêt', "You're all set"),
        body: <p>{t('Relancez ce guide à tout moment depuis le menu Aide.', 'Restart this guide at any time from the Help menu.')}</p>,
      },
    },
  ];
  // `content` est exigé par Joyride ; l'infobulle personnalisée affiche `data`.
  const steps: GuideStep[] = stepData.map((s) => ({ ...s, content: s.data.title }));

  const handleJoyrideCallback = (data: CallBackProps) => {
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(data.status)) {
      setRun(false);
      onClose();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      scrollToFirstStep
      tooltipComponent={GuideTooltip}
      callback={handleJoyrideCallback}
      floaterProps={{ hideArrow: false }}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: 'hsl(var(--popover))',
          overlayColor: 'rgba(15, 23, 42, 0.55)',
        },
        spotlight: { borderRadius: 10 },
      }}
    />
  );
};
