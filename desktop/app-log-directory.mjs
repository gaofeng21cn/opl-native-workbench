import fileSystem from "node:fs/promises";
import path from "node:path";

const UPDATE_SCHEMA = "opl_app_log_directory_update.v1";
const PERSISTENCE_SCHEMA = "opl_desktop_client_system_info.v1";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizedAbsolutePath(value, pathApi) {
  if (typeof value !== "string" || !value.trim() || !pathApi.isAbsolute(value.trim())) return null;
  return pathApi.normalize(value.trim());
}

export function createAppLogDirectoryController({
  electronApp,
  fs = fileSystem,
  pathApi = path,
  storageFile
}) {
  if (!electronApp) throw new TypeError("electronApp is required");

  const targetFile = storageFile ?? pathApi.join(electronApp.getPath("userData"), "system-info.json");
  let temporarySequence = 0;

  function result(fields) {
    return {
      schema: UPDATE_SCHEMA,
      owner: "one-person-lab-app_desktop_host",
      carrier: "electron_desktop",
      action: "application.setLogDirectory",
      ...fields
    };
  }

  async function readSnapshot() {
    try {
      const content = await fs.readFile(targetFile, "utf8");
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { exists: true, content, logDir: null };
      }
      return {
        exists: true,
        content,
        logDir: normalizedAbsolutePath(parsed?.desktop_client_system_info?.logDir, pathApi)
      };
    } catch (error) {
      if (error?.code === "ENOENT") return { exists: false, content: "", logDir: null };
      throw error;
    }
  }

  async function writeAtomically(content) {
    await fs.mkdir(pathApi.dirname(targetFile), { recursive: true });
    temporarySequence += 1;
    const temporaryFile = `${targetFile}.tmp-${process.pid}-${temporarySequence}`;
    try {
      await fs.writeFile(temporaryFile, content, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporaryFile, targetFile);
    } finally {
      await fs.unlink(temporaryFile).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  }

  function persistenceContent(logDir) {
    return `${JSON.stringify({
      schema: PERSISTENCE_SCHEMA,
      desktop_client_system_info: { logDir }
    }, null, 2)}\n`;
  }

  async function persist(logDir) {
    await writeAtomically(persistenceContent(logDir));
  }

  async function restoreSnapshot(snapshot) {
    if (snapshot.exists) {
      await writeAtomically(snapshot.content);
      return;
    }
    await fs.unlink(targetFile).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }

  async function setLogDirectory({ path: requestedPath } = {}) {
    const nextLogDir = normalizedAbsolutePath(requestedPath, pathApi);
    if (!nextLogDir) {
      return result({
        status: "error",
        success: false,
        errorCode: "invalid_log_directory",
        rollbackStatus: "not_required"
      });
    }

    const previousLivePath = electronApp.getPath("logs");
    let previousSnapshot;
    try {
      previousSnapshot = await readSnapshot();
      await persist(nextLogDir);
    } catch (error) {
      return result({
        status: "error",
        success: false,
        errorCode: "log_directory_persistence_failed",
        rollbackStatus: "not_required",
        message: errorMessage(error)
      });
    }

    try {
      electronApp.setAppLogsPath(nextLogDir);
      const hostLogDir = pathApi.normalize(electronApp.getPath("logs"));
      if (hostLogDir !== nextLogDir) throw new Error("Electron did not adopt the persisted log directory");
      return result({ status: "updated", success: true, hostLogDir });
    } catch (switchError) {
      const rollbackErrors = [];
      try {
        await restoreSnapshot(previousSnapshot);
      } catch (error) {
        rollbackErrors.push(`persistence: ${errorMessage(error)}`);
      }
      try {
        electronApp.setAppLogsPath(previousLivePath);
        if (pathApi.normalize(electronApp.getPath("logs")) !== pathApi.normalize(previousLivePath)) {
          throw new Error("Electron did not restore the previous log directory");
        }
      } catch (error) {
        rollbackErrors.push(`live: ${errorMessage(error)}`);
      }
      return result({
        status: "error",
        success: false,
        errorCode: rollbackErrors.length
          ? "log_directory_switch_rollback_failed"
          : "log_directory_switch_failed",
        rollbackStatus: rollbackErrors.length ? "failed" : "restored",
        message: [errorMessage(switchError), ...rollbackErrors].join("; ")
      });
    }
  }

  async function restore() {
    let snapshot;
    try {
      snapshot = await readSnapshot();
    } catch (error) {
      return { restored: false, reasonCode: "log_directory_persistence_read_failed", message: errorMessage(error) };
    }
    if (!snapshot.exists) return { restored: false, reasonCode: "log_directory_not_configured" };
    if (!snapshot.logDir) return { restored: false, reasonCode: "invalid_persisted_log_directory" };

    const previousLivePath = electronApp.getPath("logs");
    try {
      electronApp.setAppLogsPath(snapshot.logDir);
      const hostLogDir = pathApi.normalize(electronApp.getPath("logs"));
      if (hostLogDir !== snapshot.logDir) throw new Error("Electron did not restore the persisted log directory");
      return { restored: true, hostLogDir };
    } catch (error) {
      try {
        electronApp.setAppLogsPath(previousLivePath);
      } catch {
        // The startup readback remains typed and the App continues with Electron's current path.
      }
      return { restored: false, reasonCode: "log_directory_restore_failed", message: errorMessage(error) };
    }
  }

  return {
    persistenceFile: targetFile,
    restore,
    setLogDirectory
  };
}
