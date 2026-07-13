import type {
  CodexThreadRuntimeStatus,
  CoordinationDispatchKind,
  CoordinationGuardFailure,
  CoordinationPermissionDecision,
  CoordinationRequest,
  CoordinationThread,
  CoordinationThreadState,
  DynamicToolFunctionSpec
} from "./types";

export const COORDINATION_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COORDINATION_MAX_HOPS = 8;

const threadId = { type: "string", minLength: 1 } as const;

export const COORDINATION_DYNAMIC_TOOLS: DynamicToolFunctionSpec[] = [
  {
    type: "function",
    name: "list_threads",
    description: "List addressable threads in an authorized project and host scope.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        projectKey: { type: "string" }, hostId: { type: "string" }, archived: { type: "boolean" },
        workspace: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
        limit: { type: "integer", minimum: 1, maximum: 100 }, searchTerm: { type: "string" }
      }
    }
  },
  {
    type: "function",
    name: "read_thread",
    description: "Read authorized thread metadata and optionally its turns.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["threadId"],
      properties: { threadId, includeTurns: { type: "boolean" } }
    }
  },
  {
    type: "function",
    name: "send_message_to_thread",
    description: "Prepare and, when authorized, dispatch a guarded message to another top-level thread.",
    inputSchema: {
      type: "object", additionalProperties: false,
      required: ["targetThreadId", "intent", "reason", "message", "summary", "expectedWriteSet", "dedupeKey"],
      properties: {
        targetThreadId: threadId,
        intent: { enum: ["delegate", "inform", "review", "block", "handoff"] },
        reason: { type: "string", minLength: 1 }, message: { type: "string", minLength: 1 },
        summary: { type: "string", minLength: 1 },
        expectedWriteSet: { type: "array", items: { type: "string" } },
        ancestorCoordinationIds: { type: "array", items: { type: "string" } },
        priority: { enum: ["normal", "urgent"] }, dedupeKey: { type: "string", minLength: 1 },
        hopCount: { type: "integer", minimum: 0, maximum: COORDINATION_MAX_HOPS }
      }
    }
  },
  {
    type: "function",
    name: "fork_thread",
    description: "Fork an authorized thread through an optional turn.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["threadId"],
      properties: { threadId, throughTurnId: { type: "string" } }
    }
  },
  {
    type: "function",
    name: "archive_thread",
    description: "Archive a thread with explicit lifecycle confirmation.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["threadId"],
      properties: { threadId }
    }
  },
  {
    type: "function",
    name: "unarchive_thread",
    description: "Unarchive an authorized thread.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["threadId"], properties: { threadId }
    }
  },
  {
    type: "function",
    name: "wait_thread",
    description: "Wait for a coordination involving a target thread to reach its latest known result.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["threadId"],
      properties: {
        threadId, coordinationId: { type: "string" }, condition: { type: "string" },
        timeoutMs: { type: "integer", minimum: 0, maximum: 180000 }
      }
    }
  }
];

export function normalizeThreadState(status: CodexThreadRuntimeStatus): CoordinationThreadState {
  switch (status.type) {
    case "notLoaded": return "unloaded";
    case "idle": return "idle";
    case "active": return "running";
    case "systemError": return "system_error";
  }
}

function normalizedWritePath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || "/";
}

export function writeSetsOverlap(left: string[], right: string[]): boolean {
  const leftPaths = left.map(normalizedWritePath);
  const rightPaths = right.map(normalizedWritePath);
  return leftPaths.some((a) => rightPaths.some((b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)));
}

export function evaluateCoordinationGuards(
  request: CoordinationRequest,
  target: CoordinationThread,
  permissionDecision: CoordinationPermissionDecision,
  recentlySeenDedupeKeys: ReadonlySet<string> = new Set()
): CoordinationGuardFailure | undefined {
  if (permissionDecision === "denied") {
    return { code: "permission_denied", message: "coordination permission was denied" };
  }
  if (request.sourceThreadId === request.targetThreadId
    || request.hopCount > COORDINATION_MAX_HOPS) {
    return { code: "loop_rejected", message: "same-target, ancestor-cycle, or hop-budget guard rejected coordination" };
  }
  if (recentlySeenDedupeKeys.has(request.dedupeKey)) {
    return { code: "duplicate_rejected", message: "dedupe key was already accepted within 24 hours" };
  }
  if (target.archived) {
    return { code: "archived_target", message: "target thread is archived" };
  }
  if ((request.projectKey != null && request.projectKey !== target.projectKey) || request.targetHostId !== target.hostId) {
    return { code: "scope_mismatch", message: "target project or host does not match the coordination envelope" };
  }
  if (writeSetsOverlap(request.expectedWriteSet, target.writeSet)) {
    return { code: "write_set_conflict", message: "expected and target write sets overlap" };
  }
  if (target.state === "system_error") {
    return { code: "stale_status", message: "target status could not be refreshed safely" };
  }
  return undefined;
}

export function selectDispatchKind(
  state: CoordinationThreadState,
  priority: CoordinationRequest["priority"]
): CoordinationDispatchKind {
  if (state === "running") return priority === "urgent" ? "steered" : "queued";
  return "started";
}
