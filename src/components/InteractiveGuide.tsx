import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import BrainIcon from '@/assets/brain-icon.svg';
import HeartIcon from '@/assets/heart-mypicu.svg';
import LungsIcon from '@/assets/lungs-icon.svg';

interface InteractiveGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InteractiveGuide = ({ isOpen, onClose }: InteractiveGuideProps) => {
  const [run, setRun] = useState(false);

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
          <h2 className="text-lg font-bold mb-2">Bienvenue dans MYPICU!</h2>
          <p>Ce guide interactif vous aidera à naviguer dans l'interface. Cliquez sur "Suivant" pour commencer.</p>
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
          <p className="mb-2">Surveillance neurologique complète du patient :</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>Pression intracrânienne (PIC)</strong> - Monitoring et alertes</li>
            <li><strong>Pression de perfusion cérébrale optimale (PPC)</strong> - Suivi en temps réel</li>
            <li><strong>Indicateurs</strong> - Évaluation et ajustement</li>
            <li><strong>Lignes directrices</strong> - Analyse de l'activité cérébrale</li>
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
          <p className="mb-2">Surveillance cardiovasculaire avancée :</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>Débit cardiaque</strong> - Mesure et évolution</li>
            <li><strong>Pression artérielle</strong> - MAP, systolique, diastolique</li>
            <li><strong>Bilan hydrique</strong> - Entrées/sorties</li>
            <li><strong>Échocardiographie</strong> - Résultats et analyses</li>
            <li><strong>Lactates</strong> - Indicateur de perfusion tissulaire</li>
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
          <p className="mb-2">Surveillance respiratoire complète :</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>Ventilation mécanique</strong> - Paramètres et modes</li>
            <li><strong>Gaz du sang</strong> - pH, PaO2, PaCO2, HCO3</li>
            <li><strong>Compliance pulmonaire</strong> - Évaluation dynamique</li>
            <li><strong>Prédiction VAP</strong> - Risque de pneumonie associée à la ventilation</li>
            <li><strong>Sevrage respiratoire</strong> - Critères et progression</li>
          </ul>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '[data-guide="search"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Recherche de patients</h3>
          <p>Utilisez cette barre pour rechercher rapidement un patient par nom, identifiant ou PED.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="patient-nav"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Navigation des patients</h3>
          <p>Accédez aux différentes vues de monitoring : Statistiques, Cerveau, Cœur et Poumons.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="tour-info"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Tournée active</h3>
          <p>Lorsqu'une tournée est active, vous pouvez naviguer entre les patients et confirmer vos visites.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="user-menu"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Menu utilisateur</h3>
          <p>Accédez à vos commentaires, à l'aide et déconnectez-vous ici.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-guide="organize-tour"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Organiser une tournée</h3>
          <p>Créez et organisez vos tournées de patients par glisser-déposer selon vos priorités.</p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '[data-guide="patient-table"]',
      content: (
        <div>
          <h3 className="font-semibold mb-2">Liste des patients</h3>
          <p>Visualisez tous vos patients avec leurs informations clés, alarmes et scores PELOD.</p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      content: (
        <div>
          <h2 className="text-lg font-bold mb-2">Guide terminé!</h2>
          <p>Vous êtes maintenant prêt à utiliser myPICU. Vous pouvez relancer ce guide à tout moment depuis le menu Aide.</p>
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
        back: 'Retour',
        close: 'Fermer',
        last: 'Terminer',
        next: 'Suivant',
        skip: 'Passer',
      }}
    />
  );
};
