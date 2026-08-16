import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWorkbenchModelFromState,
  mergeManagedUpdateProjections,
  readManagedUpdateProjection
} from "../../src/workbench/workbenchModel.ts";

test("runtime projection keeps component health, carriers, and only App-projected maintenance actions", () => {
  const model = deriveWorkbenchModelFromState({
    app_state: {
      actions: [
        {
          action_id: "settings_check_app_update",
          label: "Check App update",
          route: "opl app action execute --action settings_check_app_update",
          payload_fields: [],
          mutates: "none_read_only",
          dry_run_supported: true,
          confirmation_required: false
        },
        {
          action_id: "provider_scheduler_status",
          label: "Read Temporal scheduler status",
          route: "opl app action execute --action provider_scheduler_status",
          payload_fields: [],
          mutates: "none_read_only",
          dry_run_supported: true,
          confirmation_required: false
        },
        {
          action_id: "unrelated_action",
          label: "Unrelated",
          route: "opl app action execute --action unrelated_action",
          payload_fields: [],
          mutates: "none_read_only",
          dry_run_supported: true
        }
      ],
      settings_control_center: {
        app_settings_read_model: {
          local_environment: {
            app_update_action_id: "settings_check_app_update"
          }
        }
      },
      provider: {
        status: "ready",
        temporal: {
          status: "ready",
          ready: true,
          management: { actions: ["provider_scheduler_status", "missing_action"] },
          details: {
            address: "127.0.0.1:7233",
            namespace: "opl-foundry",
            task_queue: "opl-stage-attempts",
            worker_readiness: {
              readiness_status: "ready",
              service_ready: true,
              worker_ready: true,
              temporal_service_lifecycle: {
                service_status: "running",
                supervisor: { status: "loaded_running", ready: true }
              }
            },
            scheduler: { status: "attention_needed", ready: false, observed_at: "2026-08-10T00:00:00Z" }
          }
        }
      },
      runtime_source_carriers: {
        summary: {
          default_carriers_count: 2,
          present_default_carriers_count: 2,
          healthy_default_carriers_count: 1
        },
        items: [
          { package_id: "mas", label: "Med Auto Science", source_present: true, source_health_status: "ready", git: { sync_status: "synced", dirty: false } },
          { package_id: "mag", label: "Med Auto Grant", source_present: true, source_health_status: "attention_needed", git: { sync_status: "behind", dirty: false } }
        ]
      }
    }
  });

  assert.equal(model.runtimeOverview?.temporal.serviceStatus, "loaded_running");
  assert.equal(model.runtimeOverview?.temporal.workerStatus, "ready");
  assert.equal(model.runtimeOverview?.temporal.schedulerStatus, "attention_needed");
  assert.equal(model.runtimeOverview?.carriers.healthy, 1);
  assert.equal(model.runtimeOverview?.carriers.items[1]?.syncStatus, "behind");
  assert.deepEqual(model.runtimeOverview?.maintenanceActions.map((action) => action.actionId), [
    "settings_check_app_update",
    "provider_scheduler_status"
  ]);
  assert.equal(model.runtimeOverview?.recommendedActionId, "provider_scheduler_status");
});

test("runtime projection hides bridge placeholders but keeps real active work", () => {
  const placeholder = deriveWorkbenchModelFromState({
    app_state: {
      active_project_lines: [{
        status: "candidate_preview_only",
        active_run_id: "placeholder-fast",
        next_visible_step: "Read runtime refs before execution"
      }]
    }
  });
  assert.deepEqual(placeholder.activeProjectLines, []);

  const real = deriveWorkbenchModelFromState({
    app_state: {
      active_project_lines: [{
        status: "running",
        active_run_id: "run-42",
        next_visible_step: "Validate the hypothesis",
        progress_delta_classification: "analysis",
        deliverable_progress_delta: "draft updated",
        next_forced_delta: "review"
      }]
    }
  });
  assert.equal(real.activeProjectLines[0]?.activeRunId, "run-42");
});

test("actions do not masquerade as files or results", () => {
  const model = deriveWorkbenchModelFromState({
    app_state: {
      actions: [{
        action_id: "workspace_ensure",
        label: "Ensure workspace",
        route: "opl app action execute --action workspace_ensure",
        dry_run_supported: true,
        payload_fields: []
      }]
    }
  });
  assert.deepEqual(model.artifactPreviews, []);
  assert.equal(model.contextActions[0]?.id, "workspace_ensure");
});

test("managed update action results preserve owner components across fresh actions", () => {
  const app = readManagedUpdateProjection({
    app_action_execution: {
      result: {
        managed_update: {
          operation: "check",
          update_channel: "stable",
          components: [{
            component_id: "opl_app",
            lifecycle_owner: "one-person-lab-app",
            label: "OPL App",
            state: "current",
            current: { installed_version: "1.2.0", latest_version: "1.2.0" },
            auto_apply: { mode: "native_host", eligible: false, app_background_safe: false }
          }]
        }
      }
    }
  });
  assert.ok(app);
  assert.deepEqual(app.components[0], {
    componentId: "opl_app",
    lifecycleOwner: "one-person-lab-app",
    label: "OPL App",
    state: "current",
    channel: "stable",
    installedVersion: "1.2.0",
    latestVersion: "1.2.0",
    autoApplyMode: "native_host",
    autoApplyEligible: false,
    backgroundSafe: false
  });

  const packages = readManagedUpdateProjection({
    result: {
      managed_update: {
        operation: "apply",
        components: [{
          component_id: "opl_packages",
          lifecycle_owner: "one-person-lab",
          label: "OPL Packages",
          state: "restart_needed",
          current: { installed_version: "cohort-4", latest_version: "cohort-5" },
          auto_apply: { mode: "eligible_native_packages", eligible: true, app_background_safe: true }
        }]
      }
    }
  });
  assert.ok(packages);
  const merged = mergeManagedUpdateProjections(app, packages);
  assert.deepEqual(merged.components.map((component) => component.componentId), ["opl_app", "opl_packages"]);
  assert.equal(merged.components[1]?.autoApplyEligible, true);
  assert.equal(merged.channel, "stable");
});

test("browser bridge normalization preserves App-projected Temporal runtime details", async () => {
  Object.assign(globalThis, {
    __OPL_CODEX_MODEL_POLICY__: {
      source: "test App policy",
      defaultModel: "test-model",
      defaultReasoningEffort: "high",
      visibleModels: [{ id: "test-model" }],
      reasoningEfforts: ["high"],
      autoLabel: { zh: "自动（推荐）", en: "Auto (recommended)" },
      knownModelReasoningEffortOverrides: {},
      acceptUnknownCatalogDefault: true,
      useHighestSupportedReasoningForUnknown: true
    }
  });
  const { normalizeCodexCapabilityCatalog, normalizeStateReadback } = await import("../../src/bridge/oplBridge.ts");
  const readback = normalizeStateReadback({
    profile: "fast",
    app_state: {
      app_state: {
        provider: {
          selected_provider: "temporal",
          temporal: {
            status: "ready",
            ready: true,
            details: {
              worker_readiness: {
                readiness_status: "ready",
                worker_ready: true,
                temporal_service_lifecycle: {
                  service_status: "running",
                  supervisor: { status: "loaded_running", ready: true }
                }
              },
              scheduler: { status: "attention_needed", ready: false }
            }
          }
        },
        managed_companions: [{
          surface_kind: "opl_managed_computer_use_projection",
          provider_id: "kimi-cu",
          product_name: "KimiCU",
          available_actions: ["settings_reinstall_computer_use"]
        }],
        actions: [{
          action_id: "settings_reinstall_computer_use",
          label: "Reinstall Computer Use",
          route: "opl app action execute --action settings_reinstall_computer_use",
          surface: "opl app action execute",
          submit_via: "opl app action execute",
          payload_fields: [],
          mutates: "opl_managed_kimi_cu_bundle_service_and_codex_mcp_registration",
          dry_run_supported: true,
          confirmation_required: true,
          danger_level: "medium",
          owner: "one-person-lab",
          delegated_surface: "OPL managed KimiCU reinstall",
          can_submit_to_safe_action_shell: true,
          route_requires_domain_or_app_payload: false
        }]
      }
    },
    carrierDiagnostics: {
      schema: "opl_app_carrier_diagnostics.v1",
      owner: "one-person-lab-app_desktop_host",
      carrier: "electron_desktop",
      status: "available",
      application: { systemInfo: { logDir: "/tmp/opl-app-logs" } },
      setLogDirectorySupported: true
    }
  }, "fast");

  const model = deriveWorkbenchModelFromState(readback);
  assert.equal(model.runtimeOverview?.temporal.serviceStatus, "loaded_running");
  assert.equal(model.runtimeOverview?.temporal.workerStatus, "ready");
  assert.equal(model.runtimeOverview?.temporal.schedulerStatus, "attention_needed");
  assert.equal(model.managedComputerUse?.providerId, "kimi-cu");
  assert.deepEqual(readback.app_state.managed_companions.map((item) => item.provider_id), ["kimi-cu"]);
  assert.deepEqual(readback.app_state.actions[0], {
    action_id: "settings_reinstall_computer_use",
    label: "Reinstall Computer Use",
    route: "opl app action execute --action settings_reinstall_computer_use",
    surface: "opl app action execute",
    submit_via: "opl app action execute",
    payload_fields: [],
    mutates: "opl_managed_kimi_cu_bundle_service_and_codex_mcp_registration",
    dry_run_supported: true,
    confirmation_required: true,
    danger_level: "medium",
    owner: "one-person-lab",
    delegated_surface: "OPL managed KimiCU reinstall",
    can_submit_to_safe_action_shell: true,
    route_requires_domain_or_app_payload: false
  });
  assert.deepEqual(readback.carrierDiagnostics, {
    schema: "opl_app_carrier_diagnostics.v1",
    owner: "one-person-lab-app_desktop_host",
    carrier: "electron_desktop",
    status: "available",
    application: { systemInfo: { logDir: "/tmp/opl-app-logs" } },
    setLogDirectorySupported: true
  });

  const capabilities = normalizeCodexCapabilityCatalog({
    skills: [
      { name: "MinerU", path: "/skills/mineru", enabled: true },
      { name: "MinerU", path: "/agents/mineru", enabled: true }
    ],
    plugins: [
      { id: "github", name: "GitHub", enabled: true, callable: true },
      { id: "github", name: "GitHub", enabled: true, callable: true }
    ],
    apps: []
  });
  assert.deepEqual(capabilities.skills.map((item) => item.name), ["MinerU"]);
  assert.deepEqual(capabilities.plugins.map((item) => item.id), ["github"]);
});
