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
              
              {/* Gradients for anatomical illustration style */}
              <radialGradient id="brainGradient" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#E8C4B8" stopOpacity="1"/>
                <stop offset="50%" stopColor="#D4A89C" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#C09888" stopOpacity="0.9"/>
              </radialGradient>
              
              <radialGradient id="brainGradientProblem" cx="45%" cy="40%">
                <stop offset="0%" stopColor={getOrganColor('brain')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('brain')} stopOpacity="0.8"/>
              </radialGradient>
              
              <radialGradient id="heartGradient" cx="30%" cy="25%">
                <stop offset="0%" stopColor="#D84444" stopOpacity="1"/>
                <stop offset="40%" stopColor="#C63838" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#A82E2E" stopOpacity="0.9"/>
              </radialGradient>
              
              <radialGradient id="heartGradientProblem" cx="30%" cy="25%">
                <stop offset="0%" stopColor={getOrganColor('heart')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('heart')} stopOpacity="0.8"/>
              </radialGradient>
              
              <radialGradient id="lungsGradient" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#F0B8C0" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#E0A0B0" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#D08898" stopOpacity="0.85"/>
              </radialGradient>
              
              <radialGradient id="lungsGradientProblem" cx="35%" cy="30%">
                <stop offset="0%" stopColor={getOrganColor('lungs')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('lungs')} stopOpacity="0.7"/>
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

            {/* Brain - anatomical illustration style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => brainStatus && handleOrganClick('brain')}
                  className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main cerebrum outline */}
                  <path
                    d="M 150 48
                       Q 168 46 180 55
                       Q 188 64 189 76
                       Q 190 86 186 95
                       Q 180 102 170 106
                       L 150 108
                       L 130 106
                       Q 120 102 114 95
                       Q 110 86 111 76
                       Q 112 64 120 55
                       Q 132 46 150 48 Z"
                    fill={brainStatus ? "url(#brainGradientProblem)" : "url(#brainGradient)"}
                    stroke="#9C8478"
                    strokeWidth="1.8"
                    filter="url(#glow)"
                  />
                  
                  {/* Central longitudinal fissure - dark line */}
                  <path
                    d="M 150 50 L 150 106"
                    stroke="#8A6E62"
                    strokeWidth="2.2"
                    fill="none"
                    opacity="0.8"
                  />
                  
                  {/* Gyri (brain folds) - left hemisphere */}
                  <path
                    d="M 125 62 Q 122 65 120 70 M 128 70 Q 125 73 123 78 M 125 80 Q 122 84 120 90 M 130 88 Q 127 92 125 96"
                    stroke="#9C8478"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  
                  {/* Gyri - right hemisphere */}
                  <path
                    d="M 175 62 Q 178 65 180 70 M 172 70 Q 175 73 177 78 M 175 80 Q 178 84 180 90 M 170 88 Q 173 92 175 96"
                    stroke="#9C8478"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                    strokeLinecap="round"
                  />
                  
                  {/* Sulci details (grooves) */}
                  <path
                    d="M 135 67 Q 140 68 145 67 M 138 82 Q 143 83 148 82"
                    stroke="#9C8478"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.5"
                  />
                  <path
                    d="M 155 67 Q 160 68 165 67 M 152 82 Q 157 83 162 82"
                    stroke="#9C8478"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.5"
                  />
                  
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="77" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="84" 
                        textAnchor="middle" 
                        className="text-[18px] font-bold"
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

            {/* Lungs - anatomical illustration style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => lungsStatus && handleOrganClick('lungs')}
                  className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Trachea - beige tube with rings */}
                  <rect
                    x="170"
                    y="115"
                    width="10"
                    height="35"
                    rx="4"
                    fill="#C4ACA0"
                    stroke="#9C8478"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  {/* Cartilage rings */}
                  <path
                    d="M 171 120 L 179 120 M 171 126 L 179 126 M 171 132 L 179 132 M 171 138 L 179 138 M 171 144 L 179 144"
                    stroke="#9C8478"
                    strokeWidth="1.2"
                    opacity="0.6"
                  />
                  
                  {/* Left lung */}
                  <path
                    d="M 148 155
                       Q 128 160 122 175
                       L 120 200
                       Q 120 215 125 225
                       Q 130 233 140 236
                       L 152 233
                       Q 158 228 160 218
                       L 160 170
                       Q 160 160 152 155
                       Z"
                    fill={lungsStatus ? "url(#lungsGradientProblem)" : "url(#lungsGradient)"}
                    stroke="#C88898"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  {/* Left lung lobe division */}
                  <path
                    d="M 128 192 Q 138 194 148 192"
                    stroke="#C88898"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                  />
                  
                  {/* Right lung */}
                  <path
                    d="M 202 155
                       Q 222 160 228 175
                       L 230 200
                       Q 230 215 225 225
                       Q 220 233 210 236
                       L 198 233
                       Q 192 228 190 218
                       L 190 170
                       Q 190 160 198 155
                       Z"
                    fill={lungsStatus ? "url(#lungsGradientProblem)" : "url(#lungsGradient)"}
                    stroke="#C88898"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  {/* Right lung lobe divisions */}
                  <path
                    d="M 205 178 Q 215 180 223 178"
                    stroke="#C88898"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                  />
                  <path
                    d="M 204 207 Q 214 209 222 207"
                    stroke="#C88898"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.6"
                  />
                  
                  {/* Bronchi - main branches */}
                  <path
                    d="M 175 150 Q 168 160 162 168"
                    stroke="#A8948C"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <path
                    d="M 175 150 Q 182 160 188 168"
                    stroke="#A8948C"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  
                  {/* Secondary bronchi */}
                  <path
                    d="M 162 168 L 150 182 M 162 168 L 147 195"
                    stroke="#C4ACA0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <path
                    d="M 188 168 L 200 182 M 188 168 L 203 195"
                    stroke="#C4ACA0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  
                  {lungsStatus && (
                    <g>
                      <circle cx="175" cy="195" r="17" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="203" 
                        textAnchor="middle" 
                        className="text-[19px] font-bold"
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

            {/* Heart - anatomical illustration style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => heartStatus && handleOrganClick('heart')}
                  className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main heart body */}
                  <path
                    d="M 175 172
                       L 163 182
                       Q 153 192 153 207
                       Q 153 222 163 233
                       L 175 246
                       L 187 233
                       Q 197 222 197 207
                       Q 197 192 187 182
                       Z"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#A82E2E"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  
                  {/* Left atrium */}
                  <ellipse
                    cx="165"
                    cy="170"
                    rx="9"
                    ry="10"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#A82E2E"
                    strokeWidth="2"
                  />
                  
                  {/* Right atrium */}
                  <ellipse
                    cx="185"
                    cy="170"
                    rx="9"
                    ry="10"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#A82E2E"
                    strokeWidth="2"
                  />
                  
                  {/* Aortic arch */}
                  <path
                    d="M 168 162 Q 165 156 163 148"
                    stroke="#D84444"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.9"
                  />
                  
                  {/* Pulmonary artery */}
                  <path
                    d="M 182 162 Q 185 156 187 148"
                    stroke="#C63838"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.9"
                  />
                  
                  {/* Ventricular septum */}
                  <path
                    d="M 175 185 L 175 240"
                    stroke="#8A2424"
                    strokeWidth="2.5"
                    opacity="0.5"
                  />
                  
                  {/* Valves */}
                  <ellipse
                    cx="168"
                    cy="195"
                    rx="4"
                    ry="3"
                    fill="#8A2424"
                    opacity="0.6"
                  />
                  <ellipse
                    cx="182"
                    cy="195"
                    rx="4"
                    ry="3"
                    fill="#8A2424"
                    opacity="0.6"
                  />
                  
                  {/* Coronary arteries - detailed */}
                  <path
                    d="M 165 187 Q 160 192 158 200 L 156 210"
                    stroke="#D84444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.8"
                  />
                  <path
                    d="M 185 187 Q 190 192 192 200 L 194 210"
                    stroke="#D84444"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.8"
                  />
                  
                  {/* Additional coronary branches */}
                  <path
                    d="M 158 200 L 155 205 M 160 205 L 158 210"
                    stroke="#C63838"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <path
                    d="M 192 200 L 195 205 M 190 205 L 192 210"
                    stroke="#C63838"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  
                  {/* Myocardium texture lines */}
                  <path
                    d="M 165 215 Q 170 213 175 215 M 175 215 Q 180 213 185 215"
                    stroke="#8A2424"
                    strokeWidth="1.2"
                    opacity="0.4"
                  />
                  <path
                    d="M 165 225 Q 170 223 175 225 M 175 225 Q 180 223 185 225"
                    stroke="#8A2424"
                    strokeWidth="1.2"
                    opacity="0.4"
                  />
                  
                  {heartStatus && (
                    <g>
                      <circle cx="175" cy="210" r="17" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="175" 
                        y="218" 
                        textAnchor="middle" 
                        className="text-[19px] font-bold"
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