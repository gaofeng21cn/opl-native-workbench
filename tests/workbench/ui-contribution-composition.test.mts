import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  OPL_UI_CONTRIBUTION_SLOTS,
  createOplContributionActionRequest,
  createOplContributionReadInput,
  groupSettingsContributions,
  readChannelAccessResult,
  readUiContributionsProjection,
  settingsContributionDestination,
  type OplUiContributionsProjection
} from "../../src/composition/contributionProjection.ts";

(globalThis as typeof globalThis & { __OPL_CODEX_MODEL_POLICY__?: unknown }).__OPL_CODEX_MODEL_POLICY__ = {
  source: "test-fixture",
  defaultModel: "codex-fixture",
  defaultReasoningEffort: "high",
  visibleModels: [{ id: "codex-fixture", label_zh: "Fixture", label_en: "Fixture" }],
  reasoningEfforts: ["high"],
  autoLabel: { zh: "自动（推荐）", en: "Auto (recommended)" },
  knownModelReasoningEffortOverrides: { "codex-fixture": "high" },
  acceptUnknownCatalogDefault: true,
  useHighestSupportedReasoningForUnknown: true
};

const { normalizeContributionReadback } = await import("../../src/bridge/oplBridge.ts");
const { OplStudioDshSlotHost } = await import("../../src/composition/dshSlotHost.tsx");
const { buildActivityLogSummary } = await import("../../src/composition/contributionComponents.tsx");
const { resolveCodexModelOptions } = await import("../../src/workbench/modelPolicy.ts");

const projectionState = {
  app_state: {
    ui_contributions: {
      surface_kind: "opl_app_ui_contributions_projection.v1",
      entries: [{
        contribution_key: "mas:research-roadmap",
        contribution_id: "research-roadmap",
        package_id: "mas",
        slot: "runtime.detail",
        contribution_kind: "view",
        trust_tier: "declarative",
        scope: "work_item",
        sort_order: 20,
        view: {
          view_id: "roadmap",
          view_type: "task_board",
          title_i18n: { "en-US": "Research roadmap", "zh-CN": "研究路线图" },
          data_ref: "mas.research-roadmap.v1#current",
          command_ids: ["refresh"],
          badge_ids: ["health"]
        },
        commands: [{
          command_id: "refresh",
          label_i18n: { "en-US": "Refresh" },
          action_ref: "mas.research-roadmap.v1#refresh",
          confirmation_required: false
        }],
        badges: [{
          badge_id: "health",
          label_i18n: { "en-US": "Ready" },
          data_ref: "mas.research-roadmap.v1#health",
          tone: "success"
        }]
      }, {
        contribution_key: "mag:grant-actions",
        contribution_id: "grant-actions",
        package_id: "mag",
        slot: "composer.palette",
        contribution_kind: "command_group",
        trust_tier: "trusted_first_party_renderer",
        scope: "root",
        sort_order: 10,
        plugin_discovery: "forbidden",
        plugin_install: "forbidden",
        registry: "forbidden",
        currentness: "forbidden",
        release_operation: "forbidden",
        task_truth: "forbidden",
        package_truth: "forbidden",
        product_truth: "forbidden",
        commands: [{
          command_id: "start",
          label_i18n: { "en-US": "Start grant" },
          action_ref: "mag.grant.v1#start",
          confirmation_required: true
        }],
        badges: []
      }, {
        contribution_key: "forged:identity",
        contribution_id: "grant-actions",
        package_id: "mag",
        slot: "settings.section",
        contribution_kind: "command_group",
        trust_tier: "declarative",
        scope: "root",
        sort_order: 15,
        commands: [],
        badges: []
      }, {
        contribution_key: "hostile:overlay",
        contribution_id: "overlay",
        package_id: "hostile",
        slot: "shell.overlay",
        contribution_kind: "command_group",
        trust_tier: "trusted_first_party_renderer",
        scope: "root",
        sort_order: 0,
        component: "arbitrary-component",
        commands: [{
          command_id: "execute",
          label_i18n: { "en-US": "Execute" },
          action_ref: "hostile.overlay.v1#execute",
          confirmation_required: false,
          handler: "arbitrary-handler"
        }],
        badges: []
      }]
    }
  }
};

describe("OPL Studio DSH contribution composition", () => {
  test("routes settings contributions by declared view semantics", () => {
    expect(settingsContributionDestination({ view: { viewId: "wechat", viewType: "channel_access", title: {}, dataRef: "wechat#state" } })).toBe("resources");
    expect(settingsContributionDestination({ view: { viewId: "fleet", viewType: "activity_log", title: {}, dataRef: "fleet#state" } })).toBe("services");
    expect(settingsContributionDestination({ view: { viewId: "capability", viewType: "table", title: {}, dataRef: "capability#state" } })).toBe("capabilities");
  });

  test("groups settings views by their dynamically projected Package identity", () => {
    const projection = readUiContributionsProjection({
      ui_contributions: {
        surface_kind: "opl_app_ui_contributions_projection.v1",
        entries: [
          {
            contribution_key: "opl-fleet-agent:telemetry",
            contribution_id: "telemetry",
            package_id: "opl-fleet-agent",
            slot: "settings.section",
            contribution_kind: "view",
            trust_tier: "declarative",
            scope: "root",
            sort_order: 10,
            view: { view_id: "fleet.telemetry", view_type: "activity_log", title_i18n: { "en-US": "Telemetry" }, data_ref: "fleet.telemetry#current" },
            commands: [],
            badges: []
          },
          {
            contribution_key: "opl-fleet-agent:doctor",
            contribution_id: "doctor",
            package_id: "opl-fleet-agent",
            slot: "settings.section",
            contribution_kind: "view",
            trust_tier: "declarative",
            scope: "root",
            sort_order: 20,
            view: { view_id: "fleet.doctor", view_type: "activity_log", title_i18n: { "en-US": "Doctor" }, data_ref: "fleet.doctor#current" },
            commands: [],
            badges: []
          },
          {
            contribution_key: "opl-channel-weixin:access",
            contribution_id: "access",
            package_id: "opl-channel-weixin",
            slot: "settings.section",
            contribution_kind: "view",
            trust_tier: "declarative",
            scope: "root",
            sort_order: 30,
            view: { view_id: "weixin.access", view_type: "channel_access", title_i18n: { "en-US": "WeChat" }, data_ref: "weixin.access#current" },
            commands: [],
            badges: []
          }
        ]
      }
    });
    const groups = groupSettingsContributions(projection.entries.filter((entry) => settingsContributionDestination(entry) === "services"));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ packageId: "opl-fleet-agent" });
    expect(groups[0]?.entries.map((entry) => entry.contributionId)).toEqual(["telemetry", "doctor"]);
  });

  test("summarizes generic activity-log data without exposing operational payload fields by default", () => {
    const summary = buildActivityLogSummary({
      freshness: { state: "fresh", last_observed_at: "2026-08-19T02:43:36.431Z" },
      native_carrier: { availability: "available", status: "ready" },
      node: { display_name: "Local development Mac", platform: "macOS" },
      observed_at: "2026-08-19T02:43:38.533Z",
      payload: {
        collection_status: "available",
        active_conversation_count: 7,
        host_cpu_percent: 61.0465,
        checks: [
          { check_id: "provider", state: "pass" },
          { check_id: "collection", state: "pass" },
          { check_id: "optional-source", state: "unavailable" }
        ]
      }
    }, "zh");
    expect(summary).toMatchObject({ state: "done", statusLabel: "运行正常" });
    expect(summary.fields).toEqual(expect.arrayContaining([
      { id: "location", label: "本机", value: "Local development Mac · macOS" },
      { id: "collection", label: "数据状态", value: "可用" },
      { id: "active-conversations", label: "活跃对话", value: "7" },
      { id: "checks", label: "检查结果", value: "2 项通过，1 项暂不可用" }
    ]));
    expect(JSON.stringify(summary)).not.toContain("host_cpu_percent");
    expect(JSON.stringify(summary)).not.toContain("check_id");
  });

  test("registers each static list-slot occupant with a stable id", () => {
    const host = new OplStudioDshSlotHost();
    expect(host.core.entries("shell.overlay")).toHaveLength(1);
    expect(host.core.snapshot("shell.overlay")[0]?.occupants[0]?.id).toBe("opl-studio-overlay");
    expect(host.core.entries("conversation.input.dock")).toHaveLength(1);
    expect(host.core.snapshot("conversation.input.dock")[0]?.occupants[0]).toMatchObject({
      id: "queue",
      order: 20,
      registrant: "dsh-ui-conversation"
    });
  });

  test("normalizes Framework projection without importing executable plugin fields", () => {
    const projection = readUiContributionsProjection(projectionState);
    expect(OPL_UI_CONTRIBUTION_SLOTS).toEqual(["composer.palette", "runtime.detail", "settings.section"]);
    expect(projection.surfaceKind).toBe("opl_app_ui_contributions_projection.v1");
    expect(projection.entries.map((entry) => entry.contributionKey)).toEqual([
      "mag:grant-actions",
      "mas:research-roadmap"
    ]);
    expect(projection.entries[1]?.view?.dataRef).toBe("mas.research-roadmap.v1#current");
    expect(projection.entries[1]?.commands[0]?.actionRef).toBe("mas.research-roadmap.v1#refresh");
    expect(Object.keys(projection.entries[1]?.commands[0] ?? {}).sort()).toEqual([
      "actionRef",
      "commandId",
      "confirmationRequired",
      "label"
    ]);
    expect(projection.entries.some((entry) => entry.contributionKey === "hostile:overlay")).toBe(false);
    expect(projection.entries.some((entry) => entry.contributionKey === "forged:identity")).toBe(false);
    expect(JSON.stringify(projection)).not.toMatch(/component|handler|javascript|html|url|plugin|registry|currentness|release_operation|task_truth|package_truth|product_truth/i);
  });

  test("uses DSH registration and disposer lifecycle for projection changes", () => {
    const host = new OplStudioDshSlotHost();
    const projection = readUiContributionsProjection(projectionState);
    host.replaceHostDerivedProjection(projection);

    expect(host.core.entries("runtime.detail")).toHaveLength(1);
    expect(host.core.entries("composer.palette")).toHaveLength(1);
    expect(host.core.snapshot("runtime.detail")[0]?.occupants[0]?.registrant).toBe("mas");

    host.replaceHostDerivedProjection({
      surfaceKind: "opl_app_ui_contributions_projection.v1",
      entries: projection.entries.filter((entry) => entry.slot === "runtime.detail")
    });
    expect(host.core.entries("composer.palette")).toHaveLength(0);
    expect(host.core.entries("runtime.detail")).toHaveLength(1);

    host.clearProjection();
    expect(host.core.entries("runtime.detail")).toHaveLength(0);
  });

  test("contains a failed contribution at its DSH entry boundary", () => {
    const host = new OplStudioDshSlotHost();
    host.replaceHostDerivedProjection(readUiContributionsProjection(projectionState));
    const entry = host.core.entries("runtime.detail")[0];
    expect(entry).toBeDefined();

    host.core.reportEntryError("runtime.detail", entry!, new Error("fixture crash"), { abdicate: true });
    expect(host.core.entries("runtime.detail")).toHaveLength(1);
    expect(host.core.entriesOfSlot("runtime.detail")).toHaveLength(0);
    expect(host.core.entriesOfSlot("composer.palette")).toHaveLength(1);
    host.clearProjection();
  });

  test("keeps malformed or absent projections unavailable", () => {
    const unavailable: OplUiContributionsProjection = readUiContributionsProjection({ app_state: {} });
    expect(unavailable).toEqual({ surfaceKind: "unavailable", entries: [] });
  });

  test("validates channel_access results and preserves only scoped contribution action input", () => {
    const result = readChannelAccessResult({
      schema_version: "opl-app-channel-access.v1",
      status: "available",
      channel_id: "weixin",
      connection: {
        state: "qr_ready",
        qr_challenge: { payload: "data:image/png;base64,fixture", expires_at_ms: 2_000 }
      },
      actions: [{ command_id: "disconnect", input: { channel_id: "weixin" } }],
      pending_pairings: [{
        pairing_id: "pairing-1",
        display_name: "Researcher",
        requested_at_ms: 1_000,
        expires_at_ms: 3_000,
        actions: [{ command_id: "approve", input: { channel_id: "weixin", pairing_id: "pairing-1" } }]
      }],
      authorized_users: [{
        user_id: "user-1",
        display_name: "Editor",
        authorized_at_ms: 900,
        actions: [{ command_id: "revoke", input: { channel_id: "weixin", user_id: "user-1" } }]
      }],
      refresh_after_ms: 1_000
    });
    expect(result?.channelId).toBe("weixin");
    expect(result?.pendingPairings[0]?.actions[0]?.input).toEqual({ channel_id: "weixin", pairing_id: "pairing-1" });
    expect(result?.authorizedUsers[0]?.actions[0]?.input).toEqual({ channel_id: "weixin", user_id: "user-1" });

    const projection = readUiContributionsProjection(projectionState);
    const entry = projection.entries[0]!;
    const command = entry.commands[0]!;
    expect(createOplContributionActionRequest(entry, command, true, { channel_id: "weixin" }).payload).toEqual({
      package_id: entry.packageId,
      ref: command.actionRef,
      input: { channel_id: "weixin" },
      confirmed: true
    });
    expect(createOplContributionReadInput(projection.entries.find((candidate) => candidate.slot === "runtime.detail")!, {
      agentId: "mas",
      domainId: "medautoscience",
      workItemId: "002-dm-china-us-mortality-attribution",
      domainWorkItemId: "002-dm-china-us-mortality-attribution",
      workItemScopeId: "project:test:002-dm-china-us-mortality-attribution",
      identityState: "resolved"
    })).toEqual({
      work_item_identity: {
        agent_id: "mas",
        domain_id: "medautoscience",
        work_item_id: "002-dm-china-us-mortality-attribution",
        domain_work_item_id: "002-dm-china-us-mortality-attribution",
        work_item_scope_id: "project:test:002-dm-china-us-mortality-attribution",
        identity_state: "resolved"
      }
    });
    expect(readChannelAccessResult({
      schema_version: "opl-app-channel-access.v1",
      status: "available",
      channel_id: "weixin",
      connection: { state: "connected" },
      actions: [{ command_id: "disconnect", input: { channel_id: "weixin", secret: "forbidden" } }],
      pending_pairings: [],
      authorized_users: []
    })).toBeNull();
    expect(readChannelAccessResult({
      schema_version: "opl-app-channel-access.v1",
      status: "available",
      channel_id: "weixin",
      connection: { state: "connected" },
      actions: [],
      pending_pairings: [{
        pairing_id: "pairing-1",
        requested_at_ms: 1_000,
        expires_at_ms: 3_000,
        actions: [{ command_id: "approve", input: { channel_id: "weixin", user_id: "wrong-scope" } }]
      }],
      authorized_users: []
    })).toBeNull();
    expect(readChannelAccessResult({
      schema_version: "opl-app-channel-access.v1",
      status: "unavailable",
      channel_id: "weixin",
      unavailable_reason: "producer_absent",
      refresh_after_ms: 1_000
    })).toBeNull();
  });

  test("collapses alias-linked catalog rows into one App-owned model option", () => {
    const options = resolveCodexModelOptions([{
      id: "codex-fixture",
      model: "codex-fixture-canonical",
      displayName: "Legacy alias",
      isDefault: false,
      defaultReasoningEffort: "high",
      supportedReasoningEfforts: ["high"]
    }, {
      id: "codex-fixture-canonical",
      model: "codex-fixture-current",
      displayName: "Current catalog default",
      isDefault: true,
      defaultReasoningEffort: "high",
      supportedReasoningEfforts: ["high"]
    }]);

    expect(options.map((option) => option.id)).toEqual(["codex-fixture"]);
    expect(options[0]).toMatchObject({ known: true, isCatalogDefault: true, available: true });
  });

  test("accepts only the current Framework contribution read identity", () => {
    const request = { packageId: "mas", ref: "mas.research-roadmap.v1#current" };
    const response = {
      command: "opl app contribution read",
      exitCode: 0,
      stdout: JSON.stringify({
        opl_app_contribution: {
          surface_kind: "opl_app_package_contribution.v1",
          package_id: request.packageId,
          ref: request.ref,
          operation: "read",
          response: {
            schema_version: "opl-package-app-contribution-response.v1",
            ok: true,
            ref: request.ref,
            operation: "read",
            result: { hypotheses: ["Current hypothesis"], roadmap: ["Validate"] }
          }
        }
      })
    };
    expect(normalizeContributionReadback(response, request).result).toEqual({
      hypotheses: ["Current hypothesis"],
      roadmap: ["Validate"]
    });
    expect(() => normalizeContributionReadback(response, { ...request, ref: "mas.research-roadmap.v1#stale" })).toThrow(/stale or malformed/);
  });

  test("renders non-image channel payloads with the maintained QR component", () => {
    const source = readFileSync(
      new URL("../../src/composition/contributionComponents.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toMatch(/import \{ QRCodeSVG \} from "qrcode\.react"/);
    expect(source).toMatch(/<QRCodeSVG/);
    expect(source).toMatch(/value=\{qr\.payload\}/);
    expect(source).not.toMatch(/<code>\{qr\.payload\}<\/code>/);
  });
});
