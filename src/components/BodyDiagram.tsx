import { useNavigate } from 'react-router-dom';

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
    if (!status) return 'hsl(var(--muted-foreground) / 0.15)';
    return status.status === 'critical' 
      ? 'hsl(0 84% 60% / 0.7)' 
      : 'hsl(20 91% 48% / 0.7)';
  };

  const getStrokeColor = (organ: string) => {
    const status = getOrganStatus(organ);
    if (!status) return 'none';
    return status.status === 'critical' 
      ? 'hsl(0 84% 60%)' 
      : 'hsl(20 91% 48%)';
  };

  const brainStatus = getOrganStatus('brain');
  const heartStatus = getOrganStatus('heart');
  const lungsStatus = getOrganStatus('lungs');

  return (
    <div className="relative w-full max-w-5xl mx-auto py-8 animate-fade-in">
      <div className="flex justify-center gap-16 items-start">
        {/* Front view */}
        <div className="relative">
          <div className="text-center mb-6">
            <h3 className="text-base font-semibold text-foreground">Vue de face</h3>
          </div>
          
          <svg 
            viewBox="0 0 300 600" 
            className="w-80 h-auto drop-shadow-lg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground) / 0.08)" />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground) / 0.03)" />
              </linearGradient>
              
              <filter id="shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
              </filter>
            </defs>

            {/* Body silhouette with realistic proportions */}
            <g opacity="0.4" fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1.5">
              {/* Head */}
              <ellipse cx="150" cy="50" rx="35" ry="42" />
              
              {/* Neck */}
              <rect x="135" y="85" width="30" height="25" rx="8" />
              
              {/* Shoulders */}
              <ellipse cx="150" cy="115" rx="65" ry="15" />
              
              {/* Chest/Torso */}
              <path d="M 95 115 Q 85 140 85 180 L 85 280 Q 85 300 95 310 L 115 360 L 130 420" />
              <path d="M 205 115 Q 215 140 215 180 L 215 280 Q 215 300 205 310 L 185 360 L 170 420" />
              
              {/* Waist */}
              <path d="M 95 310 Q 100 330 110 340 L 130 420" />
              <path d="M 205 310 Q 200 330 190 340 L 170 420" />
              
              {/* Arms */}
              <path d="M 95 115 Q 75 120 65 130 L 55 200 L 50 260" />
              <path d="M 205 115 Q 225 120 235 130 L 245 200 L 250 260" />
              
              {/* Legs */}
              <path d="M 130 420 L 132 520 L 128 580" strokeWidth="18" strokeLinecap="round" />
              <path d="M 170 420 L 168 520 L 172 580" strokeWidth="18" strokeLinecap="round" />
            </g>

            {/* Organs with realistic anatomy */}
            
            {/* Brain with detail */}
            <g 
              onClick={() => brainStatus && handleOrganClick('brain')}
              className={`transition-all duration-300 ${brainStatus ? 'cursor-pointer hover:scale-105' : ''}`}
            >
              <ellipse 
                cx="150" 
                cy="45" 
                rx="32" 
                ry="38"
                fill={getOrganColor('brain')}
                stroke={getStrokeColor('brain')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              {/* Brain folds detail */}
              <path 
                d="M 135 35 Q 140 30 145 35 M 155 35 Q 160 30 165 35 M 140 50 Q 145 45 150 50 M 150 50 Q 155 45 160 50"
                stroke="hsl(var(--muted-foreground) / 0.3)"
                strokeWidth="1"
                fill="none"
              />
              {brainStatus && (
                <g>
                  <circle cx="150" cy="45" r="14" fill="rgba(255,255,255,0.9)" />
                  <text 
                    x="150" 
                    y="52" 
                    textAnchor="middle" 
                    className="text-[16px] font-bold"
                    fill={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                  >
                    {brainStatus.count}
                  </text>
                </g>
              )}
            </g>

            {/* Lungs - anatomically shaped */}
            <g 
              onClick={() => lungsStatus && handleOrganClick('lungs')}
              className={`transition-all duration-300 ${lungsStatus ? 'cursor-pointer hover:scale-105' : ''}`}
            >
              {/* Left lung */}
              <path 
                d="M 120 135 Q 110 145 110 165 L 110 200 Q 110 220 120 225 Q 125 228 130 225 L 135 200 L 135 165 Q 135 145 125 140 Q 122 138 120 135 Z"
                fill={getOrganColor('lungs')}
                stroke={getStrokeColor('lungs')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              {/* Right lung */}
              <path 
                d="M 180 135 Q 190 145 190 165 L 190 200 Q 190 220 180 225 Q 175 228 170 225 L 165 200 L 165 165 Q 165 145 175 140 Q 178 138 180 135 Z"
                fill={getOrganColor('lungs')}
                stroke={getStrokeColor('lungs')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              {/* Bronchi detail */}
              <path 
                d="M 150 120 L 150 140 M 150 140 L 130 155 M 150 140 L 170 155"
                stroke="hsl(var(--muted-foreground) / 0.3)"
                strokeWidth="2"
                fill="none"
              />
              {lungsStatus && (
                <g>
                  <circle cx="150" cy="175" r="14" fill="rgba(255,255,255,0.9)" />
                  <text 
                    x="150" 
                    y="182" 
                    textAnchor="middle" 
                    className="text-[16px] font-bold"
                    fill={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                  >
                    {lungsStatus.count}
                  </text>
                </g>
              )}
            </g>

            {/* Heart - anatomically shaped */}
            <g 
              onClick={() => heartStatus && handleOrganClick('heart')}
              className={`transition-all duration-300 ${heartStatus ? 'cursor-pointer hover:scale-105' : ''}`}
            >
              <path 
                d="M 150 145 L 142 152 Q 135 159 135 168 Q 135 177 142 184 L 150 192 L 158 184 Q 165 177 165 168 Q 165 159 158 152 Z"
                fill={getOrganColor('heart')}
                stroke={getStrokeColor('heart')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              {/* Heart chambers detail */}
              <path 
                d="M 150 155 L 150 185"
                stroke="hsl(var(--muted-foreground) / 0.3)"
                strokeWidth="1"
              />
              {heartStatus && (
                <g>
                  <circle cx="150" cy="168" r="12" fill="rgba(255,255,255,0.9)" />
                  <text 
                    x="150" 
                    y="174" 
                    textAnchor="middle" 
                    className="text-[14px] font-bold"
                    fill={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'}
                  >
                    {heartStatus.count}
                  </text>
                </g>
              )}
            </g>

            {/* Liver - right side, detailed shape */}
            <path 
              d="M 155 230 Q 180 230 195 240 L 200 270 Q 200 285 190 290 L 160 295 Q 155 295 155 290 Z"
              fill={getOrganColor('liver')}
              stroke={getStrokeColor('liver')}
              strokeWidth="2"
              filter="url(#shadow)"
            />

            {/* Stomach */}
            <ellipse 
              cx="135" 
              cy="255" 
              rx="20" 
              ry="28"
              fill={getOrganColor('stomach')}
              stroke={getStrokeColor('stomach')}
              strokeWidth="1.5"
              filter="url(#shadow)"
            />

            {/* Kidneys */}
            <g>
              <ellipse 
                cx="115" 
                cy="280" 
                rx="12" 
                ry="22"
                fill={getOrganColor('kidneys')}
                stroke={getStrokeColor('kidneys')}
                strokeWidth="1.5"
                filter="url(#shadow)"
              />
              <ellipse 
                cx="185" 
                cy="280" 
                rx="12" 
                ry="22"
                fill={getOrganColor('kidneys')}
                stroke={getStrokeColor('kidneys')}
                strokeWidth="1.5"
                filter="url(#shadow)"
              />
            </g>

            {/* Pancreas */}
            <ellipse 
              cx="150" 
              cy="265" 
              rx="30" 
              ry="8"
              fill={getOrganColor('pancreas')}
              stroke={getStrokeColor('pancreas')}
              strokeWidth="1.5"
              filter="url(#shadow)"
            />

            {/* Intestines - coiled pattern */}
            <g 
              fill={getOrganColor('intestine')}
              stroke={getStrokeColor('intestine')}
              strokeWidth="1.5"
              filter="url(#shadow)"
            >
              <path d="M 130 310 Q 120 320 125 335 Q 130 350 145 350 Q 160 350 165 335 Q 170 320 160 310 Z" />
              <path d="M 145 350 Q 140 365 150 375 Q 160 375 155 360" />
            </g>
          </svg>

          {/* Labels with connecting lines */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 300 600">
            {brainStatus && (
              <g>
                <line x1="185" y1="45" x2="235" y2="30" stroke={brainStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="1.5" />
                <foreignObject x="235" y="15" width="120" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg ${
                    brainStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-400'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-400'
                  }`}>
                    Cerveau ({brainStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}
            
            {heartStatus && (
              <g>
                <line x1="120" y1="168" x2="50" y2="168" stroke={heartStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="1.5" />
                <foreignObject x="5" y="150" width="120" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg ${
                    heartStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-400'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-400'
                  }`}>
                    Cœur ({heartStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}

            {lungsStatus && (
              <g>
                <line x1="195" y1="175" x2="245" y2="175" stroke={lungsStatus.status === 'critical' ? '#dc2626' : '#ea580c'} strokeWidth="1.5" />
                <foreignObject x="245" y="157" width="120" height="40">
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg ${
                    lungsStatus.status === 'critical' 
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-400'
                      : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-400'
                  }`}>
                    Poumons ({lungsStatus.count})
                  </div>
                </foreignObject>
              </g>
            )}
          </svg>
        </div>

        {/* Back view */}
        <div className="relative">
          <div className="text-center mb-6">
            <h3 className="text-base font-semibold text-foreground">Vue de dos</h3>
          </div>
          
          <svg 
            viewBox="0 0 300 600" 
            className="w-80 h-auto drop-shadow-lg"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Body silhouette - back view */}
            <g opacity="0.4" fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1.5">
              {/* Head */}
              <ellipse cx="150" cy="50" rx="35" ry="42" />
              
              {/* Neck */}
              <rect x="135" y="85" width="30" height="25" rx="8" />
              
              {/* Shoulders */}
              <ellipse cx="150" cy="115" rx="65" ry="15" />
              
              {/* Back/Spine line */}
              <line x1="150" y1="110" x2="150" y2="340" stroke="hsl(var(--muted-foreground) / 0.15)" strokeWidth="2" strokeDasharray="5,5" />
              
              {/* Back muscles */}
              <path d="M 95 115 Q 85 140 85 180 L 85 280 Q 85 300 95 310 L 115 360 L 130 420" />
              <path d="M 205 115 Q 215 140 215 180 L 215 280 Q 215 300 205 310 L 185 360 L 170 420" />
              
              {/* Waist */}
              <path d="M 95 310 Q 100 330 110 340 L 130 420" />
              <path d="M 205 310 Q 200 330 190 340 L 170 420" />
              
              {/* Arms */}
              <path d="M 95 115 Q 75 120 65 130 L 55 200 L 50 260" />
              <path d="M 205 115 Q 225 120 235 130 L 245 200 L 250 260" />
              
              {/* Legs */}
              <path d="M 130 420 L 132 520 L 128 580" strokeWidth="18" strokeLinecap="round" />
              <path d="M 170 420 L 168 520 L 172 580" strokeWidth="18" strokeLinecap="round" />
            </g>

            {/* Brain (back of head) */}
            <ellipse 
              cx="150" 
              cy="45" 
              rx="32" 
              ry="38"
              fill={getOrganColor('brain')}
              stroke={getStrokeColor('brain')}
              strokeWidth="2"
              opacity="0.5"
              filter="url(#shadow)"
            />

            {/* Lungs (back view) */}
            <g opacity="0.6">
              <path 
                d="M 120 135 Q 110 145 110 165 L 110 200 Q 110 220 120 225 Q 125 228 130 225 L 135 200 L 135 165 Q 135 145 125 140 Z"
                fill={getOrganColor('lungs')}
                stroke={getStrokeColor('lungs')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              <path 
                d="M 180 135 Q 190 145 190 165 L 190 200 Q 190 220 180 225 Q 175 228 170 225 L 165 200 L 165 165 Q 165 145 175 140 Z"
                fill={getOrganColor('lungs')}
                stroke={getStrokeColor('lungs')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
            </g>

            {/* Kidneys (more prominent from back) */}
            <g>
              <ellipse 
                cx="115" 
                cy="280" 
                rx="16" 
                ry="26"
                fill={getOrganColor('kidneys')}
                stroke={getStrokeColor('kidneys')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              <ellipse 
                cx="185" 
                cy="280" 
                rx="16" 
                ry="26"
                fill={getOrganColor('kidneys')}
                stroke={getStrokeColor('kidneys')}
                strokeWidth="2"
                filter="url(#shadow)"
              />
              {/* Kidney detail */}
              <ellipse cx="115" cy="280" rx="8" ry="13" fill="hsl(var(--muted-foreground) / 0.1)" />
              <ellipse cx="185" cy="280" rx="8" ry="13" fill="hsl(var(--muted-foreground) / 0.1)" />
            </g>
          </svg>
        </div>
      </div>

      {/* Legend with better styling */}
      <div className="mt-10 flex items-center justify-center gap-10 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-muted/30 border-2 border-muted-foreground/20"></div>
          <span className="text-muted-foreground font-medium">Normal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-500/70 border-2 border-orange-500"></div>
          <span className="text-muted-foreground font-medium">Attention</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-red-500/70 border-2 border-red-500"></div>
          <span className="text-muted-foreground font-medium">Critique</span>
        </div>
      </div>

      {/* Organ list summary */}
      {problematicOrgans.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {[
            { id: 'brain', label: 'Cerveau' },
            { id: 'heart', label: 'Cœur' },
            { id: 'lungs', label: 'Poumons' },
            { id: 'liver', label: 'Foie' },
            { id: 'kidneys', label: 'Reins' },
            { id: 'pancreas', label: 'Pancréas' },
            { id: 'intestine', label: 'Intestin grêle' },
          ].map((organ) => {
            const status = getOrganStatus(organ.id);
            if (!status) return null;
            
            return (
              <button
                key={organ.id}
                onClick={() => ['brain', 'heart', 'lungs'].includes(organ.id) && handleOrganClick(organ.id)}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium text-left
                  transition-all duration-300 hover:scale-105 hover:shadow-md
                  ${status.status === 'critical'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-2 border-red-400 dark:border-red-700'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-2 border-orange-400 dark:border-orange-700'
                  }
                  ${['brain', 'heart', 'lungs'].includes(organ.id) ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{organ.label}</span>
                  <span className="text-xs opacity-75 ml-2">
                    {status.count} indicateur{status.count > 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};