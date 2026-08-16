import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRunDetailViewModel,
  buildRuntimeDetailResultViewModel
} from "../../src/workbench/runDetailModel.ts";
import type { ArtifactPreview, WorkbenchArtifactRef } from "../../src/workbench/workbenchModel.ts";

const inputFile: WorkbenchArtifactRef = {
  id: "input-a",
  title: "Input A",
  kind: "file",
  status: "ready",
  previewKind: "markdown",
  ref: "attachment://input-a",
  summary: "Input for this thread",
  provenance: [],
  actions: []
};

const result: ArtifactPreview = {
  id: "result-a",
  label: "Result A",
  previewKind: "markdown",
  rendererModuleId: "markdown",
  title: "Result A",
  ref: "artifact://result-a",
  summary: "Result for this work item"
};

test("run detail keeps files, results, active lines, and modules inside the selected identity", () => {
  const viewModel = buildRunDetailViewModel({
    thread: { id: "thread-a", status: "active", agentRole: "researcher" },
    workItemId: "work-a",
    running: true,
    activeLines: [{
      status: "running",
      activeRunId: "work-a",
      nextVisibleStep: "Validate hypothesis",
      progressDeltaClassification: "analysis",
      deliverableProgressDelta: "draft updated",
      platformRepairDelta: "none",
      nextForcedDelta: "review"
    }, {
      status: "running",
      activeRunId: "work-b",
      nextVisibleStep: "Other work",
      progressDeltaClassification: "analysis",
      deliverableProgressDelta: "none",
      platformRepairDelta: "none",
      nextForcedDelta: "review"
    }],
    files: [
      { scope: "thread", threadId: "thread-a", value: inputFile },
      { scope: "thread", threadId: "thread-b", value: { ...inputFile, id: "other-input" } }
    ],
    results: [
      { scope: "work_item", threadId: "thread-a", workItemId: "work-a", value: result },
      { scope: "work_item", threadId: "thread-a", workItemId: "work-b", value: { ...result, id: "other-result" } }
    ],
    contributions: {
      surfaceKind: "opl_app_ui_contributions_projection.v1",
      entries: [{
        contributionKey: "mas:roadmap",
        contributionId: "roadmap",
        packageId: "mas",
        slot: "runtime.detail",
        contributionKind: "view",
        trustTier: "declarative",
        scope: "work_item",
        sortOrder: 10,
        view: { viewId: "roadmap", viewType: "task_board", title: { en: "Roadmap" }, dataRef: "mas.roadmap#current" },
        commands: [],
        badges: []
      }, {
        contributionKey: "future:unknown",
        contributionId: "unknown",
        packageId: "future",
        slot: "runtime.detail",
        contributionKind: "future_kind",
        trustTier: "declarative",
        scope: "root",
        sortOrder: 20,
        commands: [],
        badges: []
      }]
    }
  });

  assert.equal(viewModel.status.state, "running");
  assert.equal(viewModel.status.agentLabel, "researcher");
  assert.deepEqual(viewModel.status.activeLines.map((line) => line.activeRunId), ["work-a"]);
  assert.deepEqual(viewModel.files.map((file) => file.id), ["input-a"]);
  assert.deepEqual(viewModel.results.map((item) => item.id), ["result-a"]);
  assert.deepEqual(viewModel.runtimeDetails.map((item) => item.state), ["ready", "unsupported"]);
  assert.equal(viewModel.runtimeDetails[1]?.fallbackReason, "unknown_contribution_kind");
});
test("work-item modules and results stay hidden without an explicit work-item identity", () => {
  const viewModel = buildRunDetailViewModel({
    thread: { id: "thread-a", status: "idle" },
    running: false,
    activeLines: [],
    files: [],
    results: [{ scope: "work_item", workItemId: "work-a", value: result }],
    contributions: {
      surfaceKind: "opl_app_ui_contributions_projection.v1",
      entries: [{
        contributionKey: "mas:hypotheses",
        contributionId: "hypotheses",
        packageId: "mas",
        slot: "runtime.detail",
        contributionKind: "view",
        trustTier: "declarative",
        scope: "work_item",
        sortOrder: 10,
        view: { viewId: "hypotheses", viewType: "list_detail", title: { en: "Hypotheses" }, dataRef: "mas.hypotheses#current" },
        commands: [],
        badges: []
      }]
    }
  });

  assert.equal(viewModel.status.state, "idle");
  assert.deepEqual(viewModel.results, []);
  assert.deepEqual(viewModel.runtimeDetails, []);
});

test("selected runtime work item supplies the detail agent and lifecycle status", () => {
  const viewModel = buildRunDetailViewModel({
    thread: { id: "thread-a", status: "active", agentRole: "Codex" },
    workItem: {
      workItemId: "work-a",
      status: "delivered_paused",
      agentDisplayName: "Med Auto Science",
      executionState: "idle"
    },
    workItemId: "work-a",
    running: true,
    activeLines: [],
    files: [],
    results: [],
    contributions: { surfaceKind: "opl_app_ui_contributions_projection.v1", entries: [] }
  });

  assert.equal(viewModel.status.state, "idle");
  assert.equal(viewModel.status.sourceStatus, "delivered_paused");
  assert.equal(viewModel.status.agentLabel, "Med Auto Science");
});

test("a new task reports an idle Codex run instead of an unavailable runtime", () => {
  const viewModel = buildRunDetailViewModel({
    thread: null,
    running: false,
    activeLines: [],
    files: [],
    results: [],
    contributions: {
      surfaceKind: "opl_app_ui_contributions_projection.v1",
      entries: []
    }
  });

  assert.equal(viewModel.status.state, "idle");
  assert.equal(viewModel.status.sourceStatus, "idle");
  assert.equal(viewModel.status.agentLabel, "Codex");
});

const masRuntimeDetail = {
  surface_kind: "mas_runtime_detail_contribution",
  version: "mas-runtime-detail-contribution.v1",
  identity: {
    agent_id: "mas",
    domain_id: "medautoscience",
    work_item_id: "002-dm-china-us-mortality-attribution",
    study_id: "002-dm-china-us-mortality-attribution",
    identity_state: "resolved",
    scope_binding: "work_item_id_exact_study_id"
  },
  agent: {
    agent_id: "mas",
    display_name: "Med Auto Science",
    authority_owner: "MedAutoScience"
  },
  current_owner: "user",
  phase: {
    business_status: "delivered_paused",
    lifecycle_state: "delivered_paused",
    stage_id: null,
    stage_status: null
  },
  work: {
    active: [],
    queued: [],
    pending: [{
      action_id: "complete_submission_metadata_or_wake_for_revision",
      action_type: "user_action",
      owner: "user",
      status: "waiting"
    }]
  },
  hypotheses: [{
    hypothesis_id: "hypothesis-transportability",
    status: "supported",
    label: "风险排序假设",
    summary: "排序部分保留"
  }],
  roadmap: {
    trajectory_revision: 3,
    trajectory_status: "active",
    current_focus: {
      node_id: "route-authoring",
      primary_hypothesis: "排序可转运但绝对风险不能直接转运"
    },
    active_branch: {
      branch_id: "branch-revision",
      label: "论文修订路线"
    },
    current_judgment: "受限转运性结论",
    next_research_step: "独立审阅后修订论文"
  },
  authority_boundary: {
    projection_only: true,
    writes_domain_truth: false,
    writes_runtime_state: false,
    provider_completion_is_progress: false
  }
};

test("runtime detail maps the canonical MAS response into declarative sections", () => {
  const viewModel = buildRuntimeDetailResultViewModel(masRuntimeDetail);

  assert.equal(viewModel.state, "ready");
  if (viewModel.state !== "ready") return;
  assert.deepEqual(viewModel.sections.map((section) => section.id), [
    "identity",
    "agent",
    "phase",
    "work.active",
    "work.queued",
    "work.pending",
    "hypotheses",
    "roadmap"
  ]);
  const pending = viewModel.sections.find((section) => section.id === "work.pending");
  assert.equal(pending?.kind, "list");
  if (pending?.kind === "list") {
    assert.equal(pending.items[0]?.id, "complete_submission_metadata_or_wake_for_revision");
  }
  const hypotheses = viewModel.sections.find((section) => section.id === "hypotheses");
  assert.equal(hypotheses?.kind, "list");
  if (hypotheses?.kind === "list") {
    assert.equal(hypotheses.items[0]?.id, "hypothesis-transportability");
  }
  const roadmap = viewModel.sections.find((section) => section.id === "roadmap");
  assert.equal(roadmap?.kind, "rows");
  if (roadmap?.kind === "rows") {
    assert.equal(roadmap.rows.find((row) => row.id === "trajectory_revision")?.value, 3);
    assert.equal(roadmap.rows.find((row) => row.id === "active_branch.label")?.value, "论文修订路线");
  }
});

test("runtime detail accepts standard read and execute response wrappers", () => {
  const response = {
    schema_version: "opl-package-app-contribution-response.v1",
    ok: true,
    ref: "mas.runtime-detail.v1#current",
    operation: "read",
    result: masRuntimeDetail
  };

  assert.equal(buildRuntimeDetailResultViewModel(response).state, "ready");
  assert.equal(buildRuntimeDetailResultViewModel({
    stdoutJson: {
      opl_app_contribution: {
        response
      }
    }
  }).state, "ready");
});

test("runtime detail returns unavailable diagnostics instead of inventing missing business data", () => {
  const missingHypotheses = buildRuntimeDetailResultViewModel({
    ...masRuntimeDetail,
    hypotheses: undefined
  });
  assert.deepEqual(missingHypotheses, {
    state: "unavailable",
    diagnostic: {
      code: "invalid_hypotheses",
      message: "hypotheses must be an array"
    },
    sections: []
  });

  const mismatchedIdentity = buildRuntimeDetailResultViewModel({
    ...masRuntimeDetail,
    identity: {
      ...masRuntimeDetail.identity,
      study_id: "another-study"
    }
  });
  assert.equal(mismatchedIdentity.state, "unavailable");
  if (mismatchedIdentity.state === "unavailable") {
    assert.equal(mismatchedIdentity.diagnostic.code, "invalid_identity");
    assert.deepEqual(mismatchedIdentity.sections, []);
  }

  const writableProjection = buildRuntimeDetailResultViewModel({
    ...masRuntimeDetail,
    authority_boundary: {
      ...masRuntimeDetail.authority_boundary,
      writes_runtime_state: true
    }
  });
  assert.equal(writableProjection.state, "unavailable");
  if (writableProjection.state === "unavailable") {
    assert.equal(writableProjection.diagnostic.code, "invalid_authority_boundary");
  }
});

test("runtime detail rejects producer errors and unrelated surfaces", () => {
  const producerError = buildRuntimeDetailResultViewModel({
    ok: false,
    error: {
      code: "mas_runtime_detail_contribution_invalid",
      message: "input.work_item_identity is unresolved"
    }
  });
  assert.equal(producerError.state, "unavailable");
  if (producerError.state === "unavailable") {
    assert.equal(producerError.diagnostic.code, "producer_error");
  }

  const unrelated = buildRuntimeDetailResultViewModel({ surface_kind: "other_surface" });
  assert.equal(unrelated.state, "unavailable");
  if (unrelated.state === "unavailable") {
    assert.equal(unrelated.diagnostic.code, "unsupported_surface");
    assert.deepEqual(unrelated.sections, []);
  }
});
