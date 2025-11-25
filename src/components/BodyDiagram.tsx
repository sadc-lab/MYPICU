import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
      <div className="relative w-full max-w-3xl mx-auto py-8 animate-fade-in">
      <div className="flex justify-center">
        <div className="relative">
          <div className="text-center mb-6">
            <h3 className="text-base font-semibold text-foreground">Vue anatomique</h3>
          </div>
          
          <svg 
            viewBox="0 0 350 320" 
            className="w-full h-auto max-w-2xl mx-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Medical grid pattern */}
              <pattern id="medicalGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" opacity="0.15"/>
              </pattern>
              
              <pattern id="medicalGridMajor" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#medicalGrid)"/>
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.25"/>
              </pattern>
              
              {/* Gradients for realistic organs */}
              <radialGradient id="brainGradient" cx="30%" cy="30%">
                <stop offset="0%" stopColor={getOrganColor('brain')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('brain')} stopOpacity="0.7"/>
              </radialGradient>
              
              <radialGradient id="heartGradient" cx="30%" cy="30%">
                <stop offset="0%" stopColor={getOrganColor('heart')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('heart')} stopOpacity="0.75"/>
              </radialGradient>
              
              <radialGradient id="lungsGradient" cx="30%" cy="30%">
                <stop offset="0%" stopColor={getOrganColor('lungs')} stopOpacity="0.95"/>
                <stop offset="100%" stopColor={getOrganColor('lungs')} stopOpacity="0.6"/>
              </radialGradient>
            </defs>

            {/* Background with medical grid */}
            <rect 
              x="0" 
              y="0" 
              width="350" 
              height="320" 
              fill="url(#medicalGridMajor)" 
              opacity="0.8"
            />
            
            {/* Subtle frame border */}
            <rect 
              x="0" 
              y="0" 
              width="350" 
              height="320" 
              fill="none" 
              stroke="hsl(var(--muted-foreground))" 
              strokeWidth="1.5" 
              opacity="0.3"
            />

            {/* Brain indicator values */}
            {brainStatus && organIndicators['brain'] && (
              <g>
                {organIndicators['brain'].slice(0, 2).map((indicator, idx) => (
                  <g key={idx}>
                    <rect
                      x="10"
                      y={40 + idx * 30}
                      width="90"
                      height="24"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="17" 
                      y={52 + idx * 30} 
                      className="text-[9px] font-semibold"
                      fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="17" 
                      y={60 + idx * 30} 
                      className="text-[7px]"
                      fill="hsl(var(--muted-foreground))"
                    >
                      Cible: {indicator.target}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Brain - stylized like reference image */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => brainStatus && handleOrganClick('brain')}
                  className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main brain shape - rounded */}
                  <ellipse
                    cx="150"
                    cy="70"
                    rx="35"
                    ry="30"
                    fill="url(#brainGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  
                  {/* Central fissure */}
                  <path
                    d="M 150 42 L 150 98"
                    stroke="hsl(210 30% 30%)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.5"
                  />
                  
                  {/* Left hemisphere neural pattern */}
                  <path
                    d="M 130 55 Q 125 60 122 65 M 130 62 Q 125 67 122 72"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 135 70 Q 130 73 125 78 M 135 78 Q 130 81 125 86"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  <circle cx="125" cy="62" r="2.5" fill="hsl(210 30% 35%)" opacity="0.7"/>
                  <circle cx="120" cy="75" r="2.5" fill="hsl(210 30% 35%)" opacity="0.7"/>
                  
                  {/* Right hemisphere neural pattern */}
                  <path
                    d="M 170 55 Q 175 60 178 65 M 170 62 Q 175 67 178 72"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 165 70 Q 170 73 175 78 M 165 78 Q 170 81 175 86"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  <circle cx="175" cy="62" r="2.5" fill="hsl(210 30% 35%)" opacity="0.7"/>
                  <circle cx="180" cy="75" r="2.5" fill="hsl(210 30% 35%)" opacity="0.7"/>
                  
                  {/* Additional neural connections */}
                  <circle cx="142" cy="58" r="2" fill="hsl(210 30% 35%)" opacity="0.6"/>
                  <circle cx="158" cy="58" r="2" fill="hsl(210 30% 35%)" opacity="0.6"/>
                  <circle cx="142" cy="82" r="2" fill="hsl(210 30% 35%)" opacity="0.6"/>
                  <circle cx="158" cy="82" r="2" fill="hsl(210 30% 35%)" opacity="0.6"/>
                  
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="70" r="15" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="77" 
                        textAnchor="middle" 
                        className="text-[17px] font-bold"
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
              <g>
                {organIndicators['lungs'].slice(0, 2).map((indicator, idx) => (
                  <g key={idx}>
                    <rect
                      x="250"
                      y={160 + idx * 30}
                      width="95"
                      height="24"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="257" 
                      y={172 + idx * 30} 
                      className="text-[9px] font-semibold"
                      fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="257" 
                      y={180 + idx * 30} 
                      className="text-[7px]"
                      fill="hsl(var(--muted-foreground))"
                    >
                      Cible: {indicator.target}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Lungs - stylized like reference image */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => lungsStatus && handleOrganClick('lungs')}
                  className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Trachea */}
                  <rect
                    x="172"
                    y="110"
                    width="6"
                    height="35"
                    rx="3"
                    fill="hsl(210 30% 55%)"
                    opacity="0.7"
                  />
                  <path
                    d="M 173 115 L 177 115 M 173 120 L 177 120 M 173 125 L 177 125 M 173 130 L 177 130 M 173 135 L 177 135 M 173 140 L 177 140"
                    stroke="hsl(210 30% 70%)"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  
                  {/* Left lung - simplified shape */}
                  <path
                    d="M 145 150
                       Q 125 155 120 170
                       L 118 205
                       Q 118 220 125 230
                       Q 130 237 140 240
                       L 155 235
                       Q 160 228 160 210
                       L 160 165
                       Q 160 153 150 150
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  
                  {/* Right lung - simplified shape */}
                  <path
                    d="M 205 150
                       Q 225 155 230 170
                       L 232 205
                       Q 232 220 225 230
                       Q 220 237 210 240
                       L 195 235
                       Q 190 228 190 210
                       L 190 165
                       Q 190 153 200 150
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  
                  {/* Bronchi */}
                  <path
                    d="M 175 145 Q 170 155 162 163"
                    stroke="hsl(210 30% 45%)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <path
                    d="M 175 145 Q 180 155 188 163"
                    stroke="hsl(210 30% 45%)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  
                  {lungsStatus && (
                    <g>
                      <circle cx="175" cy="190" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="198" 
                        textAnchor="middle" 
                        className="text-[18px] font-bold"
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
              <g>
                {organIndicators['heart'].slice(0, 2).map((indicator, idx) => (
                  <g key={idx}>
                    <rect
                      x="10"
                      y={240 + idx * 30}
                      width="95"
                      height="24"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="17" 
                      y={252 + idx * 30} 
                      className="text-[9px] font-semibold"
                      fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="17" 
                      y={260 + idx * 30} 
                      className="text-[7px]"
                      fill="hsl(var(--muted-foreground))"
                    >
                      Cible: {indicator.target}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Heart - stylized like reference image */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => heartStatus && handleOrganClick('heart')}
                  className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main heart body - rounded bottom */}
                  <path
                    d="M 175 165
                       L 160 175
                       Q 148 185 148 202
                       Q 148 218 158 230
                       L 175 245
                       L 192 230
                       Q 202 218 202 202
                       Q 202 185 190 175
                       Z"
                    fill="url(#heartGradient)"
                    stroke="hsl(0 70% 40%)"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  
                  {/* Left atrium curve */}
                  <path
                    d="M 160 175 Q 155 168 155 160 Q 155 153 160 148 Q 165 145 170 148"
                    fill="url(#heartGradient)"
                    stroke="hsl(0 70% 40%)"
                    strokeWidth="2.5"
                  />
                  
                  {/* Right atrium curve */}
                  <path
                    d="M 190 175 Q 195 168 195 160 Q 195 153 190 148 Q 185 145 180 148"
                    fill="url(#heartGradient)"
                    stroke="hsl(0 70% 40%)"
                    strokeWidth="2.5"
                  />
                  
                  {/* Aorta detail */}
                  <circle
                    cx="167"
                    cy="155"
                    r="6"
                    fill="url(#heartGradient)"
                    stroke="hsl(0 70% 40%)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="183"
                    cy="155"
                    r="6"
                    fill="url(#heartGradient)"
                    stroke="hsl(0 70% 40%)"
                    strokeWidth="2"
                  />
                  
                  {/* Ventricular septum line */}
                  <path
                    d="M 175 175 L 175 238"
                    stroke="hsl(0 70% 30%)"
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  
                  {/* Valve curves */}
                  <path
                    d="M 162 195 Q 168 192 175 195 Q 182 192 188 195"
                    stroke="hsl(0 70% 30%)"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                  
                  {/* Highlight/shine effect */}
                  <ellipse
                    cx="168"
                    cy="185"
                    rx="8"
                    ry="12"
                    fill="white"
                    opacity="0.15"
                  />
                  
                  {heartStatus && (
                    <g>
                      <circle cx="175" cy="205" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="213" 
                        textAnchor="middle" 
                        className="text-[18px] font-bold"
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