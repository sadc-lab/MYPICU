export interface Patient {
  id: string;
  name: string;
  age: string;
  weight: string;
  picuId: string;
  pelodScore: number;
  adherence: number;
  diagnosis: string;
  exam: string;
  priority: string;
  brainScore?: number;
  heartScore?: number;
  lungsScore?: number;
}

export const pedAPatients: Patient[] = [
  {
    id: "#1",
    name: "Smith, John (M)",
    age: "3y 2m 5d",
    weight: "14.2 kg",
    picuId: "A1",
    pelodScore: 25,
    adherence: 78,
    diagnosis: "Respiratory failure",
    exam: "X-RAY",
    priority: "High",
    brainScore: 2,
    heartScore: 1,
    lungsScore: 3
  },
  {
    id: "#2",
    name: "Johnson, Emma (F)",
    age: "5y 8m 15d",
    weight: "18.5 kg",
    picuId: "A2",
    pelodScore: 32,
    adherence: 65,
    diagnosis: "Septic shock",
    exam: "BLOOD TEST",
    priority: "Critical",
    brainScore: 3,
    heartScore: 3,
    lungsScore: 2
  },
  {
    id: "#3",
    name: "Williams, Oliver (M)",
    age: "2y 4m 22d",
    weight: "12.3 kg",
    picuId: "A3",
    pelodScore: 18,
    adherence: 85,
    diagnosis: "Pneumonia",
    exam: "CT SCAN",
    priority: "Medium",
    brainScore: 1,
    heartScore: 1,
    lungsScore: 2
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
    diagnosis: "Traumatic brain injury",
    exam: "MRI",
    priority: "High",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 1
  },
  {
    id: "#5",
    name: "Davis, Liam (M)",
    age: "6y 1m 8d",
    weight: "20.1 kg",
    picuId: "B2",
    pelodScore: 22,
    adherence: 80,
    diagnosis: "Post-operative care",
    exam: "ECHO",
    priority: "Medium",
    brainScore: 1,
    heartScore: 2,
    lungsScore: 1
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
