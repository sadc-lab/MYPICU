import { useNavigate } from 'react-router-dom';
import { Brain, Heart, Wind, Droplet } from 'lucide-react';

interface BodyDiagramProps {
  problematicOrgans: {
    organ: string;
    status: 'critical' | 'warning';
    count: number;
  }[];
  patientId: string;
}

const OrganIcon = ({ 
  name, 
  status 
}: { 
  name: string; 
  status?: 'critical' | 'warning';
}) => {
  const getColor = () => {
    if (!status) return '#94a3b8'; // muted
    return status === 'critical' ? '#dc2626' : '#ea580c'; // red or orange
  };

  const color = getColor();

  const organs: Record<string, JSX.Element> = {
    brain: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.64-.8 3.09-2.03 4h-5.94C7.8 12.09 7 10.64 7 9c0-2.76 2.24-5 5-5z"/>
      </svg>
    ),
    heart: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    ),
    lungs: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M6.5 3C4.57 3 3 4.57 3 6.5v9C3 17.43 4.57 19 6.5 19c1.04 0 1.98-.45 2.63-1.16.29-.32.54-.68.74-1.09V7.25c-.2-.41-.45-.77-.74-1.09C8.48 5.45 7.54 5 6.5 5 5.67 5 5 5.67 5 6.5v9c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-9C8 5.67 7.33 5 6.5 5zm11 0c-1.93 0-3.5 1.57-3.5 3.5v9c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5v-9C21 4.57 19.43 3 17.5 3zm0 2c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-9c0-.83.67-1.5 1.5-1.5zM12 3v8c-.2.41-.45.77-.74 1.09.29.32.54.68.74 1.09V21h0"/>
      </svg>
    ),
    liver: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M18 4c-1.66 0-3 1.34-3 3v2h-2V7c0-1.66-1.34-3-3-3H8C6.34 4 5 5.34 5 7v8c0 2.76 2.24 5 5 5h4c2.76 0 5-2.24 5-5V7c0-1.66-1.34-3-3-3h-2zm-8 2h2c.55 0 1 .45 1 1v2H9V7c0-.55.45-1 1-1zm5 0h2c.55 0 1 .45 1 1v8c0 1.66-1.34 3-3 3h-4c-1.66 0-3-1.34-3-3v-5h10V7c0-.55.45-1 1-1z"/>
      </svg>
    ),
    pancreas: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M20 8H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zm0 6H4v-4h16v4zM7 11h2v2H7zm4 0h6v2h-6z"/>
      </svg>
    ),
    kidneys: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M8 4C6.34 4 5 5.34 5 7v10c0 1.66 1.34 3 3 3 1.66 0 3-1.34 3-3V7c0-1.66-1.34-3-3-3zm0 2c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm8-2c-1.66 0-3 1.34-3 3v10c0 1.66 1.34 3 3 3 1.66 0 3-1.34 3-3V7c0-1.66-1.34-3-3-3zm0 2c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1z"/>
      </svg>
    ),
    intestine: (
      <svg viewBox="0 0 24 24" fill={color} className="w-full h-full">
        <path d="M12 2C9.79 2 8 3.79 8 6v12c0 2.21 1.79 4 4 4s4-1.79 4-4V6c0-2.21-1.79-4-4-4zm2 16c0 1.1-.9 2-2 2s-2-.9-2-2v-3h4v3zm0-5h-4V9h4v4zm0-6h-4V6c0-1.1.9-2 2-2s2 .9 2 2v1z"/>
      </svg>
    ),
  };

  return organs[name] || null;
};

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

  const allOrgans = [
    { id: 'brain', label: 'Cerveau', top: '8%', left: '50%' },
    { id: 'heart', label: 'Cœur', top: '32%', left: '50%' },
    { id: 'lungs', label: 'Poumons', top: '28%', left: '35%' },
    { id: 'liver', label: 'Foie', top: '42%', left: '60%' },
    { id: 'pancreas', label: 'Pancréas', top: '48%', left: '50%' },
    { id: 'kidneys', label: 'Reins', top: '52%', left: '40%' },
    { id: 'intestine', label: 'Intestin grêle', top: '60%', left: '50%' },
  ];

  return (
    <div className="relative w-full max-w-3xl mx-auto py-12 px-8">
      {/* Human body silhouette */}
      <div className="relative mx-auto" style={{ width: '300px', height: '600px' }}>
        <svg
          viewBox="0 0 200 400"
          className="w-full h-full opacity-5"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Head */}
          <ellipse cx="100" cy="35" rx="25" ry="30" fill="currentColor" className="text-muted-foreground" />
          {/* Neck */}
          <rect x="90" y="60" width="20" height="15" fill="currentColor" className="text-muted-foreground" />
          {/* Torso */}
          <path
            d="M 80 75 L 75 200 Q 75 210 85 210 L 115 210 Q 125 210 125 200 L 120 75 Q 120 65 110 65 L 90 65 Q 80 65 80 75"
            fill="currentColor"
            className="text-muted-foreground"
          />
          {/* Arms */}
          <rect x="50" y="85" width="30" height="12" rx="6" fill="currentColor" className="text-muted-foreground" />
          <rect x="120" y="85" width="30" height="12" rx="6" fill="currentColor" className="text-muted-foreground" />
          {/* Legs */}
          <rect x="82" y="210" width="15" height="80" rx="7" fill="currentColor" className="text-muted-foreground" />
          <rect x="103" y="210" width="15" height="80" rx="7" fill="currentColor" className="text-muted-foreground" />
        </svg>

        {/* Organs overlay */}
        {allOrgans.map((organ) => {
          const status = getOrganStatus(organ.id);
          const hasClickHandler = ['brain', 'heart', 'lungs'].includes(organ.id);
          
          return (
            <div
              key={organ.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 animate-fade-in"
              style={{ top: organ.top, left: organ.left }}
            >
              <button
                onClick={() => hasClickHandler && handleOrganClick(organ.id)}
                disabled={!hasClickHandler}
                className={`
                  group relative
                  ${hasClickHandler ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                  transition-all duration-300
                `}
              >
                {/* Organ icon */}
                <div
                  className={`
                    w-16 h-16 rounded-full p-3 shadow-lg
                    transition-all duration-300
                    ${status 
                      ? status.status === 'critical'
                        ? 'bg-red-100 dark:bg-red-950 ring-2 ring-red-500 dark:ring-red-400'
                        : 'bg-orange-100 dark:bg-orange-950 ring-2 ring-orange-500 dark:ring-orange-400'
                      : 'bg-muted/50'
                    }
                  `}
                >
                  <OrganIcon name={organ.id} status={status?.status} />
                </div>

                {/* Label */}
                <div
                  className={`
                    absolute top-full mt-2 left-1/2 transform -translate-x-1/2
                    px-3 py-1 rounded-md shadow-md whitespace-nowrap text-xs font-medium
                    transition-all duration-300
                    ${status
                      ? status.status === 'critical'
                        ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                        : 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  {organ.label}
                  {status && (
                    <span className="ml-1 text-xs">
                      ({status.count})
                    </span>
                  )}
                </div>

                {/* Hover tooltip for clickable organs */}
                {hasClickHandler && status && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-foreground text-background px-2 py-1 rounded text-xs whitespace-nowrap">
                      Cliquer pour voir les détails
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-muted"></div>
          <span className="text-muted-foreground">Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span className="text-muted-foreground">Attention</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-muted-foreground">Critique</span>
        </div>
      </div>
    </div>
  );
};