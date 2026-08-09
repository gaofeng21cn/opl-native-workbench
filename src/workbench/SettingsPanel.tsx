import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  FolderCog,
  Gauge,
  Info,
  Link2,
  LoaderCircle,
  PackageOpen,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Workflow,
  Wrench,
  X
} from "lucide-react";
import { useMemo, useState, type PointerEventHandler, type ReactNode } from "react";
import type { PackageLifecycleActionRef, RuntimeMaintenanceActionRef, WorkbenchModel } from "./workbenchModel";
import {
  codexModelPolicy,
  modelLabel,
  reasoningLabel,
  type ResolvedCodexModelOption
} from "./modelPolicy";
import {
  settingsDefaults,
  type SettingKey,
  type WorkbenchSettings
} from "./settingsModel";

export type SettingsDestinationId =
  | "overview"
  | "account"
  | "models"
  | "resources"
  | "workspace"
  | "storage"
  | "agents"
  | "capabilities"
  | "instructions"
  | "services"
  | "updates"
  | "diagnostics"
  | "preferences"
  | "about";

type SettingsGroupId =
  | "overview"
  | "account_models"
  | "connections_deployment"
  | "workspace"
  | "agents_capabilities"
  | "runtime_maintenance"
  | "preferences";

type SettingsPanelProps = {
  model: WorkbenchModel;
  settings: WorkbenchSettings;
  modelOptions: ResolvedCodexModelOption[];
  resolvedModel?: ResolvedCodexModelOption;
  resolvedReasoning: string;
  resolvedReasoningOptions: string[];
  stateStatus: "loading" | "ready" | "error";
  stateError: string;
  activeDestination: SettingsDestinationId;
  onDestinationChange: (destination: SettingsDestinationId) => void;
  onRefresh: () => void;
  onSettingChange: <Key extends keyof WorkbenchSettings>(key: Key, value: WorkbenchSettings[Key]) => void;
  onReasoningChange: (reasoning: WorkbenchSettings["reasoningLevel"]) => void;
  onAction: (request: SettingsActionRequest) => void;
  actionBusyKey: string | null;
  actionFeedback: SettingsActionFeedback | null;
  pendingConfirmation: SettingsActionConfirmation | null;
  onConfirmAction: () => void;
  onCancelAction: () => void;
};

export type SettingsActionRequest = {
  key: string;
  actionId: string;
  label: string;
  payload: Record<string, unknown>;
  confirmationRequired: boolean;
};

export type SettingsActionFeedback = {
  tone: "success" | "attention" | "neutral";
  message: string;
};

export type SettingsActionConfirmation = {
  request: SettingsActionRequest;
  previewStatus: string;
};

type SettingsSidebarProps = {
  locale: WorkbenchSettings["locale"];
  activeDestination: SettingsDestinationId;
  onDestinationChange: (destination: SettingsDestinationId) => void;
  onBack: () => void;
  onWindowDrag: PointerEventHandler<HTMLElement>;
  onMobileClose: () => void;
};

type NavigationDestination = {
  id: SettingsDestinationId;
  label: string;
};

type NavigationGroup = {
  id: SettingsGroupId;
  label: string;
  icon: typeof Gauge;
  destinations: NavigationDestination[];
};

const navigationCopy = {
  zh: {
    groups: {
      overview: "概览",
      account_models: "账户与模型",
      connections_deployment: "连接与部署",
      workspace: "工作区",
      agents_capabilities: "智能体与能力",
      runtime_maintenance: "运行与维护",
      preferences: "偏好"
    },
    destinations: {
      overview: "概览",
      account: "账户与访问",
      models: "模型",
      resources: "资源与连接",
      workspace: "工作目录",
      storage: "数据与存储",
      agents: "智能体",
      capabilities: "能力",
      instructions: "指令",
      services: "服务状态",
      updates: "更新与修复",
      diagnostics: "日志与诊断",
      preferences: "偏好",
      about: "关于"
    }
  },
  en: {
    groups: {
      overview: "Overview",
      account_models: "Account & Models",
      connections_deployment: "Connections & Deployment",
      workspace: "Workspace",
      agents_capabilities: "Agents & Capabilities",
      runtime_maintenance: "Runtime & Maintenance",
      preferences: "Preferences"
    },
    destinations: {
      overview: "Overview",
      account: "Account & Access",
      models: "Models",
      resources: "Resources & Connections",
      workspace: "Working Directory",
      storage: "Data & Storage",
      agents: "Agents",
      capabilities: "Capabilities",
      instructions: "Instructions",
      services: "Service Status",
      updates: "Updates & Repair",
      diagnostics: "Logs & Diagnostics",
      preferences: "Preferences",
      about: "About"
    }
  }
} as const;

function navigationGroups(locale: WorkbenchSettings["locale"]): NavigationGroup[] {
  const copy = navigationCopy[locale];
  return [
    { id: "overview", label: copy.groups.overview, icon: Gauge, destinations: [{ id: "overview", label: copy.destinations.overview }] },
    {
      id: "account_models",
      label: copy.groups.account_models,
      icon: CircleUserRound,
      destinations: [
        { id: "account", label: copy.destinations.account },
        { id: "models", label: copy.destinations.models }
      ]
    },
    {
      id: "connections_deployment",
      label: copy.groups.connections_deployment,
      icon: Link2,
      destinations: [{ id: "resources", label: copy.destinations.resources }]
    },
    {
      id: "workspace",
      label: copy.groups.workspace,
      icon: FolderCog,
      destinations: [
        { id: "workspace", label: copy.destinations.workspace },
        { id: "storage", label: copy.destinations.storage }
      ]
    },
    {
      id: "agents_capabilities",
      label: copy.groups.agents_capabilities,
      icon: Bot,
      destinations: [
        { id: "agents", label: copy.destinations.agents },
        { id: "capabilities", label: copy.destinations.capabilities },
        { id: "instructions", label: copy.destinations.instructions }
      ]
    },
    {
      id: "runtime_maintenance",
      label: copy.groups.runtime_maintenance,
      icon: Wrench,
      destinations: [
        { id: "services", label: copy.destinations.services },
        { id: "updates", label: copy.destinations.updates },
        { id: "diagnostics", label: copy.destinations.diagnostics }
      ]
    },
    {
      id: "preferences",
      label: copy.groups.preferences,
      icon: SlidersHorizontal,
      destinations: [{ id: "preferences", label: copy.destinations.preferences }]
    }
  ];
}

function statusTone(status: string | undefined): "ready" | "attention" | "neutral" {
  if (!status) return "neutral";
  const normalized = status.toLowerCase();
  if (["ready", "connected", "active", "compatible", "available", "stable", "healthy"].some((value) => normalized.includes(value))) {
    return "ready";
  }
  if (["error", "attention", "stale", "required", "unavailable", "failed", "missing", "incompatible"].some((value) => normalized.includes(value))) {
    return "attention";
  }
  return "neutral";
}

function formatStatus(status: string | undefined, locale: WorkbenchSettings["locale"]): string {
  if (!status) return locale === "zh" ? "未知" : "Unknown";
  const labels: Record<string, [string, string]> = {
    connected: ["已连接", "Connected"],
    active: ["正常", "Active"],
    ready: ["正常", "Ready"],
    compatible: ["兼容", "Compatible"],
    unavailable: ["不可用", "Unavailable"],
    attention_needed: ["需要处理", "Needs attention"],
    action_available: ["可配置", "Action available"],
    diagnose_with_doctor: ["需要诊断", "Diagnosis available"],
    stable: ["稳定版", "Stable"],
    preview: ["预览版", "Preview"]
  };
  return labels[status]?.[locale === "zh" ? 0 : 1] ?? status.replaceAll("_", " ");
}

function formatNumber(value: number | undefined, locale: string, compact = false): string {
  if (value === undefined) return "--";
  return new Intl.NumberFormat(locale, compact
    ? { notation: "compact", maximumFractionDigits: 2 }
    : { maximumFractionDigits: 2 }
  ).format(value);
}

function formatAmount(value: number | undefined, currency: string | undefined, locale: string): string {
  if (value === undefined) return "--";
  if (!currency) return formatNumber(value, locale);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${formatNumber(value, locale)} ${currency}`;
  }
}

function formatBytes(value: number | undefined, locale: string): string {
  if (value === undefined) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (Math.abs(size) >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function gatewayAccountInitials(name: string | undefined): string {
  if (!name) return "OP";
  const characters = Array.from(name.trim());
  if (characters.some((character) => /\p{Script=Han}/u.test(character))) return characters.find((character) => /\p{Script=Han}/u.test(character)) ?? "OP";
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OP";
}

export function SettingsSidebar({
  locale,
  activeDestination,
  onDestinationChange,
  onBack,
  onWindowDrag,
  onMobileClose
}: SettingsSidebarProps) {
  const groups = useMemo(() => navigationGroups(locale), [locale]);
  const activeGroup = groups.find((group) => group.destinations.some((destination) => destination.id === activeDestination));
  const copy = navigationCopy[locale].destinations;

  return (
    <>
      <header className="brand-row settings-back-row" onPointerDown={onWindowDrag}>
        <button data-testid="opl-settings-back-to-app" className="settings-back-to-app" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} />
          <span>{locale === "zh" ? "返回应用" : "Back to app"}</span>
        </button>
        <button className="icon-button sidebar-close-mobile" type="button" aria-label={locale === "zh" ? "隐藏侧边栏" : "Hide sidebar"} onClick={onMobileClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <div className="settings-navigation" aria-label={locale === "zh" ? "设置导航" : "Settings navigation"}>
        <nav>
          {groups.map((group) => {
            const Icon = group.icon;
            const active = activeGroup?.id === group.id;
            return (
              <div className="settings-nav-group" key={group.id} data-active={active}>
                <button type="button" aria-expanded={group.destinations.length > 1 ? active : undefined} aria-current={group.destinations.some((item) => item.id === activeDestination) && group.destinations.length === 1 ? "page" : undefined} onClick={() => onDestinationChange(group.destinations[0].id)}>
                  <Icon aria-hidden="true" size={15} />
                  <span>{group.label}</span>
                </button>
                {active && group.destinations.length > 1 ? (
                  <div className="settings-subnav">
                    {group.destinations.map((destination) => (
                      <button key={destination.id} type="button" aria-current={destination.id === activeDestination ? "page" : undefined} onClick={() => onDestinationChange(destination.id)}>{destination.label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <button className="settings-about-link" type="button" aria-current={activeDestination === "about" ? "page" : undefined} onClick={() => onDestinationChange("about")}><Info aria-hidden="true" size={15} /><span>{copy.about}</span></button>
      </div>
    </>
  );
}

function SettingRow({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
      <div className="settings-row-value">{children}</div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group" data-testid="opl-settings-section">
      <h2>{title}</h2>
      <div className="settings-rows">{children}</div>
    </section>
  );
}

function StatusValue({ status, locale }: { status?: string; locale: WorkbenchSettings["locale"] }) {
  return (
    <span className="settings-status" data-tone={statusTone(status)}>
      <span aria-hidden="true" />
      {formatStatus(status, locale)}
    </span>
  );
}

function packageRoleLabel(role: string, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<string, [string, string]> = {
    standard_agent: ["智能体", "Agent"],
    workflow_profile: ["工作流", "Workflow"],
    capability_package: ["依赖与能力包", "Supporting capability"],
    framework_capability_package: ["依赖与能力包", "Supporting capability"]
  };
  return labels[role]?.[locale === "zh" ? 0 : 1] ?? role;
}

function packageActionLabel(action: PackageLifecycleActionRef, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<PackageLifecycleActionRef["kind"], [string, string]> = {
    install: ["安装", "Install"],
    update: ["更新", "Update"],
    repair: ["修复", "Repair"],
    uninstall: ["卸载", "Uninstall"],
    preferences: ["偏好", "Preferences"],
    other: [action.label, action.label]
  };
  return labels[action.kind][locale === "zh" ? 0 : 1];
}

function actionPayloadComplete(payload: Record<string, unknown>, requiredFields: string[]): boolean {
  return requiredFields.every((field) => {
    const alternatives = field.split(/\s+or\s+/i).map((item) => item.trim()).filter(Boolean);
    return alternatives.some((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== "");
  });
}

function PackageCatalog({
  model,
  settings,
  actionBusyKey,
  onAction
}: {
  model: WorkbenchModel;
  settings: WorkbenchSettings;
  actionBusyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
}) {
  const [scope, setScope] = useState<"official" | "all">("official");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const locale = settings.locale;
  const packages = model.packageLifecycle.filter((item) => item.packageId !== "missing_bridge");
  const roleOptions = [...new Set(packages.map((item) => item.packageRole))].sort();
  const statusOptions = [...new Set(packages.map((item) => item.status))].sort();
  const sourceOptions = [...new Set(packages.map((item) => item.publisher))].sort();
  const normalizedQuery = query.trim().toLowerCase();
  const visible = packages.filter((item) => {
    if (scope === "official" && !item.official) return false;
    if (roleFilter !== "all" && item.packageRole !== roleFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (sourceFilter !== "all" && item.publisher !== sourceFilter) return false;
    return !normalizedQuery || item.searchMetadata.query.includes(normalizedQuery);
  });
  const groups = [
    { key: "agent", label: locale === "zh" ? "OPL 官方智能体" : "Official OPL agents", icon: Bot },
    { key: "workflow", label: locale === "zh" ? "工作流" : "Workflows", icon: Workflow },
    { key: "supporting", label: locale === "zh" ? "依赖与能力包" : "Supporting packages", icon: PackageOpen },
    { key: "other", label: locale === "zh" ? "其他 Codex 插件" : "Other Codex plugins", icon: Boxes }
  ].map((group) => ({ ...group, items: visible.filter((item) => item.roleGroup === group.key) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="agent-catalog" data-testid="opl-settings-agent-catalog">
      <div className="agent-catalog-toolbar">
        <label className="settings-search-field">
          <Search aria-hidden="true" size={14} />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={locale === "zh" ? "搜索智能体与能力包" : "Search agents and packages"} />
        </label>
        <div className="segmented-control" aria-label={locale === "zh" ? "目录范围" : "Catalog scope"}>
          <button type="button" data-active={scope === "official"} onClick={() => setScope("official")}>{locale === "zh" ? "OPL 官方" : "OPL"}</button>
          <button type="button" data-active={scope === "all"} onClick={() => setScope("all")}>{locale === "zh" ? "全部" : "All"}</button>
        </div>
      </div>
      <div className="agent-catalog-filters">
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按角色筛选" : "Filter by role"}>
          <option value="all">{locale === "zh" ? "全部角色" : "All roles"}</option>
          {roleOptions.map((role) => <option key={role} value={role}>{packageRoleLabel(role, locale)}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按状态筛选" : "Filter by status"}>
          <option value="all">{locale === "zh" ? "全部状态" : "All statuses"}</option>
          {statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status, locale)}</option>)}
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按来源筛选" : "Filter by source"}>
          <option value="all">{locale === "zh" ? "全部来源" : "All sources"}</option>
          {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <span>{locale === "zh" ? `${visible.length} 项` : `${visible.length} items`}</span>
      </div>
      {groups.length ? groups.map((group) => (
        <section key={group.key} className="agent-catalog-group">
          <h2><group.icon aria-hidden="true" size={15} />{group.label}<span>{group.items.length}</span></h2>
          <div className="agent-package-list">
            {group.items.map((item) => {
              const executableActions = item.actions.filter((action) => action.status === "available" && actionPayloadComplete(action.payload, action.requiredPayloadFields));
              const primaryAction = executableActions.find((action) => action.actionId === item.recommendedActionId)
                ?? (item.installed === false ? executableActions.find((action) => action.kind === "install") : undefined)
                ?? (statusTone(item.status) === "attention" ? executableActions.find((action) => action.kind === "repair") : undefined);
              return (
                <details key={item.id} className="agent-package-row" data-testid="opl-settings-agent-row">
                  <summary>
                    <span className="agent-package-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description || packageRoleLabel(item.packageRole, locale)}</small>
                      <span className="agent-package-meta">
                        {item.version ? <span>v{item.version}</span> : null}
                        <span>{item.publisher}</span>
                        <span>{packageRoleLabel(item.packageRole, locale)}</span>
                      </span>
                    </span>
                    <span className="agent-package-summary-actions">
                      <StatusValue status={item.status} locale={locale} />
                      {primaryAction ? (
                        <button
                          className="settings-action-button primary"
                          type="button"
                          disabled={actionBusyKey !== null}
                          onClick={(event) => {
                            event.preventDefault();
                            onAction({
                              key: `${item.packageId}:${primaryAction.actionId}`,
                              actionId: primaryAction.actionId,
                              label: `${packageActionLabel(primaryAction, locale)} ${item.label}`,
                              payload: primaryAction.payload,
                              confirmationRequired: primaryAction.confirmationRequired
                            });
                          }}
                        >
                          {actionBusyKey === `${item.packageId}:${primaryAction.actionId}` ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : <Play aria-hidden="true" size={13} />}
                          {packageActionLabel(primaryAction, locale)}
                        </button>
                      ) : null}
                      <ChevronDown className="agent-package-chevron" aria-hidden="true" size={15} />
                    </span>
                  </summary>
                  <div className="agent-package-details">
                    <dl>
                      <div><dt>{locale === "zh" ? "安装" : "Installation"}</dt><dd>{item.installed === null ? "--" : item.installed ? (locale === "zh" ? "已安装" : "Installed") : (locale === "zh" ? "未安装" : "Not installed")}</dd></div>
                      <div><dt>{locale === "zh" ? "启用" : "Active"}</dt><dd>{item.activated === null ? "--" : item.activated ? (locale === "zh" ? "已启用" : "Active") : (locale === "zh" ? "未启用" : "Inactive")}</dd></div>
                      <div><dt>{locale === "zh" ? "版本状态" : "Version status"}</dt><dd>{formatStatus(item.currentness, locale)}</dd></div>
                    </dl>
                    {executableActions.length ? (
                      <div className="agent-package-actions">
                        {executableActions.map((action) => (
                          <button
                            key={`${item.id}:${action.actionId}`}
                            className={`settings-action-button ${action.kind === "uninstall" ? "danger" : ""}`}
                            type="button"
                            disabled={actionBusyKey !== null}
                            onClick={() => onAction({
                              key: `${item.packageId}:${action.actionId}`,
                              actionId: action.actionId,
                              label: `${packageActionLabel(action, locale)} ${item.label}`,
                              payload: action.payload,
                              confirmationRequired: action.confirmationRequired
                            })}
                          >
                            {actionBusyKey === `${item.packageId}:${action.actionId}` ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : null}
                            {packageActionLabel(action, locale)}
                          </button>
                        ))}
                      </div>
                    ) : <small>{locale === "zh" ? "当前没有可直接执行的管理动作" : "No directly executable management action"}</small>}
                    {settings.developerDetails ? (
                      <details className="agent-technical-details">
                        <summary>{locale === "zh" ? "技术详情" : "Technical details"}</summary>
                        <dl>{item.details.map((detail) => <div key={`${item.id}:${detail.label}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
                      </details>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )) : (
        <div className="settings-empty-state"><Search aria-hidden="true" size={18} /><span>{locale === "zh" ? "没有符合条件的项目" : "No matching items"}</span></div>
      )}
    </div>
  );
}

function RuntimeActionButton({
  action,
  locale,
  busyKey,
  onAction,
  primary = false
}: {
  action?: RuntimeMaintenanceActionRef;
  locale: WorkbenchSettings["locale"];
  busyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
  primary?: boolean;
}) {
  if (!action || !actionPayloadComplete(action.payload, action.requiredPayloadFields)) return null;
  const key = `runtime:${action.actionId}`;
  const labels: Record<string, [string, string]> = {
    settings_check_app_update: ["检查更新", "Check for updates"],
    settings_prune_runtime_roots_dry_run: ["检查可清理内容", "Check reclaimable data"],
    provider_service_status: ["检查服务", "Check service"],
    provider_service_start: ["启动服务", "Start service"],
    provider_service_restart: ["重启服务", "Restart service"],
    provider_worker_status: ["检查 Worker", "Check worker"],
    provider_worker_start: ["启动 Worker", "Start worker"],
    provider_worker_restart: ["重启 Worker", "Restart worker"],
    provider_scheduler_status: ["检查调度器", "Check scheduler"],
    provider_scheduler_install: ["安装调度器", "Install scheduler"],
    provider_scheduler_trigger: ["立即运行", "Run now"]
  };
  const label = labels[action.actionId]?.[locale === "zh" ? 0 : 1] ?? action.label;
  return (
    <button
      className={`settings-action-button ${primary ? "primary" : ""}`}
      type="button"
      disabled={busyKey !== null}
      onClick={() => onAction({ key, actionId: action.actionId, label, payload: action.payload, confirmationRequired: action.confirmationRequired })}
    >
      {busyKey === key ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : <RefreshCw aria-hidden="true" size={13} />}
      {label}
    </button>
  );
}

export function SettingsPanel({
  model,
  settings,
  modelOptions,
  resolvedModel,
  resolvedReasoning,
  resolvedReasoningOptions,
  stateStatus,
  stateError,
  activeDestination,
  onDestinationChange,
  onRefresh,
  onSettingChange,
  onReasoningChange,
  onAction,
  actionBusyKey,
  actionFeedback,
  pendingConfirmation,
  onConfirmAction,
  onCancelAction
}: SettingsPanelProps) {
  const groups = useMemo(() => navigationGroups(settings.locale), [settings.locale]);
  const locale = settings.locale === "zh" ? "zh-CN" : "en-US";
  const copy = navigationCopy[settings.locale].destinations;
  const activeGroup = groups.find((group) => group.destinations.some((destination) => destination.id === activeDestination));
  const projection = model.settingsProjection;
  const runtime = model.runtimeOverview;
  const gateway = model.gatewayAccount;
  const availableStarters = model.starters.filter((starter) => starter.available).length;
  const unavailableFixedModel = settings.modelAccess !== "__auto" && !resolvedModel;

  function settingValueLabel(key: SettingKey, value: WorkbenchSettings[SettingKey]): string {
    if (key === "modelAccess") return value === "__auto" ? (settings.locale === "zh" ? "自动" : "Auto") : modelLabel(value as string, settings.locale);
    if (key === "reasoningLevel") return reasoningLabel(value as string, settings.locale);
    if (key === "defaultWorkspace") return settings.locale === "zh" ? "OPL App 工作区" : "OPL App workspace";
    if (key === "runtimeProfile") return value === "fast" ? (settings.locale === "zh" ? "快速" : "Fast") : (settings.locale === "zh" ? "完整" : "Full");
    if (key === "professionalStarterDefaults") return settings.locale === "zh" ? "科研、基金与演示" : "Research, grant, and presentation";
    if (key === "theme") return value === "system" ? (settings.locale === "zh" ? "跟随系统" : "System") : (settings.locale === "zh" ? "浅色" : "Light");
    if (key === "artifactPreviewMode") return settings.locale === "zh" ? "丰富预览（仅引用）" : "Rich preview (refs only)";
    if (typeof value === "boolean") return value ? (settings.locale === "zh" ? "开" : "On") : (settings.locale === "zh" ? "关" : "Off");
    return String(value);
  }

  function renderSettingControl(key: SettingKey) {
    const value = settings[key];
    if (typeof value === "boolean") {
      return (
        <button className="setting-switch" role="switch" aria-checked={value} type="button" onClick={() => onSettingChange(key, !value)}>
          <span className="setting-switch-track" aria-hidden="true"><span /></span>
          <span>{settingValueLabel(key, value)}</span>
        </button>
      );
    }
    if (key === "locale") {
      return (
        <div className="segmented-control" data-testid="opl-locale-toggle" aria-label="Language">
          <button type="button" data-active={value === "zh"} onClick={() => onSettingChange("locale", "zh")}>中文</button>
          <button type="button" data-active={value === "en"} onClick={() => onSettingChange("locale", "en")}>English</button>
        </div>
      );
    }
    if (key === "reasoningLevel") {
      return (
        <select className="setting-select" data-testid="opl-settings-reasoning" value={resolvedReasoning} disabled={!resolvedModel} onChange={(event) => onReasoningChange(event.currentTarget.value)}>
          {codexModelPolicy.reasoningOptions.map((effort) => (
            <option key={effort} value={effort} disabled={!resolvedReasoningOptions.includes(effort)}>{reasoningLabel(effort, settings.locale)}</option>
          ))}
        </select>
      );
    }
    if (key === "modelAccess") {
      return (
        <select className="setting-select" data-testid="opl-model-access-entry" value={value} onChange={(event) => onSettingChange("modelAccess", event.currentTarget.value)}>
          <option value="__auto">{settings.locale === "zh" ? "自动" : "Auto"}</option>
          {value !== "__auto" && !modelOptions.some((option) => option.id === value) ? (
            <option value={value} disabled>{modelLabel(value, settings.locale)} ({settings.locale === "zh" ? "不可用" : "Unavailable"})</option>
          ) : null}
          {modelOptions.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.available}>
              {modelLabel(option.id, settings.locale)}{option.available ? "" : ` (${settings.locale === "zh" ? "不可用" : "Unavailable"})`}
            </option>
          ))}
        </select>
      );
    }
    if (key === "runtimeProfile") {
      return <button className="setting-toggle" type="button" onClick={() => onSettingChange("runtimeProfile", value === "fast" ? "full" : "fast")}>{settingValueLabel(key, value)}</button>;
    }
    if (key === "theme") {
      return <button className="setting-toggle" type="button" onClick={() => onSettingChange("theme", value === "system" ? "light" : "system")}>{settingValueLabel(key, value)}</button>;
    }
    return <span>{settingValueLabel(key, value)}</span>;
  }

  function renderContent() {
    if (activeDestination === "overview") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "账户" : "Account"}>
            <SettingRow label={settings.locale === "zh" ? "OPL Gateway" : "OPL Gateway"}>
              <span className="settings-inline-identity">
                <span className="settings-avatar" aria-hidden="true">{gatewayAccountInitials(gateway?.displayName)}</span>
                <span><strong data-testid="opl-settings-gateway-username">{gateway?.displayName ?? (settings.locale === "zh" ? "未连接" : "Not connected")}</strong><small>{gateway?.email ?? "OPL Gateway"}</small></span>
              </span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "连接状态" : "Connection status"}><StatusValue status={gateway?.status} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "当前运行状态" : "Current status"}>
            <SettingRow label="Codex CLI"><span>{projection?.codex.version ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "模型" : "Model"}><span>{projection?.codex.model ?? resolvedModel?.id ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "工作目录" : "Working directory"}><code>{projection?.workspace.selectedPath ?? "--"}</code></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "状态读取" : "State readback"}>
              <StatusValue status={stateStatus === "ready" ? "ready" : stateStatus === "error" ? "attention_needed" : undefined} locale={settings.locale} />
            </SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "account") {
      return (
        <>
          <div className="gateway-identity">
            <span className="settings-avatar large" aria-hidden="true">{gatewayAccountInitials(gateway?.displayName)}</span>
            <span>
              <strong data-testid="opl-settings-gateway-username">{gateway?.displayName ?? (settings.locale === "zh" ? "未连接 OPL Gateway" : "OPL Gateway not connected")}</strong>
              <small>{gateway?.email ?? (settings.locale === "zh" ? "未提供账户邮箱" : "No account email available")}</small>
            </span>
            <StatusValue status={gateway?.status} locale={settings.locale} />
          </div>
          <SettingsGroup title={settings.locale === "zh" ? "账户" : "Account"}>
            <SettingRow label={settings.locale === "zh" ? "账户状态" : "Account status"}><StatusValue status={gateway?.accountStatus ?? gateway?.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "余额" : "Balance"}><strong>{formatAmount(gateway?.balance?.amount, gateway?.balance?.currency, locale)}</strong></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "今日用量" : "Usage today"}><span>{formatNumber(gateway?.usage?.todayTokens, locale, true)} tokens · {formatAmount(gateway?.usage?.todayCost, gateway?.usage?.currency, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "累计用量" : "Total usage"}><span>{formatNumber(gateway?.usage?.totalTokens, locale, true)} tokens · {formatAmount(gateway?.usage?.totalCost, gateway?.usage?.currency, locale)}</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "此设备" : "This device"}>
            <SettingRow label={settings.locale === "zh" ? "设备" : "Device"}><span>{gateway?.installation?.deviceLabel ?? "--"}{gateway?.installation?.shortId ? ` · ${gateway.installation.shortId}` : ""}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "托管 Key" : "Managed key"}><span>{gateway?.managedKey?.name ?? "--"}{gateway?.managedKey?.status ? ` · ${formatStatus(gateway.managedKey.status, settings.locale)}` : ""}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "最近刷新" : "Last refresh"} detail={gateway?.freshness?.stale ? (settings.locale === "zh" ? "数据可能已过期" : "Data may be stale") : undefined}><span>{formatDate(gateway?.freshness?.observedAt, locale)}</span></SettingRow>
          </SettingsGroup>
          <button className="settings-command" type="button" onClick={onRefresh}><RefreshCw aria-hidden="true" size={14} />{settings.locale === "zh" ? "刷新状态" : "Refresh status"}</button>
        </>
      );
    }

    if (activeDestination === "models") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "会话配置" : "Session configuration"}>
            <SettingRow label={settings.locale === "zh" ? "模型" : "Model"} detail={unavailableFixedModel ? (settings.locale === "zh" ? "所选模型当前不可用" : "Selected model is unavailable") : undefined}>{renderSettingControl("modelAccess")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "推理强度" : "Reasoning effort"}>{renderSettingControl("reasoningLevel")}</SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "Codex 读取状态" : "Codex readback"}>
            <SettingRow label={settings.locale === "zh" ? "当前模型" : "Current model"}><code>{projection?.codex.model ?? "--"}</code></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "当前推理强度" : "Current reasoning"}><span>{projection?.codex.reasoningEffort ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "提供方" : "Provider"}><span>{projection?.codex.providerName ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "模型访问" : "Model access"}><StatusValue status={projection?.codex.accessStatus} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "配置文件" : "Configuration"}><code>{projection?.codex.configPath ?? "--"}</code></SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "resources") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "外部连接" : "External connections"}>
            {projection?.externalConnections.length ? projection.externalConnections.map((connection) => (
              <SettingRow key={connection.id} label={connection.name} detail={connection.endpoint}><StatusValue status={connection.status} locale={settings.locale} /></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "连接" : "Connections"}><span className="settings-muted">{settings.locale === "zh" ? "暂无外部连接" : "No external connections"}</span></SettingRow>}
          </SettingsGroup>
          <SettingsGroup title="Docker WebUI">
            <SettingRow label={settings.locale === "zh" ? "配置状态" : "Configuration"}><StatusValue status={projection?.dockerWebui.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行状态" : "Runtime"}><StatusValue status={projection?.dockerWebui.runtimeStatus} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "恢复能力" : "Recovery"}><StatusValue status={projection?.dockerWebui.recoveryStatus} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "workspace") {
      return (
        <SettingsGroup title={settings.locale === "zh" ? "工作目录" : "Working directory"}>
          <SettingRow label={settings.locale === "zh" ? "位置" : "Location"}><code>{projection?.workspace.selectedPath ?? "--"}</code></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "目录存在" : "Directory exists"}><span>{projection?.workspace.exists === null || projection?.workspace.exists === undefined ? "--" : projection.workspace.exists ? (settings.locale === "zh" ? "是" : "Yes") : (settings.locale === "zh" ? "否" : "No")}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "可写" : "Writable"}><span>{projection?.workspace.writable === null || projection?.workspace.writable === undefined ? "--" : projection.workspace.writable ? (settings.locale === "zh" ? "是" : "Yes") : (settings.locale === "zh" ? "否" : "No")}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "健康状态" : "Health"}><StatusValue status={projection?.workspace.healthStatus} locale={settings.locale} /></SettingRow>
        </SettingsGroup>
      );
    }

    if (activeDestination === "storage") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "智能体包存储" : "Agent package storage"}>
            <SettingRow label={settings.locale === "zh" ? "状态" : "Status"} detail={projection?.storage.agentPackageStore.reasonCode}><StatusValue status={projection?.storage.agentPackageStore.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "已用空间" : "Used space"}><span>{formatBytes(projection?.storage.agentPackageStore.bytes, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "可回收" : "Reclaimable"}><span>{formatBytes(projection?.storage.agentPackageStore.reclaimableBytes, locale)}</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="WebUI data">
            <SettingRow label={settings.locale === "zh" ? "状态" : "Status"} detail={projection?.storage.webuiDataVolume.reasonCode}><StatusValue status={projection?.storage.webuiDataVolume.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "已用空间" : "Used space"}><span>{formatBytes(projection?.storage.webuiDataVolume.bytes, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "可回收" : "Reclaimable"}><span>{formatBytes(projection?.storage.webuiDataVolume.reclaimableBytes, locale)}</span></SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "agents") {
      return (
        <>
          <div className="settings-page-summary">
            <span>{settings.locale === "zh" ? "官方智能体与能力包" : "Agents and capabilities"}</span>
            <StatusValue status={projection?.statusSummary.agentPackageHealth} locale={settings.locale} />
          </div>
          <PackageCatalog model={model} settings={settings} actionBusyKey={actionBusyKey} onAction={onAction} />
        </>
      );
    }

    if (activeDestination === "capabilities") {
      return (
        <SettingsGroup title={settings.locale === "zh" ? "能力" : "Capabilities"}>
          <SettingRow label={settings.locale === "zh" ? "可用专业入口" : "Available professional starters"}><span>{availableStarters} / {model.starters.length}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "本地默认入口" : "Local starter defaults"}>{renderSettingControl("professionalStarterDefaults")}</SettingRow>
          <SettingRow label={settings.locale === "zh" ? "能力包读取" : "Package readback"}><span>{model.packageLifecycle.length}</span></SettingRow>
        </SettingsGroup>
      );
    }

    if (activeDestination === "instructions") {
      return (
        <SettingsGroup title={settings.locale === "zh" ? "指令与上下文" : "Instructions & context"}>
          <SettingRow label={settings.locale === "zh" ? "个性化来源" : "Personalization sources"}><span>{projection?.workspace.personalizationSourceCount ?? 0}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "当前项目上下文" : "Current project context"}><span>{model.contextSources.length}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "状态来源" : "State source"}><code>{projection?.sourceRef ?? "--"}</code></SettingRow>
        </SettingsGroup>
      );
    }

    if (activeDestination === "services") {
      const runtimeActions = runtime?.maintenanceActions ?? [];
      const serviceAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.serviceReady === false ? "provider_service_start" : "provider_service_status"));
      const workerAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.workerReady === false ? "provider_worker_start" : "provider_worker_status"));
      const schedulerAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.schedulerStatus === "not_installed" ? "provider_scheduler_install" : "provider_scheduler_status"));
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "核心运行状态" : "Core runtime"}>
            <SettingRow label={settings.locale === "zh" ? "安装状态" : "Installation"}><StatusValue status={projection?.codex.installed === true ? "ready" : projection?.codex.installed === false ? "unavailable" : undefined} locale={settings.locale} /></SettingRow>
            <SettingRow label="Codex CLI" detail={projection?.codex.version ? `v${projection.codex.version}` : undefined}><StatusValue status={projection?.codex.versionStatus} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "智能体能力" : "Agent capabilities"}><StatusValue status={projection?.statusSummary.agentPackageHealth} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行载体" : "Runtime sources"}><StatusValue status={projection?.statusSummary.runtimeSourceHealth} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="OPL-managed Temporal Runtime">
            <SettingRow label={settings.locale === "zh" ? "服务" : "Service"} detail={runtime?.temporal.address}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.serviceStatus} locale={settings.locale} /><RuntimeActionButton action={serviceAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} /></span>
            </SettingRow>
            <SettingRow label="Worker" detail={runtime?.temporal.taskQueue}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.workerStatus} locale={settings.locale} /><RuntimeActionButton action={workerAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} /></span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "调度器" : "Scheduler"} detail={runtime?.temporal.observedAt ? formatDate(runtime.temporal.observedAt, locale) : undefined}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.schedulerStatus} locale={settings.locale} /><RuntimeActionButton action={schedulerAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} primary={statusTone(runtime?.temporal.schedulerStatus) === "attention"} /></span>
            </SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? `运行载体 ${runtime?.carriers.healthy ?? 0} / ${runtime?.carriers.total ?? 0}` : `Runtime sources ${runtime?.carriers.healthy ?? 0} / ${runtime?.carriers.total ?? 0}`}>
            {runtime?.carriers.items.length ? runtime.carriers.items.map((carrier) => (
              <SettingRow key={carrier.packageId} label={carrier.label} detail={[carrier.sourceOrigin, carrier.syncStatus].filter(Boolean).join(" · ")}><StatusValue status={carrier.status} locale={settings.locale} /></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "运行载体" : "Runtime sources"}><span className="settings-muted">--</span></SettingRow>}
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "updates") {
      const runtimeActions = runtime?.maintenanceActions ?? [];
      const recommendedAction = runtimeActions.find((action) => action.actionId === runtime?.recommendedActionId);
      const additionalActions = runtimeActions.filter((action) => action.actionId !== runtime?.recommendedActionId && !action.actionId.startsWith("provider_") && actionPayloadComplete(action.payload, action.requiredPayloadFields));
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "建议操作" : "Recommended action"}>
            <SettingRow label={statusTone(runtime?.temporal.schedulerStatus) === "attention" ? (settings.locale === "zh" ? "运行状态需要检查" : "Runtime needs attention") : (settings.locale === "zh" ? "应用更新" : "App updates")} detail={settings.locale === "zh" ? "操作完成后会自动刷新状态" : "State refreshes after completion"}>
              {recommendedAction ? <RuntimeActionButton action={recommendedAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} primary /> : <span className="settings-muted">{settings.locale === "zh" ? "当前没有建议操作" : "No recommended action"}</span>}
            </SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "版本与通道" : "Version and channel"}>
            <SettingRow label={settings.locale === "zh" ? "发布通道" : "Release channel"}><span>{formatStatus(projection?.localEnvironment.releaseChannel ?? projection?.statusSummary.releaseChannel, settings.locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "Codex 更新" : "Codex update"}><span>{projection?.codex.updateAvailable === null || projection?.codex.updateAvailable === undefined ? (settings.locale === "zh" ? "尚未检查" : "Not checked") : projection.codex.updateAvailable ? (settings.locale === "zh" ? "有可用更新" : "Update available") : (settings.locale === "zh" ? "已是当前版本" : "Up to date")}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "最近读取" : "Last readback"}><span>{formatDate(model.stateGeneratedAt, locale)}</span></SettingRow>
          </SettingsGroup>
          {additionalActions.length ? (
            <details className="settings-advanced-actions">
              <summary>{settings.locale === "zh" ? "更多维护操作" : "More maintenance actions"}<ChevronDown aria-hidden="true" size={14} /></summary>
              <div>{additionalActions.map((action) => <RuntimeActionButton key={action.actionId} action={action} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} />)}</div>
            </details>
          ) : null}
        </>
      );
    }

    if (activeDestination === "diagnostics") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "诊断" : "Diagnostics"}>
            <SettingRow label={settings.locale === "zh" ? "状态" : "Status"} detail={stateError || undefined}><StatusValue status={stateStatus === "ready" ? "ready" : stateStatus === "error" ? "attention_needed" : undefined} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "待处理问题" : "Issues"}><span>{projection?.statusSummary.issueCount ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "开发者详情" : "Developer details"}>{renderSettingControl("developerDetails")}</SettingRow>
          </SettingsGroup>
          {settings.developerDetails ? (
            <SettingsGroup title={settings.locale === "zh" ? "高级详情" : "Advanced details"}>
              <SettingRow label={settings.locale === "zh" ? "日志" : "Logs"}><code>{projection?.localEnvironment.logsDir ?? "--"}</code></SettingRow>
              <SettingRow label={settings.locale === "zh" ? "状态目录" : "State directory"}><code>{projection?.localEnvironment.stateDir ?? "--"}</code></SettingRow>
              <SettingRow label={settings.locale === "zh" ? "运行时来源" : "Runtime sources"}><code>{projection?.localEnvironment.runtimeSourcesRoot ?? "--"}</code></SettingRow>
              <SettingRow label="Codex CLI"><code>{projection?.codex.binaryPath ?? "--"}</code></SettingRow>
            </SettingsGroup>
          ) : null}
          <button className="settings-command" type="button" onClick={onRefresh}><RefreshCw aria-hidden="true" size={14} />{settings.locale === "zh" ? "刷新状态" : "Refresh status"}</button>
        </>
      );
    }

    if (activeDestination === "preferences") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "界面" : "Interface"}>
            <SettingRow label={settings.locale === "zh" ? "语言" : "Language"}>{renderSettingControl("locale")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "外观" : "Appearance"}>{renderSettingControl("theme")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "预览模式" : "Preview mode"}>{renderSettingControl("artifactPreviewMode")}</SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "执行" : "Execution"}>
            <SettingRow label={settings.locale === "zh" ? "执行前确认" : "Confirm before execute"}>{renderSettingControl("confirmBeforeExecute")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "默认工作区" : "Default workspace"}>{renderSettingControl("defaultWorkspace")}</SettingRow>
          </SettingsGroup>
        </>
      );
    }

    return (
      <>
        <div className="about-mark"><Boxes aria-hidden="true" size={24} /></div>
        <SettingsGroup title="One Person Lab Native">
          <SettingRow label={settings.locale === "zh" ? "版本" : "Version"}><span>0.1.0</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "定位" : "Channel"}><span>{settings.locale === "zh" ? "技术评估候选" : "Technical evaluation candidate"}</span></SettingRow>
          <SettingRow label="Codex CLI"><span>{projection?.codex.version ?? "--"}</span></SettingRow>
          <SettingRow label="AionCore"><span>{settings.locale === "zh" ? "不需要（未包含）" : "Not required (not included)"}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "运行接口" : "Runtime interface"}><span>Codex app-server · OPL App state/action</span></SettingRow>
        </SettingsGroup>
      </>
    );
  }

  const allDestinations = [...groups.flatMap((group) => group.destinations), { id: "about" as const, label: copy.about }];

  return (
    <section data-testid="opl-settings-panel" className="settings-page" aria-label="Settings">
      <div className="settings-mobile-navigation">
        <select aria-label={settings.locale === "zh" ? "设置页面" : "Settings page"} value={activeDestination} onChange={(event) => onDestinationChange(event.currentTarget.value as SettingsDestinationId)}>
          {allDestinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}
        </select>
      </div>

      <div className="settings-detail">
        <header className="settings-detail-header">
          <span>{activeGroup?.label ?? copy.about}</span>
          <h1>{copy[activeDestination]}</h1>
        </header>
        <div className="settings-content" data-section={activeDestination}>
          {actionFeedback ? (
            <div className="settings-action-feedback" data-tone={actionFeedback.tone} role="status">
              {actionFeedback.tone === "success" ? <CheckCircle2 aria-hidden="true" size={15} /> : <AlertCircle aria-hidden="true" size={15} />}
              <span>{actionFeedback.message}</span>
            </div>
          ) : null}
          {renderContent()}
        </div>
      </div>
      {pendingConfirmation ? (
        <div className="settings-action-dialog-backdrop" role="presentation">
          <section className="settings-action-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-action-dialog-title" data-testid="opl-settings-action-confirmation">
            <div className="settings-action-dialog-icon"><Wrench aria-hidden="true" size={18} /></div>
            <div>
              <h2 id="settings-action-dialog-title">{pendingConfirmation.request.label}</h2>
              <p>{settings.locale === "zh" ? "预检查已完成。确认后将通过 OPL App 执行，并重新读取最新状态。" : "The preview is complete. Confirm to execute through OPL App and refresh state."}</p>
              <small>{settings.locale === "zh" ? "预检查" : "Preview"}: {formatStatus(pendingConfirmation.previewStatus, settings.locale)}</small>
            </div>
            <div className="settings-action-dialog-actions">
              <button type="button" onClick={onCancelAction}>{settings.locale === "zh" ? "取消" : "Cancel"}</button>
              <button className="primary" type="button" onClick={onConfirmAction} disabled={actionBusyKey !== null}>
                {actionBusyKey ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : null}
                {settings.locale === "zh" ? "确认执行" : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
