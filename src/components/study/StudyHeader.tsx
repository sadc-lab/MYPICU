import { Link } from 'react-router-dom';
import mypicuLogo from '@/assets/mypicu-logo.png';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export const StudyHeader = () => {
  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-3 sm:px-6">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
          <Link to="/autoreg" className="flex items-center gap-2">
            <img
              src={mypicuLogo}
              alt="MYPICU logo"
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-lg sm:text-2xl font-bold text-primary tracking-tight">
                MYPICU
              </span>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
                Étude · Autorégulation cérébrale
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                Retour MYPICU
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
