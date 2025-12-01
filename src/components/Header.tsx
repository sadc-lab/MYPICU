import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, User, Search, ChevronLeft, ChevronRight, Check, List, Moon, Sun, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { getAllPatients, Patient } from '@/utils/patientData';
import { useTourNavigation, VisitStatus } from '@/hooks/useTourNavigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { InteractiveGuide } from '@/components/InteractiveGuide';
import { useTheme } from 'next-themes';

export const Header = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  
  const isOnMainDashboard = location.pathname === '/';
  
  // Get patient ID from URL to determine if we're viewing a patient
  const rawPatientParam = searchParams.get('patient');
  const hashId = location.hash ? decodeURIComponent(location.hash) : '';
  const currentPatientId = rawPatientParam && rawPatientParam.trim() !== '' ? rawPatientParam : (hashId || undefined);

  // Tour navigation
  const {
    activeTour,
    confirmVisit,
    getVisitStatus,
    getCurrentPatientIndex,
    getNextPatient,
    getPreviousPatient,
    isInTour,
  } = useTourNavigation();

  const hasActiveTour = Boolean(activeTour?.length);
  const isOnTourPatient = hasActiveTour && currentPatientId ? isInTour(currentPatientId) : false;

  const currentIndex = isOnTourPatient ? getCurrentPatientIndex(currentPatientId!) : -1;
  const nextPatient = isOnTourPatient ? getNextPatient(currentPatientId!) : null;
  const previousPatient = isOnTourPatient ? getPreviousPatient(currentPatientId!) : null;

  const handleNavigateToPatient = (patientId: string) => {
    const basePath = location.pathname.startsWith('/optibrain')
      ? '/optibrain'
      : location.pathname.startsWith('/optiheart')
      ? '/optiheart'
      : location.pathname.startsWith('/optilungs')
      ? '/optilungs'
      : '/optistate';
    const timeRange = searchParams.get('timeRange');
    const params = new URLSearchParams();
    params.set('patient', patientId);
    if (timeRange) params.set('timeRange', timeRange);
    window.location.href = `${basePath}?${params.toString()}`;
  };

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
        const ped = patient.picuId.startsWith('D') ? 'a' : patient.picuId.startsWith('B') ? 'b' : 'c';
        
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
    const ped = patient.picuId.startsWith('D') ? 'A' : patient.picuId.startsWith('B') ? 'B' : 'C';
    if (!acc[ped]) acc[ped] = [];
    acc[ped].push(patient);
    return acc;
  }, {} as Record<string, Patient[]>);

  return (
    <>
      <InteractiveGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary">MYPICU</span>
            </Link>
            
            <div ref={searchRef} className="relative" data-guide="search">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Rechercher patients..."
                className="pl-10 w-[200px] bg-background"
              />
              
              {showDropdown && searchQuery && filteredPatients.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto">
                  {Object.entries(patientsByPed).sort().map(([ped, patients]) => (
                    <div key={ped}>
                      <div className="px-4 py-2 bg-muted text-sm font-semibold text-muted-foreground border-b">
                        PED {ped}
                      </div>
                      {patients.map((patient) => {
                        const timeRange = searchParams.get('timeRange');
                        const linkParams = new URLSearchParams();
                        linkParams.set('patient', patient.id);
                        if (timeRange) linkParams.set('timeRange', timeRange);
                        return (
                        <Link
                          key={patient.id}
                          to={`/optistate?${linkParams.toString()}`}
                          className="block px-4 py-3 hover:bg-accent border-b transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-foreground">{patient.name}</div>
                              <div className="text-sm text-muted-foreground">{patient.id}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              PELOD: {patient.pelodScore}
                            </div>
                          </div>
                        </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              
              {showDropdown && searchQuery && filteredPatients.length === 0 && (
                <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg z-50 p-4 text-center text-muted-foreground text-sm">
                  Aucun patient trouvé
                </div>
              )}
            </div>
          </div>

          <nav className="hidden md:flex gap-2 items-center" data-guide="patient-nav">
            {hasActiveTour && (
              <>
                <Badge variant="default" className="bg-primary text-white text-xs" data-guide="tour-info">
                  {isOnTourPatient ? `${currentIndex + 1}/${activeTour!.length}` : `${activeTour!.length} patients`}
                </Badge>
                
                <div className="flex items-center gap-1 bg-muted rounded-lg border p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => previousPatient && handleNavigateToPatient(previousPatient.id)}
                    disabled={!previousPatient}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <List className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-64 max-h-[400px] overflow-y-auto z-50">
                      {activeTour?.map((patient, index) => (
                        <DropdownMenuItem
                          key={patient.id}
                          onClick={() => handleNavigateToPatient(patient.id)}
                          className={`cursor-pointer ${
                            patient.id === currentPatientId ? 'bg-accent font-semibold' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{index + 1}.</span>
                              <span className="text-destructive font-semibold text-sm">{patient.id}</span>
                              <span className="text-sm truncate">{patient.name}</span>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => nextPatient && handleNavigateToPatient(nextPatient.id)}
                    disabled={!nextPatient}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {isOnTourPatient && currentPatientId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={getVisitStatus(currentPatientId) ? "default" : "ghost"}
                        size="sm"
                        className={`h-7 px-3 gap-1.5 ${
                          getVisitStatus(currentPatientId) === 'Priority'
                            ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800'
                            : getVisitStatus(currentPatientId)
                            ? 'bg-gray-500 hover:bg-gray-600 text-white dark:bg-gray-600 dark:hover:bg-gray-700'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        <span className="text-xs">
                          {getVisitStatus(currentPatientId) || 'Confirmer visite'}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 z-50">
                      <DropdownMenuItem
                        onClick={() => confirmVisit(currentPatientId, 'Confirmed')}
                        className="cursor-pointer"
                      >
                        Confirmer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => confirmVisit(currentPatientId, 'Priority')}
                        className="cursor-pointer"
                      >
                        Prioritaire
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => confirmVisit(currentPatientId, 'Leaving')}
                        className="cursor-pointer"
                      >
                        Sortant
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => confirmVisit(currentPatientId, 'To Check')}
                        className="cursor-pointer"
                      >
                        À vérifier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground hover:text-foreground" data-guide="user-menu">
                  <User className="h-5 w-5" />
                  <span className="hidden md:inline">
                    {user?.user_metadata?.full_name || 'Philippe Jouvet'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-50">
                <DropdownMenuLabel>Réglages</DropdownMenuLabel>
                <DropdownMenuItem 
                  className="flex items-center justify-between cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    <span>Mode sombre</span>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/feedback">Commentaires</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowGuide(true)}>
                  Aide
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowGuide(true)}
              title="Aide"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
    </>
  );
};
