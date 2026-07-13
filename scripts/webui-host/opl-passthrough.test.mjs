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
          installed_package_count: 1,
          installed_packages: [{
            package_id: "mas",
            display_name: "MAS",
            lifecycle_status: "installed",
            available_actions: ["update"],
            managed_runtime_source: { bootstrap_command: ["x".repeat(20_000)] },
            lifecycle_receipts: [{ receipt_ref: "receipt:1", physical_surface: { payload: "x".repeat(20_000) } }]
          }]
        },
        status_index: {
          packages: {
            mas: { package_id: "mas", update_state: "current", owner_route_readback: { payload: "x".repeat(20_000) } }
          }
        }
      }
    }
  });

  const state = compact.app_state;
  assert.equal(state.actions[0].action_id, "refresh");
  assert.equal("internal_trace" in state.actions[0], false);
  assert.equal(state.agent_packages.directory.installed_packages[0].display_name, "MAS");
  assert.equal("managed_runtime_source" in state.agent_packages.directory.installed_packages[0], false);
  assert.equal(state.agent_packages.directory.installed_packages[0].lifecycle_receipts[0].receipt_ref, "receipt:1");
  assert.equal("physical_surface" in state.agent_packages.directory.installed_packages[0].lifecycle_receipts[0], false);
  assert.equal(state.agent_packages.status_index.packages.mas.update_state, "current");
  assert.equal("owner_route_readback" in state.agent_packages.status_index.packages.mas, false);
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 5_000);
});
