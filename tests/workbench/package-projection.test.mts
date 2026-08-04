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
                version_source_ref: "private://source-explanation"
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
                  semantic: "update"
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
          }
        }
      }
    }
  });

  assert.equal(model.packageLifecycle.length, 1);
  const item = model.packageLifecycle[0];
  assert.equal(item.packageId, "future.agent");
  assert.equal(item.label, "Future Agent");
  assert.equal(item.searchMetadata.tags.includes("required_skill:future-agent"), true);
  assert.equal(item.statusAxes.find((axis) => axis.label === "Codex surface")?.value, "visible");
  assert.equal(item.details.find((detail) => detail.label === "Physical surface")?.value, "available");
  assert.equal(item.actions.find((action) => action.kind === "update")?.status, "available");
  assert.equal(item.actions.find((action) => action.kind === "install")?.status, "unavailable");
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
