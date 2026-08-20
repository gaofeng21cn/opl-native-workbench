import { CircleAlert, LoaderCircle, RefreshCw, Route } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type {
  DomainDetailViewDescriptor,
  DomainDetailViewAvailability,
  WorkItemRuntimeItem
} from "./workbenchModel";

export type DomainDetailViewReadRequest = {
  itemId: string;
  viewId: string;
  ifRevision?: number;
};

export type DomainDetailViewRead = (request: DomainDetailViewReadRequest) => Promise<unknown>;

type RecordValue = Record<string, unknown>;

const READBACK_SCHEMA_VERSION = "opl_domain_detail_view.v1";
const READBACK_SURFACE_KIND = "opl_domain_detail_view";
const RESEARCH_ROADMAP_SCHEMA_REFS = [
  "contracts/schemas/v2/mas-research-trajectory-snapshot-v2.schema.json",
  "contracts/schemas/research-roadmap.schema.json"
] as const;

function asRecord(value: unknown): RecordValue | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function requiredText(record: RecordValue, key: string): string {
  const value = asText(record[key]);
  if (!value) throw new Error(`${key}_missing`);
  return value;
}

function safeRevision(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const revision = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

function textArray(value: unknown, key: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${key}_invalid`);
  return value.map((candidate, index) => {
    if (typeof candidate !== "string" || !candidate.trim()) throw new Error(`${key}_${index}_invalid`);
    return candidate;
  });
}

function optionalRecord(value: unknown, key: string): RecordValue | undefined {
  if (value === undefined || value === null) return undefined;
  const record = asRecord(value);
  if (!record) throw new Error(`${key}_invalid`);
  return record;
}

export type ResearchRoadmapSummary = {
  primaryHypothesis: string;
  latestFinding: string;
  currentJudgment: string;
  nextResearchStep: string;
  updatedAt?: string;
};

export type ResearchRoadmapNode = {
  id: string;
  kind?: string;
  label: string;
  status?: string;
  summary?: string;
  branchId?: string;
  occurredAt?: string;
  evidenceJudgment?: string;
};

export type ResearchRoadmapEdge = {
  id: string;
  source: string;
  target: string;
  kind?: string;
  label?: string;
  status?: string;
};

export type ResearchRoadmapPayload = {
  surfaceKind: "mas_research_trajectory_snapshot";
  version: "mas-research-trajectory-snapshot.v2";
  studyId: string;
  studyRef?: string;
  revision?: number;
  status?: string;
  summary: ResearchRoadmapSummary;
  currentFocus?: { nodeId?: string; label?: string };
  activeBranch?: { branchId?: string; label?: string };
  currentFocusNodeRefs: string[];
  activeBranchNodeRefs: string[];
  nodes: ResearchRoadmapNode[];
  edges: ResearchRoadmapEdge[];
};

function parseResearchRoadmapNode(value: unknown, index: number): ResearchRoadmapNode {
  const record = asRecord(value);
  if (!record) throw new Error(`nodes_${index}_invalid`);
  const details = asRecord(record.details);
  return {
    id: requiredText(record, "id"),
    ...(asText(record.kind) ? { kind: asText(record.kind) } : {}),
    label: requiredText(record, "label"),
    ...(asText(record.status) ? { status: asText(record.status) } : {}),
    ...(asText(record.summary) ? { summary: asText(record.summary) } : {}),
    ...(asText(record.branch_id) ? { branchId: asText(record.branch_id) } : {}),
    ...(asText(record.occurred_at) ? { occurredAt: asText(record.occurred_at) } : {}),
    ...(asText(details?.evidence_judgment) ? { evidenceJudgment: asText(details?.evidence_judgment) } : {})
  };
}

function parseResearchRoadmapEdge(value: unknown, index: number): ResearchRoadmapEdge {
  const record = asRecord(value);
  if (!record) throw new Error(`edges_${index}_invalid`);
  return {
    id: requiredText(record, "id"),
    source: requiredText(record, "source"),
    target: requiredText(record, "target"),
    ...(asText(record.kind) ? { kind: asText(record.kind) } : {}),
    ...(asText(record.label) ? { label: asText(record.label) } : {}),
    ...(asText(record.status) ? { status: asText(record.status) } : {})
  };
}

export function parseResearchRoadmapPayload(value: unknown, expectedStudyId?: string): ResearchRoadmapPayload {
  const payload = asRecord(value);
  if (!payload) throw new Error("payload_not_object");
  if (payload.surface_kind !== "mas_research_trajectory_snapshot") throw new Error("payload_surface_invalid");
  if (payload.version !== "mas-research-trajectory-snapshot.v2") throw new Error("payload_version_invalid");
  const studyId = requiredText(payload, "study_id");
  if (expectedStudyId && studyId !== expectedStudyId) throw new Error("payload_study_id_mismatch");
  const studyRef = asRecord(payload.study_ref);
  if (studyRef && asText(studyRef.ref) && studyRef.ref !== `mas-study:${studyId}`) {
    throw new Error("payload_study_ref_mismatch");
  }
  const summary = asRecord(payload.summary);
  if (!summary) throw new Error("summary_invalid");
  const nodes = payload.nodes;
  const edges = payload.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new Error("graph_invalid");
  const parsedNodes = nodes.map(parseResearchRoadmapNode);
  const nodeIds = new Set<string>();
  for (const node of parsedNodes) {
    if (nodeIds.has(node.id)) throw new Error("nodes_duplicate");
    nodeIds.add(node.id);
  }
  const parsedEdges = edges.map(parseResearchRoadmapEdge);
  return {
    surfaceKind: "mas_research_trajectory_snapshot",
    version: "mas-research-trajectory-snapshot.v2",
    studyId,
    ...(studyRef && asText(studyRef.ref) ? { studyRef: asText(studyRef.ref) } : {}),
    ...(safeRevision(payload.revision) !== undefined ? { revision: safeRevision(payload.revision) } : {}),
    ...(asText(payload.status) ? { status: asText(payload.status) } : {}),
    summary: {
      primaryHypothesis: requiredText(summary, "primary_hypothesis"),
      latestFinding: requiredText(summary, "latest_finding"),
      currentJudgment: requiredText(summary, "current_judgment"),
      nextResearchStep: requiredText(summary, "next_research_step"),
      ...(asText(summary.updated_at) ? { updatedAt: asText(summary.updated_at) } : {})
    },
    ...(optionalRecord(payload.current_focus, "current_focus") ? {
      currentFocus: {
        ...(asText(optionalRecord(payload.current_focus, "current_focus")?.node_id)
          ? { nodeId: asText(optionalRecord(payload.current_focus, "current_focus")?.node_id) }
          : {}),
        ...(asText(optionalRecord(payload.current_focus, "current_focus")?.label)
          ? { label: asText(optionalRecord(payload.current_focus, "current_focus")?.label) }
          : {})
      }
    } : {}),
    ...(optionalRecord(payload.active_branch, "active_branch") ? {
      activeBranch: {
        ...(asText(optionalRecord(payload.active_branch, "active_branch")?.branch_id)
          ? { branchId: asText(optionalRecord(payload.active_branch, "active_branch")?.branch_id) }
          : {}),
        ...(asText(optionalRecord(payload.active_branch, "active_branch")?.label)
          ? { label: asText(optionalRecord(payload.active_branch, "active_branch")?.label) }
          : {})
      }
    } : {}),
    currentFocusNodeRefs: textArray(payload.current_focus_node_refs, "current_focus_node_refs"),
    activeBranchNodeRefs: textArray(payload.active_branch_node_refs, "active_branch_node_refs"),
    nodes: parsedNodes,
    edges: parsedEdges
  };
}

export type DomainDetailViewReadback = {
  schemaVersion: typeof READBACK_SCHEMA_VERSION;
  surfaceKind: typeof READBACK_SURFACE_KIND;
  itemId: string;
  viewId: string;
  viewKind: string;
  availability: Exclude<DomainDetailViewAvailability, "unread">;
  revision: number;
  notModified: boolean;
  payload: unknown;
  digest?: string;
  generation?: number;
  payloadSchemaRef?: string;
  payloadSchema?: unknown;
  conditions: unknown[];
};

export type DomainDetailViewReadValidation =
  | { ok: true; readback: DomainDetailViewReadback }
  | { ok: false; reason: string };

function readbackAvailability(value: unknown): Exclude<DomainDetailViewAvailability, "unread"> | undefined {
  if (value === "available" || value === "missing" || value === "stale" || value === "invalid" || value === "read_error") {
    return value;
  }
  return undefined;
}

export function parseDomainDetailViewReadback(
  value: unknown,
  descriptor?: DomainDetailViewDescriptor
): DomainDetailViewReadValidation {
  const record = asRecord(value);
  if (!record) return { ok: false, reason: "readback_not_object" };
  if (record.schema_version !== READBACK_SCHEMA_VERSION) return { ok: false, reason: "readback_schema_invalid" };
  if (record.surface_kind !== READBACK_SURFACE_KIND) return { ok: false, reason: "readback_surface_invalid" };
  const itemId = asText(record.item_id);
  const viewId = asText(record.view_id);
  const viewKind = asText(record.view_kind);
  const availability = readbackAvailability(record.availability);
  const revision = safeRevision(record.revision);
  if (!itemId || !viewId || !viewKind || !availability || revision === undefined) {
    return { ok: false, reason: "readback_identity_invalid" };
  }
  if (typeof record.not_modified !== "boolean") return { ok: false, reason: "readback_not_modified_invalid" };
  if (descriptor) {
    if (itemId !== descriptor.itemId) return { ok: false, reason: "readback_item_id_mismatch" };
    if (viewId !== descriptor.viewId) return { ok: false, reason: "readback_view_id_mismatch" };
    if (viewKind !== descriptor.viewKind) return { ok: false, reason: "readback_view_kind_mismatch" };
    const payloadSchemaRef = asText(record.payload_schema_ref);
    if (descriptor.schemaRef && payloadSchemaRef && descriptor.schemaRef !== payloadSchemaRef) {
      return { ok: false, reason: "readback_schema_ref_mismatch" };
    }
    if (descriptor.schemaVersion && asRecord(record.payload)?.version !== descriptor.schemaVersion) {
      return { ok: false, reason: "readback_schema_version_mismatch" };
    }
  }
  if (record.not_modified && record.payload !== null && record.payload !== undefined) {
    return { ok: false, reason: "readback_not_modified_payload" };
  }
  const conditions = Array.isArray(record.conditions) ? record.conditions : [];
  return {
    ok: true,
    readback: {
      schemaVersion: READBACK_SCHEMA_VERSION,
      surfaceKind: READBACK_SURFACE_KIND,
      itemId,
      viewId,
      viewKind,
      availability,
      revision,
      notModified: record.not_modified,
      payload: record.payload ?? null,
      ...(asText(record.digest) ? { digest: asText(record.digest) } : {}),
      ...(safeRevision(record.generation) !== undefined ? { generation: safeRevision(record.generation) } : {}),
      ...(asText(record.payload_schema_ref) ? { payloadSchemaRef: asText(record.payload_schema_ref) } : {}),
      ...(record.payload_schema !== undefined ? { payloadSchema: record.payload_schema } : {}),
      conditions
    }
  };
}

type DomainDetailViewRendererRegistration = {
  viewKind: string;
  ownerPackageId: string;
  rendererId: string;
  schemaCompatibility: readonly string[];
  parse(payload: unknown, expectedStudyId?: string): ResearchRoadmapPayload;
  render(payload: ResearchRoadmapPayload, locale: "zh" | "en"): ReactNode;
};

function localizedText(value: string | undefined, locale: "zh" | "en"): string {
  return value ?? (locale === "zh" ? "未提供" : "Not provided");
}

function researchRoadmapCopy(locale: "zh" | "en") {
  return locale === "zh" ? {
    currentHypothesis: "当前假设",
    latestFinding: "最新发现",
    currentJudgment: "当前判断",
    nextStep: "下一步",
    focus: "当前聚焦",
    branch: "当前路线",
    nodes: "路线节点",
    edges: "关系",
    noEdges: "暂无关系",
    status: "状态",
    evidence: "证据判断"
  } : {
    currentHypothesis: "Current hypothesis",
    latestFinding: "Latest finding",
    currentJudgment: "Current judgment",
    nextStep: "Next step",
    focus: "Current focus",
    branch: "Active branch",
    nodes: "Roadmap nodes",
    edges: "Relations",
    noEdges: "No relations",
    status: "Status",
    evidence: "Evidence judgment"
  };
}

function ResearchRoadmapRenderer({ payload, locale }: { payload: ResearchRoadmapPayload; locale: "zh" | "en" }) {
  const copy = researchRoadmapCopy(locale);
  return (
    <div className="opl-runtime-detail-result" data-testid="opl-research-roadmap-renderer">
      <section>
        <h4>{copy.currentHypothesis}</h4>
        <dl className="opl-structured-fields">
          <div><dt>{copy.currentHypothesis}</dt><dd className="opl-structured-scalar" style={{ whiteSpace: "pre-wrap" }}>{payload.summary.primaryHypothesis}</dd></div>
          <div><dt>{copy.latestFinding}</dt><dd className="opl-structured-scalar" style={{ whiteSpace: "pre-wrap" }}>{payload.summary.latestFinding}</dd></div>
          <div><dt>{copy.currentJudgment}</dt><dd className="opl-structured-scalar" style={{ whiteSpace: "pre-wrap" }}>{payload.summary.currentJudgment}</dd></div>
          <div><dt>{copy.nextStep}</dt><dd className="opl-structured-scalar" style={{ whiteSpace: "pre-wrap" }}>{payload.summary.nextResearchStep}</dd></div>
        </dl>
      </section>
      {payload.currentFocus || payload.activeBranch ? (
        <section>
          <h4>{copy.focus}</h4>
          <dl className="opl-structured-fields">
            {payload.currentFocus ? <div><dt>{copy.focus}</dt><dd>{localizedText(payload.currentFocus.label ?? payload.currentFocus.nodeId, locale)}</dd></div> : null}
            {payload.activeBranch ? <div><dt>{copy.branch}</dt><dd>{localizedText(payload.activeBranch.label ?? payload.activeBranch.branchId, locale)}</dd></div> : null}
          </dl>
        </section>
      ) : null}
      <section>
        <h4>{copy.nodes}</h4>
        <ol className="opl-structured-list">
          {payload.nodes.map((node) => (
            <li key={node.id}>
              <strong>{node.label}</strong>
              {node.summary ? <span>{node.summary}</span> : null}
              {node.evidenceJudgment ? <span><b>{copy.evidence}:</b> {node.evidenceJudgment}</span> : null}
              {node.status ? <span><b>{copy.status}:</b> {node.status}</span> : null}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h4>{copy.edges}</h4>
        {payload.edges.length ? (
          <ul className="opl-structured-list">
            {payload.edges.map((edge) => <li key={edge.id}><strong>{edge.source} -&gt; {edge.target}</strong>{edge.label ? <span>{edge.label}</span> : null}</li>)}
          </ul>
        ) : <p className="opl-structured-empty">{copy.noEdges}</p>}
      </section>
    </div>
  );
}

function roadmapRegistration(viewKind: string): DomainDetailViewRendererRegistration {
  return {
    viewKind,
    ownerPackageId: "mas",
    rendererId: "research-roadmap",
    schemaCompatibility: RESEARCH_ROADMAP_SCHEMA_REFS,
    parse: parseResearchRoadmapPayload,
    render: (payload, locale) => <ResearchRoadmapRenderer payload={payload} locale={locale} />
  };
}

export const domainDetailViewRendererRegistry: Readonly<Record<string, DomainDetailViewRendererRegistration>> = {
  "research-roadmap": roadmapRegistration("research-roadmap")
};

export const DOMAIN_DETAIL_VIEW_RENDERER_REGISTRY = domainDetailViewRendererRegistry;

export function resolveDomainDetailViewRenderer(viewKind: string): DomainDetailViewRendererRegistration | undefined {
  return domainDetailViewRendererRegistry[viewKind];
}

type ParsedDomainViewState = {
  phase: "idle" | "loading" | "ready" | "error";
  payload?: ResearchRoadmapPayload;
  revision?: number;
  error?: string;
};

function viewUnavailableCopy(locale: "zh" | "en"): string {
  return locale === "zh" ? "此视图暂不可用" : "This view is unavailable";
}

function viewLoadingCopy(locale: "zh" | "en"): string {
  return locale === "zh" ? "正在读取视图" : "Loading view";
}

function viewRefreshFailedCopy(locale: "zh" | "en"): string {
  return locale === "zh" ? "最新读取失败，保留上次有效视图" : "The latest read failed; showing the last valid view";
}

export type DomainDetailViewsProps = {
  item: WorkItemRuntimeItem;
  locale: "zh" | "en";
  readDomainDetailView?: DomainDetailViewRead;
};

export function DomainDetailViews({ item, locale, readDomainDetailView }: DomainDetailViewsProps) {
  const views = item.domainDetailViews ?? [];
  const itemId = item.id;
  const [selectedViewId, setSelectedViewId] = useState<string | undefined>(views[0]?.viewId);
  const [viewStates, setViewStates] = useState<Record<string, ParsedDomainViewState>>({});
  const viewStatesRef = useRef(viewStates);
  const previousItemIdRef = useRef(itemId);
  useEffect(() => {
    viewStatesRef.current = viewStates;
  }, [viewStates]);
  useEffect(() => {
    if (previousItemIdRef.current === itemId) return;
    previousItemIdRef.current = itemId;
    setViewStates({});
    setSelectedViewId(views[0]?.viewId);
  }, [itemId, views]);
  useEffect(() => {
    setSelectedViewId((current) => views.some((view) => view.viewId === current) ? current : views[0]?.viewId);
  }, [views]);

  const loadView = useCallback(async (view: DomainDetailViewDescriptor) => {
    const previous = viewStatesRef.current[view.viewId];
    const registration = view.valid ? resolveDomainDetailViewRenderer(view.viewKind) : undefined;
    if (!view.valid || !registration || !readDomainDetailView) {
      setViewStates((current) => ({
        ...current,
        [view.viewId]: {
          ...current[view.viewId],
          phase: "error",
          error: "unavailable"
        }
      }));
      return;
    }
    setViewStates((current) => ({
      ...current,
      [view.viewId]: { ...current[view.viewId], phase: "loading", error: undefined }
    }));
    try {
      const readback = await readDomainDetailView({
        itemId,
        viewId: view.viewId,
        ...(previous?.payload && previous.revision !== undefined ? { ifRevision: previous.revision } : {})
      });
      const validation = parseDomainDetailViewReadback(readback, view);
      if (!validation.ok) throw new Error(validation.reason);
      const normalized = validation.readback;
      if (normalized.notModified) {
        if (!previous?.payload) throw new Error("not_modified_without_last_valid_view");
        setViewStates((current) => ({
          ...current,
          [view.viewId]: { ...current[view.viewId], phase: "ready", payload: previous.payload, revision: normalized.revision, error: undefined }
        }));
        return;
      }
      if (normalized.availability !== "available") {
        setViewStates((current) => ({
          ...current,
          [view.viewId]: { ...current[view.viewId], phase: "error", revision: normalized.revision, error: normalized.availability }
        }));
        return;
      }
      if (normalized.payloadSchemaRef && !registration.schemaCompatibility.includes(normalized.payloadSchemaRef)) {
        throw new Error("readback_payload_schema_unsupported");
      }
      const payload = registration.parse(normalized.payload, item.domainWorkItemId ?? item.workItemId);
      setViewStates((current) => ({
        ...current,
        [view.viewId]: { phase: "ready", payload, revision: normalized.revision }
      }));
    } catch (error) {
      setViewStates((current) => ({
        ...current,
        [view.viewId]: {
          ...current[view.viewId],
          phase: "error",
          error: error instanceof Error ? error.message : String(error)
        }
      }));
    }
  }, [itemId, item.domainWorkItemId, item.workItemId, readDomainDetailView]);

  const selectedView = useMemo(
    () => views.find((view) => view.viewId === selectedViewId) ?? views[0],
    [selectedViewId, views]
  );
  if (!views.length) return null;
  const selectedState = selectedView ? viewStates[selectedView.viewId] : undefined;
  const selectedRenderer = selectedView ? resolveDomainDetailViewRenderer(selectedView.viewKind) : undefined;

  return (
    <section className="opl-runtime-detail-result" data-testid="opl-domain-detail-views" aria-label={locale === "zh" ? "任务详情视图" : "Work item detail views"}>
      <header>
        <h4><Route aria-hidden="true" size={15} />{locale === "zh" ? "任务详情" : "Work item details"}</h4>
      </header>
      <nav role="tablist" aria-label={locale === "zh" ? "任务详情入口" : "Work item detail entries"}>
        {views.map((view) => {
          const registration = view.valid ? resolveDomainDetailViewRenderer(view.viewKind) : undefined;
          const unavailable = !view.valid || !registration;
          return (
            <button
              key={view.viewId}
              type="button"
              role="tab"
              aria-selected={view.viewId === selectedView?.viewId}
              data-view-id={view.viewId}
              data-view-kind={view.viewKind}
              onClick={() => {
                setSelectedViewId(view.viewId);
                if (!unavailable) void loadView(view);
                else setViewStates((current) => ({ ...current, [view.viewId]: { ...current[view.viewId], phase: "error", error: "unavailable" } }));
              }}
            >
              {view.title ?? view.viewId}
            </button>
          );
        })}
      </nav>
      {selectedView ? (
        <div role="tabpanel" data-testid="opl-domain-detail-view-panel" data-view-id={selectedView.viewId}>
          {selectedState?.phase === "loading" ? <p role="status"><LoaderCircle className="spin" aria-hidden="true" size={14} />{viewLoadingCopy(locale)}</p> : null}
          {selectedState?.payload && selectedRenderer ? selectedRenderer.render(selectedState.payload, locale) : null}
          {selectedState?.phase === "error" && !selectedState.payload ? (
            <p role="alert"><CircleAlert aria-hidden="true" size={14} />{viewUnavailableCopy(locale)}</p>
          ) : null}
          {selectedState?.phase === "error" && selectedState.payload ? (
            <p role="alert"><CircleAlert aria-hidden="true" size={14} />{viewRefreshFailedCopy(locale)}</p>
          ) : null}
          {selectedState?.phase === "ready" && selectedState.payload ? (
            <button type="button" aria-label={locale === "zh" ? "刷新视图" : "Refresh view"} title={locale === "zh" ? "刷新视图" : "Refresh view"} onClick={() => void loadView(selectedView)}>
              <RefreshCw aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
