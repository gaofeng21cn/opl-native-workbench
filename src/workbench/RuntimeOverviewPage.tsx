import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ChevronDown,
  Clock3,
  RefreshCw,
  UserRound,
  X
} from "lucide-react";
import type { WorkItemRuntimeItem, WorkItemRuntimeProjection } from "./workbenchModel";

type RuntimeOverviewPageProps = {
  locale: "zh" | "en";
  projection?: WorkItemRuntimeProjection;
  selectedWorkItemId?: string;
  stateStatus: "loading" | "ready" | "error";
  stateError: string;
  onRefresh(): void;
  onOpenWorkItem(item: WorkItemRuntimeItem): void;
};

type StatusFilter = "all" | "running" | "attention" | "paused" | "completed" | "stopped";

function statusCategory(item: WorkItemRuntimeItem): Exclude<StatusFilter, "all"> | "other" {
  if (item.executionState === "running" || item.status === "running") return "running";
  if (item.attentionKind !== "none") return "attention";
  if (/paused/.test(item.status)) return "paused";
  if (/completed|delivered|success/.test(item.status)) return "completed";
  if (/stopped|cancelled|failed/.test(item.status)) return "stopped";
  return "other";
}

function formatTimestamp(value: string | undefined, locale: "zh" | "en"): string {
  if (!value) return locale === "zh" ? "尚未读取" : "Not read yet";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatDuration(value: number | null, locale: "zh" | "en"): string {
  if (value === null) return locale === "zh" ? "当前没有运行" : "Not currently running";
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return locale === "zh" ? `${seconds} 秒` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === "zh" ? `${minutes} 分钟` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return locale === "zh" ? `${hours} 小时 ${rest} 分钟` : `${hours}h ${rest}m`;
}

function formatTokens(value: number | null, locale: "zh" | "en"): string {
  if (value === null) return locale === "zh" ? "用量未记录" : "Usage not recorded";
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { notation: "compact" }).format(value);
}

function localizedStageName(item: WorkItemRuntimeItem, stageId: string, locale: "zh" | "en"): string {
  const stage = item.stages.find((candidate) => candidate.stageId === stageId);
  return (locale === "zh" ? stage?.displayNameI18n.zh : stage?.displayNameI18n.en) ?? stage?.displayName ?? stageId;
}

export function RuntimeOverviewPage({
  locale,
  projection,
  selectedWorkItemId,
  stateStatus,
  stateError,
  onRefresh,
  onOpenWorkItem
}: RuntimeOverviewPageProps) {
  const [agentId, setAgentId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [openStagesFor, setOpenStagesFor] = useState<string | null>(null);
  const copy = locale === "zh" ? {
    title: "项目运行总览",
    scope: "查看范围",
    agent: "智能体",
    allAgents: "全部智能体",
    project: "项目",
    allProjects: "全部项目",
    loaded: "加载时间",
    availability: "可用性",
    available: "可用",
    unavailable: "不可用",
    running: "运行中",
    attention: "需要处理",
    tasks: "任务",
    currentCount: "当前范围",
    workItems: "项工作",
    all: "全部",
    paused: "已暂停",
    completed: "已交付",
    stopped: "已停止",
    archive: "归档库",
    backToCurrent: "返回当前任务",
    refresh: "刷新运行状态",
    noData: "运行状态暂不可用",
    noItems: "当前范围没有工作",
    stage: "当前阶段",
    noStage: "暂无当前阶段",
    nextStage: "下一阶段",
    nextAction: "下一步",
    owner: "负责人",
    elapsed: "已用时",
    currentStageUsage: "阶段",
    cumulativeUsage: "累计",
    stageMap: "阶段进度",
    close: "关闭阶段进度",
    openDetails: "查看详情"
  } : {
    title: "Project runtime overview",
    scope: "Scope",
    agent: "Agent",
    allAgents: "All Agents",
    project: "Project",
    allProjects: "All projects",
    loaded: "Loaded",
    availability: "Availability",
    available: "Available",
    unavailable: "Unavailable",
    running: "Running",
    attention: "Needs attention",
    tasks: "Tasks",
    currentCount: "Current scope",
    workItems: "work items",
    all: "All",
    paused: "Paused",
    completed: "Delivered",
    stopped: "Stopped",
    archive: "Archive",
    backToCurrent: "Back to current tasks",
    refresh: "Refresh runtime status",
    noData: "Runtime status is unavailable",
    noItems: "No work in this scope",
    stage: "Current stage",
    noStage: "No current stage",
    nextStage: "Next stage",
    nextAction: "Next",
    owner: "Owner",
    elapsed: "Elapsed",
    currentStageUsage: "Stage",
    cumulativeUsage: "Total",
    stageMap: "Stage progress",
    close: "Close stage progress",
    openDetails: "Open details"
  };
  const projects = useMemo(() => (projection?.projects ?? []).filter((project) => (
    agentId === "all" || project.agentId === agentId
  )), [agentId, projection?.projects]);
  const items = useMemo(() => (projection?.items ?? []).filter((item) => (
    item.archived === showArchived
    && (agentId === "all" || item.agentId === agentId)
    && (projectId === "all" || item.projectId === projectId)
    && (status === "all" || statusCategory(item) === status)
  )), [agentId, projectId, projection?.items, showArchived, status]);
  const attentionCount = projection
    ? projection.summary.userAttentionCount + projection.summary.systemAttentionCount
    : 0;

  const changeAgent = (value: string) => {
    setAgentId(value);
    const project = projection?.projects.find((candidate) => candidate.id === projectId);
    if (value !== "all" && project?.agentId !== value) setProjectId("all");
  };

  return (
    <section className="opl-runtime-overview" data-testid="opl-runtime-overview-page" aria-labelledby="opl-runtime-overview-title">
      <header className="runtime-overview-header">
        <div>
          <Activity aria-hidden="true" size={20} />
          <h1 id="opl-runtime-overview-title">{copy.title}</h1>
        </div>
        <button
          type="button"
          className="runtime-icon-button"
          aria-label={copy.refresh}
          title={copy.refresh}
          disabled={stateStatus === "loading"}
          onClick={onRefresh}
        >
          <RefreshCw className={stateStatus === "loading" ? "spin" : undefined} aria-hidden="true" size={16} />
        </button>
      </header>

      <div className="runtime-scope-band">
        <strong>{copy.scope}</strong>
        <label>
          <span>{copy.agent}</span>
          <select value={agentId} onChange={(event) => changeAgent(event.currentTarget.value)}>
            <option value="all">{copy.allAgents}</option>
            {(projection?.agents ?? []).map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}
          </select>
        </label>
        <label>
          <span>{copy.project}</span>
          <select value={projectId} onChange={(event) => setProjectId(event.currentTarget.value)}>
            <option value="all">{copy.allProjects}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
        </label>
        <span className="runtime-loaded-at">{copy.loaded}: {formatTimestamp(projection?.generatedAt, locale)}</span>
      </div>

      <dl className="runtime-summary-band">
        <div><dt>{copy.availability}</dt><dd data-tone={projection ? "success" : "muted"}>{projection ? copy.available : copy.unavailable}</dd></div>
        <div><dt>{copy.running}</dt><dd data-tone={projection?.summary.runningCount ? "active" : "muted"}>{projection?.summary.runningCount ?? "-"}</dd></div>
        <div><dt>{copy.attention}</dt><dd data-tone={attentionCount ? "attention" : "muted"}>{projection ? attentionCount : "-"}</dd></div>
      </dl>

      <div className="runtime-list-heading">
        <div><h2>{copy.tasks}</h2><span>{copy.currentCount} {items.length} {copy.workItems}</span></div>
        <div className="runtime-list-controls">
          <select aria-label={locale === "zh" ? "状态" : "Status"} value={status} onChange={(event) => setStatus(event.currentTarget.value as StatusFilter)}>
            <option value="all">{copy.all}</option>
            <option value="running">{copy.running}</option>
            <option value="attention">{copy.attention}</option>
            <option value="paused">{copy.paused}</option>
            <option value="completed">{copy.completed}</option>
            <option value="stopped">{copy.stopped}</option>
          </select>
          <button type="button" className="runtime-archive-button" aria-pressed={showArchived} onClick={() => { setShowArchived((value) => !value); setOpenStagesFor(null); }}>
            <Archive aria-hidden="true" size={15} />
            {showArchived ? copy.backToCurrent : `${copy.archive} (${projection?.summary.archivedWorkItemCount ?? 0})`}
          </button>
        </div>
      </div>

      {stateStatus === "error" ? <p className="runtime-overview-error" role="alert">{stateError || copy.noData}</p> : null}
      {stateStatus === "ready" && !projection ? <p className="runtime-overview-empty">{copy.noData}</p> : null}
      {projection && items.length === 0 ? <p className="runtime-overview-empty">{copy.noItems}</p> : null}

      <div className="runtime-work-list" aria-live="polite">
        {items.map((item) => {
          const category = statusCategory(item);
          const stageLabel = item.currentStageId
            ? localizedStageName(item, item.currentStageId, locale)
            : item.currentStageName ?? copy.noStage;
          const stagesOpen = openStagesFor === item.id;
          return (
            <article className="runtime-work-row" key={item.id} data-status={category} data-selected={selectedWorkItemId === item.workItemId}>
              <div className="runtime-work-identity">
                <button type="button" aria-label={`${copy.openDetails}: ${item.title}`} onClick={() => onOpenWorkItem(item)}>
                  <strong>{item.projectDisplayName}</strong>
                  <h3>{item.title}</h3>
                  <span><UserRound aria-hidden="true" size={13} />{item.agentDisplayName}</span>
                </button>
              </div>
              <div className="runtime-work-status"><span>{item.statusLabel}</span>{item.activeSessionCount ? <small>{item.activeSessionCount} {locale === "zh" ? "个活跃会话" : "active sessions"}</small> : null}</div>
              <div className="runtime-work-progress">
                <button
                  type="button"
                  className="runtime-stage-button"
                  aria-expanded={stagesOpen}
                  aria-controls={`runtime-stages-${item.workItemId}`}
                  onClick={() => setOpenStagesFor(stagesOpen ? null : item.id)}
                >
                  <span>{copy.stage}: {stageLabel}</span><ChevronDown aria-hidden="true" size={14} />
                </button>
                <p><strong>{copy.nextAction}:</strong> {item.nextActionTitle ?? item.nextActionSummary ?? (item.nextStageName ? `${copy.nextStage}: ${item.nextStageName}` : "-")}</p>
                <p><strong>{copy.owner}:</strong> {item.nextActionOwner ?? "-"} <strong>{copy.elapsed}:</strong> {formatDuration(item.elapsedMs, locale)}</p>
                {stagesOpen ? (
                  <section id={`runtime-stages-${item.workItemId}`} className="runtime-stage-popover" aria-label={copy.stageMap}>
                    <header><strong>{copy.stageMap}</strong><button type="button" aria-label={copy.close} title={copy.close} onClick={() => setOpenStagesFor(null)}><X aria-hidden="true" size={14} /></button></header>
                    {item.stages.length ? <ol>{item.stages.map((stage) => <li key={stage.stageId} data-state={stage.state}><span /><div><strong>{(locale === "zh" ? stage.displayNameI18n.zh : stage.displayNameI18n.en) ?? stage.displayName}</strong><small>{stage.state}</small></div></li>)}</ol> : <p>{copy.noStage}</p>}
                  </section>
                ) : null}
              </div>
              <dl className="runtime-work-usage">
                <div><dt>{copy.currentStageUsage}</dt><dd>{formatTokens(item.stageTokens, locale)}</dd></div>
                <div><dt>{copy.cumulativeUsage}</dt><dd>{formatTokens(item.totalTokens, locale)}</dd></div>
                <div className="runtime-work-time"><Clock3 aria-hidden="true" size={13} /><span>{item.updatedAt ? formatTimestamp(item.updatedAt, locale) : "-"}</span></div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
