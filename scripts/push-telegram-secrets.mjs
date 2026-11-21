import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = join(projectRoot, ".telegram-secrets");
const secretNames = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

function readSecrets() {
  const providedSecretNames = secretNames.filter((name) =>
    Object.hasOwn(process.env, name),
  );
  if (providedSecretNames.length > 0) {
    const secrets = new Map();
    for (const name of secretNames) {
      const value = process.env[name]?.trim();
      if (!value) {
        throw new Error(`${name} is missing or empty in the environment.`);
      }
      secrets.set(name, value);
    }
    return secrets;
  }

  const contents = readFileSync(inputPath, "utf8");
  const secrets = new Map();

  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new Error(`Invalid entry on line ${index + 1}; expected KEY=value.`);
    }

    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!secretNames.includes(name)) {
      throw new Error(`Unexpected secret name on line ${index + 1}: ${name}.`);
    }
    if (!value) {
      throw new Error(`${name} is empty in .telegram-secrets.`);
    }
    if (secrets.has(name)) {
      throw new Error(`${name} appears more than once in .telegram-secrets.`);
    }
    secrets.set(name, value);
  }

  for (const name of secretNames) {
    if (!secrets.has(name)) {
      throw new Error(`Add ${name} to .telegram-secrets.`);
    }
  }
  return secrets;
}

function runFirebase(args) {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const projectArgs = projectId ? ["--project", projectId] : [];
  const result = spawnSync("firebase", [...args, ...projectArgs], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error?.code === "ENOENT") {
    throw new Error("Firebase CLI not found. Install firebase-tools and try again.");
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Firebase CLI failed (${args.join(" ")}).`);
  }
}

function uploadSecrets(secrets) {
  const tempDir = mkdtempSync(join(tmpdir(), "zosmy-telegram-secrets-"));
  try {
    chmodSync(tempDir, 0o700);
    for (const name of secretNames) {
      const dataPath = join(tempDir, name);
      writeFileSync(dataPath, `${secrets.get(name)}\n`, { mode: 0o600 });
      runFirebase(["functions:secrets:set", name, "--data-file", dataPath]);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  const secrets = readSecrets();
  uploadSecrets(secrets);
  runFirebase(["deploy", "--only", "functions"]);
  console.log("Telegram secrets uploaded and Cloud Functions deployed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
