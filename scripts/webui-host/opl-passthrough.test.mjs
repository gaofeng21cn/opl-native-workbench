import assert from "node:assert/strict";
import test from "node:test";
import { compactFastState } from "./opl-passthrough.mjs";

test("fast state keeps GUI package fields without copying deep runtime payloads", () => {
  const compact = compactFastState({
    version: "test",
    app_state: {
      actions: [{ action_id: "refresh", label: "Refresh", route: "opl app action execute", internal_trace: "x".repeat(20_000) }],
      agent_packages: {
        directory: {
          status: "current",
          entry_count: 1,
          installed_package_count: 1,
          installable_package_count: 0,
          migration_required_count: 0,
          source_catalog_kind: "installed_descriptor",
          files: {
            home_shortcut_preferences_file: "state://shortcuts",
            package_lock_file: "private://lock",
            lifecycle_ledger_file: "private://ledger"
          },
          entries: [{
            package_id: "future.agent",
            display_name: "Future Agent",
            publisher: "Owner",
            package_role: "standard_agent",
            capability_metadata: { source: "normalized_owner_manifest", required_skill_ids: ["future-agent"] },
            installed_carrier_readback: {
              kind: "codex_plugin_manager",
              identity: "future-agent@example",
              source_ref: "/private/plugin/path",
              version: "1.0.0",
              lifecycle_authority: "carrier_owned"
            },
            installed_readiness: {
              installed: true,
              physical_status: "available",
              callability: "callable",
              legacy_lifecycle_state_present: false
            },
            source_explanation: {
              kind: "installed_codex_plugin_descriptor",
              source: "installed_descriptor",
              version_source_ref: "owner://future-agent/1.0.0"
            },
            available_actions: [{ action_id: "agent_package_update", semantic: "update", payload: { private: "x".repeat(20_000) } }],
            managed_runtime_source: { bootstrap_command: ["x".repeat(20_000)] },
            lifecycle_receipts: [{ receipt_ref: "private://receipt", physical_surface: { payload: "x".repeat(20_000) } }],
            package_lock_ref: "private://lock",
            rollback_ref: "private://rollback"
          }]
        },
        status_index: {
          packages: {
            "future.agent": {
              package_id: "future.agent",
              status: "available",
              presence: { registered: true, installed: true, present: true, callable: true, status: "present" },
              actions: { available: ["update"], recommended: null },
              owner_route_readback: { payload: "x".repeat(20_000) }
            }
          }
        }
      }
    }
  });

  const state = compact.app_state;
  assert.equal(state.actions[0].action_id, "refresh");
  assert.equal("internal_trace" in state.actions[0], false);
  const entry = state.agent_packages.directory.entries[0];
  assert.equal(entry.display_name, "Future Agent");
  assert.equal(entry.publisher, "Owner");
  assert.equal(entry.capability_metadata.required_skill_ids[0], "future-agent");
  assert.equal(entry.installed_carrier_readback.lifecycle_authority, "carrier_owned");
  assert.equal("version_source_ref" in entry.source_explanation, false);
  assert.equal(entry.installed_carrier_readback.identity, "future-agent@example");
  assert.equal("legacy_lifecycle_state_present" in entry.installed_readiness, false);
  assert.equal(entry.available_actions[0].action_id, "agent_package_update");
  assert.equal("payload" in entry.available_actions[0], false);
  assert.equal("source_ref" in entry.installed_carrier_readback, false);
  assert.equal("managed_runtime_source" in entry, false);
  assert.equal("lifecycle_receipts" in entry, false);
  assert.equal("package_lock_ref" in entry, false);
  assert.equal("rollback_ref" in entry, false);
  assert.equal("package_lock_file" in state.agent_packages.directory.files, false);
  assert.equal("lifecycle_ledger_file" in state.agent_packages.directory.files, false);
  assert.equal(state.agent_packages.status_index.packages["future.agent"].status, "available");
  assert.equal("owner_route_readback" in state.agent_packages.status_index.packages["future.agent"], false);
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 5_000);
});
