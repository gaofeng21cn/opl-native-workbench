import type {
  OplUiContribution,
  OplUiContributionsProjection
} from "../composition/contributionProjection";
import type {
  ActiveProjectLine,
  ArtifactPreview,
  WorkItemRuntimeItem,
  WorkbenchArtifactRef,
  WorkbenchThreadItem
} from "./workbenchModel";

export type RunDetailIdentity = {
  threadId?: string;
  workItemId?: string;
};

type RootScope = { scope: "root" };
type ThreadScope = { scope: "thread"; threadId: string };
type WorkItemScope = { scope: "work_item"; workItemId: string; threadId?: string };
export type RunDetailItemScope = RootScope | ThreadScope | WorkItemScope;

export type ScopedRunDetailItem<Value> = RunDetailItemScope & {
  value: Value;
};

export type RunDetailStatus = {
  state: "running" | "idle" | "attention" | "unavailable";
  sourceStatus: string;
  agentLabel: string;
  threadId?: string;
  workItemId?: string;
  activeLines: ActiveProjectLine[];
};

export type RuntimeDetailModuleViewModel = {
  contribution: OplUiContribution;
  state: "ready" | "unsupported";
  fallbackReason?: "unknown_contribution_kind" | "missing_view_descriptor";
};

export type RunDetailViewModel = {
  identity: RunDetailIdentity;
  status: RunDetailStatus;
  files: WorkbenchArtifactRef[];
  results: ArtifactPreview[];
  runtimeDetails: RuntimeDetailModuleViewModel[];
};

export type RunDetailModelInput = {
  thread?: Pick<WorkbenchThreadItem, "id" | "status" | "agentNickname" | "agentRole"> | null;
  workItem?: Pick<WorkItemRuntimeItem, "workItemId" | "status" | "agentDisplayName" | "executionState"> | null;
  workItemId?: string;
  running: boolean;
  activeLines: ActiveProjectLine[];
  files: ScopedRunDetailItem<WorkbenchArtifactRef>[];
  results: ScopedRunDetailItem<ArtifactPreview>[];
  contributions: OplUiContributionsProjection;
};

export type RuntimeDetailScalar = string | number | boolean | null;

export type RuntimeDetailRow = {
  id: string;
  value: RuntimeDetailScalar;
};

export type RuntimeDetailListItem = {
  id: string;
  rows: RuntimeDetailRow[];
};

export type RuntimeDetailSection = {
  id: "identity" | "agent" | "phase" | "work.active" | "work.queued" | "work.pending" | "hypotheses" | "roadmap";
} & (
  | { kind: "rows"; rows: RuntimeDetailRow[] }
  | { kind: "list"; items: RuntimeDetailListItem[] }
);

export type RuntimeDetailDiagnosticCode =
  | "not_object"
  | "producer_error"
  | "unsupported_surface"
  | "unsupported_version"
  | "invalid_identity"
  | "invalid_agent"
  | "invalid_phase"
  | "invalid_work"
  | "invalid_hypotheses"
  | "invalid_roadmap"
  | "invalid_authority_boundary";

export type RuntimeDetailResultViewModel =
  | {
    state: "ready";
    surfaceKind: "mas_runtime_detail_contribution";
    version: "mas-runtime-detail-contribution.v1";
    sections: RuntimeDetailSection[];
  }
  | {
    state: "unavailable";
    diagnostic: {
      code: RuntimeDetailDiagnosticCode;
      message: string;
    };
    sections: [];
  };

class RuntimeDetailParseError extends Error {
  constructor(readonly code: RuntimeDetailDiagnosticCode, message: string) {
    super(message);
  }
}

function detailRecord(value: unknown, code: RuntimeDetailDiagnosticCode, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RuntimeDetailParseError(code, message);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, code: RuntimeDetailDiagnosticCode, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new RuntimeDetailParseError(code, message);
  return value;
}

function nullableString(value: unknown, code: RuntimeDetailDiagnosticCode, message: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new RuntimeDetailParseError(code, message);
  return value;
}

function scalarRows(value: unknown, code: RuntimeDetailDiagnosticCode, message: string): RuntimeDetailRow[] {
  const record = detailRecord(value, code, message);
  return Object.entries(record).map(([id, item]) => {
    if (item !== null && typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      throw new RuntimeDetailParseError(code, message);
    }
    return { id, value: item as RuntimeDetailScalar };
  });
}

function listSection(
  id: Extract<RuntimeDetailSection["id"], "work.active" | "work.queued" | "work.pending" | "hypotheses">,
  value: unknown,
  itemIdKeys: string[],
  code: RuntimeDetailDiagnosticCode
): RuntimeDetailSection {
  if (!Array.isArray(value)) {
    throw new RuntimeDetailParseError(code, `${id} must be an array`);
  }
  const seen = new Set<string>();
  const items = value.map((item, index): RuntimeDetailListItem => {
    const record = detailRecord(item, code, `${id} item ${index} must be an object`);
    const itemId = itemIdKeys
      .map((key) => record[key])
      .find((candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim()));
    if (!itemId || seen.has(itemId)) {
      throw new RuntimeDetailParseError(code, `${id} items require unique canonical identifiers`);
    }
    seen.add(itemId);
    return {
      id: itemId,
      rows: scalarRows(record, code, `${id} item ${itemId} contains unsupported data`)
    };
  });
  return { id, kind: "list", items };
}

function unwrapRuntimeDetailResult(input: unknown): Record<string, unknown> {
  const root = detailRecord(input, "not_object", "Runtime detail result must be an object");
  const records: Record<string, unknown>[] = [root];
  const appendRecord = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) records.push(value as Record<string, unknown>);
  };
  appendRecord(root.result);
  appendRecord(root.stdoutJson);
  for (const record of [...records]) {
    appendRecord(record.result);
    const envelope = record.opl_app_contribution;
    if (envelope && typeof envelope === "object" && !Array.isArray(envelope)) {
      appendRecord((envelope as Record<string, unknown>).response);
    }
  }
  for (const record of [...records]) appendRecord(record.result);

  const failed = records.find((record) => record.ok === false);
  if (failed) {
    const error = failed.error && typeof failed.error === "object" && !Array.isArray(failed.error)
      ? failed.error as Record<string, unknown>
      : null;
    const message = typeof error?.message === "string" && error.message.trim()
      ? error.message
      : "Runtime detail producer reported an error";
    throw new RuntimeDetailParseError("producer_error", message);
  }

  const candidate = records.find((record) => record.surface_kind === "mas_runtime_detail_contribution");
  if (!candidate) {
    throw new RuntimeDetailParseError("unsupported_surface", "Result is not a MAS runtime detail contribution");
  }
  return candidate;
}

function roadmapRows(value: unknown): RuntimeDetailRow[] {
  const roadmap = detailRecord(value, "invalid_roadmap", "Roadmap must be an object");
  if (typeof roadmap.trajectory_revision !== "number" || !Number.isFinite(roadmap.trajectory_revision)) {
    throw new RuntimeDetailParseError("invalid_roadmap", "Roadmap revision must be a finite number");
  }
  const rows: RuntimeDetailRow[] = [
    { id: "trajectory_revision", value: roadmap.trajectory_revision },
    { id: "trajectory_status", value: nullableString(roadmap.trajectory_status, "invalid_roadmap", "Roadmap status must be a string or null") },
    { id: "current_judgment", value: nullableString(roadmap.current_judgment, "invalid_roadmap", "Current judgment must be a string or null") },
    { id: "next_research_step", value: nullableString(roadmap.next_research_step, "invalid_roadmap", "Next research step must be a string or null") }
  ];
  for (const key of ["current_focus", "active_branch"] as const) {
    const nested = roadmap[key];
    if (nested === null) {
      rows.push({ id: key, value: null });
      continue;
    }
    for (const row of scalarRows(nested, "invalid_roadmap", `${key} must contain scalar values`)) {
      rows.push({ id: `${key}.${row.id}`, value: row.value });
    }
  }
  return rows;
}

export function buildRuntimeDetailResultViewModel(input: unknown): RuntimeDetailResultViewModel {
  try {
    const result = unwrapRuntimeDetailResult(input);
    if (result.version !== "mas-runtime-detail-contribution.v1") {
      throw new RuntimeDetailParseError("unsupported_version", "MAS runtime detail version is unsupported");
    }

    const identity = detailRecord(result.identity, "invalid_identity", "Runtime detail identity is missing");
    const agentId = nonEmptyString(identity.agent_id, "invalid_identity", "Runtime detail agent identity is invalid");
    const domainId = nonEmptyString(identity.domain_id, "invalid_identity", "Runtime detail domain identity is invalid");
    const workItemId = nonEmptyString(identity.work_item_id, "invalid_identity", "Runtime detail work-item identity is invalid");
    const studyId = nonEmptyString(identity.study_id, "invalid_identity", "Runtime detail study identity is invalid");
    if (
      agentId !== "mas"
      || workItemId !== studyId
      || identity.identity_state !== "resolved"
      || identity.scope_binding !== "work_item_id_exact_study_id"
    ) {
      throw new RuntimeDetailParseError("invalid_identity", "Runtime detail identity is unresolved or mismatched");
    }

    const agent = detailRecord(result.agent, "invalid_agent", "Runtime detail agent is missing");
    if (agent.agent_id !== agentId) {
      throw new RuntimeDetailParseError("invalid_agent", "Runtime detail agent does not match its identity");
    }
    const displayName = nonEmptyString(agent.display_name, "invalid_agent", "Runtime detail agent display name is invalid");
    const authorityOwner = nonEmptyString(agent.authority_owner, "invalid_agent", "Runtime detail agent authority owner is invalid");
    const currentOwner = nullableString(result.current_owner, "invalid_agent", "Runtime detail current owner must be a string or null");

    const phase = detailRecord(result.phase, "invalid_phase", "Runtime detail phase is missing");
    const businessStatus = nonEmptyString(phase.business_status, "invalid_phase", "Business status is invalid");
    const lifecycleState = nonEmptyString(phase.lifecycle_state, "invalid_phase", "Lifecycle state is invalid");
    const stageId = nullableString(phase.stage_id, "invalid_phase", "Stage identity must be a string or null");
    const stageStatus = nullableString(phase.stage_status, "invalid_phase", "Stage status must be a string or null");

    const work = detailRecord(result.work, "invalid_work", "Runtime detail work is missing");
    const authority = detailRecord(result.authority_boundary, "invalid_authority_boundary", "Runtime detail authority boundary is missing");
    if (
      authority.projection_only !== true
      || authority.writes_domain_truth !== false
      || authority.writes_runtime_state !== false
      || authority.provider_completion_is_progress !== false
    ) {
      throw new RuntimeDetailParseError("invalid_authority_boundary", "Runtime detail authority boundary is not read-only");
    }

    return {
      state: "ready",
      surfaceKind: "mas_runtime_detail_contribution",
      version: "mas-runtime-detail-contribution.v1",
      sections: [
        {
          id: "identity",
          kind: "rows",
          rows: [
            { id: "agent_id", value: agentId },
            { id: "domain_id", value: domainId },
            { id: "work_item_id", value: workItemId },
            { id: "study_id", value: studyId },
            { id: "identity_state", value: "resolved" }
          ]
        },
        {
          id: "agent",
          kind: "rows",
          rows: [
            { id: "display_name", value: displayName },
            { id: "authority_owner", value: authorityOwner },
            { id: "current_owner", value: currentOwner }
          ]
        },
        {
          id: "phase",
          kind: "rows",
          rows: [
            { id: "business_status", value: businessStatus },
            { id: "lifecycle_state", value: lifecycleState },
            { id: "stage_id", value: stageId },
            { id: "stage_status", value: stageStatus }
          ]
        },
        listSection("work.active", work.active, ["stage_id"], "invalid_work"),
        listSection("work.queued", work.queued, ["action_id", "stage_id"], "invalid_work"),
        listSection("work.pending", work.pending, ["action_id", "stage_id"], "invalid_work"),
        listSection("hypotheses", result.hypotheses, ["hypothesis_id"], "invalid_hypotheses"),
        { id: "roadmap", kind: "rows", rows: roadmapRows(result.roadmap) }
      ]
    };
  } catch (error) {
    const diagnostic = error instanceof RuntimeDetailParseError
      ? error
      : new RuntimeDetailParseError("unsupported_surface", "Runtime detail result is unavailable");
    return {
      state: "unavailable",
      diagnostic: { code: diagnostic.code, message: diagnostic.message },
      sections: []
    };
  }
}

function isScopedToIdentity(scope: RunDetailItemScope, identity: RunDetailIdentity): boolean {
  if (scope.scope === "root") return true;
  if (scope.scope === "thread") return Boolean(identity.threadId) && scope.threadId === identity.threadId;
  return Boolean(identity.workItemId)
    && scope.workItemId === identity.workItemId
    && (!scope.threadId || scope.threadId === identity.threadId);
}
function runState(running: boolean, sourceStatus: string): RunDetailStatus["state"] {
  if (running) return "running";
  const normalized = sourceStatus.toLowerCase();
  if (/error|failed|blocked|attention|system_error/.test(normalized)) return "attention";
  if (/idle|paused|delivered|completed|stopped|cancelled|ready|notloaded|unloaded/.test(normalized)) return "idle";
  return "unavailable";
}

function runtimeDetailModule(entry: OplUiContribution): RuntimeDetailModuleViewModel {
  if (entry.contributionKind === "command_group") return { contribution: entry, state: "ready" };
  if (entry.contributionKind === "view") {
    return entry.view
      ? { contribution: entry, state: "ready" }
      : { contribution: entry, state: "unsupported", fallbackReason: "missing_view_descriptor" };
  }
  return { contribution: entry, state: "unsupported", fallbackReason: "unknown_contribution_kind" };
}

export function buildRunDetailViewModel(input: RunDetailModelInput): RunDetailViewModel {
  const identity: RunDetailIdentity = {
    ...(input.thread?.id ? { threadId: input.thread.id } : {}),
    ...(input.workItemId ? { workItemId: input.workItemId } : {})
  };
  const sourceStatus = input.workItem?.status ?? input.thread?.status ?? "idle";
  const agentLabel = input.workItem?.agentDisplayName ?? input.thread?.agentNickname ?? input.thread?.agentRole ?? "Codex";
  const running = input.workItem ? input.workItem.executionState === "running" : input.running;

  const runtimeDetails = input.contributions.entries
    .filter((entry) => entry.slot === "runtime.detail")
    .filter((entry) => entry.scope === "root" || (entry.scope === "work_item" && Boolean(identity.workItemId)))
    .map(runtimeDetailModule);

  return {
    identity,
    status: {
      state: runState(running, sourceStatus),
      sourceStatus,
      agentLabel,
      ...identity,
      activeLines: identity.workItemId
        ? input.activeLines.filter((line) => line.activeRunId === identity.workItemId)
        : []
    },
    files: input.files.filter((item) => isScopedToIdentity(item, identity)).map((item) => item.value),
    results: input.results.filter((item) => isScopedToIdentity(item, identity)).map((item) => item.value),
    runtimeDetails
  };
}
