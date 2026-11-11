import { useSyncExternalStore } from "react";
import {
  getTemporaryPatientsSnapshot,
  subscribeToTemporaryPatients,
} from "@/services/temporaryPatient.service";

export function useTemporaryPatients() {
  return useSyncExternalStore(
    subscribeToTemporaryPatients,
    getTemporaryPatientsSnapshot,
    getTemporaryPatientsSnapshot,
  );
}
