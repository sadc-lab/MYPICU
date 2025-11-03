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
    id: "#25",
    name: "Dave, Alex (M)",
    age: "2y 3m 12d",
    weight: "12.5 kg",
    picuId: "A5",
    pelodScore: 18,
    adherence: 89,
    diagnosis: "Pneumonia",
    exam: "",
    priority: "Medium",
    brainScore: 1,
    heartScore: 1,
    lungsScore: 2
  },
  {
    id: "#23",
    name: "Brassel, Benjamin (M)",
    age: "4y 1m 8d",
    weight: "16.2 kg",
    picuId: "A3",
    pelodScore: 12,
    adherence: 94,
    diagnosis: "Asthma exacerbation",
    exam: "",
    priority: "Low",
    brainScore: 1,
    heartScore: 1,
    lungsScore: 1
  },
  {
    id: "#24",
    name: "Gagnon, Eli (F)",
    age: "3y 6m 15d",
    weight: "14.8 kg",
    picuId: "A4",
    pelodScore: 15,
    adherence: 87,
    diagnosis: "Bronchiolitis",
    exam: "",
    priority: "Medium",
    brainScore: 1,
    heartScore: 1,
    lungsScore: 2
  },
  {
    id: "#22",
    name: "Bunneux, Charlotte (F)",
    age: "1y 8m 22d",
    weight: "9.8 kg",
    picuId: "A2",
    pelodScore: 22,
    adherence: 78,
    diagnosis: "RSV infection",
    exam: "Chest X-ray",
    priority: "High",
    brainScore: 2,
    heartScore: 2,
    lungsScore: 2
  },
  {
    id: "#21",
    name: "Edgeworth, Etienne (M)",
    age: "5y 2m 3d",
    weight: "18.7 kg",
    picuId: "A1",
    pelodScore: 8,
    adherence: 96,
    diagnosis: "Post-operative monitoring",
    exam: "",
    priority: "Low",
    brainScore: 1,
    heartScore: 1,
    lungsScore: 1
  },
  {
    id: "#17",
    name: "Holy, Lucy (F)",
    age: "2y 11m 7d",
    weight: "13.2 kg",
    picuId: "A7",
    pelodScore: 19,
    adherence: 82,
    diagnosis: "Sepsis",
    exam: "Blood culture",
    priority: "Critical",
    brainScore: 2,
    heartScore: 2,
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
