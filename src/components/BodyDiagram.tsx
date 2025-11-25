import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import anatomyDiagram from '@/assets/anatomy-diagram.png';

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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative w-full max-w-4xl mx-auto py-8 animate-fade-in">
        <div className="text-center mb-6">
          <h3 className="text-base font-semibold text-foreground">Vue anatomique</h3>
        </div>
        
        <div className="relative flex justify-center">
          {/* Main anatomy image */}
          <img 
            src={anatomyDiagram} 
            alt="Diagramme anatomique" 
            className="w-full max-w-3xl h-auto"
          />
          {/* Interactive overlay for clickable organs */}
          <div className="absolute inset-0 flex justify-center">
            <svg 
              viewBox="0 0 1000 1200" 
              className="w-full max-w-3xl h-auto"
              style={{ pointerEvents: 'none' }}
            >

              {/* Brain indicator values - positioned for the right side detail */}
              {brainStatus && organIndicators['brain'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['brain'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="680"
                        y={180 + idx * 45}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="690" 
                        y={200 + idx * 45} 
                        className="text-[14px] font-semibold"
                        fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="690" 
                        y={213 + idx * 45} 
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Brain clickable area - on the detailed organ view */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => brainStatus && handleOrganClick('brain')}
                    style={{ pointerEvents: brainStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over brain detail */}
                    <circle
                      cx="900"
                      cy="230"
                      r="60"
                      fill="transparent"
                      stroke={brainStatus ? (brainStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {brainStatus && (
                      <g>
                        <circle cx="900" cy="230" r="28" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="900" 
                          y="243" 
                          textAnchor="middle" 
                          className="text-[32px] font-bold"
                          fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        >
                          {brainStatus.count}
                        </text>
                      </g>
                    )}
                  </g>
                </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">{getOrganInfo('brain').name}</p>
                  <p className="text-xs text-muted-foreground">{getOrganInfo('brain').function}</p>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium">Valeurs normales:</p>
                    <p className="text-xs text-muted-foreground">{getOrganInfo('brain').normal}</p>
                  </div>
                  {brainStatus && (
                    <div className={`border-t pt-2 mt-2 ${
                      brainStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      <p className="text-xs font-semibold">
                        ⚠ {brainStatus.count} indicateur{brainStatus.count > 1 ? 's' : ''} problématique{brainStatus.count > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs mt-1">Cliquez pour voir les détails</p>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

              {/* Lungs indicator values */}
              {lungsStatus && organIndicators['lungs'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['lungs'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="680"
                        y={340 + idx * 45}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="690" 
                        y={360 + idx * 45} 
                        className="text-[14px] font-semibold"
                        fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="690" 
                        y={373 + idx * 45} 
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Lungs clickable area */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => lungsStatus && handleOrganClick('lungs')}
                    style={{ pointerEvents: lungsStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over lungs detail */}
                    <circle
                      cx="880"
                      cy="380"
                      r="70"
                      fill="transparent"
                      stroke={lungsStatus ? (lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {lungsStatus && (
                      <g>
                        <circle cx="880" cy="380" r="30" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="880" 
                          y="395" 
                          textAnchor="middle" 
                          className="text-[34px] font-bold"
                          fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        >
                          {lungsStatus.count}
                        </text>
                      </g>
                    )}
                  </g>
                </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">{getOrganInfo('lungs').name}</p>
                  <p className="text-xs text-muted-foreground">{getOrganInfo('lungs').function}</p>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium">Valeurs normales:</p>
                    <p className="text-xs text-muted-foreground">{getOrganInfo('lungs').normal}</p>
                  </div>
                  {lungsStatus && (
                    <div className={`border-t pt-2 mt-2 ${
                      lungsStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      <p className="text-xs font-semibold">
                        ⚠ {lungsStatus.count} indicateur{lungsStatus.count > 1 ? 's' : ''} problématique{lungsStatus.count > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs mt-1">Cliquez pour voir les détails</p>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

              {/* Heart indicator values */}
              {heartStatus && organIndicators['heart'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['heart'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="680"
                        y={280 + idx * 45}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="690" 
                        y={300 + idx * 45} 
                        className="text-[14px] font-semibold"
                        fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="690" 
                        y={313 + idx * 45} 
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Heart clickable area */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => heartStatus && handleOrganClick('heart')}
                    style={{ pointerEvents: heartStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over heart detail */}
                    <circle
                      cx="920"
                      cy="310"
                      r="55"
                      fill="transparent"
                      stroke={heartStatus ? (heartStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {heartStatus && (
                      <g>
                        <circle cx="920" cy="310" r="28" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="920" 
                          y="323" 
                          textAnchor="middle" 
                          className="text-[32px] font-bold"
                          fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        >
                          {heartStatus.count}
                        </text>
                      </g>
                    )}
                  </g>
                </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">{getOrganInfo('heart').name}</p>
                  <p className="text-xs text-muted-foreground">{getOrganInfo('heart').function}</p>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium">Valeurs normales:</p>
                    <p className="text-xs text-muted-foreground">{getOrganInfo('heart').normal}</p>
                  </div>
                  {heartStatus && (
                    <div className={`border-t pt-2 mt-2 ${
                      heartStatus.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      <p className="text-xs font-semibold">
                        ⚠ {heartStatus.count} indicateur{heartStatus.count > 1 ? 's' : ''} problématique{heartStatus.count > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs mt-1">Cliquez pour voir les détails</p>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </svg>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};