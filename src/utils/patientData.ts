// Import centralized Patient type
import { Patient } from "@/types/patient.types";

// Re-export Patient type for backward compatibility
export type { Patient };

export const pedAPatients: Patient[] = [
  {
    id: "#12",
    name: "John Doe (M)",
    age: "11y 3m 20d",
    weight: "55.5 kg",
    picuId: "D1",
    pelodScore: 28,
    adherence: 65,
    diagnosis: "Traumatisme crânien avec hypertension intracrânienne",
    exam: "CT SCAN, EEG",
    priority: "Élevée",
    tour: "Prioritaire",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 1,
    kidneyScore: 0,
  },
  {
    id: "#13",
    name: "Lucy Hale (F)",
    age: "16y 11m 18d",
    weight: "38.3 kg",
    picuId: "D4",
    pelodScore: 24,
    adherence: 72,
    diagnosis: "Traumatisme crânien",
    exam: "EEG continu, IRM",
    priority: "Élevée",
    tour: "Prioritaire",
    brainScore: 3,
    heartScore: 1,
    lungsScore: 2,
    kidneyScore: 1,
  },
  {
    id: "#25",
    name: "Dave, Alex (M)",
    age: "4y 4m 12d",
    weight: "15.6 kg",
    picuId: "D2",
    pelodScore: 30,
    adherence: 56,
    diagnosis: "Traumatisme crânien",
    exam: "CT SCAN",
    priority: "Élevée",
    tour: "Prioritaire",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 0,
    kidneyScore: 0,
  },
  {
    id: "#23",
    name: "Brassel, Benjamin (M)",
    age: "10d",
    weight: "4.5 kg",
    picuId: "D3",
    pelodScore: 18,
    adherence: 70,
    diagnosis: "Syndrome de détresse respiratoire",
    exam: "Radio thoracique",
    priority: "Moyenne",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 3,
    kidneyScore: 1,
  },
  {
    id: "#24",
    name: "Gagnon, Eli (F)",
    age: "3y 4m 12d",
    weight: "14.8 kg",
    picuId: "D5",
    pelodScore: 17,
    adherence: 74,
    diagnosis: "Pneumonie sévère avec complications",
    exam: "CT Thorax",
    priority: "Moyenne",
    brainScore: 2,
    heartScore: 1,
    lungsScore: 2,
    kidneyScore: 0,
  },
];

export const pedBPatients: Patient[] = [
  {
    id: "#4",
    name: "Brown, Sophia (F)",
    age: "4y 6m 12d",
    weight: "15.5 kg",
    picuId: "B1",
    pelodScore: 28,
    adherence: 72,
    diagnosis: "Traumatisme crânien sévère avec hémorragie intracrânienne",
    exam: "IRM, CT Scan",
    priority: "Élevée",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 1,
    kidneyScore: 0,
  },
  {
    id: "#5",
    name: "Davis, Liam (M)",
    age: "6y 1m 8d",
    weight: "20.1 kg",
    picuId: "B2",
    pelodScore: 22,
    adherence: 80,
    diagnosis: "Soins post-chirurgie cardiaque",
    exam: "ECHO, ECG",
    priority: "Moyenne",
    brainScore: 0,
    heartScore: 3,
    lungsScore: 1,
    kidneyScore: 0,
  },
  {
    id: "#6",
    name: "Wilson, Emma (F)",
    age: "8m 20d",
    weight: "8.2 kg",
    picuId: "B3",
    pelodScore: 20,
    adherence: 75,
    diagnosis: "Bronchiolite avec insuffisance respiratoire",
    exam: "Radio thoracique",
    priority: "Moyenne",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 3,
    kidneyScore: 0,
  },
  {
    id: "#7",
    name: "Taylor, Noah (M)",
    age: "1y 3m",
    weight: "10.5 kg",
    picuId: "B4",
    pelodScore: 16,
    adherence: 85,
    diagnosis: "Méningite",
    exam: "Ponction lombaire, CT Scan",
    priority: "Moyenne",
    brainScore: 2,
    heartScore: 0,
    lungsScore: 0,
    kidneyScore: 1,
  },
  {
    id: "#9",
    name: "Anderson, Mia (F)",
    age: "5y 7m",
    weight: "18.3 kg",
    picuId: "B5",
    pelodScore: 12,
    adherence: 88,
    diagnosis: "Insuffisance rénale aiguë",
    exam: "Échographie rénale",
    priority: "Faible",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 0,
    kidneyScore: 3,
  },
];

export const pedCPatients: Patient[] = [
  {
    id: "#6",
    name: "Miller, Ava (F)",
    age: "1y 9m 3d",
    weight: "10.8 kg",
    picuId: "C1",
    pelodScore: 35,
    adherence: 58,
    diagnosis: "Arrêt cardiaque",
    exam: "ECG",
    priority: "Critique",
    brainScore: 3,
    heartScore: 3,
    lungsScore: 3,
  },
];

export const getPatientsForPed = (ped: "A" | "B" | "C"): Patient[] => {
  switch (ped) {
    case "A":
      return pedAPatients;
    case "B":
      return pedBPatients;
    case "C":
      return pedCPatients;
    default:
      return [];
  }
};

export const getAllPatients = (): Patient[] => {
  return [...pedAPatients, ...pedBPatients, ...pedCPatients];
};

export const getPatientById = (id: string): Patient | undefined => {
  return getAllPatients().find((p) => p.id === id);
};
