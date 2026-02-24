import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, User, Search, ChevronLeft, ChevronRight, Check, List, Moon, Sun, HelpCircle, Menu, X, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { getAllPatients, getPatientsForPed, Patient } from '@/utils/patientData';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface HeaderProps {
  selectedPed?: 'A' | 'B' | 'C';
}

export const Header = ({ selectedPed = 'A' }: HeaderProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  
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

  // Always align nav list with selected PED (even with active tour)
  const pedPatients = getPatientsForPed(selectedPed);
  const filteredTourPatients = (activeTour || []).filter((patient) => {
    const patientPed = patient.picuId.startsWith('D') ? 'A' : patient.picuId.startsWith('B') ? 'B' : 'C';
    return patientPed === selectedPed;
  });
  const displayedPatients = filteredTourPatients.length > 0 ? filteredTourPatients : pedPatients;
  const hasPatients = Boolean(displayedPatients?.length);
  
  const isOnDisplayedPatient = hasPatients && currentPatientId 
    ? displayedPatients.some(p => p.id === currentPatientId) 
    : false;

  const currentIndex = isOnDisplayedPatient 
    ? displayedPatients.findIndex(p => p.id === currentPatientId) 
    : -1;
  const nextPatient = isOnDisplayedPatient && currentIndex < displayedPatients.length - 1 
    ? displayedPatients[currentIndex + 1] 
    : null;
  const previousPatient = isOnDisplayedPatient && currentIndex > 0 
    ? displayedPatients[currentIndex - 1] 
    : null;

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

  // Mobile search filtered patients
  const mobileFilteredPatients = mobileSearchQuery.trim() 
    ? allPatients.filter(patient => {
        const query = mobileSearchQuery.toLowerCase();
        const ped = patient.picuId.startsWith('D') ? 'a' : patient.picuId.startsWith('B') ? 'b' : 'c';
        return (
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query) ||
          patient.pelodScore.toString().includes(query) ||
          ped === query ||
          `ped ${ped}`.includes(query)
        );
      })
    : allPatients;

  // Group mobile patients by PED
  const mobilePatientsByPed = mobileFilteredPatients.reduce((acc, patient) => {
    const ped = patient.picuId.startsWith('D') ? 'A' : patient.picuId.startsWith('B') ? 'B' : 'C';
    if (!acc[ped]) acc[ped] = [];
    acc[ped].push(patient);
    return acc;
  }, {} as Record<string, Patient[]>);

  return (
    <>
      <InteractiveGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-3 sm:px-6">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-8">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-left">Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  {/* Mobile Search */}
                  <div className="p-4 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        type="text"
                        value={mobileSearchQuery}
                        onChange={(e) => setMobileSearchQuery(e.target.value)}
                        placeholder="Rechercher patients..."
                        className="pl-10 w-full"
                      />
                    </div>
                  </div>
                  
                  {/* Navigation Links */}
                  <div className="p-4 border-b">
                    <Link 
                      to="/" 
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="h-5 w-5" />
                      <span className="font-medium">Tableau de bord</span>
                    </Link>
                  </div>
                  
                  {/* Patients List */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                        Patients ({mobileFilteredPatients.length})
                      </h3>
                      {Object.entries(mobilePatientsByPed).sort().map(([ped, patients]) => (
                        <div key={ped} className="mb-4">
                          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                            PED {ped}
                          </div>
                          <div className="space-y-1">
                            {patients.map((patient) => {
                              const isActive = patient.id === currentPatientId;
                              const timeRange = searchParams.get('timeRange');
                              const linkParams = new URLSearchParams();
                              linkParams.set('patient', patient.id);
                              if (timeRange) linkParams.set('timeRange', timeRange);
                              return (
                                <Link
                                  key={patient.id}
                                  to={`/optistate?${linkParams.toString()}`}
                                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                    isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent'
                                  }`}
                                  onClick={() => {
                                    setMobileMenuOpen(false);
                                    setMobileSearchQuery('');
                                  }}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-destructive'}`}>
                                      {patient.id}
                                    </span>
                                    <span className="text-sm truncate">{patient.name}</span>
                                  </div>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {patient.pelodScore}
                                  </Badge>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <Link to="/" className="flex items-center">
              <span className="text-lg sm:text-2xl font-bold text-primary">MYPICU</span>
            </Link>
            
            <div ref={searchRef} className="relative hidden sm:block" data-guide="search">
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
            {hasPatients && (
              <>
                <Badge variant="default" className="bg-primary text-white text-xs" data-guide="tour-info">
                  {isOnDisplayedPatient ? `${currentIndex + 1}/${displayedPatients.length}` : `${displayedPatients.length} patients`}
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
                      {displayedPatients?.map((patient, index) => (
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

                {isOnDisplayedPatient && currentPatientId && (
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
