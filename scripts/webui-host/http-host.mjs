import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootOplStudioHost } from "./dsh/host.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function createWebUiHost({
  webRoot = path.join(repositoryRoot, "dist", "webui"),
  webHost = "127.0.0.1",
  webPort = 0,
  ...coreOptions
} = {}) {
  const { context, core } = await bootOplStudioHost({
    ...coreOptions,
    webRoot: path.resolve(webRoot),
    webHost,
    webPort
  }, { web: true });
  const webServer = context.get("webServer");
  if (!webServer) {
    await context.fiber.dispose();
    throw new Error("opl-studio: DSH Web profile did not provide webServer");
  }

  const browserHost = webServer.host === "0.0.0.0" ? "127.0.0.1" : webServer.host;
  let closePromise;
  return {
    context,
    core,
    webServer,
    host: webServer.host,
    port: webServer.port,
    url: `http://${browserHost}:${webServer.port}`,
    transport: core.transport,
    threads: core.threads,
    close() {
      closePromise ??= core.close();
      return closePromise;
    }
  };
}

export async function readBuiltIndex(webRoot = path.join(repositoryRoot, "dist", "webui")) {
  return readFile(path.join(webRoot, "index.html"), "utf8");
}
