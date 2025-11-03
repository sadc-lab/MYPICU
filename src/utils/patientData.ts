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
  tour?: string;
  brainScore?: number;
  heartScore?: number;
  lungsScore?: number;
  kidneyScore?: number;
}

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
    diagnosis: "Respiratory distress",
    exam: "",
    priority: "Medium",
    brainScore: 3,
    heartScore: 2,
    lungsScore: 1,
    kidneyScore: 3
  },
  {
    id: "#24",
    name: "Gagnon, Eli (F)",
    age: "3y 4m 12d",
    weight: "14.8 kg",
    picuId: "D5",
    pelodScore: 17,
    adherence: 74,
    diagnosis: "Pneumonia",
    exam: "",
    priority: "Medium",
    brainScore: 0,
    heartScore: 0,
    lungsScore: 0,
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
    diagnosis: "Convulsions",
    exam: "CT SCAN",
    priority: "Medium",
    brainScore: 0,
    heartScore: 2,
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
    diagnosis: "Post-op Adeno-Ampdialectomy",
    exam: "",
    priority: "Low",
    brainScore: 0,
    heartScore: 2,
    lungsScore: 0,
    kidneyScore: 2
  },
  {
    id: "#17",
    name: "Holy, Lucy (F)",
    age: "7d",
    weight: "3.7 kg",
    picuId: "D6",
    pelodScore: 10,
    adherence: 90,
    diagnosis: "Transposition of large vessels",
    exam: "",
    priority: "Low",
    tour: "Leaving",
    brainScore: 0,
    heartScore: 0,
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
    exam: "",
    priority: "Low",
    brainScore: 0,
    heartScore: 0,
    lungsScore: 0,
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
    diagnosis: "Diaphragmatic hernia",
    exam: "Thoracic scan",
    priority: "Low",
    brainScore: 0,
    heartScore: 0,
    lungsScore: 0,
    kidneyScore: 0
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
