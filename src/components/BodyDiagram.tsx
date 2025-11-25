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
    if (!status) return '#94a3b8'; // muted gray
    return status.status === 'critical' ? '#dc2626' : '#ea580c'; // red or orange
  };

  const getOrganOpacity = (organ: string) => {
    const status = getOrganStatus(organ);
    return status ? '0.7' : '0.15';
  };

  const brainStatus = getOrganStatus('brain');
  const heartStatus = getOrganStatus('heart');
  const lungsStatus = getOrganStatus('lungs');

  return (
    <div className="relative w-full max-w-4xl mx-auto py-8">
      <div className="flex justify-center gap-12">
        {/* Front view */}
        <div className="relative">
          <div className="text-center mb-4">
            <h3 className="text-sm font-semibold text-foreground">Vue de face</h3>
          </div>
          
          <svg 
            viewBox="0 0 200 400" 
            className="w-64 h-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Body outline */}
            <g className="text-muted-foreground" stroke="currentColor" strokeWidth="2" fill="none">
              {/* Head */}
              <ellipse cx="100" cy="35" rx="28" ry="32" />
              {/* Neck */}
              <path d="M 85 60 L 85 75 M 115 60 L 115 75" />
              {/* Shoulders and arms */}
              <path d="M 75 75 Q 65 75 60 80 L 50 120 L 45 160" />
              <path d="M 125 75 Q 135 75 140 80 L 150 120 L 155 160" />
              {/* Torso */}
              <path d="M 75 75 L 70 130 Q 68 180 75 220 L 85 280" />
              <path d="M 125 75 L 130 130 Q 132 180 125 220 L 115 280" />
              {/* Legs */}
              <path d="M 85 280 L 88 350 L 85 390" />
              <path d="M 115 280 L 112 350 L 115 390" />
              {/* Bottom connections */}
              <path d="M 75 220 Q 80 240 85 280" />
              <path d="M 125 220 Q 120 240 115 280" />
            </g>

            {/* Brain */}
            <g 
              onClick={() => brainStatus && handleOrganClick('brain')}
              className={brainStatus ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
            >
              <ellipse 
                cx="100" 
                cy="30" 
                rx="22" 
                ry="25"
                fill={getOrganColor('brain')}
                opacity={getOrganOpacity('brain')}
                className="transition-all duration-300"
              />
              {brainStatus && (
                <text 
                  x="100" 
                  y="35" 
                  textAnchor="middle" 
                  className="text-[10px] font-bold fill-white"
                >
                  {brainStatus.count}
                </text>
              )}
            </g>

            {/* Lungs - left and right */}
            <g 
              onClick={() => lungsStatus && handleOrganClick('lungs')}
              className={lungsStatus ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
            >
              {/* Left lung */}
              <ellipse 
                cx="85" 
                cy="105" 
                rx="18" 
                ry="35"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                className="transition-all duration-300"
              />
              {/* Right lung */}
              <ellipse 
                cx="115" 
                cy="105" 
                rx="18" 
                ry="35"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                className="transition-all duration-300"
              />
              {lungsStatus && (
                <text 
                  x="100" 
                  y="110" 
                  textAnchor="middle" 
                  className="text-[10px] font-bold fill-white"
                >
                  {lungsStatus.count}
                </text>
              )}
            </g>

            {/* Heart */}
            <g 
              onClick={() => heartStatus && handleOrganClick('heart')}
              className={heartStatus ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
            >
              <path 
                d="M 100 95 L 92 103 Q 88 107 88 112 Q 88 117 92 121 L 100 129 L 108 121 Q 112 117 112 112 Q 112 107 108 103 Z"
                fill={getOrganColor('heart')}
                opacity={getOrganOpacity('heart')}
                className="transition-all duration-300"
              />
              {heartStatus && (
                <text 
                  x="100" 
                  y="115" 
                  textAnchor="middle" 
                  className="text-[8px] font-bold fill-white"
                >
                  {heartStatus.count}
                </text>
              )}
            </g>

            {/* Liver */}
            <path 
              d="M 95 145 Q 90 145 85 150 L 85 170 Q 85 175 90 175 L 110 175 Q 118 175 120 170 L 120 150 Q 118 145 110 145 Z"
              fill={getOrganColor('liver')}
              opacity={getOrganOpacity('liver')}
              className="transition-all duration-300"
            />

            {/* Kidneys */}
            <g>
              <ellipse 
                cx="82" 
                cy="160" 
                rx="8" 
                ry="18"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                className="transition-all duration-300"
              />
              <ellipse 
                cx="118" 
                cy="160" 
                rx="8" 
                ry="18"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                className="transition-all duration-300"
              />
            </g>

            {/* Intestines */}
            <g>
              <path 
                d="M 90 190 Q 85 190 85 195 L 85 230 Q 85 235 90 235 L 110 235 Q 115 235 115 230 L 115 195 Q 115 190 110 190 Z"
                fill={getOrganColor('intestine')}
                opacity={getOrganOpacity('intestine')}
                className="transition-all duration-300"
              />
            </g>

            {/* Pancreas */}
            <path 
              d="M 85 153 Q 82 153 82 156 L 82 162 Q 82 165 85 165 L 115 165 Q 118 165 118 162 L 118 156 Q 118 153 115 153 Z"
              fill={getOrganColor('pancreas')}
              opacity={getOrganOpacity('pancreas')}
              className="transition-all duration-300"
            />
          </svg>

          {/* Labels for front view */}
          <div className="absolute inset-0 pointer-events-none">
            {brainStatus && (
              <div 
                className="absolute"
                style={{ top: '5%', left: '50%', transform: 'translateX(-50%)' }}
              >
                <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  brainStatus.status === 'critical' 
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                }`}>
                  Cerveau ({brainStatus.count})
                </div>
              </div>
            )}
            
            {heartStatus && (
              <div 
                className="absolute"
                style={{ top: '26%', left: '10%' }}
              >
                <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  heartStatus.status === 'critical' 
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                }`}>
                  Cœur ({heartStatus.count})
                </div>
              </div>
            )}

            {lungsStatus && (
              <div 
                className="absolute"
                style={{ top: '22%', right: '10%' }}
              >
                <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  lungsStatus.status === 'critical' 
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                }`}>
                  Poumons ({lungsStatus.count})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back view */}
        <div className="relative">
          <div className="text-center mb-4">
            <h3 className="text-sm font-semibold text-foreground">Vue de dos</h3>
          </div>
          
          <svg 
            viewBox="0 0 200 400" 
            className="w-64 h-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Body outline - back view */}
            <g className="text-muted-foreground" stroke="currentColor" strokeWidth="2" fill="none">
              {/* Head */}
              <ellipse cx="100" cy="35" rx="28" ry="32" />
              {/* Neck */}
              <path d="M 85 60 L 85 75 M 115 60 L 115 75" />
              {/* Shoulders and arms */}
              <path d="M 75 75 Q 65 75 60 80 L 50 120 L 45 160" />
              <path d="M 125 75 Q 135 75 140 80 L 150 120 L 155 160" />
              {/* Back/Spine */}
              <path d="M 100 75 L 100 220" strokeDasharray="3,3" />
              {/* Torso */}
              <path d="M 75 75 L 70 130 Q 68 180 75 220 L 85 280" />
              <path d="M 125 75 L 130 130 Q 132 180 125 220 L 115 280" />
              {/* Legs */}
              <path d="M 85 280 L 88 350 L 85 390" />
              <path d="M 115 280 L 112 350 L 115 390" />
              {/* Bottom connections */}
              <path d="M 75 220 Q 80 240 85 280" />
              <path d="M 125 220 Q 120 240 115 280" />
            </g>

            {/* Brain (back) */}
            <ellipse 
              cx="100" 
              cy="30" 
              rx="22" 
              ry="25"
              fill={getOrganColor('brain')}
              opacity={getOrganOpacity('brain')}
              className="transition-all duration-300"
            />

            {/* Lungs (back) */}
            <g>
              <ellipse 
                cx="85" 
                cy="105" 
                rx="18" 
                ry="35"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                className="transition-all duration-300"
              />
              <ellipse 
                cx="115" 
                cy="105" 
                rx="18" 
                ry="35"
                fill={getOrganColor('lungs')}
                opacity={getOrganOpacity('lungs')}
                className="transition-all duration-300"
              />
            </g>

            {/* Kidneys (more prominent from back) */}
            <g>
              <ellipse 
                cx="82" 
                cy="160" 
                rx="12" 
                ry="22"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                className="transition-all duration-300"
              />
              <ellipse 
                cx="118" 
                cy="160" 
                rx="12" 
                ry="22"
                fill={getOrganColor('kidneys')}
                opacity={getOrganOpacity('kidneys')}
                className="transition-all duration-300"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-muted/50 border border-muted-foreground"></div>
          <span className="text-muted-foreground">Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orange-500"></div>
          <span className="text-muted-foreground">Attention</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-red-500"></div>
          <span className="text-muted-foreground">Critique</span>
        </div>
      </div>

      {/* Organ list summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
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
                px-3 py-2 rounded-lg text-sm font-medium text-left
                transition-all duration-300 hover:scale-105
                ${status.status === 'critical'
                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                  : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                }
                ${['brain', 'heart', 'lungs'].includes(organ.id) ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <div className="flex items-center justify-between">
                <span>{organ.label}</span>
                <span className="text-xs opacity-75">
                  {status.count} indicateur{status.count > 1 ? 's' : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};