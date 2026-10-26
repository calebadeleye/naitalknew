#!/usr/bin/env node
// Naitalk Call key sync. Run as root on mail.naitalk.com (naitalk-call-sync.timer).
//
// Pulls the active businesses' keys and webhook routes from the Naitalk API,
// then:
//   1. writes /etc/naitalk-call/routes.json for the webhook router;
//   2. rewrites only the "managed keys" block under keys: in livekit.yaml and
//      points webhook.urls at the router (every other line is left as it is,
//      so Cradle's key never changes);
//   3. restarts naitalk-call to load the change, but only while nobody is in a
//      call, because a restart drops live calls. Otherwise it waits for the
//      next run. --force restarts anyway; --dry-run only prints what changes.
//
// The web app never writes these files: it only answers this script.
import { execFileSync } from "node:child_process";
import { chownSync, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readKeys, readWebhookKey, renderConfig, signJwt } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const env = { ...loadEnvFile(process.env.NAITALK_CALL_ENV || "/etc/naitalk-call/sync.env"), ...process.env };
const API = (env.NAITALK_API_URL || "https://www.naitalk.com/api/v1").replace(/\/$/, "");
const TOKEN = env.NAITALK_CALL_SYNC_TOKEN;
const CONFIG = env.LIVEKIT_CONFIG || "/etc/naitalk-call/livekit.yaml";
const ROUTES = env.ROUTES_FILE || "/etc/naitalk-call/routes.json";
const ROUTER_URL = env.ROUTER_URL || `http://127.0.0.1:${env.ROUTER_PORT || 7890}/webhook`;
const LIVEKIT_HTTP = (env.LIVEKIT_HTTP || "http://127.0.0.1:7880").replace(/\/$/, "");
const SERVICE = env.SERVICE || "naitalk-call";
const GROUP = env.SERVICE_GROUP || "naitalk-call";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8").split("\n")
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function report(status, message) {
  console.log(`${status}: ${message}`);
  if (args.has("--dry-run")) return;
  await api("/internal/naitalk-call/synced", { method: "POST", body: JSON.stringify({ status, message: message.slice(0, 500) }) }).catch((error) =>
    console.error(`could not report to Naitalk: ${error.message}`),
  );
}

/** Same owner, group and mode as the file it replaces; renamed into place so readers never see half a file. */
function writeAtomically(path, content, mode = 0o640) {
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}`);
  writeFileSync(tmp, content, { mode });
  const gid = Number(execFileSync("id", ["-g", GROUP]).toString().trim());
  chownSync(tmp, 0, gid);
  renameSync(tmp, path);
}

/** People in calls right now, asked of LiveKit itself. null if LiveKit can't be asked. */
async function liveParticipants(yaml) {
  const key = readWebhookKey(yaml);
  const secret = readKeys(yaml)[key];
  if (!key || !secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ iss: key, nbf: now, exp: now + 60, video: { roomList: true } }, secret);
  try {
    const response = await fetch(`${LIVEKIT_HTTP}/twirp/livekit.RoomService/ListRooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const { rooms = [] } = await response.json();
    return rooms.reduce((sum, room) => sum + Number(room.num_participants ?? room.numParticipants ?? 0), 0);
  } catch {
    return null;
  }
}

function pruneBackups(keep = 10) {
  const dir = dirname(CONFIG);
  const prefix = `${basename(CONFIG)}.bak-`;
  readdirSync(dir).filter((name) => name.startsWith(prefix)).sort().slice(0, -keep).forEach((name) => unlinkSync(join(dir, name)));
}

async function main() {
  if (!TOKEN) throw new Error("NAITALK_CALL_SYNC_TOKEN is not set (see /etc/naitalk-call/sync.env)");
  if (process.getuid?.() !== 0 && !args.has("--dry-run")) throw new Error("run as root");

  const remote = await api("/internal/naitalk-call/config");
  const yaml = readFileSync(CONFIG, "utf8");
  const inboundKey = readWebhookKey(yaml);
  const inboundSecret = readKeys(yaml)[inboundKey];
  if (!inboundKey || !inboundSecret) throw new Error("webhook.api_key in livekit.yaml has no matching key");

  // The router needs its routes before LiveKit starts sending to it.
  const routes = `${JSON.stringify({ inbound: { api_key: inboundKey, api_secret: inboundSecret }, routes: remote.routes }, null, 2)}\n`;
  if (!existsSync(ROUTES) || readFileSync(ROUTES, "utf8") !== routes) {
    if (args.has("--dry-run")) console.log(`would write ${ROUTES} (${remote.routes.length} routes)`);
    else writeAtomically(ROUTES, routes);
  }

  const { yaml: next, skipped } = renderConfig(yaml, remote.keys, ROUTER_URL);
  const count = Object.keys(remote.keys).length - skipped.length;
  const note = skipped.length ? ` Skipped (clash or bad characters): ${skipped.join(", ")}.` : "";
  if (next === yaml) return report("unchanged", `${count} managed key(s) already live.${note}`);

  if (args.has("--dry-run")) {
    const before = new Set(yaml.split("\n"));
    const after = new Set(next.split("\n"));
    yaml.split("\n").filter((line) => !after.has(line)).forEach((line) => console.log(`- ${line.replace(/:\s+\S+$/, ": ***")}`));
    next.split("\n").filter((line) => !before.has(line)).forEach((line) => console.log(`+ ${line.replace(/:\s+\S+$/, ": ***")}`));
    return report("deferred", "dry run: nothing written");
  }

  const live = await liveParticipants(yaml);
  if (live && !args.has("--force")) return report("deferred", `${live} people are in calls; will apply when calls end.${note}`);

  const backup = `${CONFIG}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  writeFileSync(backup, yaml, { mode: 0o600 });
  writeAtomically(CONFIG, next, statSync(CONFIG).mode & 0o777);
  execFileSync("systemctl", ["restart", SERVICE]);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    execFileSync("systemctl", ["is-active", "--quiet", SERVICE]);
  } catch {
    writeAtomically(CONFIG, yaml, statSync(CONFIG).mode & 0o777);
    execFileSync("systemctl", ["restart", SERVICE]);
    await report("failed", `${SERVICE} did not start with the new config; restored ${basename(backup)}.`);
    process.exitCode = 1;
    return;
  }
  pruneBackups();
  return report("applied", `${count} managed key(s) live; ${SERVICE} restarted.${note}`);
}

main().catch(async (error) => {
  console.error(error.message);
  if (TOKEN) await report("failed", error.message);
  process.exitCode = 1;
});
