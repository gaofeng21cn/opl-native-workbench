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
  "display_name", "displayName", "package_short_name", "label", "name", "publisher", "description", "tags", "package_role",
  "lifecycle_status", "status", "install_state", "install_status", "health_status",
  "update_state", "update_status", "source_state", "trust_state", "trust_tier",
  "codex_surface_state", "codex_visible_entry", "codex_surface_ref", "shortcut_id", "display_policy",
  "conditions", "failure_conditions", "blocked_conditions", "issues", "diagnostics",
  "status_reason", "failure_reason", "reason", "recommended_action", "recommendedAction", "next_action", "repair_action",
  "source_kind", "install_origin",
  "required_skill", "requiredSkill", "skill_id", "skill_ref", "required_skills",
  "source_surface", "installed_version", "selected_version", "stable_version", "projected_version",
  "installed", "activated", "codex_visible"
];

function compactPackageActionPayload(value) {
  return selectedFields(value, [
    "package_id", "manifest_url", "registry_url", "trust_tier", "source_kind",
    "exposure_action", "shortcut_id", "visible", "sort_order"
  ]);
}

function compactPackageRecord(value) {
  const record = selectedFields(value, packageFields) ?? {};
  const sourcePolicy = selectedFields(value?.source_policy, ["effective_install_update_source"]);
  const sourceExplanation = selectedFields(value?.source_explanation, [
    "kind", "source", "summary", "source_policy_status"
  ]);
  const capabilityMetadata = selectedFields(value?.capability_metadata, [
    "source", "required_skill_ids", "optional_skill_refs"
  ]);
  const installedCarrierReadback = selectedFields(value?.installed_carrier_readback, [
    "kind", "identity", "version", "enabled", "lifecycle_authority"
  ]);
  const installedReadiness = selectedFields(value?.installed_readiness, [
    "installed", "physical_status", "callability"
  ]);
  const presence = selectedFields(value?.presence, [
    "registered", "installed", "present", "callable", "status", "reason"
  ]);
  const capabilityExposure = selectedFields(value?.capability_exposure, ["status", "codex_visible"]);
  const actions = selectedFields(value?.actions, ["available", "recommended", "execute_surface"]);
  const readiness = selectedFields(value?.readiness, ["status", "operational_ready", "launch_allowed", "reason"]);
  const packageCurrentness = selectedFields(value?.package_currentness, ["status", "reasons"]);
  const availableActions = Array.isArray(value?.available_actions)
    ? value.available_actions.map((action) => {
      const payload = compactPackageActionPayload(action?.payload);
      return {
        ...(selectedFields(action, [
        "action_id", "action_ref", "required_payload_fields", "confirmation_required", "semantic", "surface"
        ]) ?? {}),
        ...(payload && Object.keys(payload).length ? { payload } : {})
      };
    })
    : undefined;
  const files = selectedFields(value?.files, ["home_shortcut_preferences_file"]);
  return {
    ...record,
    ...(sourcePolicy ? { source_policy: sourcePolicy } : {}),
    ...(sourceExplanation ? { source_explanation: sourceExplanation } : {}),
    ...(capabilityMetadata ? { capability_metadata: capabilityMetadata } : {}),
    ...(installedCarrierReadback ? { installed_carrier_readback: installedCarrierReadback } : {}),
    ...(installedReadiness ? { installed_readiness: installedReadiness } : {}),
    ...(presence ? { presence } : {}),
    ...(capabilityExposure ? { capability_exposure: capabilityExposure } : {}),
    ...(actions ? { actions } : {}),
    ...(readiness ? { readiness } : {}),
    ...(packageCurrentness ? { package_currentness: packageCurrentness } : {}),
    ...(availableActions ? { available_actions: availableActions } : {}),
    ...(files ? { files } : {}),
  };
}

function compactPackageRows(value, limit = 64) {
  if (Array.isArray(value)) return value.slice(0, limit).map(compactPackageRecord);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, limit).map(([key, row]) => [key, compactPackageRecord(row)]));
  }
  return value;
}

function compactAction(value) {
  return selectedFields(value, [
    "action_id", "label", "route", "payload_fields", "mutates", "dry_run_supported", "owner",
    "delegated_surface", "can_submit_to_safe_action_shell", "route_requires_domain_or_app_payload",
    "confirmation_required", "danger_level"
  ]) ?? {};
}

function compactGatewayAccount(value) {
  if (!value || typeof value !== "object") return undefined;
  const account = value.account && typeof value.account === "object" ? value.account : undefined;
  return {
    ...selectedFields(value, ["surface_kind", "connection_mode", "status", "account_card_visible"]),
    account: account ? {
      ...selectedFields(account, ["display_name", "email", "status"]),
      balance: selectedFields(account.balance, ["amount", "currency"])
    } : undefined,
    usage: selectedFields(value.usage, [
      "today_tokens", "total_tokens", "today_actual_cost", "total_actual_cost", "currency", "day_timezone"
    ]),
    managed_key: selectedFields(value.managed_key, ["name", "status", "ownership"]),
    installation: selectedFields(value.installation, ["device_label", "short_id"]),
    freshness: selectedFields(value.freshness, ["observed_at", "stale_after", "stale", "last_error_code"]),
    capabilities: selectedFields(value.capabilities, ["account_login_supported", "manual_key_supported"])
  };
}

function compactSettingsReadModel(value) {
  if (!value || typeof value !== "object") return undefined;
  const connections = value.connections && typeof value.connections === "object" ? value.connections : undefined;
  const workspaceServices = value.workspace_services && typeof value.workspace_services === "object"
    ? value.workspace_services
    : undefined;
  const dockerWebui = value.docker_webui && typeof value.docker_webui === "object" ? value.docker_webui : undefined;
  const storageLifecycle = value.storage_lifecycle && typeof value.storage_lifecycle === "object"
    ? value.storage_lifecycle
    : undefined;
  return {
    ...selectedFields(value, ["surface_kind", "schema_version", "owner", "source_surface"]),
    opl_gateway_account: compactGatewayAccount(value.opl_gateway_account),
    codex_model_policy: selectedFields(value.codex_model_policy, [
      "model", "reasoning_effort", "model_provider", "provider_name", "provider_base_url", "config_path",
      "profile_source", "api_key_present", "opl_gateway_configured", "model_access_ready", "model_access_source", "access_status"
    ]),
    local_environment: selectedFields(value.local_environment, [
      "source_ref", "state_dir", "runtime_sources_root", "logs_dir", "release_channel", "temporal_provider",
      "app_update_action_id", "runtime_roots_cleanup_action_id", "runtime_substrate_rollback_action_id"
    ]),
    workspace_services: workspaceServices ? {
      workspace_root: selectedFields(workspaceServices.workspace_root, [
        "source_ref", "selected_path", "source", "exists", "writable", "health_status"
      ]),
      personalization_refs: selectedFields(workspaceServices.personalization_refs, [
        "source_refs", "user_agents_owner", "opl_app_context_owner", "framework_role"
      ])
    } : undefined,
    connections: connections ? {
      ...selectedFields(connections, ["surface_kind", "source_ref", "allowed_statuses", "default_connection_id"]),
      connections: Array.isArray(connections.connections)
        ? connections.connections.slice(0, 16).map((connection) => selectedFields(connection, [
            "connection_id", "name", "connection_type", "endpoint", "status", "status_code", "last_tested_at"
          ]) ?? {})
        : []
    } : undefined,
    docker_webui: dockerWebui ? {
      ...selectedFields(dockerWebui, ["surface_kind", "ordinary_status"]),
      runtime_proxy: selectedFields(dockerWebui.runtime_proxy, ["status"]),
      failure_recovery: selectedFields(dockerWebui.failure_recovery, ["status"])
    } : undefined,
    storage_lifecycle: storageLifecycle ? {
      ...selectedFields(storageLifecycle, ["surface_kind", "snapshot_updated_at"]),
      agent_package_store: selectedFields(storageLifecycle.agent_package_store, [
        "status", "observed_at", "stale", "bytes", "reclaimable_bytes", "reason_code"
      ]),
      webui_data_volume: selectedFields(storageLifecycle.webui_data_volume, [
        "status", "observed_at", "stale", "bytes", "reclaimable_bytes", "reason_code"
      ])
    } : undefined
  };
}

function compactCore(value) {
  if (!value || typeof value !== "object") return undefined;
  return {
    codex: selectedFields(value.codex, [
      "installed", "version", "parsed_version", "minimum_version", "version_status", "latest_version",
      "latest_version_status", "update_available", "binary_path", "default_model", "default_reasoning_effort",
      "config_path", "api_key_present", "opl_gateway_configured", "model_access_ready", "model_access_status",
      "model_access_source"
    ])
  };
}

function compactProvider(value) {
  if (!value || typeof value !== "object") return undefined;
  const temporal = value.temporal && typeof value.temporal === "object" ? value.temporal : undefined;
  const details = temporal?.details && typeof temporal.details === "object" ? temporal.details : undefined;
  const workerReadiness = details?.worker_readiness && typeof details.worker_readiness === "object"
    ? details.worker_readiness
    : undefined;
  const serviceLifecycle = workerReadiness?.temporal_service_lifecycle && typeof workerReadiness.temporal_service_lifecycle === "object"
    ? workerReadiness.temporal_service_lifecycle
    : undefined;
  return {
    ...selectedFields(value, ["status"]),
    temporal: temporal ? {
      ...selectedFields(temporal, ["status", "health_status", "ready"]),
      management: selectedFields(temporal.management, ["owner_surface", "actions"]),
      details: details ? {
        ...selectedFields(details, ["address", "address_source", "namespace", "task_queue"]),
        worker_readiness: workerReadiness ? {
          ...selectedFields(workerReadiness, ["readiness_status", "service_ready", "worker_ready", "server_reachable", "blockers"]),
          temporal_service_lifecycle: serviceLifecycle ? {
            ...selectedFields(serviceLifecycle, ["service_status", "address_source", "server_reachable", "service_kind", "blockers"]),
            supervisor: selectedFields(serviceLifecycle.supervisor, [
              "status", "installed", "loaded", "ready", "observed_at", "error", "supported", "applicable",
              "required", "configuration_current", "process_state"
            ])
          } : undefined
        } : undefined,
        scheduler: selectedFields(details.scheduler, [
          "status", "ready", "observed_at", "schedule_status", "health_status", "degraded_reason", "inspection_error"
        ])
      } : undefined
    } : undefined
  };
}

function compactRuntimeSourceCarriers(value) {
  if (!value || typeof value !== "object") return undefined;
  return {
    ...selectedFields(value, ["surface_kind"]),
    summary: selectedFields(value.summary, [
      "default_carriers_count", "present_default_carriers_count", "healthy_default_carriers_count"
    ]),
    items: Array.isArray(value.items) ? value.items.map((item) => ({
      ...selectedFields(item, [
        "package_id", "carrier_id", "label", "scope", "description", "default_carrier", "source_present",
        "source_origin", "source_health_status"
      ]),
      git: selectedFields(item?.git, ["sync_status", "dirty"])
    })) : []
  };
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
      core: compactCore(appState.core),
      provider: compactProvider(appState.provider),
      runtime_source_carriers: compactRuntimeSourceCarriers(appState.runtime_source_carriers),
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
        surface_kind: settings.surface_kind,
        schema_version: settings.schema_version,
        profile: settings.profile,
        status_summary: selectedFields(settings.status_summary, [
          "model_access", "codex_version", "runtime_source_carrier_health", "agent_package_functional_health",
          "temporal_provider", "release_channel", "issue_count"
        ]),
        app_settings_read_model: compactSettingsReadModel(settings.app_settings_read_model),
        task_entries: firstRecords(settings.task_entries, 64) ?? [],
        action_sections: firstRecords(settings.action_sections, 32) ?? []
      } : undefined,
      agent_packages: agentPackages ? {
        surface_kind: agentPackages.surface_kind,
        source: agentPackages.source,
        directory: directory ? {
          status: directory.status,
          entry_count: directory.entry_count,
          installed_package_count: directory.installed_package_count,
          installable_package_count: directory.installable_package_count,
          migration_required_count: directory.migration_required_count,
          source_catalog_kind: directory.source_catalog_kind,
          files: selectedFields(directory.files, ["home_shortcut_preferences_file"]),
          home_shortcut_preferences: firstRecords(directory.home_shortcut_preferences, 16),
          entries: compactPackageRows(directory.entries, 64) ?? []
        } : undefined,
        status_index: statusIndex ? {
          installed_package_count: statusIndex.installed_package_count,
          files: statusIndex.files,
          home_shortcut_preferences: firstRecords(statusIndex.home_shortcut_preferences, 16),
          packages: compactPackageRows(statusIndex.packages, 64)
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

    async readContribution(request = {}) {
      const packageId = typeof request.packageId === "string" ? request.packageId.trim() : "";
      const ref = typeof request.ref === "string" ? request.ref.trim() : "";
      if (!packageId || !ref) throw Object.assign(new Error("missing packageId or ref"), { code: "invalid_request" });
      const input = request.input && typeof request.input === "object" ? request.input : {};
      const args = [command, "app", "contribution", "read", "--package-id", packageId, "--ref", ref, "--input", JSON.stringify(input), "--json"];
      const result = await run(command, args.slice(1), { cwd, timeoutMs: 45_000 });
      return { ...commandReadback(args, result), stdoutJson: jsonValue(result.stdout) };
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
