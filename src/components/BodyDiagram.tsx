import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import anatomyDiagram from '@/assets/anatomy-diagram.png';
import anatomyNormal from '@/assets/anatomy-normal.png';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { HeartIcon } from '@/components/icons/HeartIcon';

interface BodyDiagramProps {
  problematicOrgans: {
    organ: string;
    status: 'critical' | 'warning';
    count: number;
  }[];
  patientId: string;
  organIndicators?: Record<string, Array<{
    label: string;
    current: string;
    target: string;
    status: 'critical' | 'warning';
  }>>;
}

export const BodyDiagram = ({ problematicOrgans, patientId, organIndicators = {} }: BodyDiagramProps) => {
  const navigate = useNavigate();
  
  // États pour la comparaison temporelle
  const [selectedPeriods, setSelectedPeriods] = useState<[number, number]>([0, 8]); // 2 périodes sélectionnées
  const [viewSlider, setViewSlider] = useState([0]); // Position du curseur (0 = période 1, 100 = période 2)
  
  // Génération des périodes disponibles (simulation - remplacer par vraies données)
  const availablePeriods = [
    { id: 0, label: '08:00', timestamp: '2024-01-15 08:00' },
    { id: 1, label: '10:00', timestamp: '2024-01-15 10:00' },
    { id: 2, label: '12:00', timestamp: '2024-01-15 12:00' },
    { id: 3, label: '14:00', timestamp: '2024-01-15 14:00' },
    { id: 4, label: '16:00', timestamp: '2024-01-15 16:00' },
    { id: 5, label: '18:00', timestamp: '2024-01-15 18:00' },
    { id: 6, label: '20:00', timestamp: '2024-01-15 20:00' },
    { id: 7, label: '22:00', timestamp: '2024-01-15 22:00' },
    { id: 8, label: '00:00', timestamp: '2024-01-16 00:00' },
  ];
  
  const handlePeriodClick = (periodId: number) => {
    const [first, second] = selectedPeriods;
    // Si on clique sur une période déjà sélectionnée, ne rien faire
    if (periodId === first || periodId === second) return;
    // Sinon, remplacer la période la plus proche du curseur
    const sliderPos = viewSlider[0];
    if (sliderPos < 50) {
      setSelectedPeriods([periodId, second]);
    } else {
      setSelectedPeriods([first, periodId]);
    }
  };
  
  // Interpolation entre les deux périodes selon la position du curseur
  const currentPeriodWeight = viewSlider[0] / 100; // 0 = période 1, 1 = période 2

  const handleOrganClick = (organ: string) => {
    const organPageMap: Record<string, string> = {
      'brain': 'optibrain',
      'heart': 'optiheart',
      'lungs': 'optilungs'
    };
    
    const page = organPageMap[organ];
    if (page) {
      navigate(`/${page}?patient=${encodeURIComponent(patientId)}`);
    }
  };

  const getOrganStatus = (organ: string) => {
    return problematicOrgans.find(o => o.organ === organ);
  };

  const getOrganColor = (organ: string) => {
    const status = getOrganStatus(organ);
    if (!status) return 'hsl(210 40% 60%)';
    return status.status === 'critical' 
      ? 'hsl(0 84% 60%)' 
      : 'hsl(20 91% 48%)';
  };

  const getOrganOpacity = (organ: string) => {
    const status = getOrganStatus(organ);
    return status ? '0.85' : '0.6';
  };

  const brainStatus = getOrganStatus('brain');
  const heartStatus = getOrganStatus('heart');
  const lungsStatus = getOrganStatus('lungs');
  
  // Check if there are any problematic organs
  const hasProblems = problematicOrgans.length > 0;

  const getOrganInfo = (organ: string) => {
    const infoMap: Record<string, { name: string; function: string; normal: string }> = {
      brain: {
        name: 'Cerveau',
        function: 'Contrôle toutes les fonctions du corps, conscience, mémoire, coordination',
        normal: 'PIC: 5-15 mmHg, Débit sanguin: 50 mL/100g/min'
      },
      heart: {
        name: 'Cœur',
        function: 'Pompe le sang oxygéné vers tous les organes du corps',
        normal: 'FC: 60-100 bpm, Débit cardiaque: 4-8 L/min, PAM: 70-100 mmHg'
      },
      lungs: {
        name: 'Poumons',
        function: 'Échanges gazeux: oxygénation du sang et élimination du CO2',
        normal: 'SpO2: >95%, FR: 12-20/min, PaO2: 80-100 mmHg'
      },
    };
    return infoMap[organ] || { name: '', function: '', normal: '' };
  };

  // Generate clinical recommendations based on problematic organs
  const getRecommendations = () => {
    const recommendations: Array<{ organ: string; text: string; priority: 'critical' | 'warning' }> = [];
    
    if (brainStatus) {
      if (brainStatus.status === 'critical') {
        recommendations.push({
          organ: 'Cerveau',
          text: 'Surveillance neurologique rapprochée nécessaire. Évaluer la pression intracrânienne et envisager une imagerie cérébrale urgente.',
          priority: 'critical'
        });
      } else {
        recommendations.push({
          organ: 'Cerveau',
          text: 'Surveiller l\'évolution des paramètres neurologiques. Adapter la sédation si nécessaire.',
          priority: 'warning'
        });
      }
    }
    
    if (heartStatus) {
      if (heartStatus.status === 'critical') {
        recommendations.push({
          organ: 'Cœur',
          text: 'Support hémodynamique urgent requis. Considérer l\'ajustement des inotropes/vasopresseurs et évaluer la fonction cardiaque par échocardiographie.',
          priority: 'critical'
        });
      } else {
        recommendations.push({
          organ: 'Cœur',
          text: 'Optimiser le bilan hydrique et surveiller la fonction cardiaque. Réévaluer les besoins en support cardiovasculaire.',
          priority: 'warning'
        });
      }
    }
    
    if (lungsStatus) {
      if (lungsStatus.status === 'critical') {
        recommendations.push({
          organ: 'Poumons',
          text: 'Détresse respiratoire nécessitant une intervention immédiate. Optimiser les paramètres ventilatoires et envisager des stratégies protectrices.',
          priority: 'critical'
        });
      } else {
        recommendations.push({
          organ: 'Poumons',
          text: 'Surveiller l\'oxygénation et les échanges gazeux. Ajuster la FiO2 et les paramètres de ventilation selon les besoins.',
          priority: 'warning'
        });
      }
    }
    
    return recommendations;
  };

  const recommendations = getRecommendations();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative w-full max-w-4xl mx-auto py-8 animate-fade-in">
        <div className="text-center mb-6">
          <h3 className="text-base font-semibold text-foreground">Vue systémique - Corrélations entre organes</h3>
        </div>
        
        {/* Timeline interactive de comparaison */}
        {hasProblems && (
          <div className="mb-8 bg-card border-2 border-border rounded-lg p-6 shadow-lg">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Comparaison temporelle
              </h4>
              <p className="text-xs text-muted-foreground">Sélectionnez deux périodes sur la timeline et utilisez le curseur pour comparer</p>
            </div>
            
            {/* Timeline interactive */}
            <div className="relative mb-8">
              <div className="flex justify-between items-center mb-2">
                {availablePeriods.map((period) => {
                  const isSelected = period.id === selectedPeriods[0] || period.id === selectedPeriods[1];
                  const isFirstPeriod = period.id === selectedPeriods[0];
                  const isSecondPeriod = period.id === selectedPeriods[1];
                  
                  return (
                    <TooltipProvider key={period.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handlePeriodClick(period.id)}
                            className={`flex flex-col items-center transition-all ${
                              isSelected 
                                ? 'scale-110' 
                                : 'opacity-50 hover:opacity-100 hover:scale-105'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 mb-1 ${
                              isFirstPeriod 
                                ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50' 
                                : isSecondPeriod 
                                ? 'bg-purple-500 border-purple-600 shadow-lg shadow-purple-500/50'
                                : 'bg-muted border-border'
                            }`} />
                            <span className={`text-xs ${
                              isSelected ? 'font-bold text-foreground' : 'text-muted-foreground'
                            }`}>
                              {period.label}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{period.timestamp}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              
              {/* Ligne de connexion entre les périodes sélectionnées */}
              <div className="absolute top-2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-400 to-purple-500 opacity-30" 
                   style={{
                     marginLeft: `${(selectedPeriods[0] / 8) * 100}%`,
                     width: `${((selectedPeriods[1] - selectedPeriods[0]) / 8) * 100}%`
                   }} />
            </div>
            
            {/* Curseur de comparaison */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="font-semibold text-foreground">
                    Période 1: {availablePeriods[selectedPeriods[0]].label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Période 2: {availablePeriods[selectedPeriods[1]].label}
                  </span>
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                </div>
              </div>
              
              <div className="relative">
                <Slider
                  value={viewSlider}
                  onValueChange={setViewSlider}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg pointer-events-none transition-all duration-200"
                  style={{
                    left: `${viewSlider[0]}%`,
                    transform: `translate(-50%, -50%)`,
                    background: `linear-gradient(90deg, rgb(59, 130, 246) ${100 - viewSlider[0]}%, rgb(168, 85, 247) ${viewSlider[0]}%)`
                  }}
                >
                  {viewSlider[0] < 50 ? '← Période 1' : 'Période 2 →'}
                </div>
              </div>
              
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewSlider([0])}
                  className="text-xs"
                >
                  Période 1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewSlider([50])}
                  className="text-xs"
                >
                  Transition
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewSlider([100])}
                  className="text-xs"
                >
                  Période 2
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Recommandations cliniques au-dessus */}
        {hasProblems && recommendations.length > 0 && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recommandations cliniques
            </h4>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className={`flex gap-3 p-3 rounded-lg ${
                    rec.priority === 'critical' 
                      ? 'bg-red-100 dark:bg-red-900/20 border-l-4 border-red-500' 
                      : 'bg-orange-100 dark:bg-orange-900/20 border-l-4 border-orange-500'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {rec.priority === 'critical' ? (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-foreground">{rec.organ}</div>
                    <div className="text-sm text-muted-foreground mt-1">{rec.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Graphique à points dispersés pour les organes */}
        <div className="relative w-full bg-card border rounded-lg p-6" style={{ minHeight: '500px' }}>
          {hasProblems ? (
            <div className="space-y-6">
              {/* Indicateur de période active */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div 
                  className="px-4 py-2 rounded-full font-semibold text-sm shadow-lg transition-all duration-300"
                  style={{
                    background: `linear-gradient(90deg, rgb(59, 130, 246) ${100 - viewSlider[0]}%, rgb(168, 85, 247) ${viewSlider[0]}%)`,
                    color: 'white'
                  }}
                >
                  {viewSlider[0] < 20 ? (
                    <>📊 Période 1 - {availablePeriods[selectedPeriods[0]].timestamp}</>
                  ) : viewSlider[0] > 80 ? (
                    <>📊 Période 2 - {availablePeriods[selectedPeriods[1]].timestamp}</>
                  ) : (
                    <>⚖️ Transition entre périodes</>
                  )}
                </div>
              </div>
              
              <svg viewBox="0 0 1200 700" className="w-full h-auto">
                <defs>
                  {/* Gradient pour les lignes */}
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
                  </linearGradient>
                  
                  {/* Filtres pour les points */}
                  <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Échelle de temps sur l'axe X */}
                <g>
                  {/* Ligne de l'axe X */}
                  <line
                    x1="200"
                    y1="620"
                    x2="1100"
                    y2="620"
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                  />
                  
                  {/* Labels de temps */}
                  {['8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h', '0h'].map((time, idx) => {
                    const xPos = 200 + (idx * 112.5);
                    return (
                      <g key={time}>
                        <line
                          x1={xPos}
                          y1="615"
                          x2={xPos}
                          y2="625"
                          stroke="hsl(var(--border))"
                          strokeWidth="2"
                        />
                        <text
                          x={xPos}
                          y="645"
                          className="text-xs font-medium"
                          fill="hsl(var(--muted-foreground))"
                          textAnchor="middle"
                        >
                          {time}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Label de l'axe X */}
                  <text
                    x="650"
                    y="680"
                    className="text-sm font-semibold"
                    fill="hsl(var(--foreground))"
                    textAnchor="middle"
                  >
                    Évolution temporelle (24h)
                  </text>
                </g>

                {/* Grille verticale pour le temps */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                  const xPos = 200 + (idx * 112.5);
                  return (
                    <line
                      key={idx}
                      x1={xPos}
                      y1="80"
                      x2={xPos}
                      y2="620"
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.2"
                    />
                  );
                })}

                {/* Organe Cerveau */}
                {brainStatus && organIndicators['brain'] && (
                  <g>
                    {/* Ligne horizontale pour le cerveau */}
                    <line
                      x1="200"
                      y1="150"
                      x2="1100"
                      y2="150"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {/* Icône et label de l'organe à gauche */}
                    <foreignObject x="20" y="115" width="70" height="70">
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-lg">
                        <img 
                          src={brainIcon} 
                          alt="brain" 
                          className="h-10 w-10"
                          style={{ 
                            filter: brainStatus.status === 'critical' 
                              ? 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'
                              : 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'
                          }}
                        />
                      </div>
                    </foreignObject>
                    
                    {/* Badge de compte */}
                    <circle cx="165" cy="150" r="12" fill="white" stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                    <text x="165" y="155" className="text-xs font-bold" fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'} textAnchor="middle">
                      {brainStatus.count}
                    </text>
                    
                    {/* Points pour chaque indicateur répartis sur la timeline */}
                    {organIndicators['brain'].slice(0, 6).map((indicator, idx) => {
                      // Distribuer les points sur l'échelle de temps (8h à 0h)
                      const timeSlot = idx * 1.5; // Espacement des indicateurs dans le temps
                      const xPosition = 200 + (timeSlot * 112.5);
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('brain')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          {/* Point */}
                          <circle
                            cx={xPosition}
                            cy="150"
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                            opacity="0.9"
                          />
                          
                          {/* Label au-dessus du point */}
                          <text
                            x={xPosition}
                            y="130"
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            textAnchor="middle"
                          >
                            {indicator.label}
                          </text>
                          
                          {/* Valeur en-dessous du point */}
                          <text
                            x={xPosition}
                            y="175"
                            className="text-xs"
                            fill="hsl(var(--muted-foreground))"
                            textAnchor="middle"
                          >
                            {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Organe Cœur */}
                {heartStatus && organIndicators['heart'] && (
                  <g>
                    <line
                      x1="200"
                      y1="350"
                      x2="1100"
                      y2="350"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {/* Icône et label de l'organe à gauche */}
                    <foreignObject x="20" y="315" width="70" height="70">
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-lg">
                        <HeartIcon className={`h-10 w-10 ${
                          heartStatus.status === 'critical' 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-orange-600 dark:text-orange-400'
                        }`} />
                      </div>
                    </foreignObject>
                    
                    <circle cx="165" cy="350" r="12" fill="white" stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                    <text x="165" y="355" className="text-xs font-bold" fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'} textAnchor="middle">
                      {heartStatus.count}
                    </text>
                    
                    {organIndicators['heart'].slice(0, 6).map((indicator, idx) => {
                      const timeSlot = idx * 1.3 + 0.5;
                      const xPosition = 200 + (timeSlot * 112.5);
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('heart')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <circle
                            cx={xPosition}
                            cy="350"
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                            opacity="0.9"
                          />
                          
                          <text
                            x={xPosition}
                            y="330"
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            textAnchor="middle"
                          >
                            {indicator.label}
                          </text>
                          
                          <text
                            x={xPosition}
                            y="375"
                            className="text-xs"
                            fill="hsl(var(--muted-foreground))"
                            textAnchor="middle"
                          >
                            {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Organe Poumons */}
                {lungsStatus && organIndicators['lungs'] && (
                  <g>
                    <line
                      x1="200"
                      y1="550"
                      x2="1100"
                      y2="550"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {/* Icône et label de l'organe à gauche */}
                    <foreignObject x="20" y="515" width="70" height="70">
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center shadow-lg">
                        <img 
                          src={lungsIcon} 
                          alt="lungs" 
                          className="h-10 w-10"
                          style={{ 
                            filter: lungsStatus.status === 'critical' 
                              ? 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)'
                              : 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'
                          }}
                        />
                      </div>
                    </foreignObject>
                    
                    <circle cx="165" cy="550" r="12" fill="white" stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                    <text x="165" y="555" className="text-xs font-bold" fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'} textAnchor="middle">
                      {lungsStatus.count}
                    </text>
                    
                    {organIndicators['lungs'].slice(0, 6).map((indicator, idx) => {
                      const timeSlot = idx * 1.4 + 0.3;
                      const xPosition = 200 + (timeSlot * 112.5);
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('lungs')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <circle
                            cx={xPosition}
                            cy="550"
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                            opacity="0.9"
                          />
                          
                          <text
                            x={xPosition}
                            y="530"
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            textAnchor="middle"
                          >
                            {indicator.label}
                          </text>
                          
                          <text
                            x={xPosition}
                            y="575"
                            className="text-xs"
                            fill="hsl(var(--muted-foreground))"
                            textAnchor="middle"
                          >
                            {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Lignes de corrélation temporelles entre organes */}
                {brainStatus && heartStatus && organIndicators['brain'] && organIndicators['heart'] && (
                  <>
                    {organIndicators['brain'].slice(0, 3).map((_, idx) => {
                      const timeSlot1 = idx * 1.5;
                      const timeSlot2 = idx * 1.3 + 0.5;
                      const xPos1 = 200 + (timeSlot1 * 112.5);
                      const xPos2 = 200 + (timeSlot2 * 112.5);
                      return (
                        <line
                          key={`brain-heart-${idx}`}
                          x1={xPos1}
                          y1="150"
                          x2={xPos2}
                          y2="350"
                          stroke="hsl(var(--primary))"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                          opacity="0.2"
                        />
                      );
                    })}
                  </>
                )}
                {heartStatus && lungsStatus && organIndicators['heart'] && organIndicators['lungs'] && (
                  <>
                    {organIndicators['heart'].slice(0, 3).map((_, idx) => {
                      const timeSlot1 = idx * 1.3 + 0.5;
                      const timeSlot2 = idx * 1.4 + 0.3;
                      const xPos1 = 200 + (timeSlot1 * 112.5);
                      const xPos2 = 200 + (timeSlot2 * 112.5);
                      return (
                        <line
                          key={`heart-lungs-${idx}`}
                          x1={xPos1}
                          y1="350"
                          x2={xPos2}
                          y2="550"
                          stroke="hsl(var(--primary))"
                          strokeWidth="1.5"
                          strokeDasharray="4,4"
                          opacity="0.2"
                        />
                      );
                    })}
                  </>
                )}
              </svg>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-6 py-3 rounded-lg shadow-lg border-2 border-green-500">
                <p className="text-lg font-semibold">✓ Tous les systèmes sont normaux</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};