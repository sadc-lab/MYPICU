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
}

export const BodyDiagram = ({ problematicOrgans, patientId }: BodyDiagramProps) => {
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
    if (!status) return 'hsl(210 40% 60%)'; // Default blue-gray
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
      liver: {
        name: 'Foie',
        function: 'Métabolisme, détoxification, production de protéines',
        normal: 'Bilirubine: <20 µmol/L, ASAT/ALAT: <40 UI/L'
      },
      stomach: {
        name: 'Estomac',
        function: 'Digestion des aliments, production d\'acide gastrique',
        normal: 'pH: 1.5-3.5, Volume: 1-1.5L'
      },
      kidneys: {
        name: 'Reins',
        function: 'Filtration du sang, élimination des déchets, équilibre hydrique',
        normal: 'Créatinine: 60-110 µmol/L, DFG: >90 mL/min'
      },
      intestine: {
        name: 'Intestins',
        function: 'Absorption des nutriments, digestion, transit',
        normal: 'Transit: 24-72h, Absorption: 90% nutriments'
      }
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
            viewBox="0 0 300 600" 
            className="w-96 h-auto"
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
            </defs>

            {/* Human body silhouette - translucent */}
            <g fill="hsl(210 30% 85%)" opacity="0.35" stroke="hsl(210 30% 70%)" strokeWidth="1">
              {/* Head */}
              <ellipse cx="150" cy="55" rx="42" ry="50" />
              
              {/* Neck */}
              <path d="M 130 95 L 125 112 L 135 112 L 165 112 L 175 112 L 170 95" />
              
              {/* Shoulders */}
              <path d="M 100 112 Q 90 115 85 125 L 75 155" />
              <path d="M 200 112 Q 210 115 215 125 L 225 155" />
              
              {/* Torso */}
              <path d="M 100 112 L 95 185 Q 93 240 98 285 L 110 350 L 125 420" />
              <path d="M 200 112 L 205 185 Q 207 240 202 285 L 190 350 L 175 420" />
              
              {/* Waist */}
              <path d="M 98 285 Q 105 310 115 330" />
              <path d="M 202 285 Q 195 310 185 330" />
              
              {/* Chest width */}
              <path d="M 100 112 Q 110 118 120 118 L 180 118 Q 190 118 200 112" />
              
              {/* Arms */}
              <path d="M 75 155 L 68 220 L 65 270" />
              <path d="M 225 155 L 232 220 L 235 270" />
              
              {/* Legs */}
              <path d="M 125 420 L 128 500 L 125 575" strokeWidth="20" strokeLinecap="round" />
              <path d="M 175 420 L 172 500 L 175 575" strokeWidth="20" strokeLinecap="round" />
              
              {/* Hip connections */}
              <path d="M 110 350 Q 115 380 125 420" />
              <path d="M 190 350 Q 185 380 175 420" />
            </g>

            {/* Internal organs */}
            
            {/* Trachea (windpipe) */}
            <path 
              d="M 150 105 L 150 145"
              stroke="hsl(210 30% 55%)"
              strokeWidth="5"
              fill="none"
              opacity="0.5"
            />
            <path 
              d="M 147 110 L 153 110 M 147 120 L 153 120 M 147 130 L 153 130 M 147 140 L 153 140"
              stroke="hsl(210 30% 65%)"
              strokeWidth="0.5"
              opacity="0.5"
            />

            {/* Brain */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => brainStatus && handleOrganClick('brain')}
                  className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  <ellipse 
                    cx="150" 
                    cy="55" 
                    rx="38" 
                    ry="45"
                    fill={getOrganColor('brain')}
                    opacity={getOrganOpacity('brain')}
                    stroke="hsl(210 30% 45%)"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                  />
                  {/* Brain hemispheres */}
                  <path 
                    d="M 150 15 L 150 95" 
                    stroke="hsl(210 30% 35%)" 
                    strokeWidth="1" 
                    opacity="0.3"
                    strokeDasharray="2,2"
                  />
                  {/* Brain folds */}
                  <path 
                    d="M 125 45 Q 130 40 135 45 M 165 45 Q 170 40 175 45 M 130 65 Q 135 60 140 65 M 160 65 Q 165 60 170 65" 
                    stroke="hsl(210 30% 40%)" 
                    strokeWidth="1" 
                    fill="none"
                    opacity="0.4"
                  />
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="55" r="14" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="62" 
                        textAnchor="middle" 
                        className="text-[16px] font-bold"
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

            {/* Lungs - realistic medical illustration style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => lungsStatus && handleOrganClick('lungs')}
                  className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
              {/* Left lung with lobes */}
              <path 
                d="M 115 145 
                   Q 100 150 95 165
                   L 93 210
                   Q 93 235 100 250
                   Q 105 260 115 262
                   L 128 258
                   Q 135 250 135 235
                   L 135 165
                   Q 135 150 125 145
                   Z"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                stroke="hsl(210 30% 45%)"
                strokeWidth="1"
                filter="url(#glow)"
              />
              {/* Left lung lobes detail */}
              <path d="M 100 185 Q 110 187 120 185" stroke="hsl(210 30% 40%)" strokeWidth="0.8" fill="none" opacity="0.5" />
              <path d="M 98 215 Q 108 217 118 215" stroke="hsl(210 30% 40%)" strokeWidth="0.8" fill="none" opacity="0.5" />
              
              {/* Right lung with lobes */}
              <path 
                d="M 185 145 
                   Q 200 150 205 165
                   L 207 210
                   Q 207 235 200 250
                   Q 195 260 185 262
                   L 172 258
                   Q 165 250 165 235
                   L 165 165
                   Q 165 150 175 145
                   Z"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                stroke="hsl(210 30% 45%)"
                strokeWidth="1"
                filter="url(#glow)"
              />
              {/* Right lung lobes detail - 3 lobes */}
              <path d="M 180 170 Q 190 172 200 170" stroke="hsl(210 30% 40%)" strokeWidth="0.8" fill="none" opacity="0.5" />
              <path d="M 180 200 Q 190 202 200 200" stroke="hsl(210 30% 40%)" strokeWidth="0.8" fill="none" opacity="0.5" />
              <path d="M 182 230 Q 192 232 202 230" stroke="hsl(210 30% 40%)" strokeWidth="0.8" fill="none" opacity="0.5" />
              
              {/* Bronchi */}
              <path d="M 150 145 Q 145 150 135 160" stroke="hsl(210 30% 50%)" strokeWidth="3.5" fill="none" opacity="0.6" />
              <path d="M 150 145 Q 155 150 165 160" stroke="hsl(210 30% 50%)" strokeWidth="3.5" fill="none" opacity="0.6" />
              
              {/* Bronchioles */}
              <path d="M 135 160 L 120 175 M 135 160 L 118 188 M 135 160 L 125 200" stroke="hsl(210 30% 55%)" strokeWidth="1.5" fill="none" opacity="0.4" />
              <path d="M 165 160 L 180 175 M 165 160 L 182 188 M 165 160 L 175 200" stroke="hsl(210 30% 55%)" strokeWidth="1.5" fill="none" opacity="0.4" />
              
              {lungsStatus && (
                <g>
                  <circle cx="150" cy="200" r="16" fill="rgba(255,255,255,0.95)" />
                  <text 
                    x="150" 
                    y="207" 
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

            {/* Heart - positioned in front of lungs */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => heartStatus && handleOrganClick('heart')}
                  className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
              <path 
                d="M 150 160
                   L 135 172
                   Q 125 180 125 192
                   Q 125 205 135 217
                   L 150 232
                   L 165 217
                   Q 175 205 175 192
                   Q 175 180 165 172
                   Z"
                fill={getOrganColor('heart')}
                opacity={getOrganOpacity('heart')}
                stroke="hsl(210 30% 45%)"
                strokeWidth="1.5"
                filter="url(#glow)"
              />
              
              {/* Heart chambers */}
              <path d="M 150 170 L 150 225" stroke="hsl(210 30% 35%)" strokeWidth="1" opacity="0.4" strokeDasharray="3,2" />
              <path d="M 135 190 Q 150 188 165 190" stroke="hsl(210 30% 35%)" strokeWidth="1" opacity="0.4" />
              
              {/* Aorta */}
              <path d="M 150 160 Q 148 152 145 148 Q 142 145 138 145" 
                    stroke={getOrganColor('heart')} strokeWidth="4" fill="none" opacity="0.7" strokeLinecap="round" />
              <path d="M 150 160 Q 152 152 155 148 Q 158 145 162 145" 
                    stroke={getOrganColor('heart')} strokeWidth="3.5" fill="none" opacity="0.7" strokeLinecap="round" />
              
              {heartStatus && (
                <g>
                  <circle cx="150" cy="195" r="14" fill="rgba(255,255,255,0.95)" />
                  <text 
                    x="150" 
                    y="202" 
                    textAnchor="middle" 
                    className="text-[16px] font-bold"
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

            {/* Liver */}
            <path 
              d="M 155 255 Q 185 255 200 265 L 205 295 Q 205 315 195 322 L 160 328 Q 155 328 155 320 Z"
              fill={getOrganColor('liver')}
              opacity={getOrganOpacity('liver')}
              stroke="hsl(210 30% 45%)"
              strokeWidth="1"
              filter="url(#glow)"
            />

            {/* Stomach */}
            <path 
              d="M 135 265 Q 125 268 120 278 L 118 300 Q 118 312 125 318 Q 132 322 140 318 Q 145 314 145 305 L 145 278 Q 143 270 135 265 Z"
              fill={getOrganColor('stomach')}
              opacity={getOrganOpacity('stomach')}
              stroke="hsl(210 30% 45%)"
              strokeWidth="1"
              filter="url(#glow)"
            />

            {/* Kidneys */}
            <g>
              <ellipse 
                cx="110" 
                cy="305" 
                rx="14" 
                ry="25"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                stroke="hsl(210 30% 45%)"
                strokeWidth="1"
                filter="url(#glow)"
              />
              <ellipse cx="110" cy="305" rx="7" ry="12" fill="hsl(210 30% 50%)" opacity="0.3" />
              
              <ellipse 
                cx="190" 
                cy="305" 
                rx="14" 
                ry="25"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                stroke="hsl(210 30% 45%)"
                strokeWidth="1"
                filter="url(#glow)"
              />
              <ellipse cx="190" cy="305" rx="7" ry="12" fill="hsl(210 30% 50%)" opacity="0.3" />
            </g>

            {/* Small intestine - coiled */}
            <g 
              fill={getOrganColor('intestine')}
              opacity={getOrganOpacity('intestine')}
              stroke="hsl(210 30% 45%)"
              strokeWidth="1"
              filter="url(#glow)"
            >
              <circle cx="140" cy="360" r="12" />
              <circle cx="160" cy="360" r="12" />
              <circle cx="150" cy="378" r="12" />
              <circle cx="135" cy="390" r="11" />
              <circle cx="165" cy="390" r="11" />
            </g>

            {/* Large intestine outline */}
            <path 
              d="M 125 340 L 110 355 L 110 395 L 125 410 L 175 410 L 190 395 L 190 355 L 175 340"
              fill="none"
              stroke={getOrganColor('intestine')}
              strokeWidth="8"
              opacity={getOrganOpacity('intestine')}
              strokeLinecap="round"
              filter="url(#glow)"
            />
          </svg>

          {/* Labels */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 300 600">
            {brainStatus && (
              <g>
                <line x1="192" y1="55" x2="245" y2="40" stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                <foreignObject x="245" y="22" width="130" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg border-2 ${
                    brainStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-500'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-500'
                  }`}>
                    Cerveau ({brainStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}
            
            {heartStatus && (
              <g>
                <line x1="125" y1="195" x2="55" y2="195" stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                <foreignObject x="5" y="177" width="130" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg border-2 ${
                    heartStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-500'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-500'
                  }`}>
                    Cœur ({heartStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}

            {lungsStatus && (
              <g>
                <line x1="207" y1="200" x2="250" y2="200" stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="2" />
                <foreignObject x="250" y="182" width="130" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-lg border-2 ${
                    lungsStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-500'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-500'
                  }`}>
                    Poumons ({lungsStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}
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
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {problematicOrgans.map((organ) => {
            const organLabels: Record<string, string> = {
              brain: 'Cerveau',
              heart: 'Cœur',
              lungs: 'Poumons',
              liver: 'Foie',
              kidneys: 'Reins',
              pancreas: 'Pancréas',
              intestine: 'Intestin',
            };
            
            const isClickable = ['brain', 'heart', 'lungs'].includes(organ.organ);
            
            return (
              <button
                key={organ.organ}
                onClick={() => isClickable && handleOrganClick(organ.organ)}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium text-left
                  transition-all duration-300 hover:scale-105 hover:shadow-md
                  ${organ.status === 'critical'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-2 border-red-500'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-2 border-orange-500'
                  }
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
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