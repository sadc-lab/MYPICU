import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build, transformSync } from "esbuild";

const source = await readFile(
  new URL("../src/services/autoregComputation.service.ts", import.meta.url),
  "utf8",
);
const transformed = transformSync(source, { loader: "ts", format: "cjs" }).code;
const computationModule = { exports: {} };
new Function("module", "exports", transformed)(computationModule, computationModule.exports);

const {
  computeIndex,
  describeAnalysisReadiness,
  parseAny,
  runAnalysis,
} = computationModule.exports;

const fixturesDirectory = fileURLToPath(new URL("../example_patients/", import.meta.url));
const integrationBundle = await build({
  stdin: {
    contents: `
      import {
        addTemporaryPatientImport,
        getTemporaryPatientProfile,
      } from "./src/services/temporaryPatient.service";
      import { computeTemporaryAutoregulation } from "./src/services/temporaryAutoregulation.service";
      import {
        getAutoregulationWindowAt,
        getAutoregulationWindowSeries,
      } from "./src/services/autoregulationWindowSeries";
      export {
        addTemporaryPatientImport,
        computeTemporaryAutoregulation,
        getTemporaryPatientProfile,
        getAutoregulationWindowAt,
        getAutoregulationWindowSeries,
      };
    `,
    resolveDir: fileURLToPath(new URL("../", import.meta.url)),
    sourcefile: "temporary-autoregulation-test.ts",
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const integrationModule = { exports: {} };
new Function("module", "exports", integrationBundle.outputFiles[0].text)(
  integrationModule,
  integrationModule.exports,
);
const expectedModes = new Map([
  ["99001_well.json", "prx"],
  ["99002_concerning.json", "prx"],
  ["99003_critical.json", "prx"],
  ["99004_cox.json", "cox"],
  ["99005_prx.json", "prx"],
]);

test("the browser-only importer never writes patient data to Supabase", async () => {
  const [importer, temporaryService] = await Promise.all([
    readFile(new URL("../src/pages/admin/ImportPatientData.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/services/temporaryPatient.service.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(importer, /supabase|patient_vitals|patient_medications|patient_validity/);
  assert.match(temporaryService, /"Variable_rSO2"/);
  assert.match(importer, /addTemporaryPatientImport/);
});

test("temporary import state stays in memory and can be cleared", async () => {
  const source = await readFile(
    new URL("../src/services/temporaryPatient.service.ts", import.meta.url),
    "utf8",
  );
  const transformedService = transformSync(source, { loader: "ts", format: "cjs" }).code;
  const temporaryModule = { exports: {} };
  new Function("module", "exports", transformedService)(temporaryModule, temporaryModule.exports);
  const {
    addTemporaryPatientImport,
    clearTemporaryPatientImports,
    getTemporaryPatient,
    getTemporaryPatientsSnapshot,
  } = temporaryModule.exports;
  const text = await readFile(`${fixturesDirectory}/99004_cox.json`, "utf8");
  const imported = addTemporaryPatientImport("99004_cox.json", JSON.parse(text));

  assert.equal(imported.id, "demo-99004");
  assert.equal(imported.mode, "COx");
  assert.ok(imported.data.Variable_rSO2.length > 1_300);
  assert.equal(imported.data.autoreg_data.Variable_PAM_autoreg.length, 1_440);
  assert.equal(getTemporaryPatient(imported.id), imported);
  assert.equal(getTemporaryPatientsSnapshot().length, 1);
  clearTemporaryPatientImports();
  assert.equal(getTemporaryPatient(imported.id), null);
  assert.equal(getTemporaryPatientsSnapshot().length, 0);
});

test("temporary OptiBrain analysis computes PRx and COx windows locally", async () => {
  for (const [fileName, expectedMode, minimumCompleteWindows] of [
    ["99003_critical.json", "prx", 0],
    ["99004_cox.json", "cox", 100],
    ["99005_prx.json", "prx", 100],
  ]) {
    const data = JSON.parse(await readFile(`${fixturesDirectory}/${fileName}`, "utf8"));
    const imported = integrationModule.exports.addTemporaryPatientImport(fileName, data);
    const results = integrationModule.exports.computeTemporaryAutoregulation(imported.id);

    assert.equal(results.length, 1);
    assert.equal(results[0].mode, expectedMode);
    assert.ok(results[0].rawTable.length > 0);
    if (minimumCompleteWindows > 0) {
      const completeWindows = results[0].rawTable.filter((row) =>
        row.Global_Inferior_Limit !== null && row.Global_Superior_Limit !== null,
      );
      const rawTable = results[0].rawTable;
      const firstTimestamp = Date.parse(String(rawTable[0].Horodate));
      const lastTimestamp = Date.parse(String(rawTable.at(-1).Horodate));
      let currentRun = 0;
      let longestRun = 0;
      for (const row of rawTable) {
        if (row.Global_Inferior_Limit !== null && row.Global_Superior_Limit !== null) {
          longestRun = Math.max(longestRun, ++currentRun);
        } else {
          currentRun = 0;
        }
      }
      assert.ok(rawTable.length > 1_300);
      assert.ok(lastTimestamp - firstTimestamp >= 22 * 60 * 60 * 1_000);
      assert.ok(completeWindows.length >= minimumCompleteWindows);
      assert.ok(longestRun >= 45);
      assert.ok(
        completeWindows.length / rawTable.length >= 0.8,
        `${fileName} should have complete limits for at least 80% of its timeline`,
      );
      const channel = expectedMode === "prx" ? "PPC" : "PAM";
      const displayValues = data[`Variable_${channel}`].map((point) => point.valeur);
      const rawValues = data.autoreg_data[`Variable_${channel}_autoreg`]
        .map((point) => point[channel]);
      const meanAbsoluteDelta = (values) => values.slice(1).reduce(
        (sum, value, index) => sum + Math.abs(value - values[index]),
        0,
      ) / (values.length - 1);
      assert.ok(meanAbsoluteDelta(displayValues) < meanAbsoluteDelta(rawValues) * 0.8);

      const displayedPressure = data[`Variable_${channel}`];
      const displayOffset = Date.now()
        - Date.parse(displayedPressure.at(-1).charttime);
      const chartTimestamps = displayedPressure.map(
        (point) => Date.parse(point.charttime) + displayOffset,
      );
      const windowSeries = integrationModule.exports.getAutoregulationWindowSeries(results[0]);
      const coveredTimestamps = chartTimestamps.filter((timestamp) =>
        integrationModule.exports.getAutoregulationWindowAt(windowSeries, timestamp),
      );
      let currentVisibleRun = [];
      let longestVisibleRun = [];
      for (const timestamp of chartTimestamps) {
        const hasWindow = integrationModule.exports.getAutoregulationWindowAt(
          windowSeries,
          timestamp,
        ) !== null;
        if (hasWindow) {
          if (
            currentVisibleRun.length > 0
            && timestamp - currentVisibleRun.at(-1) > 3 * 60 * 1_000
          ) {
            if (currentVisibleRun.length > longestVisibleRun.length) {
              longestVisibleRun = currentVisibleRun;
            }
            currentVisibleRun = [];
          }
          currentVisibleRun.push(timestamp);
        } else {
          if (currentVisibleRun.length > longestVisibleRun.length) {
            longestVisibleRun = currentVisibleRun;
          }
          currentVisibleRun = [];
        }
      }
      if (currentVisibleRun.length > longestVisibleRun.length) {
        longestVisibleRun = currentVisibleRun;
      }
      assert.ok(
        coveredTimestamps.length / chartTimestamps.length >= 0.8,
        `${fileName} frontend dynamic windows should cover at least 80% of displayed pressure samples`,
      );
      assert.ok(
        longestVisibleRun.length > 0
          && longestVisibleRun.at(-1) - longestVisibleRun[0] >= 3 * 60 * 60 * 1_000,
        `${fileName} should display at least one continuous three-hour dynamic window`,
      );
    }
  }
});

test("PRx correlates PIC with PPC and does not require PAM", () => {
  const samples = Array.from({ length: 30 }, (_, index) => ({
    time: new Date(Date.UTC(2020, 0, 1, 0, index)),
    pic: index + 1,
    pam: 100 - index,
    ppc: (index + 1) * 2,
    nirs: null,
  }));

  assert.equal(computeIndex(samples, 30, "prx").at(-1).prx, 1);
  assert.equal(computeIndex(samples, 3, "prx").at(-1).pam, 71);
  assert.equal(
    describeAnalysisReadiness(samples.map((sample) => ({ ...sample, pam: null }))),
    null,
  );
});

test("the de-identified PRx trace imports with an extensive complete local window", async () => {
  const data = JSON.parse(
    await readFile(`${fixturesDirectory}/99006_deidentified_prx.json`, "utf8"),
  );
  const imported = integrationModule.exports.addTemporaryPatientImport(
    "99006_deidentified_prx.json",
    data,
  );
  const [result] = integrationModule.exports.computeTemporaryAutoregulation(imported.id);
  const profile = integrationModule.exports.getTemporaryPatientProfile(imported.id);
  const latestCompleteWindow = result.rawTable.findLast((row) =>
    row.Global_Inferior_Limit !== null && row.Global_Superior_Limit !== null,
  );

  assert.equal(data.example_patient.deidentified, true);
  assert.equal(data.example_patient.autoregulation_mode, "PRX");
  assert.equal(imported.synthetic, false);
  assert.equal(imported.deidentified, true);
  assert.equal(profile.age, "Non renseigné");
  assert.equal(profile.diagnosis, "Profil de démonstration dé-identifié");
  assert.equal(imported.data.Variable_PIC.length, 1253);
  assert.equal(imported.data.Variable_PPC.length, 1253);
  assert.equal(imported.data.Variable_PAM.length, 1253);
  assert.equal(result.mode, "prx");
  assert.ok(result.rawTable.filter((row) =>
    row.Global_Optimal_PPC !== null
      && row.Global_Inferior_Limit !== null
      && row.Global_Superior_Limit !== null,
  ).length >= 50);
  assert.ok(latestCompleteWindow);
});

test("the de-identified COx trace imports with a multi-day local result window", async () => {
  const data = JSON.parse(
    await readFile(`${fixturesDirectory}/99007_deidentified_cox.json`, "utf8"),
  );
  const imported = integrationModule.exports.addTemporaryPatientImport(
    "99007_deidentified_cox.json",
    data,
  );
  const [result] = integrationModule.exports.computeTemporaryAutoregulation(imported.id);
  const latestCompleteWindow = result.rawTable.findLast((row) =>
    row.Global_Inferior_Limit !== null && row.Global_Superior_Limit !== null,
  );
  const firstTime = Date.parse(imported.data.Variable_rSO2[0].charttime);
  const lastTime = Date.parse(imported.data.Variable_rSO2.at(-1).charttime);

  assert.equal(data.example_patient.deidentified, true);
  assert.equal(data.example_patient.autoregulation_mode, "COX");
  assert.equal(imported.synthetic, false);
  assert.equal(imported.data.Variable_rSO2.length, 9829);
  assert.equal(imported.data.Variable_PAM.length, 9829);
  assert.ok(lastTime - firstTime > 6 * 24 * 60 * 60 * 1000);
  assert.equal(result.mode, "cox");
  assert.ok(result.rawTable.length > 9000);
  assert.ok(latestCompleteWindow);
});

test("synthetic monitor data varies and labs are intermittent", async () => {
  for (const fileName of expectedModes.keys()) {
    const data = JSON.parse(await readFile(`${fixturesDirectory}/${fileName}`, "utf8"));
    const isCox = expectedModes.get(fileName) === "cox";
    const isExtended = fileName === "99004_cox.json" || fileName === "99005_prx.json";
    const key = isCox ? "Variable_rSO2" : "Variable_PIC";
    const values = data[key].map((point) => point.valeur);
    assert.ok(values.length > 300);
    assert.ok(new Set(values).size > (isExtended ? 12 : 50));
    assert.equal(data.Variable_hemoglobine.length, isExtended ? 24 : 6);
  }
});

test("extended synthetic autoregulation profiles deteriorate without hourly repetition", async () => {
  for (const [fileName, pressureChannel, signalChannel, signalDirection] of [
    ["99004_cox.json", "Variable_PAM_autoreg", "Variable_NIRS_autoreg", -1],
    ["99005_prx.json", "Variable_PPC_autoreg", "Variable_PIC_autoreg", 1],
  ]) {
    const data = JSON.parse(await readFile(`${fixturesDirectory}/${fileName}`, "utf8"));
    const pressure = data.autoreg_data[pressureChannel].map((point) =>
      point[pressureChannel.endsWith("PPC_autoreg") ? "PPC" : "PAM"],
    );
    const signal = data.autoreg_data[signalChannel].map((point) =>
      point[signalChannel.endsWith("PIC_autoreg") ? "PIC" : "NIRS"],
    );
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const segmentAverage = (values, start, end) => average(
      values.slice(Math.floor(values.length * start), Math.floor(values.length * end)),
    );
    const hourlySignatures = Array.from({ length: 24 }, (_, hour) =>
      pressure.slice(hour * 60, (hour + 1) * 60)
        .map((value) => Math.round(value / 5))
        .join(","),
    );

    assert.ok(
      (segmentAverage(signal, 0, 0.2) - segmentAverage(signal, 0.8, 1)) * signalDirection < 0,
      `${fileName} signal should gradually worsen over the recording`,
    );
    assert.ok(
      segmentAverage(pressure, 0.8, 1) < segmentAverage(pressure, 0, 0.2),
      `${fileName} pressure should gradually decline over the recording`,
    );
    assert.ok(hourlySignatures.every((signature, hour) =>
      hour === 0 || signature !== hourlySignatures[hour - 1],
    ), `${fileName} should not repeat the preceding hour's pressure pattern`);
  }
});

for (const [fileName, expectedMode] of expectedModes) {
  test(`${fileName} imports and produces usable ${expectedMode.toUpperCase()} samples`, async () => {
    const text = await readFile(`${fixturesDirectory}/${fileName}`, "utf8");
    const data = JSON.parse(text);
    const samples = parseAny(text);

    assert.equal(Object.keys(data)[0], "autoregulation_samples");
    assert.ok(Array.isArray(data.Variable_PAM));
    assert.ok(data.Variable_PAM.length > 0);
    assert.ok(samples.length >= 60);
    assert.equal(describeAnalysisReadiness(samples), null);

    const result = runAnalysis(samples);
    assert.equal(result.mode, expectedMode);
    assert.ok(result.usableSamples > 0);
    assert.ok(result.curve.some((point) => point.robust));

    const autoregData = data.autoreg_data;
    assert.deepEqual(Object.keys(autoregData), [
      "Variable_PIC_autoreg",
      "Variable_PPC_autoreg",
      "Variable_PAM_autoreg",
      "Variable_NIRS_autoreg",
      "Variable_licox_autoreg",
      "Variable_fc_autoreg",
      "Variable_spo2_autoreg",
    ]);
    assert.ok(autoregData.Variable_PAM_autoreg.length > 0);
    assert.equal(autoregData.Variable_NIRS_autoreg.length > 0, expectedMode === "cox");
    for (const rows of Object.values(autoregData)) {
      for (const row of rows) assert.equal(String(row.noadmsip), fileName.match(/^\d+/)[0]);
    }

    if (fileName === "99001_well.json") {
      assert.ok(Math.max(...data.Variable_PIC.map((row) => row.valeur)) < 20);
      assert.ok(Math.min(...data.Variable_PPC.map((row) => row.valeur)) > 50);
    }
    if (fileName === "99002_concerning.json") {
      assert.ok(Math.max(...data.Variable_PIC.map((row) => row.valeur)) > 20);
      assert.ok(Math.min(...data.Variable_PPC.map((row) => row.valeur)) < 60);
    }
    if (fileName === "99003_critical.json") {
      assert.ok(Math.max(...data.Variable_PIC.map((row) => row.valeur)) > 30);
      assert.ok(Math.min(...data.Variable_PPC.map((row) => row.valeur)) < 50);
      assert.ok(Math.max(...data.Variable_SPO2.map((row) => row.valeur)) < 90);
    }
  });
}
