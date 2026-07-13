import { spawn } from "node:child_process";

function run(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: -1, stdout, stderr: `${stderr}${error.message}`, timedOut: false });
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: timedOut ? -1 : (code ?? -1), stdout, stderr, timedOut });
    });
  });
}

function commandReadback(args, result) {
  return {
    command: args.join(" "),
    commandArgs: args.slice(1),
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut
  };
}

function jsonValue(value) {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function createOplPassthrough({ cwd = process.cwd(), command = process.env.OPL_COMMAND ?? "opl" } = {}) {
  return {
    async readState(profile = "fast") {
      const normalizedProfile = profile === "full" ? "full" : "fast";
      const args = [command, "app", "state", "--profile", normalizedProfile, "--json"];
      const result = await run(command, args.slice(1), { cwd, timeoutMs: 30_000 });
      const readback = commandReadback(args, result);
      return { profile: normalizedProfile, app_state: jsonValue(result.stdout), readback, raw_state: jsonValue(result.stdout) };
    },

    async readFullDrilldown() {
      const args = [command, "runtime", "app-operator-drilldown", "--detail", "full", "--json"];
      const result = await run(command, args.slice(1), { cwd, timeoutMs: 45_000 });
      return { detail: "full", drilldown: jsonValue(result.stdout), readback: commandReadback(args, result) };
    },

    async executeAction(request = {}) {
      const actionId = typeof request.actionId === "string" ? request.actionId.trim() : "";
      if (!actionId) throw Object.assign(new Error("missing actionId"), { code: "invalid_request" });
      const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
      const dryRun = request.dryRun !== false;
      const confirmed = payload.confirmed === true;
      const rollbackRef = typeof payload.rollbackRef === "string" ? payload.rollbackRef : undefined;
      const requestedMode = request.mode === "rollback" || request.mode === "execute" ? request.mode : "preview";
      const receiptKind = !dryRun && !confirmed
        ? "confirmation_required"
        : (requestedMode === "rollback" || rollbackRef ? "rollback" : (dryRun ? "preview" : "execute"));
      const args = [command, "app", "action", "execute", "--action", actionId];
      if (Object.keys(payload).length) args.push("--payload", JSON.stringify(payload));
      if (dryRun) args.push("--dry-run");
      args.push("--json");
      const result = !dryRun && !confirmed
        ? { exitCode: -1, stdout: "", stderr: "confirmation_required", timedOut: false }
        : await run(command, args.slice(1), { cwd, timeoutMs: 45_000 });
      return {
        actionId,
        dryRun,
        confirmationRequired: dryRun || (!dryRun && !confirmed),
        canExecute: dryRun || confirmed,
        receiptKind,
        authorityBoundary: "app_bridge_no_domain_authority",
        requestedMode,
        status: result.timedOut
          ? "timed_out"
          : (!dryRun && !confirmed ? "confirmation_required" : (result.exitCode === 0 ? (dryRun ? "preview_ready" : "executed") : "error")),
        ...commandReadback(args, result),
        payload,
        stdoutJson: jsonValue(result.stdout),
        stderrJson: jsonValue(result.stderr),
        ...(payload.confirmationId ? { confirmationId: payload.confirmationId } : {}),
        ...(payload.receiptId ? { receiptId: payload.receiptId } : {}),
        ...(rollbackRef ? { rollbackRef } : {})
      };
    }
  };
}
