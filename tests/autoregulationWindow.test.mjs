import assert from "node:assert/strict";
import test from "node:test";
import {
  getWindowPosition,
  hasAutoregulationInputs,
  hasAutoregulationWindow,
  pickAutoregulationWindow,
} from "../src/services/autoregulationWindow.ts";

test("PRx requires PIC and PPC; COx requires NIRS and PAM", () => {
  assert.equal(hasAutoregulationInputs("prx", ["Variable_PIC", "Variable_PPC"]), true);
  assert.equal(hasAutoregulationInputs("prx", ["Variable_PIC"]), false);
  assert.equal(hasAutoregulationInputs("cox", ["Variable_rSO2", "Variable_PAM"]), true);
  assert.equal(hasAutoregulationInputs("cox", ["Variable_rSO2"]), false);
});

test("only complete finite windows are usable", () => {
  assert.equal(hasAutoregulationWindow({
    mode: "prx", optimalPressure: 65, inferiorLimit: 55, superiorLimit: 75,
  }), true);
  assert.equal(hasAutoregulationWindow({
    mode: "cox", optimalPressure: 65, inferiorLimit: null, superiorLimit: 75,
  }), false);
  assert.equal(hasAutoregulationWindow({
    mode: "prx", optimalPressure: 65, inferiorLimit: 80, superiorLimit: 70,
  }), false);
});

test("selects only a result whose required signals are present", () => {
  const prx = { mode: "prx", optimalPressure: 65, inferiorLimit: 55, superiorLimit: 75 };
  const cox = { mode: "cox", optimalPressure: 70, inferiorLimit: 60, superiorLimit: 80 };

  assert.equal(pickAutoregulationWindow([prx, cox], ["Variable_PIC", "Variable_PPC"]), prx);
  assert.equal(pickAutoregulationWindow([prx, cox], ["Variable_rSO2", "Variable_PAM"]), cox);
  assert.equal(pickAutoregulationWindow([
    cox,
    prx,
  ], ["Variable_PIC", "Variable_PPC", "Variable_rSO2", "Variable_PAM"]), prx);
  assert.equal(pickAutoregulationWindow([prx, cox], ["Variable_PIC"]), null);
});

test("pressure is classified against inclusive lower and upper limits", () => {
  const window = { mode: "prx", optimalPressure: 65, inferiorLimit: 55, superiorLimit: 75 };
  assert.equal(getWindowPosition(55, window), "inside");
  assert.equal(getWindowPosition(75, window), "inside");
  assert.equal(getWindowPosition(54.9, window), "below");
  assert.equal(getWindowPosition(75.1, window), "above");
  assert.equal(getWindowPosition(null, window), "unavailable");
  assert.equal(getWindowPosition(65, null), "unavailable");
});
