import { closeWithin, resolveHeadlessConfig, startHeadlessHost } from "./server.mjs";

function write(stream, value) {
  stream.write(`${JSON.stringify(value)}\n`);
}

let service;
try {
  service = await startHeadlessHost({ config: resolveHeadlessConfig() });
  write(process.stdout, {
    status: "headless_server_listening",
    address: service.address,
    port: service.port,
    appServerAvailable: service.host.transport.initialized === true,
    renderer: "shared_webui"
  });
} catch (error) {
  write(process.stderr, {
    status: "headless_server_start_failed",
    code: error.code ?? "start_failed",
    message: error.message ?? String(error)
  });
  process.exitCode = 1;
}

if (service) {
  let stopping;
  const stop = (signal) => {
    stopping ??= (async () => {
      try {
        const result = await closeWithin(service.host, service.config.shutdownTimeoutMs);
        write(result.timedOut ? process.stderr : process.stdout, {
          status: result.timedOut ? "headless_server_shutdown_timed_out" : "headless_server_stopped",
          signal,
          timeoutMs: service.config.shutdownTimeoutMs
        });
        process.exit(result.timedOut ? 1 : 0);
      } catch (error) {
        write(process.stderr, {
          status: "headless_server_shutdown_failed",
          signal,
          message: error.message ?? String(error)
        });
        process.exit(1);
      }
    })();
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}
