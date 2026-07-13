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

function firstRecords(value, limit = 8) {
  if (Array.isArray(value)) return value.slice(0, limit);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, limit));
  return value;
}

function selectedFields(value, fields) {
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(fields.flatMap((field) => value[field] === undefined ? [] : [[field, value[field]]]));
}

const packageFields = [
  "package_id", "packageId", "agent_id", "module_id", "id",
  "display_name", "displayName", "package_short_name", "label", "name",
  "lifecycle_status", "status", "install_state", "install_status", "health_status",
  "update_state", "update_status", "source_state", "trust_state", "trust_tier",
  "codex_surface_state", "codex_visible_entry", "codex_surface_ref", "shortcut_id", "display_policy",
  "conditions", "failure_conditions", "blocked_conditions", "issues", "diagnostics",
  "status_reason", "failure_reason", "reason", "recommended_action", "recommendedAction", "next_action", "repair_action",
  "source_kind", "install_origin", "manifest_url", "manifestUrl", "manifest_ref", "package_ref",
  "repo_url", "registry_url", "checkout_path", "managed_checkout_path", "ghcr_ref", "oci_ref", "container_ref", "image_ref",
  "required_skill", "requiredSkill", "skill_id", "skill_ref", "required_skills", "available_actions",
  "package_lock_ref", "lock_ref", "action_receipt_ref", "receipt_ref", "action_receipt_id", "receipt_refs", "rollback_ref",
  "source_surface"
];

const receiptFields = [
  "action", "action_status", "receipt_status", "receipt_ref", "package_lock_ref", "rollback_ref",
  "manifest_url", "source_kind", "source_surface", "trust_tier"
];

function compactPackageRecord(value) {
  const record = selectedFields(value, packageFields) ?? {};
  const sourcePolicy = selectedFields(value?.source_policy, ["effective_install_update_source"]);
  const distributionPayload = selectedFields(value?.distribution_payload, ["source_kind", "ref"]);
  const physicalSurface = selectedFields(value?.physical_surface ?? value?.distribution_payload?.physical_surface, ["status", "state", "ref", "path", "root"]);
  const files = selectedFields(value?.files, ["registry_cache_file", "package_lock_file", "lifecycle_ledger_file", "home_shortcut_preferences_file"]);
  const receipts = Array.isArray(value?.lifecycle_receipts)
    ? value.lifecycle_receipts.slice(0, 3).map((receipt) => selectedFields(receipt, receiptFields) ?? {})
    : undefined;
  return {
    ...record,
    ...(sourcePolicy ? { source_policy: sourcePolicy } : {}),
    ...(distributionPayload ? { distribution_payload: { ...distributionPayload, ...(physicalSurface ? { physical_surface: physicalSurface } : {}) } } : {}),
    ...(!distributionPayload && physicalSurface ? { physical_surface: physicalSurface } : {}),
    ...(files ? { files } : {}),
    ...(receipts ? { lifecycle_receipts: receipts } : {})
  };
}

function compactPackageRows(value, limit = 8) {
  if (Array.isArray(value)) return value.slice(0, limit).map(compactPackageRecord);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, limit).map(([key, row]) => [key, compactPackageRecord(row)]));
  }
  return value;
}

function compactAction(value) {
  return selectedFields(value, [
    "action_id", "label", "route", "payload_fields", "mutates", "dry_run_supported", "owner",
    "delegated_surface", "can_submit_to_safe_action_shell", "route_requires_domain_or_app_payload"
  ]) ?? {};
}

function compactFastState(value) {
  const root = value && typeof value === "object" ? value : {};
  const appState = root.app_state && typeof root.app_state === "object" ? root.app_state : root;
  const agentPackages = appState.agent_packages && typeof appState.agent_packages === "object" ? appState.agent_packages : undefined;
  const directory = agentPackages?.directory && typeof agentPackages.directory === "object" ? agentPackages.directory : undefined;
  const statusIndex = agentPackages?.status_index && typeof agentPackages.status_index === "object" ? agentPackages.status_index : undefined;
  const operator = appState.operator && typeof appState.operator === "object" ? appState.operator : undefined;
  const workbench = operator?.workbench && typeof operator.workbench === "object" ? operator.workbench : undefined;
  const settings = appState.settings_control_center && typeof appState.settings_control_center === "object"
    ? appState.settings_control_center
    : undefined;
  return {
    ...(root.version !== undefined ? { version: root.version } : {}),
    app_state: {
      schema_version: appState.schema_version,
      surface_kind: appState.surface_kind,
      runtime_source: appState.runtime_source,
      meta: appState.meta,
      provider: { status: appState.provider?.status },
      active_project_lines: firstRecords(appState.active_project_lines, 12),
      home_agent_shortcuts: firstRecords(appState.home_agent_shortcuts, 16),
      modules: { items: firstRecords(appState.modules?.items, 8) ?? [] },
      actions: Array.isArray(appState.actions) ? appState.actions.slice(0, 100).map(compactAction) : [],
      operator: operator ? {
        summary: operator.summary,
        refs: firstRecords(operator.refs, 16) ?? [],
        workbench: workbench ? {
          task_drilldowns: firstRecords(workbench.task_drilldowns, 8) ?? [],
          safe_action_routes: firstRecords(workbench.safe_action_routes, 32) ?? [],
          current_owner_delta: workbench.current_owner_delta,
          current_owner_delta_next_action: workbench.current_owner_delta_next_action
        } : undefined
      } : undefined,
      settings_control_center: settings ? {
        task_entries: firstRecords(settings.task_entries, 64) ?? [],
        action_sections: firstRecords(settings.action_sections, 32) ?? []
      } : undefined,
      agent_packages: agentPackages ? {
        surface_kind: agentPackages.surface_kind,
        source: agentPackages.source,
        directory: directory ? {
          installed_package_count: directory.installed_package_count,
          lifecycle_receipt_count: directory.lifecycle_receipt_count,
          files: directory.files,
          home_shortcut_preferences: firstRecords(directory.home_shortcut_preferences, 16),
          installed_packages: compactPackageRows(directory.installed_packages, 8) ?? [],
          lifecycle_receipts: Array.isArray(directory.lifecycle_receipts)
            ? directory.lifecycle_receipts.slice(0, 8).map((receipt) => selectedFields(receipt, receiptFields) ?? {})
            : []
        } : undefined,
        status_index: statusIndex ? {
          installed_package_count: statusIndex.installed_package_count,
          files: statusIndex.files,
          home_shortcut_preferences: firstRecords(statusIndex.home_shortcut_preferences, 16),
          packages: compactPackageRows(statusIndex.packages, 8)
        } : undefined
      } : undefined
    }
  };
}

function boundedReadback(args, result) {
  return {
    ...commandReadback(args, result),
    stdout: "",
    stdoutBytes: Buffer.byteLength(result.stdout),
    stdoutOmittedFromGuiProjection: true
  };
}

export { compactFastState };

export function createOplPassthrough({ cwd = process.cwd(), command = process.env.OPL_COMMAND ?? "opl" } = {}) {
  return {
    async readState(profile = "fast") {
      const normalizedProfile = profile === "full" ? "full" : "fast";
      const args = [command, "app", "state", "--profile", normalizedProfile, "--json"];
      const result = await run(command, args.slice(1), { cwd, timeoutMs: 30_000 });
      const parsed = jsonValue(result.stdout);
      return {
        profile: normalizedProfile,
        app_state: normalizedProfile === "fast" ? compactFastState(parsed) : parsed,
        readback: boundedReadback(args, result)
      };
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
