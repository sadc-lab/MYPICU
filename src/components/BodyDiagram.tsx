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
              
              {/* Gradients for medical-style organs */}
              <radialGradient id="brainGradient" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#E8A87C" stopOpacity="1"/>
                <stop offset="50%" stopColor="#D69A6E" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#C88B5F" stopOpacity="0.85"/>
              </radialGradient>
              
              <radialGradient id="brainGradientProblem" cx="40%" cy="35%">
                <stop offset="0%" stopColor={getOrganColor('brain')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('brain')} stopOpacity="0.75"/>
              </radialGradient>
              
              <radialGradient id="heartGradient" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#E74C4C" stopOpacity="1"/>
                <stop offset="50%" stopColor="#D43C3C" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#C12E2E" stopOpacity="0.85"/>
              </radialGradient>
              
              <radialGradient id="heartGradientProblem" cx="35%" cy="30%">
                <stop offset="0%" stopColor={getOrganColor('heart')} stopOpacity="1"/>
                <stop offset="100%" stopColor={getOrganColor('heart')} stopOpacity="0.75"/>
              </radialGradient>
              
              <radialGradient id="lungsGradient" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#E89BA3" stopOpacity="1"/>
                <stop offset="50%" stopColor="#D98895" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#C87887" stopOpacity="0.85"/>
              </radialGradient>
              
              <radialGradient id="lungsGradientProblem" cx="40%" cy="35%">
                <stop offset="0%" stopColor={getOrganColor('lungs')} stopOpacity="1"/>
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

            {/* Brain - medical style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => brainStatus && handleOrganClick('brain')}
                  className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main cerebrum with lobes */}
                  <path
                    d="M 150 45
                       Q 165 43 177 50
                       Q 186 57 188 68
                       Q 190 80 186 90
                       Q 180 100 168 105
                       L 155 108
                       L 145 108
                       L 132 105
                       Q 120 100 114 90
                       Q 110 80 112 68
                       Q 114 57 123 50
                       Q 135 43 150 45 Z"
                    fill={brainStatus ? "url(#brainGradientProblem)" : "url(#brainGradient)"}
                    stroke="#A67C52"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  
                  {/* Central longitudinal fissure */}
                  <path
                    d="M 150 47 Q 150 56 150 75 Q 150 90 150 106"
                    stroke="#8B6942"
                    strokeWidth="2.5"
                    fill="none"
                    opacity="0.6"
                  />
                  
                  {/* Left frontal lobe details */}
                  <path
                    d="M 125 58 Q 120 62 118 68"
                    stroke="#A67C52"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 130 65 Q 125 69 123 75"
                    stroke="#A67C52"
                    strokeWidth="1.8"
                    fill="none"
                    opacity="0.65"
                    strokeLinecap="round"
                  />
                  
                  {/* Left parietal/temporal lobe */}
                  <path
                    d="M 128 80 Q 122 84 120 90"
                    stroke="#A67C52"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 135 88 Q 130 92 128 98"
                    stroke="#A67C52"
                    strokeWidth="1.8"
                    fill="none"
                    opacity="0.65"
                    strokeLinecap="round"
                  />
                  
                  {/* Right frontal lobe details */}
                  <path
                    d="M 175 58 Q 180 62 182 68"
                    stroke="#A67C52"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 170 65 Q 175 69 177 75"
                    stroke="#A67C52"
                    strokeWidth="1.8"
                    fill="none"
                    opacity="0.65"
                    strokeLinecap="round"
                  />
                  
                  {/* Right parietal/temporal lobe */}
                  <path
                    d="M 172 80 Q 178 84 180 90"
                    stroke="#A67C52"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 165 88 Q 170 92 172 98"
                    stroke="#A67C52"
                    strokeWidth="1.8"
                    fill="none"
                    opacity="0.65"
                    strokeLinecap="round"
                  />
                  
                  {/* Gyri and sulci details */}
                  <circle cx="128" cy="70" r="2" fill="#A67C52" opacity="0.5"/>
                  <circle cx="135" cy="77" r="1.8" fill="#A67C52" opacity="0.5"/>
                  <circle cx="142" cy="68" r="1.5" fill="#A67C52" opacity="0.45"/>
                  <circle cx="172" cy="70" r="2" fill="#A67C52" opacity="0.5"/>
                  <circle cx="165" cy="77" r="1.8" fill="#A67C52" opacity="0.5"/>
                  <circle cx="158" cy="68" r="1.5" fill="#A67C52" opacity="0.45"/>
                  
                  {brainStatus && (
                    <g>
                      <circle cx="150" cy="75" r="16" fill="rgba(255,255,255,0.95)" />
                      <text 
                        x="150" 
                        y="82" 
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

            {/* Lungs - medical style with detailed anatomy */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => lungsStatus && handleOrganClick('lungs')}
                  className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Trachea with cartilage rings */}
                  <rect
                    x="170"
                    y="115"
                    width="10"
                    height="32"
                    rx="4"
                    fill="#9EACB8"
                    opacity="0.85"
                  />
                  {/* Cartilage rings */}
                  <path
                    d="M 171 120 L 179 120 M 171 125 L 179 125 M 171 130 L 179 130 M 171 135 L 179 135 M 171 140 L 179 140"
                    stroke="#7A8A99"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  
                  {/* Left lung - detailed with lobes */}
                  <path
                    d="M 148 152
                       Q 128 156 122 170
                       L 120 195
                       Q 120 210 124 220
                       L 126 227
                       Q 130 235 140 238
                       L 152 235
                       Q 158 230 160 220
                       L 160 168
                       Q 160 158 152 152 Z"
                    fill={lungsStatus ? "url(#lungsGradientProblem)" : "url(#lungsGradient)"}
                    stroke="#B87882"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  {/* Left lung superior lobe fissure */}
                  <path
                    d="M 128 185 Q 138 187 148 185"
                    stroke="#B87882"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                  {/* Alveoli texture - left */}
                  <circle cx="132" cy="175" r="3.5" fill="#D098A0" opacity="0.4"/>
                  <circle cx="140" cy="180" r="3" fill="#D098A0" opacity="0.35"/>
                  <circle cx="148" cy="176" r="2.8" fill="#D098A0" opacity="0.35"/>
                  <circle cx="135" cy="195" r="3.2" fill="#D098A0" opacity="0.4"/>
                  <circle cx="143" cy="200" r="3" fill="#D098A0" opacity="0.35"/>
                  <circle cx="130" cy="210" r="3.5" fill="#D098A0" opacity="0.4"/>
                  <circle cx="138" cy="217" r="3" fill="#D098A0" opacity="0.35"/>
                  
                  {/* Right lung - detailed with 3 lobes */}
                  <path
                    d="M 202 152
                       Q 222 156 228 170
                       L 230 195
                       Q 230 210 226 220
                       L 224 227
                       Q 220 235 210 238
                       L 198 235
                       Q 192 230 190 220
                       L 190 168
                       Q 190 158 198 152 Z"
                    fill={lungsStatus ? "url(#lungsGradientProblem)" : "url(#lungsGradient)"}
                    stroke="#B87882"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  {/* Right lung fissures (3 lobes) */}
                  <path
                    d="M 205 172 Q 215 174 223 172"
                    stroke="#B87882"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                  <path
                    d="M 204 202 Q 214 204 222 202"
                    stroke="#B87882"
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.5"
                  />
                  {/* Alveoli texture - right */}
                  <circle cx="218" cy="175" r="3.5" fill="#D098A0" opacity="0.4"/>
                  <circle cx="210" cy="180" r="3" fill="#D098A0" opacity="0.35"/>
                  <circle cx="202" cy="176" r="2.8" fill="#D098A0" opacity="0.35"/>
                  <circle cx="215" cy="195" r="3.2" fill="#D098A0" opacity="0.4"/>
                  <circle cx="207" cy="200" r="3" fill="#D098A0" opacity="0.35"/>
                  <circle cx="220" cy="210" r="3.5" fill="#D098A0" opacity="0.4"/>
                  <circle cx="212" cy="217" r="3" fill="#D098A0" opacity="0.35"/>
                  
                  {/* Primary bronchi */}
                  <path
                    d="M 175 147 Q 170 157 163 166"
                    stroke="#8B99A6"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <path
                    d="M 175 147 Q 180 157 187 166"
                    stroke="#8B99A6"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  
                  {/* Secondary bronchi */}
                  <path
                    d="M 163 166 L 152 178 M 163 166 L 148 190"
                    stroke="#9EACB8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <path
                    d="M 187 166 L 198 178 M 187 166 L 202 190"
                    stroke="#9EACB8"
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

            {/* Heart - medical anatomical style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <g 
                  onClick={() => heartStatus && handleOrganClick('heart')}
                  className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
                >
                  {/* Main heart ventricles */}
                  <path
                    d="M 175 170
                       L 162 182
                       Q 152 192 152 207
                       Q 152 222 162 233
                       L 175 247
                       L 188 233
                       Q 198 222 198 207
                       Q 198 192 188 182
                       Z"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#B83838"
                    strokeWidth="2.5"
                    filter="url(#glow)"
                  />
                  
                  {/* Left atrium */}
                  <path
                    d="M 162 182 Q 157 175 157 167 Q 157 159 162 154 Q 167 150 172 154 L 175 158"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#B83838"
                    strokeWidth="2.5"
                  />
                  
                  {/* Right atrium */}
                  <path
                    d="M 188 182 Q 193 175 193 167 Q 193 159 188 154 Q 183 150 178 154 L 175 158"
                    fill={heartStatus ? "url(#heartGradientProblem)" : "url(#heartGradient)"}
                    stroke="#B83838"
                    strokeWidth="2.5"
                  />
                  
                  {/* Aorta arch */}
                  <path
                    d="M 172 154 Q 168 148 165 142"
                    stroke="#D84444"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.9"
                  />
                  
                  {/* Pulmonary artery */}
                  <path
                    d="M 178 154 Q 182 148 185 142"
                    stroke="#C94040"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.85"
                  />
                  
                  {/* Ventricular septum */}
                  <path
                    d="M 175 185 L 175 242"
                    stroke="#A83030"
                    strokeWidth="2.5"
                    strokeDasharray="5,3"
                    opacity="0.6"
                  />
                  
                  {/* Tricuspid and mitral valves */}
                  <path
                    d="M 164 195 Q 169 193 175 196 Q 181 193 186 195"
                    stroke="#A83030"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.7"
                  />
                  <ellipse
                    cx="169"
                    cy="195"
                    rx="3"
                    ry="2"
                    fill="#A83030"
                    opacity="0.5"
                  />
                  <ellipse
                    cx="181"
                    cy="195"
                    rx="3"
                    ry="2"
                    fill="#A83030"
                    opacity="0.5"
                  />
                  
                  {/* Coronary arteries */}
                  <path
                    d="M 165 190 Q 160 195 158 202 M 168 200 Q 164 205 162 212"
                    stroke="#D84444"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <path
                    d="M 185 190 Q 190 195 192 202 M 182 200 Q 186 205 188 212"
                    stroke="#D84444"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  
                  {/* Muscular texture */}
                  <path
                    d="M 165 210 Q 170 208 175 210 M 165 220 Q 170 218 175 220"
                    stroke="#A83030"
                    strokeWidth="1.2"
                    opacity="0.4"
                  />
                  <path
                    d="M 175 210 Q 180 208 185 210 M 175 220 Q 180 218 185 220"
                    stroke="#A83030"
                    strokeWidth="1.2"
                    opacity="0.4"
                  />
                  
                  {/* Highlight for dimension */}
                  <ellipse
                    cx="168"
                    cy="195"
                    rx="10"
                    ry="15"
                    fill="white"
                    opacity="0.15"
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