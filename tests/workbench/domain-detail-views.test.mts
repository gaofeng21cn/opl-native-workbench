import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DOMAIN_DETAIL_VIEW_RENDERER_REGISTRY,
  parseDomainDetailViewReadback,
  parseResearchRoadmapPayload,
  resolveDomainDetailViewRenderer
} from "../../src/workbench/domainDetailViews.tsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const descriptor = {
  itemId: "mas-project:study-001",
  viewId: "research-roadmap",
  viewKind: "research-roadmap",
  title: "Research roadmap",
  schemaRef: "contracts/schemas/v2/mas-research-trajectory-snapshot-v2.schema.json",
  availability: "unread" as const,
  valid: true
};

function payload() {
  return {
    surface_kind: "mas_research_trajectory_snapshot",
    version: "mas-research-trajectory-snapshot.v2",
    study_id: "study-001",
    study_ref: { kind: "mas_study", ref: "mas-study:study-001" },
    revision: 4,
    status: "active",
    summary: {
      primary_hypothesis: "主要假设",
      latest_finding: "现有结果尚不确定。",
      current_judgment: "当前证据不足以作出确定判断。",
      next_research_step: "继续完成预设验证。",
      updated_at: "2026-07-18T00:00:00Z"
    },
    current_focus: { node_id: "hypothesis-1", primary_hypothesis: "主要假设" },
    active_branch: { branch_id: "route-primary", label: "当前科研路线" },
    current_focus_node_refs: ["hypothesis-1"],
    active_branch_node_refs: ["hypothesis-1", "finding-1"],
    nodes: [
      { id: "hypothesis-1", kind: "hypothesis", label: "主要假设", status: "active", summary: "评估主要假设。" },
      { id: "finding-1", kind: "finding", label: "当前发现", status: "inconclusive", summary: "现有结果尚不确定。" }
    ],
    edges: [{ id: "edge-1", source: "finding-1", target: "hypothesis-1", label: "当前结果尚不足以确定该假设是否成立。" }],
    medical_narrative: { title: "科研路线更新" },
    source_refs: [{ kind: "study_protocol", ref: "protocol-1" }],
    conditions: []
  };
}

function readback(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "opl_domain_detail_view.v1",
    surface_kind: "opl_domain_detail_view",
    item_id: descriptor.itemId,
    view_id: descriptor.viewId,
    view_kind: descriptor.viewKind,
    availability: "available",
    revision: 4,
    not_modified: false,
    payload: payload(),
    payload_schema_ref: descriptor.schemaRef,
    conditions: [],
    ...overrides
  };
}

test("research-roadmap renderer parses Framework snapshot fields and graph", () => {
  const parsed = parseResearchRoadmapPayload(payload(), "study-001");
  assert.equal(parsed.summary.primaryHypothesis, "主要假设");
  assert.equal(parsed.summary.latestFinding, "现有结果尚不确定。");
  assert.equal(parsed.summary.currentJudgment, "当前证据不足以作出确定判断。");
  assert.equal(parsed.summary.nextResearchStep, "继续完成预设验证。");
  assert.deepEqual(parsed.nodes.map((node) => node.id), ["hypothesis-1", "finding-1"]);
  assert.deepEqual(parsed.edges.map((edge) => [edge.source, edge.target]), [["finding-1", "hypothesis-1"]]);
  assert.throws(() => parseResearchRoadmapPayload({ ...payload(), version: "wrong.v1" }, "study-001"), /payload_version_invalid/);
  assert.throws(() => parseResearchRoadmapPayload(payload(), "study-002"), /payload_study_id_mismatch/);
});

test("domain detail readback rejects wrong envelope and identity while accepting conditional no-change", () => {
  const valid = parseDomainDetailViewReadback(readback(), descriptor);
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.readback.revision, 4);
    assert.equal(valid.readback.payloadSchemaRef, descriptor.schemaRef);
  }
  assert.deepEqual(
    parseDomainDetailViewReadback(readback({ item_id: "other-item" }), descriptor),
    { ok: false, reason: "readback_item_id_mismatch" }
  );
  assert.deepEqual(
    parseDomainDetailViewReadback(readback({ payload_schema_ref: "wrong.schema.json" }), descriptor),
    { ok: false, reason: "readback_schema_ref_mismatch" }
  );
  const unchanged = parseDomainDetailViewReadback(readback({ not_modified: true, payload: null }), descriptor);
  assert.equal(unchanged.ok, true);
  if (unchanged.ok) assert.equal(unchanged.readback.payload, null);
  assert.deepEqual(
    parseDomainDetailViewReadback(readback({ schema_version: "wrong.v1" }), descriptor),
    { ok: false, reason: "readback_schema_invalid" }
  );
});

test("renderer registry is view-kind keyed and keeps unknown views local", () => {
  assert.equal(resolveDomainDetailViewRenderer("research-roadmap")?.rendererId, "research-roadmap");
  assert.equal(resolveDomainDetailViewRenderer("research_roadmap"), undefined);
  assert.equal(resolveDomainDetailViewRenderer("future_view"), undefined);
  assert.equal(Object.hasOwn(DOMAIN_DETAIL_VIEW_RENDERER_REGISTRY, "research-roadmap"), true);
  assert.equal(Object.hasOwn(DOMAIN_DETAIL_VIEW_RENDERER_REGISTRY, "research_roadmap"), false);
});

test("runtime integration uses descriptor callbacks and does not branch on agent id", () => {
  const runtimePage = fs.readFileSync(path.join(root, "src/workbench/RuntimeOverviewPage.tsx"), "utf8");
  const app = fs.readFileSync(path.join(root, "src/workbench/App.tsx"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src/workbench/domainDetailViews.tsx"), "utf8");
  assert.match(runtimePage, /<DomainDetailViews/);
  assert.match(runtimePage, /readDomainDetailView/);
  assert.match(app, /readDomainDetailView/);
  assert.match(renderer, /domainDetailViewRendererRegistry/);
  assert.doesNotMatch(renderer, /agentId\s*===\s*["']mas["']/);
});
