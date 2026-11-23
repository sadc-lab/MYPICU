import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, List, Trash2, UserRound } from 'lucide-react';
import { useStudyPatients, type StudyPatient } from '@/hooks/useStudyPatients';
import { tr } from '@/i18n';

interface StudyNavProps {
  patientsController?: ReturnType<typeof useStudyPatients>;
}

export const StudyNav = ({ patientsController }: StudyNavProps) => {
  const fallback = useStudyPatients();
  const ctrl = patientsController ?? fallback;
  const { patients, active, activeIndex, next, previous, setActiveId, removePatient } = ctrl;

  if (patients.length === 0) {
    return null;
  }

  return (
    <>
      <Badge variant="default" className="hidden sm:inline-flex bg-primary text-primary-foreground text-xs">
        {active ? `${activeIndex + 1}/${patients.length}` : tr(`${patients.length} sujets`, `${patients.length} subjects`)}
      </Badge>

      <div className="flex items-center gap-1 bg-muted rounded-lg border p-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={!previous}
          onClick={() => previous && setActiveId(previous.id)}
          aria-label={tr("Sujet précédent", "Previous subject")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">
                {active ? `${active.code} · ${active.label}` : tr('Sujets', 'Subjects')}
              </span>
              <List className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-[400px] overflow-y-auto z-50">
            <DropdownMenuLabel>{tr("Sujets de l'étude", 'Study subjects')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {patients.map((p: StudyPatient) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={(e) => {
                  e.preventDefault();
                  setActiveId(p.id);
                }}
                className={`cursor-pointer flex items-center justify-between ${
                  p.id === active?.id ? 'bg-accent font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-primary shrink-0">{p.code}</span>
                  <span className="text-sm truncate">{p.label}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePatient(p.id);
                  }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={tr(`Retirer ${p.label}`, `Remove ${p.label}`)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={!next}
          onClick={() => next && setActiveId(next.id)}
          aria-label={tr("Sujet suivant", "Next subject")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
};
