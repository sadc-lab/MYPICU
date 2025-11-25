import { useNavigate } from 'react-router-dom';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import { HeartIcon } from '@/components/icons/HeartIcon';

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

  const getOrganColor = (status?: 'critical' | 'warning') => {
    if (!status) return 'text-muted-foreground';
    return status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400';
  };

  const getOrganBgColor = (status?: 'critical' | 'warning') => {
    if (!status) return 'bg-muted/30';
    return status === 'critical' ? 'bg-red-100 dark:bg-red-950' : 'bg-orange-100 dark:bg-orange-950';
  };

  const brainStatus = getOrganStatus('brain');
  const heartStatus = getOrganStatus('heart');
  const lungsStatus = getOrganStatus('lungs');

  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative max-w-4xl w-full">
        {/* Human body silhouette (simplified SVG) */}
        <svg
          viewBox="0 0 400 600"
          className="w-full h-auto opacity-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <ellipse cx="200" cy="60" rx="50" ry="60" fill="currentColor" className="text-muted-foreground" />
          {/* Neck */}
          <rect x="180" y="110" width="40" height="30" fill="currentColor" className="text-muted-foreground" />
          {/* Torso */}
          <path
            d="M 160 140 L 160 400 Q 160 420 180 420 L 220 420 Q 240 420 240 400 L 240 140 Q 240 120 220 120 L 180 120 Q 160 120 160 140"
            fill="currentColor"
            className="text-muted-foreground"
          />
          {/* Left arm */}
          <rect x="100" y="160" width="60" height="25" rx="12" fill="currentColor" className="text-muted-foreground" />
          <rect x="80" y="185" width="80" height="25" rx="12" fill="currentColor" className="text-muted-foreground" />
          {/* Right arm */}
          <rect x="240" y="160" width="60" height="25" rx="12" fill="currentColor" className="text-muted-foreground" />
          <rect x="240" y="185" width="80" height="25" rx="12" fill="currentColor" className="text-muted-foreground" />
          {/* Left leg */}
          <rect x="165" y="420" width="30" height="160" rx="15" fill="currentColor" className="text-muted-foreground" />
          {/* Right leg */}
          <rect x="205" y="420" width="30" height="160" rx="15" fill="currentColor" className="text-muted-foreground" />
        </svg>

        {/* Organ indicators with lines */}
        <div className="absolute inset-0">
          {/* Brain */}
          {brainStatus && (
            <div className="absolute top-[8%] left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-4">
                <svg className="w-32 h-1" viewBox="0 0 128 4">
                  <line x1="0" y1="2" x2="128" y2="2" stroke="currentColor" strokeWidth="2" className={getOrganColor(brainStatus.status)} />
                </svg>
                <button
                  onClick={() => handleOrganClick('brain')}
                  className={`${getOrganBgColor(brainStatus.status)} rounded-full p-6 flex items-center justify-center gap-3 cursor-pointer hover:scale-105 transition-transform shadow-lg`}
                >
                  <img 
                    src={brainIcon} 
                    alt="brain" 
                    className="h-10 w-10"
                    style={{ 
                      filter: brainStatus.status === 'critical' 
                        ? 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)' 
                        : 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'
                    }}
                  />
                  <div className="text-left">
                    <div className={`text-sm font-bold ${getOrganColor(brainStatus.status)}`}>Cerveau</div>
                    <div className="text-xs text-muted-foreground">{brainStatus.count} indicateur{brainStatus.count > 1 ? 's' : ''}</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Heart */}
          {heartStatus && (
            <div className="absolute top-[32%] left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-4">
                <svg className="w-32 h-1" viewBox="0 0 128 4">
                  <line x1="0" y1="2" x2="128" y2="2" stroke="currentColor" strokeWidth="2" className={getOrganColor(heartStatus.status)} />
                </svg>
                <button
                  onClick={() => handleOrganClick('heart')}
                  className={`${getOrganBgColor(heartStatus.status)} rounded-full p-6 flex items-center justify-center gap-3 cursor-pointer hover:scale-105 transition-transform shadow-lg`}
                >
                  <HeartIcon className={`h-10 w-10 ${getOrganColor(heartStatus.status)}`} />
                  <div className="text-left">
                    <div className={`text-sm font-bold ${getOrganColor(heartStatus.status)}`}>Cœur</div>
                    <div className="text-xs text-muted-foreground">{heartStatus.count} indicateur{heartStatus.count > 1 ? 's' : ''}</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Lungs */}
          {lungsStatus && (
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-4">
                <svg className="w-32 h-1" viewBox="0 0 128 4">
                  <line x1="0" y1="2" x2="128" y2="2" stroke="currentColor" strokeWidth="2" className={getOrganColor(lungsStatus.status)} />
                </svg>
                <button
                  onClick={() => handleOrganClick('lungs')}
                  className={`${getOrganBgColor(lungsStatus.status)} rounded-full p-6 flex items-center justify-center gap-3 cursor-pointer hover:scale-105 transition-transform shadow-lg`}
                >
                  <img 
                    src={lungsIcon} 
                    alt="lungs" 
                    className="h-10 w-10"
                    style={{ 
                      filter: lungsStatus.status === 'critical' 
                        ? 'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)' 
                        : 'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)'
                    }}
                  />
                  <div className="text-left">
                    <div className={`text-sm font-bold ${getOrganColor(lungsStatus.status)}`}>Poumons</div>
                    <div className="text-xs text-muted-foreground">{lungsStatus.count} indicateur{lungsStatus.count > 1 ? 's' : ''}</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};