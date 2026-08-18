import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ChevronDown,
  Clock3,
  CircleAlert,
  RefreshCw,
  RotateCcw,
  UserRound,
  X
} from "lucide-react";
import type { WorkItemRuntimeItem, WorkItemRuntimeProjection } from "./workbenchModel";
import type { ServiceRecoveryAction, ServiceRecoveryModel } from "./serviceRecoveryModel";

type RuntimeOverviewPageProps = {
  locale: "zh" | "en";
  projection?: WorkItemRuntimeProjection;
  serviceRecovery?: ServiceRecoveryModel;
  serviceRecoveryBusy: boolean;
  serviceRecoveryFeedback: { tone: "success" | "attention"; message: string } | null;
  selectedWorkItemId?: string;
  stateStatus: "loading" | "ready" | "error";
  stateError: string;
  onRefresh(): void;
  onRunServiceRecovery(action: ServiceRecoveryAction): void;
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

function recoveryComponentLabel(component: ServiceRecoveryModel["causalRoot"]["component"], locale: "zh" | "en"): string {
  if (locale === "zh") {
    return component === "service" ? "后台服务" : component === "worker" ? "后台任务" : component === "scheduler" ? "定时任务" : "运行状态";
  }
  return component === "service" ? "Background service" : component === "worker" ? "Background worker" : component === "scheduler" ? "Scheduled tasks" : "Runtime";
}

function recoveryStatusLabel(model: ServiceRecoveryModel, locale: "zh" | "en"): string {
  if (locale === "zh") {
    if (model.causalRoot.status === "blocked" || model.mutationGuard.allowed === false) return "当前环境暂不能自动修复";
    if (model.causalRoot.status === "unknown") return "需要先刷新状态";
    return model.primaryAction ? "可以尝试恢复" : "暂无可安全执行的操作";
  }
  if (model.causalRoot.status === "blocked" || model.mutationGuard.allowed === false) return "Automatic repair is unavailable in this environment";
  if (model.causalRoot.status === "unknown") return "Refresh status before continuing";
  return model.primaryAction ? "Recovery can be attempted" : "No safe recovery action is available";
}

function recoveryReadinessLabel(model: ServiceRecoveryModel, locale: "zh" | "en"): string {
  if (locale === "zh") {
    return model.causalRoot.component === "worker" ? "后台任务未就绪" : model.causalRoot.component === "scheduler" ? "定时任务需检查" : "后台服务未就绪";
  }
  return model.causalRoot.component === "worker" ? "Background worker is not ready" : model.causalRoot.component === "scheduler" ? "Scheduled tasks need attention" : "Background service is not ready";
}

function recoveryActionLabel(model: ServiceRecoveryModel, locale: "zh" | "en"): string {
  if (locale === "zh") return model.causalRoot.component === "worker" ? "检查后台任务" : model.causalRoot.component === "scheduler" ? "检查定时任务" : "检查后台服务";
  return model.causalRoot.component === "worker" ? "Check background worker" : model.causalRoot.component === "scheduler" ? "Check scheduled tasks" : "Check background service";
}

export function RuntimeOverviewPage({
  locale,
  projection,
  serviceRecovery,
  serviceRecoveryBusy,
  serviceRecoveryFeedback,
  selectedWorkItemId,
  stateStatus,
  stateError,
  onRefresh,
  onRunServiceRecovery,
  onOpenWorkItem
}: RuntimeOverviewPageProps) {
  const [agentId, setAgentId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [openStagesFor, setOpenStagesFor] = useState<string | null>(null);
  const [pendingRecoveryAction, setPendingRecoveryAction] = useState<ServiceRecoveryAction | null>(null);
  const copy = locale === "zh" ? {
    title: "项目运行总览",
    scope: "查看范围",
    agent: "智能体",
    allAgents: "全部智能体",
    project: "项目",
    allProjects: "全部项目",
    loaded: "加载时间",
    availability: "整体状态",
    available: "可用",
    partial: "部分可用",
    unavailable: "不可用",
    running: "运行中",
    attention: "需关注",
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
    openDetails: "查看详情",
    serviceRecovery: "运行状态需要检查",
    causalRoot: "影响范围",
    mutationGuard: "自动修复",
    noRecoveryAction: "当前没有可安全执行的恢复操作",
    confirmRecovery: "确认执行",
    cancelRecovery: "取消"
  } : {
    title: "Project runtime overview",
    scope: "Scope",
    agent: "Agent",
    allAgents: "All Agents",
    project: "Project",
    allProjects: "All projects",
    loaded: "Loaded",
    availability: "Overall status",
    available: "Available",
    partial: "Partially available",
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
    openDetails: "Open details",
    serviceRecovery: "Runtime status needs attention",
    causalRoot: "Affected area",
    mutationGuard: "Automatic recovery",
    noRecoveryAction: "No safe recovery action is currently available",
    confirmRecovery: "Confirm",
    cancelRecovery: "Cancel"
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
  const recoveryNeedsAttention = serviceRecovery !== undefined && serviceRecovery.causalRoot.status !== "ready";
  const attentionCount = projection
    ? projection.summary.userAttentionCount + projection.summary.systemAttentionCount + (recoveryNeedsAttention ? 1 : 0)
    : 0;
  const overallStatus = stateStatus === "error" || !projection
    ? { label: copy.unavailable, tone: "muted" as const }
    : recoveryNeedsAttention
      ? { label: copy.partial, tone: "attention" as const }
      : { label: copy.available, tone: "success" as const };

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
        <div><dt>{copy.availability}</dt><dd data-tone={overallStatus.tone}>{overallStatus.label}</dd></div>
        <div><dt>{copy.running}</dt><dd data-tone={projection?.summary.runningCount ? "active" : "muted"}>{projection?.summary.runningCount ?? "-"}</dd></div>
        <div><dt>{copy.attention}</dt><dd data-tone={attentionCount ? "attention" : "muted"}>{projection ? attentionCount : "-"}</dd></div>
      </dl>

      {recoveryNeedsAttention && serviceRecovery ? (
        <section className="runtime-recovery-band" aria-labelledby="runtime-recovery-title" data-status={serviceRecovery.causalRoot.status}>
          <div className="runtime-recovery-heading">
            <CircleAlert aria-hidden="true" size={17} />
            <div>
              <h2 id="runtime-recovery-title">{copy.serviceRecovery}</h2>
              <p>{copy.causalRoot}: {recoveryComponentLabel(serviceRecovery.causalRoot.component, locale)}</p>
            </div>
          </div>
          <dl>
            <div><dt>{copy.mutationGuard}</dt><dd>{recoveryStatusLabel(serviceRecovery, locale)}</dd></div>
            <div><dt>{locale === "zh" ? "状态" : "Status"}</dt><dd>{recoveryReadinessLabel(serviceRecovery, locale)}</dd></div>
          </dl>
          <div className="runtime-recovery-action">
            {serviceRecovery.primaryAction ? (
              pendingRecoveryAction?.actionId === serviceRecovery.primaryAction.actionId ? (
                <div className="runtime-recovery-confirmation" role="group" aria-label={copy.confirmRecovery}>
                  <span>{recoveryActionLabel(serviceRecovery, locale)}</span>
                  <button type="button" disabled={serviceRecoveryBusy} onClick={() => setPendingRecoveryAction(null)}>{copy.cancelRecovery}</button>
                  <button type="button" className="primary" disabled={serviceRecoveryBusy} onClick={() => {
                    const action = pendingRecoveryAction;
                    setPendingRecoveryAction(null);
                    if (action) onRunServiceRecovery(action);
                  }}>{copy.confirmRecovery}</button>
                </div>
              ) : (
                <button type="button" disabled={serviceRecoveryBusy} onClick={() => {
                  if (serviceRecovery.primaryAction?.confirmationRequired) setPendingRecoveryAction(serviceRecovery.primaryAction);
                  else if (serviceRecovery.primaryAction) onRunServiceRecovery(serviceRecovery.primaryAction);
                }}>
                  <RotateCcw className={serviceRecoveryBusy ? "spin" : undefined} aria-hidden="true" size={15} />
                  {recoveryActionLabel(serviceRecovery, locale)}
                </button>
              )
            ) : <span>{copy.noRecoveryAction}</span>}
            {serviceRecoveryFeedback ? <p role={serviceRecoveryFeedback.tone === "attention" ? "alert" : "status"} data-tone={serviceRecoveryFeedback.tone}>{serviceRecoveryFeedback.message}</p> : null}
          </div>
        </section>
      ) : null}

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
