import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, List, Plus, Trash2, UserRound } from 'lucide-react';
import { useStudyPatients, type StudyPatient } from '@/hooks/useStudyPatients';

interface StudyNavProps {
  patientsController?: ReturnType<typeof useStudyPatients>;
}

export const StudyNav = ({ patientsController }: StudyNavProps) => {
  const fallback = useStudyPatients();
  const ctrl = patientsController ?? fallback;
  const { patients, active, activeIndex, next, previous, setActiveId, addPatient, removePatient } = ctrl;

  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');

  const submitAdd = () => {
    addPatient(label);
    setLabel('');
    setAddOpen(false);
  };

  if (patients.length === 0) {
    return (
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-8 gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Sujet</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un sujet à l'étude</DialogTitle>
            <DialogDescription>
              Créez un pseudonyme pour identifier ce sujet. Aucune donnée nominative ne doit être saisie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="subject-label">Identifiant / pseudonyme</Label>
            <Input
              id="subject-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex : Sujet Alpha, TBI-001…"
              onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitAdd}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Badge variant="default" className="hidden sm:inline-flex bg-primary text-primary-foreground text-xs">
        {active ? `${activeIndex + 1}/${patients.length}` : `${patients.length} sujets`}
      </Badge>

      <div className="flex items-center gap-1 bg-muted rounded-lg border p-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={!previous}
          onClick={() => previous && setActiveId(previous.id)}
          aria-label="Sujet précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">
                {active ? `${active.code} · ${active.label}` : 'Sujets'}
              </span>
              <List className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 max-h-[400px] overflow-y-auto z-50">
            <DropdownMenuLabel>Sujets de l'étude</DropdownMenuLabel>
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
                  aria-label={`Retirer ${p.label}`}
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
          aria-label="Sujet suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-8 gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Sujet</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un sujet à l'étude</DialogTitle>
            <DialogDescription>
              Créez un pseudonyme pour identifier ce sujet. Aucune donnée nominative ne doit être saisie.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="subject-label">Identifiant / pseudonyme</Label>
            <Input
              id="subject-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex : Sujet Alpha, TBI-001…"
              onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitAdd}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
