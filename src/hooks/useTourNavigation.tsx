import { useState, useEffect } from 'react';
import { Patient } from '@/utils/patientData';

const TOUR_STORAGE_KEY = 'mypicu-active-tour';
const VISIT_CONFIRMATIONS_KEY = 'mypicu-visit-confirmations';

export type VisitStatus = 'Priority' | 'Leaving' | 'To Check';

export const useTourNavigation = () => {
  const [activeTour, setActiveTour] = useState<Patient[] | null>(() => {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const [visitConfirmations, setVisitConfirmations] = useState<Record<string, VisitStatus>>(() => {
    const stored = localStorage.getItem(VISIT_CONFIRMATIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  });

  const startTour = (patients: Patient[]) => {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(patients));
    setActiveTour(patients);
    // Clear previous visit confirmations when starting a new tour
    localStorage.removeItem(VISIT_CONFIRMATIONS_KEY);
    setVisitConfirmations({});
  };

  const confirmVisit = (patientId: string, status: VisitStatus) => {
    const updatedConfirmations = {
      ...visitConfirmations,
      [patientId]: status,
    };
    localStorage.setItem(VISIT_CONFIRMATIONS_KEY, JSON.stringify(updatedConfirmations));
    setVisitConfirmations(updatedConfirmations);
  };

  const getVisitStatus = (patientId: string): VisitStatus | null => {
    return visitConfirmations[patientId] || null;
  };

  const getCurrentPatientIndex = (patientId: string) => {
    if (!activeTour) return -1;
    return activeTour.findIndex(p => p.id === patientId);
  };

  const getNextPatient = (currentPatientId: string) => {
    if (!activeTour) return null;
    const currentIndex = getCurrentPatientIndex(currentPatientId);
    if (currentIndex === -1 || currentIndex === activeTour.length - 1) return null;
    return activeTour[currentIndex + 1];
  };

  const getPreviousPatient = (currentPatientId: string) => {
    if (!activeTour) return null;
    const currentIndex = getCurrentPatientIndex(currentPatientId);
    if (currentIndex <= 0) return null;
    return activeTour[currentIndex - 1];
  };

  return {
    activeTour,
    startTour,
    confirmVisit,
    getVisitStatus,
    visitConfirmations,
    getCurrentPatientIndex,
    getNextPatient,
    getPreviousPatient,
    isInTour: (patientId: string) => activeTour?.some(p => p.id === patientId) ?? false,
  };
};
