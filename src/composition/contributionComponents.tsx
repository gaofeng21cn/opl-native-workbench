import { Button, Pill, StateDot, Tooltip, type StateDotState } from "@deepseek-ai/dsh-client-ui-primitives";
import { Boxes, Play, QrCode, ShieldCheck, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  contributionLabel,
  createOplContributionReadInput,
  readChannelAccessResult,
  type OplContributionSlotOwner,
  type OplChannelAccessAction,
  type OplChannelAccessResult,
  type OplUiContribution,
  type OplUiContributionBadge
} from "./contributionProjection";
import { buildRuntimeDetailResultViewModel, type RuntimeDetailSection } from "../workbench/runDetailModel";

function badgeState(badge: OplUiContributionBadge): StateDotState {
  if (badge.tone === "success") return "done";
  if (badge.tone === "warning") return "warning";
  if (badge.tone === "critical") return "error";
  return "ongoing";
}

function ContributionHeader({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const title = entry.view
    ? contributionLabel(entry.view.title, owner.locale, entry.contributionId)
    : entry.contributionId;
  return (
    <header className="opl-contribution-header">
      <span className="opl-contribution-title">
        <Boxes aria-hidden="true" size={15} />
        <strong>{title}</strong>
      </span>
      {owner.developerDetails ? (
        <details className="opl-contribution-technical-details">
          <summary>{owner.locale === "zh" ? "技术详情" : "Technical details"}</summary>
          <dl>
            <div><dt>{owner.locale === "zh" ? "模块 ID" : "Package ID"}</dt><dd>{entry.packageId}</dd></div>
            <div><dt>{owner.locale === "zh" ? "渲染信任层" : "Renderer trust"}</dt><dd>{entry.trustTier}</dd></div>
          </dl>
        </details>
      ) : null}
    </header>
  );
}

function ContributionBadges({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  if (!entry.badges.length) return null;
  return (
    <div className="opl-contribution-badges">
      {entry.badges.map((badge) => (
        <Pill key={badge.badgeId}>
          <StateDot state={badgeState(badge)} size={9} />
          {contributionLabel(badge.label, owner.locale, badge.badgeId)}
        </Pill>
      ))}
    </div>
  );
}

function ContributionActions({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  if (!entry.commands.length) return null;
  return (
    <div className="opl-contribution-actions">
      {entry.commands.map((command) => {
        const label = contributionLabel(command.label, owner.locale, command.commandId);
        return (
          <Tooltip
            key={command.commandId}
            label={!owner.actionAvailable
              ? (owner.locale === "zh" ? "当前 App action catalog 未提供此操作" : "Unavailable in the current App action catalog")
              : command.confirmationRequired
                ? (owner.locale === "zh" ? "确认后通过 OPL App 执行" : "Confirm before execution through OPL App")
                : (owner.locale === "zh" ? "通过 OPL App 执行" : "Execute through OPL App")}
            side="top"
          >
            <Button
              variant={command.confirmationRequired ? "outline" : "ghost"}
              size="sm"
              icon={<Play aria-hidden="true" size={13} />}
              disabled={!owner.actionAvailable}
              onClick={() => owner.onAction(entry, command)}
            >
              {label}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function fieldLabel(value: string, locale: OplContributionSlotOwner["locale"]): string {
  const labels: Record<string, [string, string]> = {
    hypothesis: ["假设", "Hypothesis"],
    hypotheses: ["假设", "Hypotheses"],
    roadmap: ["路线图", "Roadmap"],
    milestones: ["里程碑", "Milestones"],
    status: ["状态", "Status"],
    next_step: ["下一步", "Next step"],
    next_steps: ["下一步", "Next steps"],
    owner: ["负责人", "Owner"],
    blockers: ["阻塞项", "Blockers"],
    evidence: ["证据", "Evidence"],
    updated_at: ["更新时间", "Updated"],
    work_item_id: ["任务", "Work item"],
    study_id: ["研究", "Study"],
    business_status: ["业务状态", "Business status"],
    lifecycle_state: ["生命周期", "Lifecycle"],
    stage_id: ["阶段", "Stage"],
    stage_status: ["阶段状态", "Stage status"],
    current_judgment: ["当前判断", "Current judgment"],
    next_research_step: ["下一研究步骤", "Next research step"]
  };
  const localized = labels[value.toLowerCase()];
  if (localized) return localized[locale === "zh" ? 0 : 1];
  return value.replaceAll("_", " ");
}

function runtimeDetailSectionLabel(section: RuntimeDetailSection, locale: OplContributionSlotOwner["locale"]): string {
  const labels: Record<RuntimeDetailSection["id"], [string, string]> = {
    identity: ["任务", "Work item"],
    agent: ["智能体", "Agent"],
    phase: ["当前阶段", "Current phase"],
    "work.active": ["进行中", "Active"],
    "work.queued": ["待执行", "Queued"],
    "work.pending": ["待处理", "Pending"],
    hypotheses: ["研究假设", "Hypotheses"],
    roadmap: ["路线图", "Roadmap"]
  };
  return labels[section.id][locale === "zh" ? 0 : 1];
}

function RuntimeDetailResult({ sections, locale }: {
  sections: RuntimeDetailSection[];
  locale: OplContributionSlotOwner["locale"];
}) {
  return <div className="opl-runtime-detail-result">
    {sections.map((section) => <section key={section.id}>
      <h4>{runtimeDetailSectionLabel(section, locale)}</h4>
      {section.kind === "rows" ? (
        <dl className="opl-structured-fields">
          {section.rows.map((row) => <div key={row.id}><dt>{fieldLabel(row.id, locale)}</dt><dd><StructuredValue value={row.value} locale={locale} /></dd></div>)}
        </dl>
      ) : section.items.length ? (
        <ul className="opl-structured-list">
          {section.items.map((item) => <li key={item.id}><strong>{item.id}</strong><dl className="opl-structured-fields">{item.rows.map((row) => <div key={row.id}><dt>{fieldLabel(row.id, locale)}</dt><dd><StructuredValue value={row.value} locale={locale} /></dd></div>)}</dl></li>)}
        </ul>
      ) : <p className="opl-structured-empty">{locale === "zh" ? "暂无内容" : "No items"}</p>}
    </section>)}
  </div>;
}

function StructuredValue({ value, locale, depth = 0 }: {
  value: unknown;
  locale: OplContributionSlotOwner["locale"];
  depth?: number;
}): ReactNode {
  if (value === null || value === undefined) return <span className="opl-structured-empty">-</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="opl-structured-scalar">{String(value)}</span>;
  }
  if (depth >= 5) return <span className="opl-structured-empty">...</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="opl-structured-empty">{locale === "zh" ? "暂无内容" : "No items"}</span>;
    return (
      <ul className="opl-structured-list">
        {value.slice(0, 100).map((item, index) => <li key={index}><StructuredValue value={item} locale={locale} depth={depth + 1} /></li>)}
      </ul>
    );
  }
  if (typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>).slice(0, 100);
    if (!fields.length) return <span className="opl-structured-empty">{locale === "zh" ? "暂无内容" : "No fields"}</span>;
    return (
      <dl className="opl-structured-fields">
        {fields.map(([key, item]) => (
          <div key={key}>
            <dt>{fieldLabel(key, locale)}</dt>
            <dd><StructuredValue value={item} locale={locale} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="opl-structured-scalar">{String(value)}</span>;
}

type ActivityLogSummaryField = {
  id: string;
  label: string;
  value: string;
};

export type ActivityLogSummary = {
  state: StateDotState;
  statusLabel: string;
  fields: ActivityLogSummaryField[];
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function activityStatus(value: string | null): "healthy" | "attention" | "unavailable" | "unknown" {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (["available", "ready", "fresh", "healthy", "current", "pass", "ok"].includes(normalized)) return "healthy";
  if (["unavailable", "error", "failed", "blocked", "missing"].includes(normalized)) return "unavailable";
  if (["stale", "attention", "warning", "degraded", "partial"].includes(normalized)) return "attention";
  return "unknown";
}

function activityStatusLabel(status: ActivityLogSummary["state"], locale: OplContributionSlotOwner["locale"]): string {
  const labels: Record<ActivityLogSummary["state"], [string, string]> = {
    done: ["运行正常", "Operating normally"],
    warning: ["需要关注", "Needs attention"],
    error: ["当前不可用", "Unavailable"],
    ongoing: ["状态待确认", "Status pending"]
  };
  return labels[status][locale === "zh" ? 0 : 1];
}

function presentationValue(value: string, locale: OplContributionSlotOwner["locale"]): string {
  const labels: Record<string, [string, string]> = {
    available: ["可用", "Available"],
    ready: ["已就绪", "Ready"],
    fresh: ["最新", "Fresh"],
    healthy: ["正常", "Healthy"],
    current: ["当前", "Current"],
    pass: ["通过", "Pass"],
    unavailable: ["暂不可用", "Unavailable"],
    stale: ["可能过期", "May be stale"],
    attention: ["需要关注", "Needs attention"],
    warning: ["需要关注", "Needs attention"],
    degraded: ["部分可用", "Degraded"],
    failed: ["未通过", "Failed"],
    error: ["发生错误", "Error"]
  };
  return labels[value.toLowerCase()]?.[locale === "zh" ? 0 : 1] ?? value.replaceAll("_", " ");
}

function formatActivityTimestamp(value: string | null, locale: OplContributionSlotOwner["locale"]): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(timestamp);
}

/**
 * Activity-log providers may expose rich operational payloads. The ordinary
 * settings surface projects only broadly understood service status; raw data
 * remains available under the user-enabled developer-details control.
 */
export function buildActivityLogSummary(value: unknown, locale: OplContributionSlotOwner["locale"]): ActivityLogSummary {
  const result = recordValue(value) ?? {};
  const nativeCarrier = recordValue(result.native_carrier);
  const freshness = recordValue(result.freshness);
  const node = recordValue(result.node);
  const payload = recordValue(result.payload);
  const checks = Array.isArray(payload?.checks) ? payload.checks.map(recordValue).filter((check): check is Record<string, unknown> => check !== null) : [];
  const statusSignals = [
    stringValue(nativeCarrier?.availability),
    stringValue(nativeCarrier?.status),
    stringValue(freshness?.state),
    stringValue(payload?.doctor_state),
    stringValue(payload?.collection_status)
  ].map(activityStatus);
  const state: StateDotState = statusSignals.includes("unavailable")
    ? "error"
    : statusSignals.includes("attention")
      ? "warning"
      : statusSignals.includes("healthy")
        ? "done"
        : "ongoing";
  const fields: ActivityLogSummaryField[] = [];
  const displayName = stringValue(node?.display_name);
  const platform = stringValue(node?.platform);
  if (displayName || platform) {
    fields.push({
      id: "location",
      label: locale === "zh" ? "本机" : "This device",
      value: [displayName, platform].filter(Boolean).join(" · ")
    });
  }
  const collectionStatus = stringValue(payload?.collection_status);
  if (collectionStatus) {
    fields.push({
      id: "collection",
      label: locale === "zh" ? "数据状态" : "Data status",
      value: presentationValue(collectionStatus, locale)
    });
  }
  const activeConversationCount = numberValue(payload?.active_conversation_count);
  if (activeConversationCount !== null) {
    fields.push({
      id: "active-conversations",
      label: locale === "zh" ? "活跃对话" : "Active conversations",
      value: String(activeConversationCount)
    });
  }
  if (checks.length) {
    const passed = checks.filter((check) => activityStatus(stringValue(check.state)) === "healthy").length;
    const unavailable = checks.filter((check) => activityStatus(stringValue(check.state)) === "unavailable").length;
    const attention = checks.length - passed - unavailable;
    const fragments = [
      passed ? (locale === "zh" ? `${passed} 项通过` : `${passed} passed`) : null,
      attention ? (locale === "zh" ? `${attention} 项需关注` : `${attention} need attention`) : null,
      unavailable ? (locale === "zh" ? `${unavailable} 项暂不可用` : `${unavailable} unavailable`) : null
    ].filter((fragment): fragment is string => Boolean(fragment));
    fields.push({
      id: "checks",
      label: locale === "zh" ? "检查结果" : "Checks",
      value: fragments.join(locale === "zh" ? "，" : ", ")
    });
  }
  const observedAt = formatActivityTimestamp(stringValue(result.observed_at) ?? stringValue(freshness?.last_observed_at), locale);
  if (observedAt) {
    fields.push({
      id: "updated",
      label: locale === "zh" ? "上次更新" : "Updated",
      value: observedAt
    });
  }
  return { state, statusLabel: activityStatusLabel(state, locale), fields };
}

function ActivityLogResult({ value, locale, developerDetails }: {
  value: unknown;
  locale: OplContributionSlotOwner["locale"];
  developerDetails?: boolean;
}) {
  const summary = buildActivityLogSummary(value, locale);
  return <div className="opl-activity-log-summary" data-testid="opl-activity-log-summary">
    <p className="opl-activity-log-status"><StateDot state={summary.state} size={10} /><strong>{summary.statusLabel}</strong></p>
    {summary.fields.length ? (
      <dl className="opl-structured-fields">
        {summary.fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
      </dl>
    ) : <p className="opl-structured-empty">{locale === "zh" ? "暂未提供可展示的服务状态" : "No service status is available"}</p>}
    {developerDetails ? (
      <details className="opl-contribution-technical-details opl-activity-log-technical-details">
        <summary>{locale === "zh" ? "查看技术数据" : "View technical data"}</summary>
        <StructuredValue value={value} locale={locale} />
      </details>
    ) : null}
  </div>;
}

function ContributionView({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  return entry.view?.viewType === "channel_access"
    ? <ChannelAccessView entry={entry} owner={owner} />
    : <StructuredContributionView entry={entry} owner={owner} />;
}

function StructuredContributionView({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const view = entry.view;

  useEffect(() => {
    if (!view) return;
    if (entry.slot === "runtime.detail" && !owner.runtimeDetailIdentity) {
      setResult(null);
      setError("Selected work-item identity is unavailable");
      setState("error");
      return;
    }
    let active = true;
    setState("loading");
    setError("");
    const input = createOplContributionReadInput(entry, owner.runtimeDetailIdentity);
    void owner.readData(entry, input).then((value) => {
      if (!active) return;
      setResult(value);
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setResult(null);
      setError(String(reason));
      setState("error");
    });
    return () => { active = false; };
  }, [entry.packageId, owner.readData, owner.runtimeDetailIdentity?.agentId, owner.runtimeDetailIdentity?.domainId, owner.runtimeDetailIdentity?.workItemId, owner.runtimeDetailIdentity?.workItemScopeId, view?.dataRef]);

  if (!view) return null;
  if (state === "loading") {
    return <p className="opl-contribution-fallback" role="status"><StateDot state="ongoing" size={10} />{owner.locale === "zh" ? "正在读取模块数据" : "Loading module data"}</p>;
  }
  if (state === "error") {
    const identityUnavailable = entry.slot === "runtime.detail" && !owner.runtimeDetailIdentity;
    const errorLabel = identityUnavailable
      ? (owner.locale === "zh" ? "任务身份当前不可用" : "Work-item identity is unavailable")
      : (view.emptyState ? contributionLabel(view.emptyState, owner.locale, "") : (owner.locale === "zh" ? "模块数据当前不可用" : "Module data is unavailable"));
    return <p className="opl-contribution-fallback" role="status" title={error}><StateDot state="warning" size={10} />{errorLabel}</p>;
  }
  const runtimeDetail = entry.slot === "runtime.detail" ? buildRuntimeDetailResultViewModel({
    workItemIdentity: owner.runtimeDetailIdentity,
    readback: result
  }) : null;
  if (runtimeDetail?.state === "ready") {
    return <div className="opl-contribution-result" data-view-type={view.viewType} data-testid={`opl-ui-contribution-result-${entry.contributionKey}`}><RuntimeDetailResult sections={runtimeDetail.sections} locale={owner.locale} /></div>;
  }
  if (runtimeDetail?.state === "unavailable" && runtimeDetail.diagnostic.code !== "unsupported_surface") {
    const unavailableLabel = runtimeDetail.diagnostic.code === "identity_unavailable"
      ? (owner.locale === "zh" ? "任务身份当前不可用" : "Work-item identity is unavailable")
      : (owner.locale === "zh" ? "任务详情当前不可用" : "Runtime detail is unavailable");
    return <p className="opl-contribution-fallback" role="status" title={runtimeDetail.diagnostic.message}><StateDot state="warning" size={10} />{unavailableLabel}</p>;
  }
  if (entry.slot === "settings.section" && view.viewType === "activity_log") {
    return <div className="opl-contribution-result" data-view-type={view.viewType} data-testid={`opl-ui-contribution-result-${entry.contributionKey}`}>
      <ActivityLogResult value={result} locale={owner.locale} developerDetails={owner.developerDetails} />
    </div>;
  }
  return (
    <div className="opl-contribution-result" data-view-type={view.viewType} data-testid={`opl-ui-contribution-result-${entry.contributionKey}`}>
      <StructuredValue value={result} locale={owner.locale} />
    </div>
  );
}

function ChannelAccessActions({
  actions,
  entry,
  owner,
  onScopedAction
}: {
  actions: OplChannelAccessAction[];
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
  onScopedAction: (action: OplChannelAccessAction) => void;
}) {
  const available = actions.flatMap((action) => {
    const command = entry.commands.find((candidate) => candidate.commandId === action.commandId);
    return command ? [{ action, command }] : [];
  });
  if (!available.length) return null;
  return (
    <div className="opl-contribution-actions">
      {available.map(({ action, command }) => (
        <Button
          key={`${command.commandId}:${JSON.stringify(action.input)}`}
          variant={command.confirmationRequired ? "outline" : "ghost"}
          size="sm"
          icon={<Play aria-hidden="true" size={13} />}
          disabled={!owner.actionAvailable}
          onClick={() => onScopedAction(action)}
        >
          {contributionLabel(command.label, owner.locale, command.commandId)}
        </Button>
      ))}
    </div>
  );
}

function channelStatusLabel(result: OplChannelAccessResult, locale: OplContributionSlotOwner["locale"]): string {
  const status = result.connection?.state ?? result.status;
  const labels: Record<string, [string, string]> = {
    available: ["可用", "Available"],
    unavailable: ["不可用", "Unavailable"],
    disconnected: ["未连接", "Disconnected"],
    connecting: ["正在连接", "Connecting"],
    qr_ready: ["等待扫码", "Scan required"],
    qr_scanned: ["已扫码，等待确认", "Scanned; awaiting confirmation"],
    connected: ["已连接", "Connected"],
    attention: ["需要处理", "Needs attention"]
  };
  return labels[status]?.[locale === "zh" ? 0 : 1] ?? status;
}

function ChannelAccessView({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<OplChannelAccessResult | null>(null);
  const [error, setError] = useState("");
  const [timerRevision, setTimerRevision] = useState(0);
  const scopedInputRef = useRef<Record<string, unknown>>({});
  const view = entry.view!;

  useEffect(() => {
    let active = true;
    if (!result) setState("loading");
    setError("");
    void owner.readData(entry, scopedInputRef.current).then((value) => {
      if (!active) return;
      const parsed = readChannelAccessResult(value);
      if (!parsed) throw new Error("invalid channel_access contribution result");
      setResult(parsed);
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setResult(null);
      setError(String(reason));
      setState("error");
    });
    return () => { active = false; };
  }, [entry.packageId, owner.readData, owner.refreshRevision, timerRevision, view.dataRef]);

  useEffect(() => {
    if (state !== "ready" || !result?.refreshAfterMs) return;
    const timeout = window.setTimeout(() => {
      scopedInputRef.current = { channel_id: result.channelId };
      setTimerRevision((revision) => revision + 1);
    }, result.refreshAfterMs);
    return () => window.clearTimeout(timeout);
  }, [result?.channelId, result?.refreshAfterMs, state]);

  const runAction = (action: OplChannelAccessAction) => {
    const command = entry.commands.find((candidate) => candidate.commandId === action.commandId);
    if (!command) return;
    scopedInputRef.current = action.input;
    owner.onAction(entry, command, action.input);
  };

  if (state === "loading") {
    return <p className="opl-contribution-fallback" role="status"><StateDot state="ongoing" size={10} />{owner.locale === "zh" ? "正在读取渠道" : "Loading channel"}</p>;
  }
  if (state === "error" || !result) {
    return <p className="opl-contribution-fallback" role="status" title={error}><StateDot state="warning" size={10} />{view.emptyState ? contributionLabel(view.emptyState, owner.locale, "") : (owner.locale === "zh" ? "渠道当前不可用" : "The channel is unavailable")}</p>;
  }
  if (result.status === "unavailable") {
    return <p className="opl-contribution-fallback" role="status"><StateDot state="warning" size={10} />{owner.locale === "zh" ? "渠道当前不可用" : "The channel is unavailable"}</p>;
  }

  const qr = result.connection?.state === "qr_ready"
    && result.connection.qrChallenge
    && result.connection.qrChallenge.expiresAtMs > Date.now()
    ? result.connection.qrChallenge
    : undefined;
  return (
    <div className="opl-contribution-result" data-view-type="channel_access" data-testid={`opl-ui-contribution-result-${entry.contributionKey}`}>
      <div className="opl-contribution-badges">
        <Pill><StateDot state={result.connection?.state === "connected" ? "done" : "ongoing"} size={9} />{channelStatusLabel(result, owner.locale)}</Pill>
        {result.connection?.accountDisplayName ? <Pill>{result.connection.accountDisplayName}</Pill> : null}
      </div>
      {qr ? (
        <section className="opl-structured-fields" data-testid="opl-channel-access-qr">
          <div><dt><QrCode aria-hidden="true" size={15} />{owner.locale === "zh" ? "扫码登录" : "Scan to connect"}</dt><dd>
            {qr.payload.startsWith("data:image/")
              ? <img src={qr.payload} alt={owner.locale === "zh" ? "渠道登录二维码" : "Channel login QR code"} />
              : <QRCodeSVG
                  value={qr.payload}
                  size={192}
                  level="M"
                  marginSize={2}
                  title={owner.locale === "zh" ? "渠道登录二维码" : "Channel login QR code"}
                />}
          </dd></div>
        </section>
      ) : null}
      <ChannelAccessActions actions={result.actions} entry={entry} owner={owner} onScopedAction={runAction} />
      <section data-testid="opl-channel-access-pairings">
        <h3><Users aria-hidden="true" size={15} />{owner.locale === "zh" ? "待处理配对" : "Pending pairings"}</h3>
        {result.pendingPairings.length ? (
          <div className="opl-structured-fields">
            {result.pendingPairings.map((pairing) => (
              <div key={pairing.pairingId}>
                <dt>{pairing.displayName ?? pairing.platformUserId ?? pairing.pairingId}</dt>
                <dd><ChannelAccessActions actions={pairing.actions} entry={entry} owner={owner} onScopedAction={runAction} /></dd>
              </div>
            ))}
          </div>
        ) : <p className="opl-structured-empty">{owner.locale === "zh" ? "暂无待处理配对" : "No pending pairings"}</p>}
      </section>
      <section data-testid="opl-channel-access-users">
        <h3><ShieldCheck aria-hidden="true" size={15} />{owner.locale === "zh" ? "已授权用户" : "Authorized users"}</h3>
        {result.authorizedUsers.length ? (
          <div className="opl-structured-fields">
            {result.authorizedUsers.map((user) => (
              <div key={user.userId}>
                <dt>{user.displayName ?? user.platformUserId ?? user.userId}</dt>
                <dd><ChannelAccessActions actions={user.actions} entry={entry} owner={owner} onScopedAction={runAction} /></dd>
              </div>
            ))}
          </div>
        ) : <p className="opl-structured-empty">{owner.locale === "zh" ? "暂无已授权用户" : "No authorized users"}</p>}
      </section>
    </div>
  );
}

export function ProjectedContribution({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const supported = entry.contributionKind === "command_group"
    || (entry.contributionKind === "view" && entry.view !== undefined);
  return (
    <section
      className="opl-contribution"
      data-slot={entry.slot}
      data-testid={`opl-ui-contribution-${entry.contributionKey}`}
    >
      <ContributionHeader entry={entry} owner={owner} />
      {supported ? (
        <>
          <ContributionView entry={entry} owner={owner} />
          <ContributionBadges entry={entry} owner={owner} />
          {entry.view?.viewType === "channel_access" ? null : <ContributionActions entry={entry} owner={owner} />}
        </>
      ) : (
        <p className="opl-contribution-fallback" role="status">
          <StateDot state="warning" size={10} />
          {owner.locale === "zh"
            ? `暂不支持 ${entry.contributionKind}，其他模块仍可使用。`
            : `${entry.contributionKind} is not supported; other modules remain available.`}
        </p>
      )}
    </section>
  );
}
