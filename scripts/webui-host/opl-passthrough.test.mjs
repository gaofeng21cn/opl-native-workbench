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
            available_actions: [{
              action_id: "agent_package_update",
              action_ref: "app_state.actions#agent_package_update",
              semantic: "update",
              payload: { package_id: "future.agent", private: "x".repeat(20_000) },
              required_payload_fields: ["package_id"],
              confirmation_required: true
            }],
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
  assert.deepEqual(entry.available_actions[0].payload, { package_id: "future.agent" });
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

test("fast state exposes only the Settings read model fields needed by the shared renderer", () => {
  const compact = compactFastState({
    app_state: {
      core: {
        codex: {
          installed: true,
          parsed_version: "0.147.0",
          version_status: "compatible",
          binary_path: "/usr/local/bin/codex",
          private_runtime_payload: "private"
        }
      },
      settings_control_center: {
        status_summary: {
          model_access: "ready",
          agent_package_functional_health: "18/25",
          issue_count: 1,
          internal_issue_payload: "private"
        },
        app_settings_read_model: {
          surface_kind: "opl_app_settings_read_model.v1",
          opl_gateway_account: {
            surface_kind: "opl_gateway_account_read_model.v1",
            connection_mode: "account",
            status: "connected",
            account_card_visible: true,
            account: {
              display_name: "OPL User",
              email: "opl@example.com",
              status: "active",
              balance: { amount: 128.4, currency: "CNY", internal_ledger: "private" },
              credential: "private"
            },
            usage: { today_tokens: 32000, currency: "CNY", raw_events: ["private"] },
            managed_key: { name: "OPL App · Test", status: "active", secret: "private" },
            installation: { device_label: "Test Mac", short_id: "ABC123", host_token: "private" },
            freshness: { observed_at: "2026-08-09T03:39:22.845Z", stale: false, raw_error: "private" },
            actions: { disconnect: "gateway_account_disconnect" }
          },
          codex_model_policy: {
            model: "gpt-5.6-sol",
            reasoning_effort: "max",
            provider_name: "OPL Gateway",
            api_key_present: true,
            api_key: "private"
          },
          local_environment: {
            state_dir: "/state",
            logs_dir: "/logs",
            private_environment: "private"
          },
          connections: {
            connections: [{
              connection_id: "external",
              name: "External",
              endpoint: "https://example.com",
              status: "ready",
              credential_handle: "credential-store:private"
            }]
          }
        }
      }
    }
  });

  const state = compact.app_state;
  const readModel = state.settings_control_center.app_settings_read_model;
  assert.equal(readModel.opl_gateway_account.account.display_name, "OPL User");
  assert.equal(readModel.opl_gateway_account.account.email, "opl@example.com");
  assert.equal(readModel.opl_gateway_account.account.balance.amount, 128.4);
  assert.equal(readModel.opl_gateway_account.usage.today_tokens, 32000);
  assert.equal(readModel.opl_gateway_account.managed_key.name, "OPL App · Test");
  assert.equal(state.core.codex.parsed_version, "0.147.0");
  assert.equal(readModel.codex_model_policy.model, "gpt-5.6-sol");
  assert.equal(readModel.local_environment.logs_dir, "/logs");
  assert.equal(readModel.connections.connections[0].name, "External");
  const projected = JSON.stringify(compact);
  for (const privateMarker of ["credential_handle", "api_key\"", "internal_ledger", "raw_events", "host_token", "raw_error", "private_runtime_payload", "internal_issue_payload"]) {
    assert.equal(projected.includes(privateMarker), false, `must omit ${privateMarker}`);
  }
  assert.equal("actions" in readModel.opl_gateway_account, false);
});

test("fast state keeps the complete package catalog and bounded runtime control projection", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    package_id: `package-${index}`,
    display_name: `Package ${index}`,
    publisher: index < 9 ? "one-person-lab" : "OpenAI",
    package_role: "standard_agent",
    installed: true,
    activated: true,
    readiness: { status: "ready", private: "private" },
    package_currentness: { status: "unknown", internal: "private" },
    available_actions: []
  }));
  const compact = compactFastState({
    app_state: {
      actions: [{
        action_id: "provider_scheduler_status",
        label: "Read scheduler status",
        route: "opl app action execute --action provider_scheduler_status",
        payload_fields: [],
        dry_run_supported: true,
        confirmation_required: false,
        danger_level: "none"
      }],
      agent_packages: {
        directory: { status: "available", entry_count: entries.length, entries },
        status_index: { packages: {} }
      },
      provider: {
        status: "ready",
        temporal: {
          status: "ready",
          ready: true,
          management: { owner_surface: "opl app action execute", actions: ["provider_scheduler_status"] },
          details: {
            address: "127.0.0.1:7233",
            worker_readiness: {
              readiness_status: "ready",
              worker_ready: true,
              temporal_service_lifecycle: { supervisor: { status: "loaded_running", ready: true, database_path: "/private" } }
            },
            scheduler: { status: "attention_needed", ready: false, internal_history: "private" }
          }
        }
      },
      runtime_source_carriers: {
        summary: { default_carriers_count: 1, present_default_carriers_count: 1, healthy_default_carriers_count: 1 },
        items: [{ package_id: "mas", label: "Med Auto Science", source_health_status: "ready", source_path: "/private", git: { sync_status: "synced", dirty: false, head_sha: "private" } }]
      }
    }
  });

  assert.equal(compact.app_state.agent_packages.directory.entries.length, 12);
  assert.equal(compact.app_state.actions[0].confirmation_required, false);
  assert.equal(compact.app_state.provider.temporal.details.scheduler.status, "attention_needed");
  assert.equal(compact.app_state.runtime_source_carriers.items[0].git.sync_status, "synced");
  const serialized = JSON.stringify(compact);
  for (const marker of ["database_path", "internal_history", "source_path", "head_sha"]) {
    assert.equal(serialized.includes(marker), false, `must omit ${marker}`);
  }
});
