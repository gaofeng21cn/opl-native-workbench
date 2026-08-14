import assert from "node:assert/strict";
import test from "node:test";

import { deriveWorkbenchModelFromState } from "../../src/workbench/workbenchModel.ts";

test("current Package directory entries replace retired private lifecycle fields", () => {
  const model = deriveWorkbenchModelFromState({
    app_state: {
      actions: [
        {
          action_id: "agent_package_update",
          label: "Update package",
          route: "opl app action execute --action agent_package_update",
          payload_fields: ["package_id"],
          mutates: "opl_packages",
          dry_run_supported: true
        },
        {
          action_id: "agent_package_install",
          label: "Install package",
          route: "opl app action execute --action agent_package_install",
          payload_fields: ["package_id"],
          mutates: "opl_packages",
          dry_run_supported: true
        },
        {
          action_id: "agent_package_preferences_set",
          label: "Set package preferences",
          route: "opl app action execute --action agent_package_preferences_set",
          payload_fields: ["package_id", "exposure_action", "shortcut_id", "visible", "sort_order"],
          mutates: "opl_agent_package_preferences",
          dry_run_supported: true,
          confirmation_required: false
        }
      ],
      agent_packages: {
        directory: {
          status: "current",
          entry_count: 1,
          installed_package_count: 1,
          entries: [
            {
              package_id: "future.agent",
              display_name: "Future Agent",
              publisher: "Owner",
              package_role: "standard_agent",
              capability_metadata: {
                source: "normalized_owner_manifest",
                required_skill_ids: ["future-agent"]
              },
              installed_readiness: {
                installed: true,
                physical_status: "available",
                callability: "callable"
              },
              source_explanation: {
                kind: "installed_codex_plugin_descriptor",
                source: "installed_descriptor",
                version_source_ref: "private://source-explanation",
                effective_source_policy: {
                  effective_install_update_source: "package_channel",
                  package_channel_auto_update: true
                }
              },
              manifest_url: "file:///private/manifest",
              source: "/private/source",
              repo_url: "/private/repo",
              installed_carrier_readback: {
                kind: "codex_plugin_manager",
                identity: "future-agent@example",
                lifecycle_authority: "carrier_owned"
              },
              available_actions: [
                {
                  action_id: "agent_package_update",
                  action_ref: "app_state.actions#agent_package_update",
                  semantic: "update",
                  payload: { package_id: "future.agent" },
                  required_payload_fields: ["package_id"],
                  confirmation_required: true
                },
                {
                  action_id: "agent_package_preferences_set",
                  action_ref: "app_state.actions#agent_package_preferences_set",
                  semantic: "preferences",
                  payload: { package_id: "future.agent" },
                  required_payload_fields: ["package_id", "exposure_action or shortcut_id"],
                  confirmation_required: false
                }
              ],
              lifecycle_receipts: [{ receipt_ref: "private://receipt" }],
              package_lock_ref: "private://lock",
              rollback_ref: "private://rollback",
              files: {
                package_lock_file: "private://lock-file",
                lifecycle_ledger_file: "private://ledger"
              }
            }
          ]
        },
        status_index: {
          packages: {
            "future.agent": {
              package_id: "future.agent",
              status: "available",
              presence: {
                registered: true,
                installed: true,
                present: true,
                callable: true,
                status: "present"
              },
              capability_exposure: {
                status: "visible",
                codex_visible: true
              },
              actions: {
                available: ["update"],
                recommended: null
              }
            }
          },
          home_shortcut_preferences: [
            { package_id: "future.agent", shortcut_id: "research", visible: true, sort_order: 10 },
            { package_id: "future.agent", shortcut_id: "review", visible: false, sort_order: 20 }
          ]
        }
      }
    }
  });

  assert.equal(model.packageLifecycle.length, 1);
  const item = model.packageLifecycle[0];
  assert.equal(item.packageId, "future.agent");
  assert.equal(item.label, "Future Agent");
  assert.equal(item.publisher, "Owner");
  assert.equal(item.packageRole, "standard_agent");
  assert.equal(item.searchMetadata.tags.includes("required_skill:future-agent"), true);
  assert.equal(item.statusAxes.find((axis) => axis.label === "Codex surface")?.value, "visible");
  assert.equal(item.details.find((detail) => detail.label === "Physical surface")?.value, "available");
  assert.equal(item.sourceMode, "package_channel");
  assert.equal(item.automaticUpdate, true);
  assert.deepEqual(item.homeShortcuts, [
    { shortcutId: "research", visible: true, sortOrder: 10 },
    { shortcutId: "review", visible: false, sortOrder: 20 }
  ]);
  assert.equal(item.actions.length, 2);
  assert.equal(item.actions[0]?.kind, "update");
  assert.equal(item.actions[0]?.status, "available");
  assert.deepEqual(item.actions[0]?.payload, { package_id: "future.agent" });
  assert.deepEqual(item.actions[0]?.requiredPayloadFields, ["package_id"]);
  assert.equal(item.actions[0]?.confirmationRequired, true);
  assert.equal(item.actions[1]?.kind, "preferences");
  assert.equal(item.actions[1]?.status, "available");
  assert.equal(item.refs.find((ref) => ref.label === "Source")?.ref, "future-agent@example");
  assert.equal(item.refs.some((ref) => ref.label === "Manifest"), false);

  const serialized = JSON.stringify(item);
  for (const retired of [
    "private://source-explanation",
    "file:///private/manifest",
    "/private/source",
    "/private/repo",
    "private://receipt",
    "private://lock",
    "private://rollback",
    "private://lock-file",
    "private://ledger"
  ]) {
    assert.equal(serialized.includes(retired), false, `retired private field leaked: ${retired}`);
  }
});

test("package projection keeps the complete dynamic catalog and separates OPL roles", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    package_id: `package-${index}`,
    display_name: `Package ${index}`,
    publisher: index < 9 ? "one-person-lab" : "OpenAI",
    package_role: index < 5 ? "standard_agent" : index < 7 ? "capability_package" : index === 7 ? "workflow_profile" : "standard_agent",
    installed: true,
    activated: true,
    readiness: { status: "ready" },
    package_currentness: { status: "unknown" },
    available_actions: []
  }));
  const model = deriveWorkbenchModelFromState({
    app_state: {
      agent_packages: {
        directory: { status: "available", entry_count: entries.length, entries },
        status_index: { packages: {} }
      }
    }
  });

  assert.equal(model.packageLifecycle.length, 12);
  assert.equal(model.packageLifecycle.filter((item) => item.official && item.roleGroup === "agent").length, 6);
  assert.equal(model.packageLifecycle.filter((item) => item.roleGroup === "supporting").length, 2);
  assert.equal(model.packageLifecycle.filter((item) => item.roleGroup === "workflow").length, 1);
  assert.equal(model.packageLifecycle.filter((item) => item.roleGroup === "other").length, 3);
});
