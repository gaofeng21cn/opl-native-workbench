import { createWebUiHost } from "./webui-host/http-host.mjs";

const host = await createWebUiHost();
const port = Number(process.env.PORT ?? 4178);
const address = process.env.HOST ?? "127.0.0.1";
host.server.listen(port, address, () => {
  console.log(JSON.stringify({
    status: "webui_server_listening",
    address,
    port,
    app_server_available: host.transport.initialized,
    dynamic_tools: host.transport.dynamicToolsStatus
  }, null, 2));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await host.close();
    process.exit(0);
  });
}
