#!/usr/bin/env node

import { main } from "./headless/installer.mjs";

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    schema: "opl_headless_installer_result.v1",
    status: "error",
    message: error.message
  })}\n`);
  process.exitCode = 1;
});
