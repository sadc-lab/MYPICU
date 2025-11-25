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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative w-full max-w-2xl mx-auto py-8 animate-fade-in">
        <div className="text-center mb-6">
          <h3 className="text-base font-semibold text-foreground">Vue anatomique</h3>
        </div>
        
        <div className="relative flex justify-center">
          {/* Main anatomy image - switch based on organ status */}
          <img 
            src={hasProblems ? anatomyDiagram : anatomyNormal}
            alt="Diagramme anatomique" 
            className="w-full max-w-lg h-auto"
          />
          {/* Interactive overlay for clickable organs - only show if there are problems */}
          {hasProblems && (
          <div className="absolute inset-0 flex justify-center">
            <svg 
              viewBox="0 0 600 850" 
              className="w-full max-w-lg h-auto"
              style={{ pointerEvents: 'none' }}
            >
              <defs>
                {/* Filters for organ highlighting */}
                <filter id="organGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Brain overlay - increase opacity when problematic */}
              {brainStatus && (
                <ellipse
                  cx="300"
                  cy="80"
                  rx="50"
                  ry="44"
                  fill={brainStatus.status === 'critical' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(234, 88, 12, 0.25)'}
                  filter="url(#organGlow)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              
              {/* Lungs overlay - increase opacity when problematic */}
              {lungsStatus && (
                <g>
                  {/* Left lung */}
                  <ellipse
                    cx="235"
                    cy="270"
                    rx="50"
                    ry="68"
                    fill={lungsStatus.status === 'critical' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(234, 88, 12, 0.25)'}
                    filter="url(#organGlow)"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Right lung */}
                  <ellipse
                    cx="365"
                    cy="270"
                    rx="50"
                    ry="68"
                    fill={lungsStatus.status === 'critical' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(234, 88, 12, 0.25)'}
                    filter="url(#organGlow)"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )}
              
              {/* Heart overlay - increase opacity when problematic */}
              {heartStatus && (
                <ellipse
                  cx="300"
                  cy="230"
                  rx="44"
                  ry="52"
                  fill={heartStatus.status === 'critical' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(234, 88, 12, 0.3)'}
                  filter="url(#organGlow)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>
            <svg 
              viewBox="0 0 600 850" 
              className="w-full max-w-lg h-auto"
              style={{ pointerEvents: 'none' }}
            >

              {/* Brain indicator values - positioned above head */}
              {brainStatus && organIndicators['brain'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['brain'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="50"
                        y={30 + idx * 42}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="60" 
                        y={50 + idx * 42}
                        className="text-[14px] font-semibold"
                        fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="60" 
                        y={63 + idx * 42} 
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Brain clickable area - on head */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => brainStatus && handleOrganClick('brain')}
                    style={{ pointerEvents: brainStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over brain in head */}
                    <circle
                      cx="300"
                      cy="80"
                      r="44"
                      fill="transparent"
                      stroke={brainStatus ? (brainStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {brainStatus && (
                      <g>
                        <circle cx="300" cy="80" r="25" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="300" 
                          y="90"
                          textAnchor="middle" 
                          className="text-[28px] font-bold"
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

              {/* Lungs indicator values - positioned on sides */}
              {lungsStatus && organIndicators['lungs'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['lungs'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="410"
                        y={250 + idx * 42}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="420" 
                        y={270 + idx * 42}
                        className="text-[14px] font-semibold"
                        fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="420" 
                        y={283 + idx * 42}
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Lungs clickable area - in chest */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => lungsStatus && handleOrganClick('lungs')}
                    style={{ pointerEvents: lungsStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over lungs in chest */}
                    <ellipse
                      cx="300"
                      cy="270"
                      rx="82"
                      ry="58"
                      fill="transparent"
                      stroke={lungsStatus ? (lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {lungsStatus && (
                      <g>
                        <circle cx="300" cy="270" r="26" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="300" 
                          y="282"
                          textAnchor="middle" 
                          className="text-[30px] font-bold"
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

              {/* Heart indicator values - positioned below or beside */}
              {heartStatus && organIndicators['heart'] && (
                <g style={{ pointerEvents: 'auto' }}>
                  {organIndicators['heart'].slice(0, 2).map((indicator, idx) => (
                    <g key={idx}>
                      <rect
                        x="50"
                        y={195 + idx * 42}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(255,255,255,0.95)"
                        stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                        strokeWidth="2.5"
                      />
                      <text 
                        x="60" 
                        y={215 + idx * 42}
                        className="text-[14px] font-semibold"
                        fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      >
                        {indicator.label}: {indicator.current}
                      </text>
                      <text 
                        x="60" 
                        y={228 + idx * 42}
                        className="text-[11px]"
                        fill="hsl(var(--muted-foreground))"
                      >
                        Cible: {indicator.target}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* Heart clickable area - in center chest */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <g 
                    onClick={() => heartStatus && handleOrganClick('heart')}
                    style={{ pointerEvents: heartStatus ? 'auto' : 'none' }}
                    className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer' : ''}`}
                  >
                    {/* Clickable area over heart */}
                    <circle
                      cx="300"
                      cy="230"
                      r="44"
                      fill="transparent"
                      stroke={heartStatus ? (heartStatus.status === 'critical' ? '#dc2626' : '#ea580c') : 'transparent'}
                      strokeWidth="3"
                      opacity="0.6"
                    />
                    
                    {heartStatus && (
                      <g>
                        <circle cx="300" cy="230" r="25" fill="rgba(255,255,255,0.95)" />
                        <text 
                          x="300" 
                          y="241"
                          textAnchor="middle" 
                          className="text-[28px] font-bold"
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
          )}
          
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