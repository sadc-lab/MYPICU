#!/usr/bin/env node
// Builds the uploadable Teams app package.
//
//   TEAMS_APP_HOST=mypicu-chusip.vercel.app npm run teams:package
//   npm run teams:package -- mypicu-chusip.vercel.app
//
// Produces teams/mypicu.zip — upload it in Teams via "Applications" ->
// "Gérer vos applications" -> "Charger une application personnalisée", or in the
// admin center under "Applications Teams" -> "Gérer les applications".

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const teamsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "teams");
const buildDir = join(teamsDir, ".build");
const outputZip = join(teamsDir, "mypicu.zip");

const host = (process.env.TEAMS_APP_HOST ?? process.argv[2] ?? "").trim();

if (!host) {
  fail(
    "Aucun hôte fourni.\n" +
      "  TEAMS_APP_HOST=mypicu-chusip.vercel.app npm run teams:package\n" +
      "  npm run teams:package -- mypicu-chusip.vercel.app",
  );
}

// Teams requires a bare HTTPS host in validDomains — no scheme, path or port.
if (/^https?:\/\//i.test(host)) fail(`Retirez le schéma — passez seulement l'hôte, ex. ${stripScheme(host)}`);
if (host.includes("/")) fail("Retirez le chemin — passez seulement le nom d'hôte.");
if (host === "localhost" || host.startsWith("localhost:")) {
  fail("Teams ne peut pas charger un onglet depuis localhost. Utilisez un hôte HTTPS public (un tunnel de dev convient).");
}
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) fail(`"${host}" ne ressemble pas à un nom de domaine.`);

const manifest = readFileSync(join(teamsDir, "manifest.json"), "utf8");
if (!manifest.includes("{{APP_HOST}}")) fail("manifest.json ne contient plus de marqueur {{APP_HOST}}.");

const resolved = manifest.replaceAll("{{APP_HOST}}", host);
JSON.parse(resolved); // échouer ici plutôt que de livrer un manifeste invalide

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
writeFileSync(join(buildDir, "manifest.json"), resolved);
cpSync(join(teamsDir, "color.png"), join(buildDir, "color.png"));
cpSync(join(teamsDir, "outline.png"), join(buildDir, "outline.png"));

rmSync(outputZip, { force: true });
// -j aplatit les chemins : Teams exige manifest.json à la racine du zip.
execFileSync("zip", ["-j", "-q", outputZip, ...["manifest.json", "color.png", "outline.png"].map((f) => join(buildDir, f))]);
rmSync(buildDir, { recursive: true, force: true });

console.log(`Empaqueté pour https://${host}`);
console.log(`  -> ${outputZip}`);

function stripScheme(value) {
  return value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

function fail(message) {
  console.error(`[teams:package] ${message}`);
  process.exit(1);
}
