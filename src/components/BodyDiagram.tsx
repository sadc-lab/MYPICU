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

            {/* Brain - realistic anatomy */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => brainStatus && handleOrganClick('brain')}
                  className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main cerebrum */}
                  <path
                    d="M 175 50 
                       Q 160 45 150 45 Q 140 45 125 50
                       Q 115 55 112 65
                       Q 110 73 112 82
                       Q 115 93 125 100
                       Q 135 105 150 105
                       Q 165 105 175 100
                       Q 185 93 188 82
                       Q 190 73 188 65
                       Q 185 55 175 50 Z"
                    fill="url(#brainGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  
                  {/* Left hemisphere details */}
                  <path
                    d="M 120 63 Q 118 67 118 73 Q 118 80 122 87 Q 126 93 132 97"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 126 67 Q 124 71 124 76 Q 124 81 128 86"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.35"
                  />
                  
                  {/* Right hemisphere details */}
                  <path
                    d="M 180 63 Q 182 67 182 73 Q 182 80 178 87 Q 174 93 168 97"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 174 67 Q 176 71 176 76 Q 176 81 172 86"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.35"
                  />
                  
                  {/* Longitudinal fissure */}
                  <path
                    d="M 150 47 Q 150 55 150 75 Q 150 90 150 102"
                    stroke="hsl(210 30% 30%)"
                    strokeWidth="1.5"
                    strokeDasharray="3,2"
                    fill="none"
                    opacity="0.3"
                  />
                  
                  {/* Cerebellum */}
                  <ellipse
                    cx="150"
                    cy="107"
                    rx="28"
                    ry="11"
                    fill="url(#brainGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                  <path
                    d="M 125 107 Q 135 105 145 107 Q 155 105 165 107 Q 172 109 175 107"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="0.8"
                    fill="none"
                    opacity="0.3"
                  />
                  
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="75" r="15" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="82" 
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

            {/* Lungs - realistic anatomy with lobes */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => lungsStatus && handleOrganClick('lungs')}
                  className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Trachea */}
                  <path
                    d="M 175 123 L 175 145"
                    stroke="hsl(210 30% 50%)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                  <path
                    d="M 173 127 L 177 127 M 173 133 L 177 133 M 173 139 L 177 139"
                    stroke="hsl(210 30% 60%)"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  
                  {/* Left lung with 2 lobes */}
                  <path
                    d="M 140 150
                       Q 125 153 118 165
                       L 116 195
                       Q 116 213 122 225
                       Q 128 235 138 238
                       L 150 235
                       Q 158 230 158 215
                       L 158 165
                       Q 158 153 148 150
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 42%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  {/* Left lung fissure */}
                  <path
                    d="M 125 190 Q 135 192 145 190"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  {/* Alveoli detail */}
                  <circle cx="130" cy="180" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="138" cy="185" r="2.5" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="132" cy="205" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  
                  {/* Right lung with 3 lobes */}
                  <path
                    d="M 210 150
                       Q 225 153 232 165
                       L 234 195
                       Q 234 213 228 225
                       Q 222 235 212 238
                       L 200 235
                       Q 192 230 192 215
                       L 192 165
                       Q 192 153 202 150
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 42%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  {/* Right lung fissures (3 lobes) */}
                  <path
                    d="M 205 175 Q 215 177 225 175"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 205 205 Q 215 207 225 205"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  {/* Alveoli detail */}
                  <circle cx="220" cy="180" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="212" cy="185" r="2.5" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="218" cy="205" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  
                  {/* Bronchi */}
                  <path
                    d="M 175 145 Q 172 153 160 163"
                    stroke="hsl(210 30% 48%)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <path
                    d="M 175 145 Q 178 153 190 163"
                    stroke="hsl(210 30% 48%)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  
                  {/* Bronchioles */}
                  <path
                    d="M 160 163 L 145 177 M 160 163 L 150 187"
                    stroke="hsl(210 30% 52%)"
                    strokeWidth="1.8"
                    opacity="0.4"
                  />
                  <path
                    d="M 190 163 L 205 177 M 190 163 L 200 187"
                    stroke="hsl(210 30% 52%)"
                    strokeWidth="1.8"
                    opacity="0.4"
                  />
                  
                  {lungsStatus && (
                    <g>
                      <circle cx="175" cy="195" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="203" 
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

            {/* Heart - realistic anatomy */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => heartStatus && handleOrganClick('heart')}
                  className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main heart ventricles */}
                  <path
                    d="M 175 180
                       L 162 190
                       Q 150 200 150 215
                       Q 150 227 160 240
                       L 175 255
                       L 190 240
                       Q 200 227 200 215
                       Q 200 200 188 190
                       Z"
                    fill="url(#heartGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.8"
                    filter="url(#glow)"
                  />
                  
                  {/* Left atrium */}
                  <ellipse
                    cx="165"
                    cy="177"
                    rx="9"
                    ry="11"
                    fill="url(#heartGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.2"
                    opacity="0.9"
                  />
                  
                  {/* Right atrium */}
                  <ellipse
                    cx="185"
                    cy="177"
                    rx="9"
                    ry="11"
                    fill="url(#heartGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.2"
                    opacity="0.9"
                  />
                  
                  {/* Aorta */}
                  <path
                    d="M 175 180 Q 173 172 168 167 Q 164 163 160 162"
                    stroke={getOrganColor('heart')}
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                  
                  {/* Pulmonary artery */}
                  <path
                    d="M 175 180 Q 177 172 182 167 Q 186 163 190 162"
                    stroke={getOrganColor('heart')}
                    strokeWidth="4.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  
                  {/* Ventricular septum */}
                  <path
                    d="M 175 190 L 175 247"
                    stroke="hsl(210 30% 32%)"
                    strokeWidth="1.8"
                    strokeDasharray="4,2"
                    opacity="0.4"
                  />
                  
                  {/* Valve detail */}
                  <path
                    d="M 162 205 Q 175 203 188 205"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                  
                  {/* Coronary arteries */}
                  <path
                    d="M 165 193 Q 160 197 158 205"
                    stroke="hsl(0 70% 50%)"
                    strokeWidth="1.2"
                    opacity="0.5"
                  />
                  <path
                    d="M 185 193 Q 190 197 192 205"
                    stroke="hsl(0 70% 50%)"
                    strokeWidth="1.2"
                    opacity="0.5"
                  />
                  
                  {heartStatus && (
                    <g>
                      <circle cx="175" cy="217" r="15" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="224" 
                        textAnchor="middle" 
                        className="text-[17px] font-bold"
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