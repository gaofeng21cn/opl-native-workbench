import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAppServerTransport } from "./app-server-transport.mjs";
import {
  CoordinationError,
  ThreadCoordinationHost,
  coordinationDynamicTools,
  dynamicToolProbeSpec
} from "./coordination-host.mjs";
import { CoordinationLedger } from "./coordination-ledger.mjs";
import { createOplPassthrough } from "./opl-passthrough.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"]
]);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function errorResponse(res, error) {
  const typed = error instanceof CoordinationError
    ? error
    : new CoordinationError(error.code ?? "host_error", error.message ?? String(error), error.details ?? {}, 502);
  json(res, typed.httpStatus ?? 502, {
    error: { code: typed.code, message: typed.message, details: typed.details ?? {} }
  });
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_048_576) throw new CoordinationError("protocol_incompatible", "Request body exceeds 1 MiB", {}, 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CoordinationError("protocol_incompatible", "Request body must be valid JSON", {}, 400);
  }
}

async function serveStatic(url, res, webRoot) {
  const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const resolved = path.resolve(webRoot, relative);
  if (!resolved.startsWith(`${path.resolve(webRoot)}${path.sep}`) && resolved !== path.resolve(webRoot, "index.html")) {
    json(res, 403, { error: { code: "path_forbidden", message: "Static path is outside the WebUI root", details: {} } });
    return;
  }
  let file = resolved;
  try {
    await access(file);
  } catch {
    file = path.join(webRoot, "index.html");
    try {
      await access(file);
    } catch {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<main id=\"root\">OPL Native Workbench WebUI build is unavailable.</main>");
      return;
    }
  }
  res.writeHead(200, { "content-type": mimeTypes.get(path.extname(file)) ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

export async function createWebUiHost({
  transport = new CodexAppServerTransport({ cwd: process.env.OPL_NATIVE_WORKBENCH_CODEX_CWD ?? repositoryRoot }),
  ledger = new CoordinationLedger(),
  opl = createOplPassthrough({ cwd: process.env.OPL_NATIVE_WORKBENCH_CODEX_CWD ?? repositoryRoot }),
  webRoot = path.join(repositoryRoot, "dist", "webui"),
  canonicalStateDbOnly = false
} = {}) {
  const coordination = new ThreadCoordinationHost(transport, { ledger, canonicalStateDbOnly });
  await coordination.ready();
  let appServerError = null;
  try {
    await transport.start();
  } catch (error) {
    appServerError = { code: error.code ?? "app_server_unavailable", message: error.message };
  }
  const eventClients = new Set();
  const emit = (event) => {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of eventClients) client.write(frame);
  };
  coordination.on("event", emit);
  transport.on("availability", (availability) => emit({ method: "host/availability", params: availability }));
  transport.on("dynamicTools", (capability) => emit({ method: "host/dynamicTools", params: capability }));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && (url.pathname === "/api/opl-events" || url.pathname === "/api/coordination/events")) {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no"
        });
        res.write(`data: ${JSON.stringify({ method: "host/ready", params: coordination.capabilities() })}\n\n`);
        eventClients.add(res);
        const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
        req.once("close", () => {
          clearInterval(heartbeat);
          eventClients.delete(res);
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/capabilities") {
        json(res, 200, {
          localHost: true,
          threadCoordination: coordination.capabilities(),
          appServerError,
          oplPassthrough: { available: true, authorityBoundary: "app_bridge_no_domain_authority" }
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/capabilities/dynamic-tools/probe") {
        const status = await transport.probeDynamicTools([dynamicToolProbeSpec()]);
        json(res, 200, { status, evidence: status === "available" ? "item/tool/call_received" : "probe_turn_without_tool_call" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl/state") {
        json(res, 200, await opl.readState(url.searchParams.get("profile") ?? "fast"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl/drilldown") {
        json(res, 200, await opl.readFullDrilldown());
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/opl/action") {
        json(res, 200, await opl.executeAction(await body(req)));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/codex/models") {
        json(res, 200, await transport.listModels());
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/send-message") {
        const request = await body(req);
        const response = await transport.sendMessage({
          ...request,
          dynamicTools: coordinationDynamicTools()
        });
        json(res, 200, response);
        return;
      }

      const postRoutes = new Map([
        ["/api/threads/list", (value) => coordination.listThreads(value)],
        ["/api/threads/read", (value) => coordination.readThread(value)],
        ["/api/threads/resume", (value) => coordination.resumeThread(value)],
        ["/api/coordination/prepare", (value) => coordination.prepareCoordination(value)],
        ["/api/coordination/dispatch", (value) => coordination.dispatchCoordination(value)],
        ["/api/threads/fork", (value) => coordination.forkThread(value)],
        ["/api/threads/archive", (value) => coordination.setArchived({ ...value, archived: true })],
        ["/api/threads/unarchive", (value) => coordination.setArchived({ ...value, archived: false })],
        ["/api/coordination/wait", (value) => coordination.waitCoordination(value)]
      ]);
      const route = req.method === "POST" ? postRoutes.get(url.pathname) : undefined;
      if (route) {
        json(res, 200, await route(await body(req)));
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        json(res, 404, { error: { code: "endpoint_not_found", message: `Unknown endpoint: ${url.pathname}`, details: {} } });
        return;
      }
      await serveStatic(url, res, webRoot);
    } catch (error) {
      errorResponse(res, error);
    }
  });

  return {
    server,
    transport,
    coordination,
    async close() {
      for (const client of eventClients) client.end();
      await new Promise((resolve) => server.close(resolve));
      await transport.stop();
    }
  };
}

export async function readBuiltIndex(webRoot = path.join(repositoryRoot, "dist", "webui")) {
  return readFile(path.join(webRoot, "index.html"), "utf8");
}
