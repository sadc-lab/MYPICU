import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bell, HelpCircle, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

export const Header = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-bold text-primary">
              MYPICU
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                All patients
              </Link>
              <Link
                to="/optistats"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/optistats') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Optistats
              </Link>
              <Link
                to="/optibrain"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/optibrain') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Optibrain
              </Link>
              <Link
                to="/optiheart"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/optiheart') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Optiheart
              </Link>
              <Link
                to="/optilungs"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive('/optilungs') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Optilungs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">
                    {user?.user_metadata?.full_name || user?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card">
                <DropdownMenuItem asChild>
                  <Link to="/feedback">Feedback</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
