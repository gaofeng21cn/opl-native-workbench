import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.url === "/api/opl-events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache"
    });
    res.end(`data: ${JSON.stringify({ type: "bridge.ready" })}\n\n`);
    return;
  }
  if (req.url === "/api/shell-data") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ shell: "opl-native-workbench", authority: "one-person-lab-app" }));
    return;
  }
  if (req.url === "/api/send-message") {
    res.writeHead(202, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "accepted", dry_run: true }));
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end("<main id=\"root\">OPL Native Workbench</main>");
});

const port = Number(process.env.PORT ?? 4178);
server.listen(port, () => {
  console.log(JSON.stringify({ status: "webui_server_listening", port }, null, 2));
});
