import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, User, Activity, Brain, Wind, Search } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { useState, useRef, useEffect } from 'react';
import { getAllPatients, Patient } from '@/utils/patientData';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const isActive = (path: string) => location.pathname === path;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter patients based on search
  const allPatients = getAllPatients();
  const filteredPatients = searchQuery.trim() 
    ? allPatients.filter(patient => {
        const query = searchQuery.toLowerCase();
        const ped = patient.id.startsWith('#1') ? 'a' : patient.id.startsWith('#2') ? 'b' : 'c';
        
        return (
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query) ||
          patient.pelodScore.toString().includes(query) ||
          ped === query ||
          `ped ${ped}`.includes(query)
        );
      })
    : [];

  // Group patients by PED
  const patientsByPed = filteredPatients.reduce((acc, patient) => {
    const ped = patient.id.startsWith('#1') ? 'A' : patient.id.startsWith('#2') ? 'B' : 'C';
    if (!acc[ped]) acc[ped] = [];
    acc[ped].push(patient);
    return acc;
  }, {} as Record<string, Patient[]>);

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">MYPICU</span>
            </Link>
            
            <div ref={searchRef} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Search patients..."
                className="pl-10 w-[200px] bg-white border-gray-300"
              />
              
              {showDropdown && searchQuery && filteredPatients.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
                  {Object.entries(patientsByPed).sort().map(([ped, patients]) => (
                    <div key={ped}>
                      <div className="px-4 py-2 bg-gray-100 text-sm font-semibold text-gray-700 border-b">
                        PED {ped}
                      </div>
                      {patients.map((patient) => (
                        <Link
                          key={patient.id}
                          to={`/optistats?patient=${encodeURIComponent(patient.id)}`}
                          className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{patient.name}</div>
                              <div className="text-sm text-gray-500">{patient.id}</div>
                            </div>
                            <div className="text-xs text-gray-400">
                              PELOD: {patient.pelodScore}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {showDropdown && searchQuery && filteredPatients.length === 0 && (
                <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500 text-sm">
                  No patients found
                </div>
              )}
            </div>
          </div>

          <nav className="hidden md:flex gap-2">
            <Link to="/optistats">
              <Button 
                variant={isActive('/optistats') ? 'default' : 'ghost'}
                className={`flex items-center gap-2 ${!isActive('/optistats') ? 'text-gray-400 hover:text-gray-600' : ''}`}
              >
                <Activity className="h-4 w-4" />
                Optistats
              </Button>
            </Link>
            <Link to="/optibrain">
              <Button 
                variant={isActive('/optibrain') ? 'default' : 'ghost'}
                className={`flex items-center gap-2 ${!isActive('/optibrain') ? 'text-gray-400 hover:text-gray-600' : ''}`}
              >
                <Brain className="h-4 w-4" />
                Optibrain
              </Button>
            </Link>
            <Link to="/optilungs">
              <Button 
                variant={isActive('/optilungs') ? 'default' : 'ghost'}
                className={`flex items-center gap-2 ${!isActive('/optilungs') ? 'text-gray-400 hover:text-gray-600' : ''}`}
              >
                <Wind className="h-4 w-4" />
                Optilungs
              </Button>
            </Link>
            <Link to="/optiheart">
              <Button 
                variant={isActive('/optiheart') ? 'default' : 'ghost'}
                className={`flex items-center gap-2 ${!isActive('/optiheart') ? 'text-gray-400 hover:text-gray-600' : ''}`}
              >
                <HeartIcon className="h-4 w-4" size={16} />
                Optiheart
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">
                    {user?.user_metadata?.full_name || 'Philippe Jouvet'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white z-50">
                <DropdownMenuItem asChild>
                  <Link to="/feedback">Feedback</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Help
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
