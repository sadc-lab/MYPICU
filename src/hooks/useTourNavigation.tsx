import { useState, useEffect } from 'react';
import { Patient } from '@/utils/patientData';

const TOUR_STORAGE_KEY = 'mypicu-active-tour';

export const useTourNavigation = () => {
  const [activeTour, setActiveTour] = useState<Patient[] | null>(() => {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const startTour = (patients: Patient[]) => {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(patients));
    setActiveTour(patients);
  };

  const endTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setActiveTour(null);
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
    endTour,
    getCurrentPatientIndex,
    getNextPatient,
    getPreviousPatient,
    isInTour: (patientId: string) => activeTour?.some(p => p.id === patientId) ?? false,
  };
};
