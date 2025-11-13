// Import centralized Patient type
import { Patient } from '@/types/patient.types';

// Re-export Patient type for backward compatibility
export type { Patient };

export const pedAPatients: Patient[] = [
  {
    id: "#25",
    name: "Dave, Alex (M)",
    age: "4y 4m 12d",
    weight: "15.6 kg",
    picuId: "D2",
    pelodScore: 30,
    adherence: 56,
    diagnosis: "Traumatic brain injury",
    exam: "CT SCAN",
    priority: "High",
    tour: "Priority",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 0,
    kidneyScore: 0
  },
  {
    id: "#23",
    name: "Brassel, Benjamin (M)",
    age: "10d",
    weight: "4.5 kg",
    picuId: "D3",
    pelodScore: 18,
    adherence: 70,
    diagnosis: "Respiratory distress syndrome",
    exam: "Chest X-Ray",
    priority: "Medium",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 3,
    kidneyScore: 1
  },
  {
    id: "#24",
    name: "Gagnon, Eli (F)",
    age: "3y 4m 12d",
    weight: "14.8 kg",
    picuId: "D5",
    pelodScore: 17,
    adherence: 74,
    diagnosis: "Severe pneumonia with complications",
    exam: "CT Thorax",
    priority: "Medium",
    brainScore: 2,
    heartScore: 1,
    lungsScore: 2,
    kidneyScore: 0
  },
  {
    id: "#22",
    name: "Bureaux, Charlotte (F)",
    age: "12d",
    weight: "3.5 kg",
    picuId: "D3",
    pelodScore: 17,
    adherence: 78,
    diagnosis: "Neonatal convulsions",
    exam: "CT SCAN, EEG",
    priority: "Medium",
    brainScore: 3,
    heartScore: 0,
    lungsScore: 0,
    kidneyScore: 0
  },
  {
    id: "#21",
    name: "Dagenais, Etienne (M)",
    age: "7y 2m 6d",
    weight: "24.3 kg",
    picuId: "D2",
    pelodScore: 12,
    adherence: 89,
    diagnosis: "Post-op Adeno-Amygdalectomy",
    exam: "",
    priority: "Low",
    brainScore: 0,
    heartScore: 0,
    lungsScore: 1,
    kidneyScore: 0
  },
  {
    id: "#17",
    name: "Holy, Lucy (F)",
    age: "7d",
    weight: "3.7 kg",
    picuId: "D6",
    pelodScore: 10,
    adherence: 90,
    diagnosis: "Transposition of large vessels - Post cardiac surgery",
    exam: "ECHO",
    priority: "Low",
    tour: "Leaving",
    brainScore: 0,
    heartScore: 2,
    lungsScore: 0,
    kidneyScore: 0
  },
  {
    id: "#16",
    name: "Ibrahim, Hakim (M)",
    age: "5y",
    weight: "19.2 kg",
    picuId: "D113",
    pelodScore: 9,
    adherence: 71,
    diagnosis: "Dilated cardiomyopathy",
    exam: "ECHO, ECG",
    priority: "Low",
    brainScore: 0,
    heartScore: 3,
    lungsScore: 1,
    kidneyScore: 0
  },
  {
    id: "#14",
    name: "Gomez, Pamela (F)",
    age: "4m 15d",
    weight: "7.8 kg",
    picuId: "D135",
    pelodScore: 8,
    adherence: 72,
    diagnosis: "Congenital diaphragmatic hernia",
    exam: "Thoracic scan",
    priority: "Low",
    brainScore: 0,
    heartScore: 0,
    lungsScore: 2,
    kidneyScore: 0
  },
  {
    id: "#8",
    name: "Martin, Sophie (F)",
    age: "2y 8m",
    weight: "12.4 kg",
    picuId: "D8",
    pelodScore: 15,
    adherence: 82,
    diagnosis: "Septic shock",
    exam: "Blood culture",
    priority: "Medium",
    brainScore: 1,
    heartScore: 2,
    lungsScore: 1,
    kidneyScore: 2
  }
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
    diagnosis: "Severe traumatic brain injury with intracranial hemorrhage",
    exam: "MRI, CT Scan",
    priority: "High",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 1,
    kidneyScore: 0
  },
  {
    id: "#5",
    name: "Davis, Liam (M)",
    age: "6y 1m 8d",
    weight: "20.1 kg",
    picuId: "B2",
    pelodScore: 22,
    adherence: 80,
    diagnosis: "Post-operative cardiac surgery care",
    exam: "ECHO, ECG",
    priority: "Medium",
    brainScore: 0,
    heartScore: 3,
    lungsScore: 1,
    kidneyScore: 0
  },
  {
    id: "#6",
    name: "Wilson, Emma (F)",
    age: "8m 20d",
    weight: "8.2 kg",
    picuId: "B3",
    pelodScore: 20,
    adherence: 75,
    diagnosis: "Bronchiolitis with respiratory failure",
    exam: "Chest X-Ray",
    priority: "Medium",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 3,
    kidneyScore: 0
  },
  {
    id: "#7",
    name: "Taylor, Noah (M)",
    age: "1y 3m",
    weight: "10.5 kg",
    picuId: "B4",
    pelodScore: 16,
    adherence: 85,
    diagnosis: "Meningitis",
    exam: "Lumbar puncture, CT Scan",
    priority: "Medium",
    brainScore: 2,
    heartScore: 0,
    lungsScore: 0,
    kidneyScore: 1
  },
  {
    id: "#9",
    name: "Anderson, Mia (F)",
    age: "5y 7m",
    weight: "18.3 kg",
    picuId: "B5",
    pelodScore: 12,
    adherence: 88,
    diagnosis: "Acute kidney injury",
    exam: "Renal ultrasound",
    priority: "Low",
    brainScore: 0,
    heartScore: 1,
    lungsScore: 0,
    kidneyScore: 3
  }
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
    diagnosis: "Cardiac arrest",
    exam: "ECG",
    priority: "Critical",
    brainScore: 3,
    heartScore: 3,
    lungsScore: 3
  }
];

export const getPatientsForPed = (ped: 'A' | 'B' | 'C'): Patient[] => {
  switch (ped) {
    case 'A':
      return pedAPatients;
    case 'B':
      return pedBPatients;
    case 'C':
      return pedCPatients;
    default:
      return [];
  }
};

export const getAllPatients = (): Patient[] => {
  return [...pedAPatients, ...pedBPatients, ...pedCPatients];
};

export const getPatientById = (id: string): Patient | undefined => {
  return getAllPatients().find(p => p.id === id);
};
