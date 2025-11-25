import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import anatomyDiagram from '@/assets/anatomy-diagram.png';
import anatomyNormal from '@/assets/anatomy-normal.png';

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

              <svg viewBox="0 0 1000 600" className="w-full h-auto">
                <defs>
                  {/* Gradient pour les lignes */}
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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

                {/* Grille horizontale */}
                {[0, 20, 40, 60, 80, 100].map((value) => (
                  <g key={value}>
                    <line
                      x1="150"
                      y1={500 - value * 4}
                      x2="850"
                      y2={500 - value * 4}
                      stroke="hsl(var(--border))"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.3"
                    />
                    <text
                      x="120"
                      y={505 - value * 4}
                      className="text-xs"
                      fill="hsl(var(--muted-foreground))"
                      textAnchor="end"
                    >
                      {value}
                    </text>
                  </g>
                ))}

                {/* Organe Cerveau */}
                {brainStatus && organIndicators['brain'] && (
                  <g>
                    {/* Ligne verticale */}
                    <line
                      x1="250"
                      y1="100"
                      x2="250"
                      y2="500"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {/* Points pour chaque indicateur */}
                    {organIndicators['brain'].slice(0, 4).map((indicator, idx) => {
                      const yPosition = 500 - (80 - idx * 20) * 4;
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('brain')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          {/* Ligne de connexion au point */}
                          <line
                            x1="250"
                            y1={yPosition}
                            x2="250"
                            y2={yPosition}
                            stroke={isCritical ? '#dc2626' : '#ea580c'}
                            strokeWidth="3"
                          />
                          
                          {/* Point */}
                          <circle
                            cx="250"
                            cy={yPosition}
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                          />
                          
                          {/* Valeur du point */}
                          <text
                            x="270"
                            y={yPosition + 5}
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                          >
                            {indicator.label}: {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Label de l'organe */}
                    <text
                      x="250"
                      y="530"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="middle"
                    >
                      🧠 Cerveau
                    </text>
                    
                    {/* Badge de compte */}
                    <circle cx="250" cy="70" r="18" fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'} />
                    <text x="250" y="76" className="text-xs font-bold" fill="white" textAnchor="middle">
                      {brainStatus.count}
                    </text>
                  </g>
                )}

                {/* Organe Cœur */}
                {heartStatus && organIndicators['heart'] && (
                  <g>
                    <line
                      x1="500"
                      y1="100"
                      x2="500"
                      y2="500"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {organIndicators['heart'].slice(0, 4).map((indicator, idx) => {
                      const yPosition = 500 - (70 - idx * 15) * 4;
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('heart')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <line
                            x1="500"
                            y1={yPosition}
                            x2="500"
                            y2={yPosition}
                            stroke={isCritical ? '#dc2626' : '#ea580c'}
                            strokeWidth="3"
                          />
                          
                          <circle
                            cx="500"
                            cy={yPosition}
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                          />
                          
                          <text
                            x="520"
                            y={yPosition + 5}
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                          >
                            {indicator.label}: {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                    
                    <text
                      x="500"
                      y="530"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="middle"
                    >
                      ❤️ Cœur
                    </text>
                    
                    <circle cx="500" cy="70" r="18" fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'} />
                    <text x="500" y="76" className="text-xs font-bold" fill="white" textAnchor="middle">
                      {heartStatus.count}
                    </text>
                  </g>
                )}

                {/* Organe Poumons */}
                {lungsStatus && organIndicators['lungs'] && (
                  <g>
                    <line
                      x1="750"
                      y1="100"
                      x2="750"
                      y2="500"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                    />
                    
                    {organIndicators['lungs'].slice(0, 4).map((indicator, idx) => {
                      const yPosition = 500 - (85 - idx * 18) * 4;
                      const isCritical = indicator.status === 'critical';
                      
                      return (
                        <g 
                          key={idx}
                          onClick={() => handleOrganClick('lungs')}
                          className="cursor-pointer transition-transform hover:scale-110"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <line
                            x1="750"
                            y1={yPosition}
                            x2="750"
                            y2={yPosition}
                            stroke={isCritical ? '#dc2626' : '#ea580c'}
                            strokeWidth="3"
                          />
                          
                          <circle
                            cx="750"
                            cy={yPosition}
                            r="12"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                            filter="url(#dotGlow)"
                          />
                          
                          <text
                            x="770"
                            y={yPosition + 5}
                            className="text-xs font-semibold"
                            fill={isCritical ? '#dc2626' : '#ea580c'}
                          >
                            {indicator.label}: {indicator.current}
                          </text>
                        </g>
                      );
                    })}
                    
                    <text
                      x="750"
                      y="530"
                      className="text-sm font-bold"
                      fill="hsl(var(--foreground))"
                      textAnchor="middle"
                    >
                      🫁 Poumons
                    </text>
                    
                    <circle cx="750" cy="70" r="18" fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'} />
                    <text x="750" y="76" className="text-xs font-bold" fill="white" textAnchor="middle">
                      {lungsStatus.count}
                    </text>
                  </g>
                )}

                {/* Lignes de corrélation entre organes */}
                {brainStatus && heartStatus && (
                  <line
                    x1="250"
                    y1="50"
                    x2="500"
                    y2="50"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.3"
                  />
                )}
                {heartStatus && lungsStatus && (
                  <line
                    x1="500"
                    y1="50"
                    x2="750"
                    y2="50"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.3"
                  />
                )}
                {brainStatus && lungsStatus && (
                  <line
                    x1="250"
                    y1="40"
                    x2="750"
                    y2="40"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.3"
                  />
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