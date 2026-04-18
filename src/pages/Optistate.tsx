import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { PatientHeader } from '@/components/PatientHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePatient } from '@/hooks/usePatients';
import { ChevronRight, AlertTriangle, Sparkles } from 'lucide-react';
import { HeartIcon } from '@/components/icons/HeartIcon';
import { MetricRangeBar } from '@/components/MetricRangeBar';
import { CopilotPromptGenerator } from '@/components/CopilotPromptGenerator';
import brainIcon from '@/assets/brain-icon.svg';
import lungsIcon from '@/assets/lungs-icon.svg';
import kidneyIcon from '@/assets/kidney-icon.svg';
import intestineIcon from '@/assets/intestine-icon.svg';
import { cn } from '@/lib/utils';

type ModuleKey = 'optibrain' | 'optiheart' | 'optilungs' | 'optirenal' | 'optigastro';

const Optistate = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patient') || '#25';
  const { data: patient, isLoading } = usePatient(patientId);

  if (!patient || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-8">
          <p>{isLoading ? 'Chargement...' : 'Patient non trouvé'}</p>
        </div>
      </div>
    );
  }

  const vitalSigns = [
    { label: 'FC', value: 130, min: 60, targetMin: 80, targetMax: 120, max: 140, unit: 'bpm' },
    { label: 'TAM', value: 70, min: 60, targetMin: 78, targetMax: 85, max: 100, unit: 'mmHg' },
    { label: 'FR', value: 25, min: 15, targetMin: 20, targetMax: 30, max: 35, unit: '/min' },
    { label: 'T°', value: 37, min: 34, targetMin: 35, targetMax: 37, max: 39, unit: '°C' },
    { label: 'SPO2', value: 95, min: 80, targetMin: 90, targetMax: 100, max: 100, unit: '%' },
  ];

  const isInRange = (value: number, targetMin: number, targetMax: number) =>
    value >= targetMin && value <= targetMax;

  // Modules overview — colour coded and sorted by severity
  const modules: Array<{
    key: ModuleKey;
    organValue: string; // value used by CopilotPromptGenerator pastilles
    label: string;
    score: number;
    icon: JSX.Element;
  }> = [
    {
      key: 'optibrain',
      organValue: 'cerveau',
      label: 'OptiBrain',
      score: patient.brainScore || 0,
      icon: <img src={brainIcon} alt="" className="h-7 w-7" />,
    },
    {
      key: 'optiheart',
      organValue: 'coeur',
      label: 'OptiHeart',
      score: patient.heartScore || 0,
      icon: <HeartIcon className="h-7 w-7" />,
    },
    {
      key: 'optilungs',
      organValue: 'poumons',
      label: 'OptiLungs',
      score: patient.lungsScore || 0,
      icon: <img src={lungsIcon} alt="" className="h-7 w-7" />,
    },
    {
      key: 'optirenal',
      organValue: 'renal',
      label: 'OptiRenal',
      score: patient.kidneyScore || 0,
      icon: <img src={kidneyIcon} alt="" className="h-7 w-7" />,
    },
    {
      key: 'optigastro',
      organValue: 'gastro',
      label: 'OptiGastro',
      score: 0,
      icon: <img src={intestineIcon} alt="" className="h-7 w-7" />,
    },
  ];

  const getStatusStyle = (score: number) => {
    if (score >= 3) {
      return {
        label: 'Critique',
        cardCls: 'border-status-critical/40 bg-status-critical/5',
        dotCls: 'bg-status-critical',
        badgeCls: 'bg-status-critical/15 text-status-critical border-status-critical/30',
        iconWrap: 'bg-status-critical/10',
        iconColor: 'text-status-critical',
        iconFilter:
          'invert(28%) sepia(89%) saturate(2641%) hue-rotate(343deg) brightness(95%) contrast(94%)',
      };
    }
    if (score === 2) {
      return {
        label: 'Surveillance',
        cardCls: 'border-status-warning/40 bg-status-warning/5',
        dotCls: 'bg-status-warning',
        badgeCls: 'bg-status-warning/15 text-status-warning border-status-warning/30',
        iconWrap: 'bg-status-warning/10',
        iconColor: 'text-status-warning',
        iconFilter:
          'invert(52%) sepia(94%) saturate(635%) hue-rotate(339deg) brightness(101%) contrast(101%)',
      };
    }
    if (score === 1) {
      return {
        label: 'À surveiller',
        cardCls: 'border-orange-300/40 bg-orange-50/40 dark:bg-orange-950/20',
        dotCls: 'bg-orange-400',
        badgeCls: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
        iconWrap: 'bg-orange-100/60 dark:bg-orange-950/40',
        iconColor: 'text-orange-500',
        iconFilter:
          'invert(59%) sepia(77%) saturate(457%) hue-rotate(346deg) brightness(101%) contrast(101%)',
      };
    }
    return {
      label: 'Normal',
      cardCls: 'border-border bg-card',
      dotCls: 'bg-muted-foreground/40',
      badgeCls: 'bg-muted text-muted-foreground border-border',
      iconWrap: 'bg-muted',
      iconColor: 'text-muted-foreground',
      iconFilter:
        'invert(64%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(92%) contrast(88%)',
    };
  };

  const sortedModules = [...modules].sort((a, b) => b.score - a.score);
  const failingModules = sortedModules.filter((m) => m.score >= 1);
  const failingCount = failingModules.length;

  // Pre-fill Copilot export with failing organs (or all if none failing)
  const defaultOrgans =
    failingModules.length > 0
      ? failingModules.map((m) => m.organValue)
      : ['general'];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PatientHeader currentPage="optistate" />

      <main className="container mx-auto px-6 pb-8 max-w-[1600px] space-y-6">
        {/* SECTION 1: Vital signs */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Signes Vitaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              {vitalSigns.map((vital, index) => {
                const inRange = isInRange(vital.value, vital.targetMin, vital.targetMax);
                const valueColor = inRange ? 'text-foreground' : 'text-status-critical';
                return (
                  <div key={index} className="flex flex-col items-center">
                    <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      {vital.label}
                    </div>
                    <div className={`text-4xl font-bold ${valueColor} mb-1`}>
                      {vital.value}
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-3">{vital.unit}</div>
                    <MetricRangeBar
                      value={vital.value}
                      min={vital.min}
                      max={vital.max}
                      targetMin={vital.targetMin}
                      targetMax={vital.targetMax}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Modules overview */}
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Vue d'ensemble des modules</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  'gap-1.5',
                  failingCount > 0
                    ? 'bg-status-critical/10 text-status-critical border-status-critical/30'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {failingCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                {failingCount} module{failingCount > 1 ? 's' : ''} défaillant{failingCount > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {sortedModules.map((m) => {
                const style = getStatusStyle(m.score);
                const failing = m.score >= 1;
                const isHeart = m.key === 'optiheart';
                return (
                  <button
                    key={m.key}
                    onClick={() => navigate(`/${m.key}?patient=${encodeURIComponent(patientId)}`)}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md hover:-translate-y-0.5',
                      style.cardCls
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-2 right-2 h-2.5 w-2.5 rounded-full',
                        style.dotCls
                      )}
                    />
                    <div
                      className={cn(
                        'flex items-center justify-center h-12 w-12 rounded-full',
                        style.iconWrap
                      )}
                    >
                      {isHeart ? (
                        <HeartIcon className={cn('h-7 w-7', style.iconColor)} />
                      ) : (
                        <img
                          src={(m.icon as any).props.src}
                          alt=""
                          className="h-7 w-7"
                          style={{ filter: style.iconFilter }}
                        />
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground">{m.label}</div>
                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0', style.badgeCls)}>
                      {style.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir détail
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                );
              })}
            </div>

            {failingCount === 0 && (
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Aucun module défaillant détecté pour ce patient.
              </p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 3: Copilot export pre-filled */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-primary/5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-semibold">Export Copilot adapté</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modules défaillants pré-sélectionnés. Ajustez et générez votre PDF.
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <CopilotPromptGenerator
              patientId={patientId}
              inline
              hideHeader
              heightClassName="h-[680px]"
              defaultOrgans={defaultOrgans}
              className="border-0 rounded-none shadow-none"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Optistate;
