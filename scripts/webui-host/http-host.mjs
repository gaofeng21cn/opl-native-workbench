import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOplHostCore } from "./host-core.mjs";
import { ThreadAdapterError } from "./thread-adapter.mjs";

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
  const typed = error instanceof ThreadAdapterError
    ? error
    : new ThreadAdapterError(error.code ?? "host_error", error.message ?? String(error), error.details ?? {}, 502);
  json(res, typed.httpStatus ?? 502, {
    error: { code: typed.code, message: typed.message, details: typed.details ?? {} }
  });
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_048_576) throw new ThreadAdapterError("invalid_request", "Request body exceeds 1 MiB", {}, 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ThreadAdapterError("invalid_request", "Request body must be valid JSON", {}, 400);
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
      res.end("<main id=\"root\">One Person Lab WebUI build is unavailable.</main>");
      return;
    }
  }
  res.writeHead(200, { "content-type": mimeTypes.get(path.extname(file)) ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

export async function createWebUiHost({
  core,
  webRoot = path.join(repositoryRoot, "dist", "webui"),
  ...coreOptions
} = {}) {
  const hostCore = core ?? await createOplHostCore(coreOptions);
  const oplEventClients = new Set();
  let closing = false;
  let closePromise;
  const emitTo = (clients, event) => {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(frame);
  };
  hostCore.on("event", (event) => emitTo(oplEventClients, event));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        json(res, closing ? 503 : 200, {
          status: closing ? "stopping" : "ok",
          service: "one-person-lab-headless"
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/readyz") {
        const capabilities = hostCore.capabilities();
        const ready = !closing && capabilities.appServerAvailable === true;
        json(res, ready ? 200 : 503, {
          status: ready ? "ready" : "not_ready",
          appServerAvailable: capabilities.appServerAvailable,
          appServerError: capabilities.appServerError
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl-events") {
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no"
        });
        res.write(`data: ${JSON.stringify({ method: "host/ready", params: hostCore.capabilities().threadAdapter })}\n\n`);
        oplEventClients.add(res);
        const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
        req.once("close", () => {
          clearInterval(heartbeat);
          oplEventClients.delete(res);
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/capabilities") {
        json(res, 200, hostCore.capabilities());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl/state") {
        json(res, 200, await hostCore.invoke("readState", { profile: url.searchParams.get("profile") ?? "fast" }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl/initialize") {
        json(res, 200, await hostCore.invoke("readInitialize"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/opl/drilldown") {
        json(res, 200, await hostCore.invoke("readFullDrilldown"));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/opl/contribution/read") {
        json(res, 200, await hostCore.invoke("readContribution", await body(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/opl/action") {
        json(res, 200, await hostCore.invoke("executeAction", await body(req)));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/codex/models") {
        json(res, 200, await hostCore.invoke("readCodexModels"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/codex/capabilities") {
        json(res, 200, await hostCore.invoke("readCodexCapabilities", { threadId: url.searchParams.get("threadId") ?? undefined }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/codex/permission-profiles") {
        json(res, 200, await hostCore.invoke("readCodexPermissionProfiles"));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/send-message") {
        json(res, 200, await hostCore.invoke("sendMessage", await body(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/turns/steer") {
        json(res, 200, await hostCore.invoke("steerTurn", await body(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/turns/interrupt") {
        json(res, 200, await hostCore.invoke("interruptTurn", await body(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/opl-runtime/gateway-account-login") {
        json(res, 200, await hostCore.invoke("loginGatewayAccount", await body(req)));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/opl-runtime/configure-codex") {
        json(res, 200, await hostCore.invoke("configureCodexApiKey", await body(req)));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/native-app-update/status") {
        json(res, 200, await hostCore.invoke("readNativeAppUpdateStatus"));
        return;
      }
      const nativeUpdaterOperation = new Map([
        ["/api/native-app-update/check", "check"],
        ["/api/native-app-update/apply", "apply"],
        ["/api/native-app-update/restart", "restart"]
      ]).get(url.pathname);
      if (req.method === "POST" && nativeUpdaterOperation) {
        await body(req);
        const method = {
          check: "checkNativeAppUpdate",
          apply: "applyNativeAppUpdate",
          restart: "restartNativeApp"
        }[nativeUpdaterOperation];
        json(res, 200, await hostCore.invoke(method));
        return;
      }

      const postRoutes = new Map([
        ["/api/threads/list", (value) => hostCore.invoke("listThreads", value)],
        ["/api/threads/read", (value) => hostCore.invoke("readThread", value)],
        ["/api/threads/resume", (value) => hostCore.invoke("resumeThread", value)],
        ["/api/threads/fork", (value) => hostCore.invoke("forkThread", value)],
        ["/api/threads/archive", (value) => hostCore.invoke("setArchived", { ...value, archived: true })],
        ["/api/threads/unarchive", (value) => hostCore.invoke("setArchived", { ...value, archived: false })]
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
    core: hostCore,
    transport: hostCore.transport,
    threads: hostCore.threads,
    async close() {
      closePromise ??= (async () => {
        closing = true;
        for (const client of oplEventClients) client.end();
        if (server.listening) {
          server.closeAllConnections?.();
          await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        }
        await hostCore.close();
      })();
      return closePromise;
    }
  };
}

export async function readBuiltIndex(webRoot = path.join(repositoryRoot, "dist", "webui")) {
  return readFile(path.join(webRoot, "index.html"), "utf8");
}
