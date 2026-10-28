#!/usr/bin/env node
/**
 * Base PostgreSQL locale de développement.
 *
 * Utilise `embedded-postgres` (binaires PostgreSQL officiels packagés par Zonky)
 * pour éviter d'imposer une installation système. En production, utilisez un
 * PostgreSQL managé et `DATABASE_URL`.
 *
 * Usage :
 *   node scripts/dev-db.mjs start   # démarre en arrière-plan (port 5433)
 *   node scripts/dev-db.mjs run     # démarre au premier plan
 *   node scripts/dev-db.mjs stop    # arrête le serveur
 *   node scripts/dev-db.mjs status
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".pgdata", "cluster");
const PID_FILE = path.join(ROOT, ".pgdata", "a2v-dev-db.pid");
const LOG_FILE = path.join(ROOT, ".pgdata", "postgres.log");
const PORT = Number(process.env.A2V_DB_PORT || 5433);
const USER = "postgres";
const PASSWORD = process.env.A2V_DB_PASSWORD || "a2v_local_dev";
const DATABASE = "a2v";

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  try {
    const raw = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function waitForPort(port, timeoutMs = 45_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error("Timeout PostgreSQL"));
        else setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

async function run() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log("Initialisation du cluster PostgreSQL local…");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DATABASE);
    console.log(`Base "${DATABASE}" créée.`);
  } catch {
    console.log(`Base "${DATABASE}" déjà présente.`);
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`PostgreSQL A2V prêt sur postgresql://${USER}:***@127.0.0.1:${PORT}/${DATABASE}`);

  const shutdown = async () => {
    console.log("\nArrêt de PostgreSQL…");
    try {
      await pg.stop();
    } finally {
      try {
        fs.unlinkSync(PID_FILE);
      } catch {}
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

function start() {
  const pid = readPid();
  if (pid && isPidAlive(pid)) {
    console.log(`PostgreSQL A2V déjà démarré (PID ${pid}).`);
    return;
  }
  fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  const out = fs.openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "dev-db.mjs"), "run"], {
    detached: true,
    stdio: ["ignore", out, out],
    cwd: ROOT,
    env: process.env,
    windowsHide: true,
  });
  child.unref();
  waitForPort(PORT)
    .then(() => {
      console.log(`PostgreSQL A2V démarré sur le port ${PORT} (journal : .pgdata/postgres.log).`);
    })
    .catch((error) => {
      console.error("Impossible de démarrer PostgreSQL :", error.message);
      console.error("Consultez .pgdata/postgres.log.");
      process.exitCode = 1;
    });
}

function stop() {
  const pid = readPid();
  if (!pid || !isPidAlive(pid)) {
    console.log("Aucun serveur A2V en cours.");
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "inherit" });
  } else {
    process.kill(pid, "SIGTERM");
  }
  try {
    fs.unlinkSync(PID_FILE);
  } catch {}
  setTimeout(() => console.log("PostgreSQL A2V arrêté."), 1200);
}

const command = process.argv[2] || "status";
switch (command) {
  case "run":
    run().catch((error) => {
      console.error(error);
      process.exit(1);
    });
    break;
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "status": {
    const pid = readPid();
    console.log(pid && isPidAlive(pid) ? `En cours (PID ${pid}, port ${PORT}).` : "Arrêté.");
    break;
  }
  default:
    console.error("Commande invalide. Utilisez start | run | stop | status.");
    process.exit(1);
}
