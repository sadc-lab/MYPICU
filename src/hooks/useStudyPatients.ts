import { useCallback, useEffect, useState } from 'react';

export interface StudyPatient {
  id: string;
  code: string; // e.g. "P01"
  label: string; // display name/pseudonym
  createdAt: number;
  fileName?: string;
  notes?: string;
  // Id of the unit patient this subject was created from, when it was picked
  // from the patient list rather than created by hand.
  sourcePatientId?: string;
}

const STORAGE_KEY = 'autoreg.studyPatients.v1';
const ACTIVE_KEY = 'autoreg.studyPatients.active.v1';

function read(): StudyPatient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: StudyPatient[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function useStudyPatients() {
  const [patients, setPatients] = useState<StudyPatient[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    const list = read();
    setPatients(list);
    const active = localStorage.getItem(ACTIVE_KEY);
    setActiveIdState(active && list.some((p) => p.id === active) ? active : list[0]?.id ?? null);
  }, []);

  const persist = useCallback((list: StudyPatient[]) => {
    write(list);
    setPatients(list);
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }, []);

  const addPatient = useCallback(
    (label: string) => {
      const list = read();
      const nextIndex = list.length + 1;
      const code = `P${String(nextIndex).padStart(2, '0')}`;
      const patient: StudyPatient = {
        id: crypto.randomUUID(),
        code,
        label: label.trim() || `Sujet ${code}`,
        createdAt: Date.now(),
      };
      const updated = [...list, patient];
      persist(updated);
      setActiveId(patient.id);
      return patient;
    },
    [persist, setActiveId],
  );

  const updatePatient = useCallback(
    (id: string, patch: Partial<StudyPatient>) => {
      const list = read().map((p) => (p.id === id ? { ...p, ...patch } : p));
      persist(list);
    },
    [persist],
  );

  const removePatient = useCallback(
    (id: string) => {
      const list = read().filter((p) => p.id !== id);
      persist(list);
      if (activeId === id) setActiveId(list[0]?.id ?? null);
    },
    [persist, activeId, setActiveId],
  );

  const active = patients.find((p) => p.id === activeId) || null;
  const activeIndex = active ? patients.findIndex((p) => p.id === active.id) : -1;
  const next = activeIndex >= 0 && activeIndex < patients.length - 1 ? patients[activeIndex + 1] : null;
  const previous = activeIndex > 0 ? patients[activeIndex - 1] : null;

  return {
    patients,
    active,
    activeIndex,
    next,
    previous,
    setActiveId,
    addPatient,
    updatePatient,
    removePatient,
  };
}
