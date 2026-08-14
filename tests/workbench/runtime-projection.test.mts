import assert from "node:assert/strict";
import test from "node:test";

import { deriveWorkbenchModelFromState } from "../../src/workbench/workbenchModel.ts";

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

test("browser bridge normalization preserves App-projected Temporal runtime details", async () => {
  Object.assign(globalThis, {
    __OPL_CODEX_MODEL_POLICY__: {
      source: "test App policy",
      defaultModel: "test-model",
      defaultReasoningEffort: "high",
      visibleModels: [{ id: "test-model" }],
      reasoningEfforts: ["high"],
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
        }
      }
    }
  }, "fast");

  const model = deriveWorkbenchModelFromState(readback);
  assert.equal(model.runtimeOverview?.temporal.serviceStatus, "loaded_running");
  assert.equal(model.runtimeOverview?.temporal.workerStatus, "ready");
  assert.equal(model.runtimeOverview?.temporal.schedulerStatus, "attention_needed");

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
