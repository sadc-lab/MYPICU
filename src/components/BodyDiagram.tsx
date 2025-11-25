import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
              {/* Légende */}
              <div className="flex items-center justify-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-muted-foreground">Critique</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-muted-foreground">Avertissement</span>
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
                    
                    <text
                      x="100"
                      y="155"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="start"
                    >
                      Cerveau
                    </text>
                    
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
                    
                    <text
                      x="100"
                      y="355"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="start"
                    >
                      Cœur
                    </text>
                    
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
                    
                    <text
                      x="100"
                      y="555"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="start"
                    >
                      Poumons
                    </text>
                    
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