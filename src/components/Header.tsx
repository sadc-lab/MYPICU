import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, HelpCircle, User, Activity, Brain, Heart, Wind, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Header = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  const isActive = (path: string) => location.pathname === path;

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = formData.get('search') as string;
    // Search functionality will be handled by the Dashboard component via URL params
    if (searchQuery.trim()) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('search', searchQuery.trim());
      window.location.href = currentUrl.toString();
    }
  };

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">MYPICU</span>
            </Link>
            
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                type="text"
                name="search"
                placeholder="Search patient by name or ID..."
                className="pl-10 w-[300px] bg-white border-gray-300"
              />
            </form>
          </div>

          <nav className="hidden md:flex gap-2">
            <Link to="/optistats">
              <Button 
                variant={isActive('/optistats') ? 'default' : 'ghost'}
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Optistats
              </Button>
            </Link>
            <Link to="/optibrain">
              <Button 
                variant={isActive('/optibrain') ? 'default' : 'ghost'}
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                Optibrain
              </Button>
            </Link>
            <Link to="/optilungs">
              <Button 
                variant={isActive('/optilungs') ? 'default' : 'ghost'}
                className="flex items-center gap-2"
              >
                <Wind className="h-4 w-4" />
                Optilungs
              </Button>
            </Link>
            <Link to="/optiheart">
              <Button 
                variant={isActive('/optiheart') ? 'default' : 'ghost'}
                className="flex items-center gap-2"
              >
                <Heart className="h-4 w-4" />
                Optiheart
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full border-2 border-dashed border-primary">
              <HelpCircle className="h-5 w-5 text-primary" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">
                    {user?.user_metadata?.full_name || 'Philippe Jouvet'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                <DropdownMenuItem asChild>
                  <Link to="/feedback">Feedback</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
