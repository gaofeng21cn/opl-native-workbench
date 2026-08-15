const { chmod, stat } = require("node:fs/promises");
const path = require("node:path");

exports.default = async function preserveLinuxSandboxHelper(context) {
  if (context.electronPlatformName !== "linux") return;

  const sandboxPath = path.join(context.appOutDir, "chrome-sandbox");
  const before = await stat(sandboxPath);
  if (!before.isFile()) throw new Error(`Linux sandbox helper is not a file: ${sandboxPath}`);

  await chmod(sandboxPath, 0o4755);
  const mode = (await stat(sandboxPath)).mode & 0o7777;
  if (mode !== 0o4755) {
    throw new Error(`Linux sandbox helper mode is ${mode.toString(8)}, expected 4755`);
  }
};
