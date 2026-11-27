import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import BrainIcon from '@/assets/brain-icon.svg';
import HeartIcon from '@/assets/heart-mypicu.svg';
import LungsIcon from '@/assets/lungs-icon.svg';
import { useI18n } from '@/i18n';

interface InteractiveGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InteractiveGuide = ({ isOpen, onClose }: InteractiveGuideProps) => {
  const [run, setRun] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (isOpen) {
      setRun(true);
    }
  }, [isOpen]);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-lg font-bold mb-2">{t("Bienvenue dans MYPICU!", "Welcome to MYPICU!")}</h2>
          <p>{t("Ce guide interactif vous aidera à naviguer dans l'interface. Cliquez sur \"Suivant\" pour commencer.", "This interactive guide will help you navigate the interface. Click \"Next\" to begin.")}</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <img src={BrainIcon} alt="Brain" className="w-5 h-5" />
            Module OptiBrain
          </h3>
          <p className="mb-2">{t("Surveillance neurologique complète du patient :", "Comprehensive neurological monitoring of the patient:")}</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>{t("Pression intracrânienne (PIC)", "Intracranial pressure (ICP)")}</strong>{t(" - Monitoring et alertes", " - Monitoring and alerts")}</li>
            <li><strong>{t("Pression de perfusion cérébrale optimale (PPC)", "Optimal cerebral perfusion pressure (CPP)")}</strong>{t(" - Suivi en temps réel", " - Real-time tracking")}</li>
            <li><strong>{t("Indicateurs", "Indicators")}</strong>{t(" - Évaluation et ajustement", " - Assessment and adjustment")}</li>
            <li><strong>{t("Lignes directrices", "Guidelines")}</strong>{t(" - Analyse de l'activité cérébrale", " - Brain activity analysis")}</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <img src={HeartIcon} alt="Heart" className="w-5 h-5" />
            Module OptiHeart
          </h3>
          <p className="mb-2">{t("Surveillance cardiovasculaire avancée :", "Advanced cardiovascular monitoring:")}</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>{t("Débit cardiaque", "Cardiac output")}</strong>{t(" - Mesure et évolution", " - Measurement and trend")}</li>
            <li><strong>{t("Pression artérielle", "Blood pressure")}</strong>{t(" - MAP, systolique, diastolique", " - MAP, systolic, diastolic")}</li>
            <li><strong>{t("Bilan hydrique", "Fluid balance")}</strong>{t(" - Entrées/sorties", " - Intake/output")}</li>
            <li><strong>{t("Échocardiographie", "Echocardiography")}</strong>{t(" - Résultats et analyses", " - Results and analyses")}</li>
            <li><strong>Lactates</strong>{t(" - Indicateur de perfusion tissulaire", " - Tissue perfusion indicator")}</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <img src={LungsIcon} alt="Lungs" className="w-5 h-5" />
            Module OptiLungs
          </h3>
          <p className="mb-2">{t("Surveillance respiratoire complète :", "Comprehensive respiratory monitoring:")}</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>{t("Ventilation mécanique", "Mechanical ventilation")}</strong>{t(" - Paramètres et modes", " - Settings and modes")}</li>
            <li><strong>{t("Gaz du sang", "Blood gases")}</strong> - pH, PaO2, PaCO2, HCO3</li>
            <li><strong>{t("Compliance pulmonaire", "Lung compliance")}</strong>{t(" - Évaluation dynamique", " - Dynamic assessment")}</li>
            <li><strong>{t("Prédiction VAP", "VAP prediction")}</strong>{t(" - Risque de pneumonie associée à la ventilation", " - Ventilator-associated pneumonia risk")}</li>
            <li><strong>{t("Sevrage respiratoire", "Ventilator weaning")}</strong>{t(" - Critères et progression", " - Criteria and progress")}</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '[data-guide="search"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Recherche de patients", "Patient search")}</h3>
          <p>{t("Utilisez cette barre pour rechercher rapidement un patient par nom, identifiant ou PED.", "Use this bar to quickly find a patient by name, ID or PED.")}</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="patient-nav"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Navigation des patients", "Patient navigation")}</h3>
          <p>{t("Accédez aux différentes vues de monitoring : Statistiques, Cerveau, Cœur et Poumons.", "Access the monitoring views: Statistics, Brain, Heart and Lungs.")}</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="tour-info"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Tournée active", "Active rounds")}</h3>
          <p>{t("Lorsqu'une tournée est active, vous pouvez naviguer entre les patients et confirmer vos visites.", "When rounds are active, you can move between patients and confirm your visits.")}</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="user-menu"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Menu utilisateur", "User menu")}</h3>
          <p>{t("Accédez à vos commentaires, à l'aide et déconnectez-vous ici.", "Access feedback and help, and sign out here.")}</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="organize-tour"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Organiser une tournée", "Organize rounds")}</h3>
          <p>{t("Créez et organisez vos tournées de patients par glisser-déposer selon vos priorités.", "Create and organize your patient rounds by drag and drop according to your priorities.")}</p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '[data-guide="patient-table"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">{t("Liste des patients", "Patient list")}</h3>
          <p>{t("Visualisez tous vos patients avec leurs informations clés, alarmes et scores PELOD.", "View all your patients with their key information, alarms and PELOD scores.")}</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-lg font-bold mb-2">{t("Guide terminé!", "Guide complete!")}</h2>
          <p>{t("Vous êtes maintenant prêt à utiliser myPICU. Vous pouvez relancer ce guide à tout moment depuis le menu Aide.", "You are now ready to use myPICU. You can restart this guide at any time from the Help menu.")}</p>
        </div>
      ),
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      onClose();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb',
          zIndex: 10000,
          // Suit le thème clair / sombre.
          backgroundColor: 'hsl(var(--popover))',
          arrowColor: 'hsl(var(--popover))',
          textColor: 'hsl(var(--popover-foreground))',
        },
        tooltip: {
          borderRadius: 8,
        },
        buttonNext: {
          backgroundColor: '#2563eb',
          borderRadius: 6,
          padding: '8px 16px',
        },
        buttonBack: {
          color: '#6b7280',
          marginRight: 8,
        },
        buttonSkip: {
          color: '#6b7280',
        },
      }}
      locale={{
        back: t('Retour', 'Back'),
        close: t('Fermer', 'Close'),
        last: t('Terminer', 'Finish'),
        next: t('Suivant', 'Next'),
        skip: t('Passer', 'Skip'),
      }}
    />
  );
};
