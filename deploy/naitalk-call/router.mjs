#!/usr/bin/env node
// Naitalk Call webhook router (naitalk-call-router.service, on 127.0.0.1:7890).
//
// LiveKit has one global webhook list, so it sends every business's room
// events here instead. The router:
//   - checks LiveKit's signature (webhook.api_key in livekit.yaml);
//   - sends the event only to the business whose room prefix matches the room
//     ("acme-…" → Acme), re-signed with that business's own key (a business
//     whose key is still kept on the server gets LiveKit's original signature);
//   - drops events for rooms no business owns;
//   - passes participant_left to Naitalk for per-business minutes.
// Routes come from /etc/naitalk-call/routes.json, written by sync.mjs.
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { roomOf, routeFor, signWebhook, verifyWebhook } from "./lib.mjs";

const ROUTES = process.env.ROUTES_FILE || "/etc/naitalk-call/routes.json";
const PORT = Number(process.env.ROUTER_PORT || 7890);
const API = (process.env.NAITALK_API_URL || "https://www.naitalk.com/api/v1").replace(/\/$/, "");
const TOKEN = process.env.NAITALK_CALL_SYNC_TOKEN;
const MAX_BODY = 1024 * 1024;

let cached = { mtimeMs: 0, config: null };

/** routes.json, re-read whenever sync.mjs replaces it. */
function config() {
  const { mtimeMs } = statSync(ROUTES);
  if (mtimeMs !== cached.mtimeMs) cached = { mtimeMs, config: JSON.parse(readFileSync(ROUTES, "utf8")) };
  return cached.config;
}

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function meter(event, body) {
  if (!TOKEN || event.event !== "participant_left") return;
  fetch(`${API}/internal/naitalk-call/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${TOKEN}` },
    body,
    signal: AbortSignal.timeout(10000),
  })
    .then((response) => response.ok || log(`metering ${event.id}: HTTP ${response.status}`))
    .catch((error) => log(`metering ${event.id}: ${error.message}`));
}

/** What happens to one webhook delivery: [status for LiveKit, log line]. */
export async function handle(body, headers, cfg, send = fetch) {
  const authorization = headers.authorization || "";
  // Usually one signing key; two while a key change waits for LiveKit to restart.
  const signers = [].concat(cfg.inbound);
  if (!signers.some((k) => verifyWebhook(body, authorization, k.api_key, k.api_secret))) return [401, "rejected: bad signature"];

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return [400, "rejected: not JSON"];
  }

  const room = roomOf(event);
  const route = routeFor(room, cfg.routes);
  if (!route) return [200, `${event.event} ${room || "(no room)"}: no business owns this room, dropped`, event];

  const response = await send(route.url, {
    method: "POST",
    headers: {
      "Content-Type": headers["content-type"] || "application/webhook+json",
      Authorization: route.api_key ? signWebhook(body, route.api_key, route.api_secret) : authorization,
    },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch((error) => ({ ok: false, status: error.name }));

  // A failed delivery answers 502 so LiveKit's own retry can try again.
  return [response.ok ? 200 : 502, `${event.event} ${room} → ${route.prefix}: ${response.status}`, event];
}

function serve() {
  createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200).end("ok");
      return;
    }
    if (req.method !== "POST" || req.url !== "/webhook") {
      res.writeHead(404).end();
      return;
    }

    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(chunk);
    });
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        const [status, line, event] = await handle(body, req.headers, config());
        if (event) meter(event, body);
        log(line);
        res.writeHead(status).end();
      } catch (error) {
        log(`error: ${error.message}`);
        res.writeHead(500).end();
      }
    });
  }).listen(PORT, "127.0.0.1", () => log(`naitalk-call-router listening on 127.0.0.1:${PORT}`));
}

if (import.meta.url === `file://${process.argv[1]}`) serve();
