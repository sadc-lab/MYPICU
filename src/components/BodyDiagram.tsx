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
                      x="15"
                      y={30 + idx * 28}
                      width="95"
                      height="23"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="22" 
                      y={42 + idx * 28} 
                      className="text-[9px] font-semibold"
                      fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="22" 
                      y={50 + idx * 28} 
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
                    d="M 175 35 
                       Q 160 30 150 30 Q 140 30 125 35
                       Q 115 40 112 50
                       Q 110 58 112 67
                       Q 115 78 125 85
                       Q 135 90 150 90
                       Q 165 90 175 85
                       Q 185 78 188 67
                       Q 190 58 188 50
                       Q 185 40 175 35 Z"
                    fill="url(#brainGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  
                  {/* Left hemisphere details */}
                  <path
                    d="M 120 48 Q 118 52 118 58 Q 118 65 122 72 Q 126 78 132 82"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 126 52 Q 124 56 124 61 Q 124 66 128 71"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.35"
                  />
                  
                  {/* Right hemisphere details */}
                  <path
                    d="M 180 48 Q 182 52 182 58 Q 182 65 178 72 Q 174 78 168 82"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 174 52 Q 176 56 176 61 Q 176 66 172 71"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1"
                    fill="none"
                    opacity="0.35"
                  />
                  
                  {/* Longitudinal fissure */}
                  <path
                    d="M 150 32 Q 150 40 150 60 Q 150 75 150 87"
                    stroke="hsl(210 30% 30%)"
                    strokeWidth="1.5"
                    strokeDasharray="3,2"
                    fill="none"
                    opacity="0.3"
                  />
                  
                  {/* Cerebellum */}
                  <ellipse
                    cx="150"
                    cy="92"
                    rx="28"
                    ry="11"
                    fill="url(#brainGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1"
                    opacity="0.85"
                  />
                  <path
                    d="M 125 92 Q 135 90 145 92 Q 155 90 165 92 Q 172 94 175 92"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="0.8"
                    fill="none"
                    opacity="0.3"
                  />
                  
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="60" r="15" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="67" 
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
                      x="240"
                      y={150 + idx * 28}
                      width="100"
                      height="23"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="247" 
                      y={162 + idx * 28} 
                      className="text-[9px] font-semibold"
                      fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="247" 
                      y={170 + idx * 28} 
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
                    d="M 175 108 L 175 130"
                    stroke="hsl(210 30% 50%)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                  <path
                    d="M 173 112 L 177 112 M 173 118 L 177 118 M 173 124 L 177 124"
                    stroke="hsl(210 30% 60%)"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  
                  {/* Left lung with 2 lobes */}
                  <path
                    d="M 140 135
                       Q 125 138 118 150
                       L 116 180
                       Q 116 198 122 210
                       Q 128 220 138 223
                       L 150 220
                       Q 158 215 158 200
                       L 158 150
                       Q 158 138 148 135
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 42%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  {/* Left lung fissure */}
                  <path
                    d="M 125 175 Q 135 177 145 175"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  {/* Alveoli detail */}
                  <circle cx="130" cy="165" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="138" cy="170" r="2.5" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="132" cy="190" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  
                  {/* Right lung with 3 lobes */}
                  <path
                    d="M 210 135
                       Q 225 138 232 150
                       L 234 180
                       Q 234 198 228 210
                       Q 222 220 212 223
                       L 200 220
                       Q 192 215 192 200
                       L 192 150
                       Q 192 138 202 135
                       Z"
                    fill="url(#lungsGradient)"
                    stroke="hsl(210 30% 42%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  {/* Right lung fissures (3 lobes) */}
                  <path
                    d="M 205 160 Q 215 162 225 160"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  <path
                    d="M 205 190 Q 215 192 225 190"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.4"
                  />
                  {/* Alveoli detail */}
                  <circle cx="220" cy="165" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="212" cy="170" r="2.5" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  <circle cx="218" cy="190" r="3" fill="hsl(210 30% 50%)" opacity="0.15"/>
                  
                  {/* Bronchi */}
                  <path
                    d="M 175 130 Q 172 138 160 148"
                    stroke="hsl(210 30% 48%)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <path
                    d="M 175 130 Q 178 138 190 148"
                    stroke="hsl(210 30% 48%)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  
                  {/* Bronchioles */}
                  <path
                    d="M 160 148 L 145 162 M 160 148 L 150 172"
                    stroke="hsl(210 30% 52%)"
                    strokeWidth="1.8"
                    opacity="0.4"
                  />
                  <path
                    d="M 190 148 L 205 162 M 190 148 L 200 172"
                    stroke="hsl(210 30% 52%)"
                    strokeWidth="1.8"
                    opacity="0.4"
                  />
                  
                  {lungsStatus && (
                    <g>
                      <circle cx="175" cy="180" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="188" 
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
                      x="15"
                      y={185 + idx * 28}
                      width="100"
                      height="23"
                      rx="4"
                      fill="rgba(255,255,255,0.95)"
                      stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                      strokeWidth="1.5"
                    />
                    <text 
                      x="22" 
                      y={197 + idx * 28} 
                      className="text-[9px] font-semibold"
                      fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                    >
                      {indicator.label}: {indicator.current}
                    </text>
                    <text 
                      x="22" 
                      y={205 + idx * 28} 
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
                    d="M 175 155
                       L 162 165
                       Q 150 175 150 190
                       Q 150 202 160 215
                       L 175 230
                       L 190 215
                       Q 200 202 200 190
                       Q 200 175 188 165
                       Z"
                    fill="url(#heartGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.8"
                    filter="url(#glow)"
                  />
                  
                  {/* Left atrium */}
                  <ellipse
                    cx="165"
                    cy="152"
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
                    cy="152"
                    rx="9"
                    ry="11"
                    fill="url(#heartGradient)"
                    stroke="hsl(210 30% 40%)"
                    strokeWidth="1.2"
                    opacity="0.9"
                  />
                  
                  {/* Aorta */}
                  <path
                    d="M 175 155 Q 173 147 168 142 Q 164 138 160 137"
                    stroke={getOrganColor('heart')}
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                  
                  {/* Pulmonary artery */}
                  <path
                    d="M 175 155 Q 177 147 182 142 Q 186 138 190 137"
                    stroke={getOrganColor('heart')}
                    strokeWidth="4.5"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  
                  {/* Ventricular septum */}
                  <path
                    d="M 175 165 L 175 222"
                    stroke="hsl(210 30% 32%)"
                    strokeWidth="1.8"
                    strokeDasharray="4,2"
                    opacity="0.4"
                  />
                  
                  {/* Valve detail */}
                  <path
                    d="M 162 180 Q 175 178 188 180"
                    stroke="hsl(210 30% 35%)"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                  
                  {/* Coronary arteries */}
                  <path
                    d="M 165 168 Q 160 172 158 180"
                    stroke="hsl(0 70% 50%)"
                    strokeWidth="1.2"
                    opacity="0.5"
                  />
                  <path
                    d="M 185 168 Q 190 172 192 180"
                    stroke="hsl(0 70% 50%)"
                    strokeWidth="1.2"
                    opacity="0.5"
                  />
                  
                  {heartStatus && (
                    <g>
                      <circle cx="175" cy="192" r="15" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="199" 
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

      {/* Legend */}
      <div className="mt-10 flex items-center justify-center gap-10 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'hsl(210 40% 60%)', opacity: 0.6 }}></div>
          <span className="text-muted-foreground font-medium">Normal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'hsl(20 91% 48%)', opacity: 0.85 }}></div>
          <span className="text-muted-foreground font-medium">Attention</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'hsl(0 84% 60%)', opacity: 0.85 }}></div>
          <span className="text-muted-foreground font-medium">Critique</span>
        </div>
      </div>

      {/* Organ summary list */}
      {problematicOrgans.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {problematicOrgans
            .filter(organ => ['brain', 'heart', 'lungs'].includes(organ.organ))
            .map((organ) => {
            const organLabels: Record<string, string> = {
              brain: 'Cerveau',
              heart: 'Cœur',
              lungs: 'Poumons',
            };
            
            return (
              <button
                key={organ.organ}
                onClick={() => handleOrganClick(organ.organ)}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium text-left
                  transition-all duration-300 hover:scale-105 hover:shadow-md cursor-pointer
                  ${organ.status === 'critical'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-2 border-red-500'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-2 border-orange-500'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{organLabels[organ.organ]}</span>
                  <span className="text-xs opacity-75 ml-2">
                    {organ.count} indicateur{organ.count > 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      </div>
    </TooltipProvider>
  );
};