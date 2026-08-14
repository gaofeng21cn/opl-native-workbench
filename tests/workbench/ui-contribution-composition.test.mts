import { describe, expect, test } from "bun:test";
import {
  readUiContributionsProjection,
  type OplUiContributionsProjection
} from "../../src/composition/contributionProjection.ts";

(globalThis as typeof globalThis & { __OPL_CODEX_MODEL_POLICY__?: unknown }).__OPL_CODEX_MODEL_POLICY__ = {
  source: "test-fixture",
  defaultModel: "codex-fixture",
  defaultReasoningEffort: "high",
  visibleModels: [{ id: "codex-fixture", label_zh: "Fixture", label_en: "Fixture" }],
  reasoningEfforts: ["high"],
  knownModelReasoningEffortOverrides: { "codex-fixture": "high" },
  acceptUnknownCatalogDefault: true,
  useHighestSupportedReasoningForUnknown: true
};

const { OplStudioDshSlotHost } = await import("../../src/composition/dshSlotHost.tsx");

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
        commands: [{
          command_id: "start",
          label_i18n: { "en-US": "Start grant" },
          action_ref: "mag.grant.v1#start",
          confirmation_required: true
        }],
        badges: []
      }]
    }
  }
};

describe("OPL Studio DSH contribution composition", () => {
  test("registers each static list-slot occupant with a stable id", () => {
    const host = new OplStudioDshSlotHost();
    expect(host.core.entries("shell.overlay")).toHaveLength(1);
    expect(host.core.snapshot("shell.overlay")[0]?.occupants[0]?.id).toBe("opl-studio-overlay");
  });

  test("normalizes Framework projection without importing executable plugin fields", () => {
    const projection = readUiContributionsProjection(projectionState);
    expect(projection.surfaceKind).toBe("opl_app_ui_contributions_projection.v1");
    expect(projection.entries.map((entry) => entry.contributionKey)).toEqual([
      "mag:grant-actions",
      "mas:research-roadmap"
    ]);
    expect(projection.entries[1]?.view?.dataRef).toBe("mas.research-roadmap.v1#current");
    expect(projection.entries[1]?.commands[0]?.actionRef).toBe("mas.research-roadmap.v1#refresh");
    expect(JSON.stringify(projection)).not.toMatch(/component|javascript|html|url/i);
  });

  test("uses DSH registration and disposer lifecycle for projection changes", () => {
    const host = new OplStudioDshSlotHost();
    const projection = readUiContributionsProjection(projectionState);
    host.replaceProjection(projection);

    expect(host.core.entries("runtime.detail")).toHaveLength(1);
    expect(host.core.entries("composer.palette")).toHaveLength(1);
    expect(host.core.snapshot("runtime.detail")[0]?.occupants[0]?.registrant).toBe("mas");

    host.replaceProjection({
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
    host.replaceProjection(readUiContributionsProjection(projectionState));
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
});
