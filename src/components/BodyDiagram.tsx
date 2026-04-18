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
          <h3 className="text-base font-semibold text-foreground">Vue anatomique</h3>
        </div>
        
        {/* Recommandations et indicateurs problématiques au-dessus du schéma */}
        {hasProblems && (
          <div className="mb-6 space-y-4">
            {/* Recommandations cliniques */}
            {recommendations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
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
                          ? 'bg-red-100 dark:bg-red-900/20' 
                          : 'bg-orange-100 dark:bg-orange-950/20'
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

            {/* Indicateurs problématiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {brainStatus && organIndicators['brain'] && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${brainStatus.status === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
                    <span className="text-sm font-semibold">Cerveau</span>
                  </div>
                  {organIndicators['brain'].slice(0, 2).map((indicator, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border-2 ${
                        brainStatus.status === 'critical' 
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
                          : 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${
                        brainStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {indicator.label}: {indicator.current}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cible: {indicator.target}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {heartStatus && organIndicators['heart'] && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${heartStatus.status === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
                    <span className="text-sm font-semibold">Cœur</span>
                  </div>
                  {organIndicators['heart'].slice(0, 2).map((indicator, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border-2 ${
                        heartStatus.status === 'critical' 
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
                          : 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${
                        heartStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {indicator.label}: {indicator.current}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cible: {indicator.target}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {lungsStatus && organIndicators['lungs'] && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${lungsStatus.status === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
                    <span className="text-sm font-semibold">Poumons</span>
                  </div>
                  {organIndicators['lungs'].slice(0, 2).map((indicator, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border-2 ${
                        lungsStatus.status === 'critical' 
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20' 
                          : 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${
                        lungsStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {indicator.label}: {indicator.current}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cible: {indicator.target}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
        
        <div className="relative flex justify-center">
          {/* Main anatomy image - switch based on organ status */}
          <img 
            src={hasProblems ? anatomyDiagram : anatomyNormal}
            alt="Diagramme anatomique" 
            className="w-full max-w-lg h-auto"
          />
          
          {/* Catheter markers overlay */}
          <svg 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-full pointer-events-none"
            viewBox="0 0 400 600"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Central venous catheter (neck/chest) */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <g className="pointer-events-auto cursor-help">
                    <circle cx="210" cy="120" r="8" fill="hsl(220 100% 50%)" opacity="0.8" stroke="white" strokeWidth="2" />
                    <circle cx="210" cy="120" r="8" fill="hsl(220 100% 50%)" opacity="0.5">
                      <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x="225" y="125" fill="hsl(220 100% 40%)" fontSize="12" fontWeight="bold">CVC</text>
                  </g>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-semibold">Cathéter Veineux Central</p>
                  <p className="text-xs">Position: Veine jugulaire/sous-clavière</p>
                  <p className="text-xs">Usage: Prélèvements sanguins, monitoring hémodynamique</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Arterial line (wrist) - left */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <g className="pointer-events-auto cursor-help">
                    <circle cx="140" cy="380" r="7" fill="hsl(0 100% 60%)" opacity="0.8" stroke="white" strokeWidth="2" />
                    <circle cx="140" cy="380" r="7" fill="hsl(0 100% 60%)" opacity="0.5">
                      <animate attributeName="r" values="7;11;7" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x="105" y="385" fill="hsl(0 100% 50%)" fontSize="11" fontWeight="bold">Art</text>
                  </g>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-semibold">Ligne Artérielle</p>
                  <p className="text-xs">Position: Artère radiale (poignet)</p>
                  <p className="text-xs">Usage: Monitoring continu PA, gazométrie artérielle</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Peripheral IV (right arm) */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <g className="pointer-events-auto cursor-help">
                    <circle cx="270" cy="320" r="6" fill="hsl(280 100% 60%)" opacity="0.8" stroke="white" strokeWidth="2" />
                    <circle cx="270" cy="320" r="6" fill="hsl(280 100% 60%)" opacity="0.5">
                      <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x="280" y="325" fill="hsl(280 100% 50%)" fontSize="11" fontWeight="bold">PIV</text>
                  </g>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-semibold">Cathéter Intraveineux Périphérique</p>
                  <p className="text-xs">Position: Veine du bras</p>
                  <p className="text-xs">Usage: Médication, prélèvements sanguins occasionnels</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </svg>
          
          {/* Message when everything is normal */}
          {!hasProblems && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-6 py-3 rounded-lg shadow-lg border-2 border-green-500">
                <p className="text-lg font-semibold">✓ Tous les organes sont normaux</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};