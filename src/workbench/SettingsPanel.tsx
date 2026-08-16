import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Copy,
  FolderOpen,
  LoaderCircle,
  PackageOpen,
  Play,
  RefreshCw,
  Search,
  Workflow,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { CodexCapabilityCatalog } from "../bridge/oplBridge";
import type { CarrierDiagnosticsReadback } from "../bridge/oplBridge";
import type {
  AgentPackageLifecycleRef,
  ManagedUpdateComponentRef,
  ManagedUpdateProjection,
  PackageLifecycleActionRef,
  RuntimeMaintenanceActionRef,
  WorkbenchModel,
  WorkbenchSettingsProjection
} from "./workbenchModel";
import {
  autoModelLabel,
  codexModelPolicy,
  modelLabel,
  reasoningLabel,
  type ResolvedCodexModelOption
} from "./modelPolicy";
import type { SettingKey, WorkbenchSettings } from "./settingsModel";
import type { ManagedComputerUseAction, ManagedComputerUseViewModel } from "./managedComputerUse";
import {
  actionPayloadComplete,
  buildSettingsActionViewModel,
  type GatewayActionViewModel,
  type SettingsExecutableIntent,
  type SettingsActionRequest,
  type SettingsHostActionIntent,
  type SettingsActionViewModel
} from "./settingsActions";
import { AppearanceRow } from "../vendor/deepseek-harness/packages/client/ui-theme/src/client/AppearanceRow";

export type { SettingsActionRequest } from "./settingsActions";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "settings.theme": "appearance.title" | "appearance.light" | "appearance.dark" | "appearance.system";
  }
}

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
  managedUpdate: ManagedUpdateProjection | null;
  actionViewModel?: SettingsActionViewModel;
  settings: WorkbenchSettings;
  modelOptions: ResolvedCodexModelOption[];
  resolvedModel?: ResolvedCodexModelOption;
  resolvedReasoning: string;
  resolvedReasoningOptions: string[];
  stateStatus: "loading" | "ready" | "error";
  stateError: string;
  carrierDiagnostics: CarrierDiagnosticsReadback;
  capabilityCatalog: CodexCapabilityCatalog;
  capabilityStatus: "idle" | "loading" | "ready" | "error";
  capabilityError: string;
  onRefreshCapabilities: () => void;
  activeDestination: SettingsDestinationId;
  onRefresh: () => void;
  onChangeLogDirectory: () => void;
  onSettingChange: <Key extends keyof WorkbenchSettings>(key: Key, value: WorkbenchSettings[Key]) => void;
  onReasoningChange: (reasoning: WorkbenchSettings["reasoningLevel"]) => void;
  onAction: (request: SettingsActionRequest) => void;
  onHostAction?: (intent: SettingsHostActionIntent) => void;
  onGatewayLogin?: (credentials: { email: string; password: string; deviceLabel?: string }) => Promise<boolean>;
  actionBusyKey: string | null;
  actionFeedback: SettingsActionFeedback | null;
  pendingConfirmation: SettingsActionConfirmation | null;
  onConfirmAction: () => void;
  onCancelAction: () => void;
  contributions?: ReactNode;
};

export type SettingsActionFeedback = {
  tone: "success" | "attention" | "neutral";
  message: string;
};

export type SettingsActionConfirmation = {
  request: SettingsActionRequest;
  previewStatus: string;
};

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest('[hidden], [aria-hidden="true"]') && element.getClientRects().length > 0);
}

function trapDialogFocus(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null): void {
  if (event.key !== "Tab") return;
  const focusable = focusableElements(root);
  if (focusable.length === 0) {
    event.preventDefault();
    root?.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (!root?.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

type NavigationDestination = {
  id: SettingsDestinationId;
  label: string;
};

type NavigationGroup = {
  id: SettingsGroupId;
  label: string;
  destinations: NavigationDestination[];
};

const navigationCopy = {
  zh: {
    groups: {
      overview: "概览",
      account_models: "账户与模型",
      connections_deployment: "连接与访问",
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
      connections_deployment: "Connections & Access",
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
    { id: "overview", label: copy.groups.overview, destinations: [{ id: "overview", label: copy.destinations.overview }] },
    {
      id: "account_models",
      label: copy.groups.account_models,
      destinations: [
        { id: "account", label: copy.destinations.account },
        { id: "models", label: copy.destinations.models }
      ]
    },
    {
      id: "connections_deployment",
      label: copy.groups.connections_deployment,
      destinations: [{ id: "resources", label: copy.destinations.resources }]
    },
    {
      id: "workspace",
      label: copy.groups.workspace,
      destinations: [
        { id: "workspace", label: copy.destinations.workspace },
        { id: "storage", label: copy.destinations.storage }
      ]
    },
    {
      id: "agents_capabilities",
      label: copy.groups.agents_capabilities,
      destinations: [
        { id: "agents", label: copy.destinations.agents },
        { id: "capabilities", label: copy.destinations.capabilities },
        { id: "instructions", label: copy.destinations.instructions }
      ]
    },
    {
      id: "runtime_maintenance",
      label: copy.groups.runtime_maintenance,
      destinations: [
        { id: "services", label: copy.destinations.services },
        { id: "updates", label: copy.destinations.updates },
        { id: "diagnostics", label: copy.destinations.diagnostics }
      ]
    },
    {
      id: "preferences",
      label: copy.groups.preferences,
      destinations: [{ id: "preferences", label: copy.destinations.preferences }]
    }
  ];
}

export function settingsDestinations(locale: WorkbenchSettings["locale"]): NavigationDestination[] {
  return [
    ...navigationGroups(locale).map((group) => ({
      id: group.destinations[0]!.id,
      label: group.label
    })),
    { id: "about", label: navigationCopy[locale].destinations.about }
  ];
}

export function settingsSubDestinations(
  primaryDestination: SettingsDestinationId,
  locale: WorkbenchSettings["locale"]
): NavigationDestination[] {
  return navigationGroups(locale)
    .find((group) => group.destinations[0]?.id === primaryDestination)
    ?.destinations ?? [{ id: "about", label: navigationCopy[locale].destinations.about }];
}

export function statusTone(status: string | undefined): "ready" | "attention" | "neutral" {
  if (!status) return "neutral";
  const normalized = status.toLowerCase();
  if (["error", "attention", "stale", "required", "unavailable", "not_available", "not-available", "not_installed", "restart_needed", "failed", "missing", "incompatible", "unsupported"].some((value) => normalized.includes(value))) {
    return "attention";
  }
  if (["ready", "connected", "active", "compatible", "available", "installed", "enabled", "current", "stable", "healthy"].some((value) => normalized.includes(value))) {
    return "ready";
  }
  return "neutral";
}

export function carrierLogDetail(
  diagnostics: CarrierDiagnosticsReadback,
  locale: WorkbenchSettings["locale"]
): string {
  const logDirectory = diagnostics.application?.systemInfo.logDir;
  if (logDirectory) return logDirectory;
  if (diagnostics.status === "unavailable") {
    return locale === "zh" ? "当前运行方式不提供应用日志路径" : "This app mode does not provide an application log path";
  }
  return locale === "zh" ? "应用日志路径尚未就绪" : "The application log path is not ready";
}

export function formatStatus(status: string | undefined, locale: WorkbenchSettings["locale"]): string {
  if (!status) return locale === "zh" ? "待确认" : "Not available";
  const labels: Record<string, [string, string]> = {
    connected: ["已连接", "Connected"],
    loading: ["正在读取", "Loading"],
    active: ["可用", "Available"],
    ready: ["可用", "Available"],
    available: ["可用", "Available"],
    healthy: ["可用", "Available"],
    current: ["已是最新", "Up to date"],
    installed: ["已安装", "Installed"],
    enabled: ["已开启", "Enabled"],
    disabled: ["已关闭", "Disabled"],
    not_installed: ["未安装", "Not installed"],
    checking: ["正在检查", "Checking"],
    compatible: ["兼容", "Compatible"],
    required: ["需要授权", "Required"],
    permission_required: ["需要授权", "Permission required"],
    unavailable: ["不可用", "Unavailable"],
    not_available: ["不可用", "Unavailable"],
    "not-available": ["不可用", "Unavailable"],
    unsupported: ["当前不支持", "Not supported"],
    restart_needed: ["需要重新启动", "Restart required"],
    error: ["出现问题", "Needs attention"],
    attention_needed: ["需要处理", "Needs attention"],
    action_available: ["可配置", "Action available"],
    diagnose_with_doctor: ["需要诊断", "Diagnosis available"],
    setup_required: ["需要设置", "Setup required"],
    reauth_required: ["需要重新登录", "Sign in again"],
    verification_deferred: ["待确认", "Pending verification"],
    not_inventoried: ["尚未盘点", "Not inventoried"],
    awaiting_inventory: ["等待盘点", "Awaiting inventory"],
    usage_unavailable: ["用量不可用", "Usage unavailable"],
    not_configured: ["尚未配置", "Not configured"],
    unknown: ["待确认", "Not available"],
    app_state_projection: ["待确认", "Not available"],
    preview_legacy_modules_fallback: ["信息有限", "Limited information"],
    stable: ["稳定版", "Stable"],
    preview: ["预览版", "Preview"]
  };
  const normalized = status.toLowerCase();
  const exact = labels[normalized]?.[locale === "zh" ? 0 : 1];
  if (exact) return exact;
  if (statusTone(normalized) === "attention") return locale === "zh" ? "需要处理" : "Needs attention";
  if (statusTone(normalized) === "ready") return locale === "zh" ? "可用" : "Available";
  return locale === "zh" ? "待确认" : "Not available";
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

type StorageProjection = WorkbenchSettingsProjection["storage"][keyof WorkbenchSettingsProjection["storage"]];

function storagePresentationStatus(entry: StorageProjection | undefined): string | undefined {
  if (!entry) return undefined;
  if (entry.reasonCode === "inventory_cache_missing_or_invalid" && !entry.observedAt) return "not_inventoried";
  if (entry.status === "unavailable" && entry.observedAt) return "usage_unavailable";
  return entry.status;
}

function storageReason(entry: StorageProjection | undefined, locale: WorkbenchSettings["locale"]): string {
  if (!entry) return locale === "zh" ? "尚未收到存储状态" : "Storage status has not been received";
  if (entry.reasonCode === "inventory_cache_missing_or_invalid") {
    return entry.observedAt
      ? (locale === "zh" ? "上次盘点结果已不可用，现有数据不受影响" : "The previous inventory is unavailable; existing data is unaffected")
      : (locale === "zh" ? "尚未完成首次用量盘点，现有数据不受影响" : "The first usage inventory has not completed; existing data is unaffected");
  }
  if (entry.reasonCode) {
    return locale === "zh" ? "当前无法读取用量，稍后刷新可重新检查" : "Usage cannot be read right now; refresh to check again";
  }
  return entry.observedAt
    ? (locale === "zh" ? `盘点于 ${formatDate(entry.observedAt, "zh-CN")}` : `Inventoried ${formatDate(entry.observedAt, "en-US")}`)
    : (locale === "zh" ? "等待用量盘点" : "Awaiting usage inventory");
}

function storageAmount(value: number | undefined, entry: StorageProjection | undefined, locale: string): string {
  return value === undefined
    ? (locale.startsWith("zh") ? "等待盘点" : "Awaiting inventory")
    : formatBytes(value, locale);
}

export function gatewayAccountInitials(name: string | undefined): string {
  if (!name) return "OP";
  const characters = Array.from(name.trim());
  if (characters.some((character) => /\p{Script=Han}/u.test(character))) return characters.find((character) => /\p{Script=Han}/u.test(character)) ?? "OP";
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OP";
}

export type GatewayModelAccessState = "current" | "different" | "unknown";

export function gatewayModelAccessState(projection: WorkbenchSettingsProjection | undefined): GatewayModelAccessState {
  const provider = projection?.codex.providerName?.trim().toLocaleLowerCase();
  const source = projection?.codex.modelAccessSource?.trim().toLocaleLowerCase();
  if (provider?.includes("opl gateway") || ["opl_gateway", "gateway", "gateway_account"].includes(source ?? "")) {
    return "current";
  }
  if (provider || source) return "different";
  return "unknown";
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

export function packageRoleLabel(role: string, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<string, [string, string]> = {
    standard_agent: ["领域智能体", "Domain agent"],
    workflow_profile: ["工作流", "Workflow"],
    capability_package: ["能力支持", "Capability support"],
    framework_capability_package: ["能力支持", "Capability support"]
  };
  return labels[role]?.[locale === "zh" ? 0 : 1] ?? (locale === "zh" ? "其他扩展" : "Other extension");
}

export function localizedPackageDescription(
  item: Pick<AgentPackageLifecycleRef, "description" | "descriptionI18n" | "packageRole">,
  locale: WorkbenchSettings["locale"]
): string {
  const ownerLocalized = item.descriptionI18n[locale]?.trim();
  if (ownerLocalized) return ownerLocalized;
  const englishFallback = item.descriptionI18n.en?.trim() || item.description.trim();
  if (englishFallback) return englishFallback;
  const fallback: Record<string, [string, string]> = {
    standard_agent: ["用于专业任务规划、执行与交付的领域智能体。", "A domain agent for planning, execution, and delivery."],
    workflow_profile: ["提供可复用的任务流程与执行步骤。", "Provides reusable task workflows and execution steps."],
    capability_package: ["为智能体提供共享能力与连接支持。", "Provides shared capabilities and connections for agents."],
    framework_capability_package: ["为智能体提供共享能力与连接支持。", "Provides shared capabilities and connections for agents."]
  };
  return fallback[item.packageRole]?.[locale === "zh" ? 0 : 1]
    ?? (locale === "zh" ? "提供可在 One Person Lab 中使用的扩展能力。" : "Adds capabilities to One Person Lab.");
}

function packageActionLabel(action: PackageLifecycleActionRef, locale: WorkbenchSettings["locale"]): string {
  const labels: Record<PackageLifecycleActionRef["kind"], [string, string]> = {
    install: ["安装", "Install"],
    update: ["更新", "Update"],
    repair: ["修复", "Repair"],
    uninstall: ["卸载", "Uninstall"],
    preferences: ["偏好", "Preferences"],
    other: ["管理", "Manage"]
  };
  return labels[action.kind][locale === "zh" ? 0 : 1];
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
  const locale = settings.locale;
  const packages = model.packageLifecycle.filter((item) => item.packageId !== "missing_bridge");
  const roleOptions = [...new Set(packages.map((item) => item.packageRole))].sort();
  const statusOptions = [...new Set(packages.map((item) => item.status))].sort();
  const homeShortcutOrder = model.packageLifecycle.flatMap((item) => item.homeShortcuts.map((shortcut) => ({
    packageId: item.packageId,
    ...shortcut
  }))).sort((left, right) => left.sortOrder - right.sortOrder || left.shortcutId.localeCompare(right.shortcutId));
  const normalizedQuery = query.trim().toLowerCase();
  const visible = packages.filter((item) => {
    if (scope === "official" && !item.official) return false;
    if (roleFilter !== "all" && item.packageRole !== roleFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return !normalizedQuery || item.searchMetadata.query.includes(normalizedQuery);
  });
  const groups = [
    { key: "agent", label: locale === "zh" ? "领域智能体" : "Domain agents", icon: Bot },
    { key: "workflow", label: locale === "zh" ? "工作流" : "Workflows", icon: Workflow },
    { key: "supporting", label: locale === "zh" ? "能力支持" : "Capability support", icon: PackageOpen },
    { key: "other", label: locale === "zh" ? "其他扩展" : "Other extensions", icon: Boxes }
  ].map((group) => ({ ...group, items: visible.filter((item) => item.roleGroup === group.key) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="agent-catalog" data-testid="opl-settings-agent-catalog">
      <div className="agent-catalog-toolbar">
        <label className="settings-search-field">
          <Search aria-hidden="true" size={14} />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={locale === "zh" ? "搜索智能体与能力" : "Search agents and capabilities"} />
        </label>
        <div className="segmented-control" aria-label={locale === "zh" ? "目录范围" : "Catalog scope"}>
          <button type="button" data-active={scope === "official"} onClick={() => setScope("official")}>{locale === "zh" ? "官方" : "Official"}</button>
          <button type="button" data-active={scope === "all"} onClick={() => setScope("all")}>{locale === "zh" ? "全部" : "All"}</button>
        </div>
      </div>
      <div className="agent-catalog-filters">
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按角色筛选" : "Filter by role"}>
          <option value="all">{locale === "zh" ? "全部类型" : "All types"}</option>
          {roleOptions.map((role) => <option key={role} value={role}>{packageRoleLabel(role, locale)}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)} aria-label={locale === "zh" ? "按状态筛选" : "Filter by status"}>
          <option value="all">{locale === "zh" ? "全部状态" : "All statuses"}</option>
          {statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status, locale)}</option>)}
        </select>
        <span>{locale === "zh" ? `${visible.length} 项` : `${visible.length} items`}</span>
      </div>
      {groups.length ? groups.map((group) => (
        <section key={group.key} className="agent-catalog-group">
          <h2><group.icon aria-hidden="true" size={15} />{group.label}<span>{group.items.length}</span></h2>
          <div className="agent-package-list">
            {group.items.map((item) => {
              const executableActions = item.actions.filter((action) => action.status === "available" && actionPayloadComplete(action.payload, action.requiredPayloadFields));
              const preferenceAction = item.actions.find((action) => action.kind === "preferences" && action.status === "available");
              const primaryAction = executableActions.find((action) => action.actionId === item.recommendedActionId)
                ?? (item.installed === false ? executableActions.find((action) => action.kind === "install") : undefined)
                ?? (statusTone(item.status) === "attention" ? executableActions.find((action) => action.kind === "repair") : undefined);
              return (
                <details key={item.id} className="agent-package-row" data-testid="opl-settings-agent-row">
                  <summary>
                    <span className="agent-package-copy">
                      <strong>{item.label}</strong>
                      <small>{localizedPackageDescription(item, locale)}</small>
                      <span className="agent-package-meta">
                        {item.version ? <span>{locale === "zh" ? `版本 ${item.version}` : `Version ${item.version}`}</span> : null}
                        {item.automaticUpdate !== null ? <span>{item.automaticUpdate ? (locale === "zh" ? "自动更新" : "Automatic updates") : (locale === "zh" ? "手动更新" : "Manual updates")}</span> : null}
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
                      <div><dt>{locale === "zh" ? "使用状态" : "Usage"}</dt><dd>{item.installed === false ? (locale === "zh" ? "未安装" : "Not installed") : item.activated === true ? (locale === "zh" ? "已启用" : "Enabled") : item.installed === true ? (locale === "zh" ? "已安装" : "Installed") : (locale === "zh" ? "待确认" : "Not available")}</dd></div>
                      <div><dt>{locale === "zh" ? "更新方式" : "Updates"}</dt><dd>{item.automaticUpdate === null ? (locale === "zh" ? "待确认" : "Not available") : item.automaticUpdate ? (locale === "zh" ? "自动" : "Automatic") : (locale === "zh" ? "手动" : "Manual")}</dd></div>
                    </dl>
                    {item.homeShortcuts.length ? (
                      <div className="home-shortcut-preferences">
                        {item.homeShortcuts.map((shortcut) => {
                          const orderIndex = homeShortcutOrder.findIndex((entry) => entry.packageId === item.packageId && entry.shortcutId === shortcut.shortcutId);
                          const previous = orderIndex > 0 ? homeShortcutOrder[orderIndex - 1] : undefined;
                          const next = orderIndex >= 0 && orderIndex < homeShortcutOrder.length - 1 ? homeShortcutOrder[orderIndex + 1] : undefined;
                          const submitPreference = (key: string, visible: boolean, sortOrder: number) => {
                            if (!preferenceAction) return;
                            onAction({
                              key,
                              actionId: preferenceAction.actionId,
                              label: locale === "zh" ? `更新 ${item.label} 的新任务入口` : `Update ${item.label} New Task entry`,
                              payload: {
                                ...preferenceAction.payload,
                                shortcut_id: shortcut.shortcutId,
                                visible,
                                sort_order: sortOrder
                              },
                              confirmationRequired: preferenceAction.confirmationRequired
                            });
                          };
                          const visibilityKey = `home:${item.packageId}:${shortcut.shortcutId}:visibility`;
                          const orderKey = `home:${item.packageId}:${shortcut.shortcutId}:order`;
                          return (
                            <div key={`${item.packageId}:${shortcut.shortcutId}`} className="home-shortcut-preference">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={shortcut.visible}
                                  disabled={!preferenceAction || actionBusyKey !== null}
                                  onChange={(event) => submitPreference(visibilityKey, event.currentTarget.checked, shortcut.sortOrder)}
                                />
                                <span className="home-shortcut-copy">
                                  <strong>{locale === "zh" ? "在新任务中显示" : "Show in New Task"}</strong>
                                  <small>{locale === "zh" ? "开启后，可从新任务页直接选择此智能体。" : "Makes this agent available from the New Task screen."}</small>
                                </span>
                              </label>
                              <span className="home-shortcut-order-actions">
                                <button
                                  type="button"
                                  aria-label={locale === "zh" ? "向前移动" : "Move earlier"}
                                  title={locale === "zh" ? "向前移动" : "Move earlier"}
                                  disabled={!preferenceAction || !previous || actionBusyKey !== null}
                                  onClick={() => previous && submitPreference(orderKey, shortcut.visible, previous.sortOrder - 1)}
                                ><ArrowUp aria-hidden="true" size={13} /></button>
                                <button
                                  type="button"
                                  aria-label={locale === "zh" ? "向后移动" : "Move later"}
                                  title={locale === "zh" ? "向后移动" : "Move later"}
                                  disabled={!preferenceAction || !next || actionBusyKey !== null}
                                  onClick={() => next && submitPreference(orderKey, shortcut.visible, next.sortOrder + 1)}
                                ><ArrowDown aria-hidden="true" size={13} /></button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
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
                        <summary>{locale === "zh" ? "技术详情" : "Technical details"}<ChevronDown aria-hidden="true" size={13} /></summary>
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

function CapabilityDirectory({
  catalog,
  status,
  error,
  locale,
  showTechnicalDetails,
  onRefresh
}: {
  catalog: CodexCapabilityCatalog;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  locale: WorkbenchSettings["locale"];
  showTechnicalDetails: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const groups = [
    {
      id: "skills",
      label: locale === "zh" ? "技能" : "Skills",
      items: catalog.skills.map((item) => ({
        id: item.name,
        name: item.name,
        description: item.description,
        status: item.enabled ? "enabled" : "disabled",
        detail: item.scope,
        technical: item.path
      }))
    },
    {
      id: "plugins",
      label: locale === "zh" ? "插件" : "Plugins",
      items: catalog.plugins.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        status: item.enabled && item.callable ? "available" : item.enabled ? "attention_needed" : "disabled",
        detail: item.callable ? (locale === "zh" ? "可调用" : "Callable") : (locale === "zh" ? "当前不可调用" : "Not callable"),
        technical: item.id
      }))
    },
    {
      id: "apps",
      label: locale === "zh" ? "连接应用" : "Connected apps",
      items: catalog.apps.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        status: item.enabled && item.callable ? "available" : item.enabled ? "attention_needed" : "disabled",
        detail: item.callable ? (locale === "zh" ? "可调用" : "Callable") : (locale === "zh" ? "当前不可调用" : "Not callable"),
        technical: item.id
      }))
    }
  ].map((group) => ({
    ...group,
    visible: group.items.filter((item) => !normalizedQuery || `${item.name} ${item.description} ${item.detail}`.toLowerCase().includes(normalizedQuery))
  }));
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleTotal = groups.reduce((sum, group) => sum + group.visible.length, 0);
  const refreshLabel = locale === "zh" ? "刷新能力目录" : "Refresh capability directory";

  return (
    <section className="settings-capability-directory" data-testid="opl-settings-capability-directory">
      <div className="settings-capability-toolbar">
        <label className="settings-search-field">
          <Search aria-hidden="true" size={14} />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={locale === "zh" ? "搜索技能、插件和应用" : "Search skills, plugins, and apps"} />
        </label>
        <button className="settings-icon-button" type="button" aria-label={refreshLabel} title={refreshLabel} disabled={status === "loading"} onClick={onRefresh}>
          {status === "loading" ? <LoaderCircle className="spin" aria-hidden="true" size={15} /> : <RefreshCw aria-hidden="true" size={15} />}
        </button>
      </div>
      <div className="settings-capability-summary">
        <span>{locale === "zh" ? `${visibleTotal} / ${total} 项` : `${visibleTotal} / ${total} items`}</span>
        <span>{catalog.source === "codex_app_server" ? (locale === "zh" ? "来自本机能力目录" : "From the local capability catalog") : (locale === "zh" ? "能力目录尚未连接" : "Capability catalog is not connected")}</span>
      </div>
      {status === "error" ? <div className="settings-inline-notice" role="alert"><AlertCircle aria-hidden="true" size={15} /><span>{error || (locale === "zh" ? "能力目录读取失败" : "Capability catalog could not be read")}</span></div> : null}
      {status !== "loading" && total === 0 ? (
        <div className="settings-empty-state"><Boxes aria-hidden="true" size={18} /><span>{locale === "zh" ? "当前没有可显示的技能、插件或应用" : "No skills, plugins, or apps are available"}</span></div>
      ) : null}
      {groups.map((group) => group.visible.length ? (
        <section className="settings-capability-group" key={group.id}>
          <h2>{group.label}<span>{group.visible.length}</span></h2>
          <div className="settings-capability-list">
            {group.visible.map((item) => (
              <details className="settings-capability-row" key={`${group.id}:${item.id}`}>
                <summary>
                  <span className="settings-capability-copy"><strong>{item.name}</strong><small>{item.description || item.detail}</small></span>
                  <span className="settings-capability-state"><StatusValue status={item.status} locale={locale} /><ChevronDown aria-hidden="true" size={14} /></span>
                </summary>
                <div className="settings-capability-details">
                  <span>{item.description || (locale === "zh" ? "该能力没有附加说明" : "No additional description is available")}</span>
                  <small>{item.detail}</small>
                  {showTechnicalDetails ? <code>{item.technical}</code> : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null)}
    </section>
  );
}

function InstructionSource({
  title,
  status,
  content,
  detail,
  locale
}: {
  title: string;
  status?: string;
  content?: string;
  detail?: string;
  locale: WorkbenchSettings["locale"];
}) {
  const [copied, setCopied] = useState(false);
  const copyLabel = copied
    ? (locale === "zh" ? "已复制" : "Copied")
    : (locale === "zh" ? `复制${title}` : `Copy ${title}`);
  const firstLine = content?.split(/\r?\n/).find((line) => line.trim())?.trim();
  return (
    <details className="settings-instruction-source" data-testid="opl-settings-instruction-source">
      <summary>
        <span className="settings-capability-copy"><strong>{title}</strong><small>{firstLine || detail || (locale === "zh" ? "暂无内容" : "No content")}</small></span>
        <span className="settings-capability-state"><StatusValue status={status} locale={locale} /><ChevronDown aria-hidden="true" size={14} /></span>
      </summary>
      <div className="settings-instruction-content">
        <div className="settings-instruction-toolbar">
          {detail ? <small>{detail}</small> : <span />}
          <button
            className="settings-icon-button"
            type="button"
            aria-label={copyLabel}
            title={copyLabel}
            disabled={!content}
            onClick={() => {
              if (!content || !navigator.clipboard) return;
              void navigator.clipboard.writeText(content).then(() => {
                setCopied(true);
                globalThis.setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            <Copy aria-hidden="true" size={15} />
          </button>
        </div>
        <pre>{content || (locale === "zh" ? "当前没有可显示的指令内容。" : "No instruction content is available.")}</pre>
      </div>
    </details>
  );
}

function RuntimeActionButton({
  action,
  locale,
  busyKey,
  onAction,
  primary = false,
  previewOnly = false
}: {
  action?: RuntimeMaintenanceActionRef;
  locale: WorkbenchSettings["locale"];
  busyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
  primary?: boolean;
  previewOnly?: boolean;
}) {
  if (!action || !actionPayloadComplete(action.payload, action.requiredPayloadFields)) return null;
  const key = `runtime:${action.actionId}`;
  const labels: Record<string, [string, string]> = {
    settings_check_app_update: ["检查更新", "Check for updates"],
    settings_apply_opl_packages: ["更新能力包", "Update packages"],
    settings_sync_capabilities: ["同步能力", "Sync capabilities"],
    settings_prune_runtime_roots_dry_run: ["检查可清理内容", "Check reclaimable data"],
    provider_service_status: ["检查服务", "Check service"],
    provider_service_start: ["启动服务", "Start service"],
    provider_service_restart: ["重启服务", "Restart service"],
    provider_worker_status: ["检查任务处理", "Check task processing"],
    provider_worker_start: ["启动任务处理", "Start task processing"],
    provider_worker_restart: ["重启任务处理", "Restart task processing"],
    provider_scheduler_status: ["检查定时任务", "Check scheduled tasks"],
    provider_scheduler_install: ["启用定时任务", "Enable scheduled tasks"],
    provider_scheduler_trigger: ["立即运行", "Run now"],
    settings_install_docker_webui: ["安装网页端", "Install WebUI"],
    settings_configure_webui_api_key: ["配置访问密钥", "Configure access key"],
    settings_run_webui_startup_maintenance: ["运行启动维护", "Run startup maintenance"],
    settings_open_docker_webui: ["打开网页端", "Open WebUI"],
    settings_diagnose_docker_webui: ["运行诊断", "Run diagnostics"]
  };
  const label = labels[action.actionId]?.[locale === "zh" ? 0 : 1] ?? action.label;
  const refreshOnly = [
    "settings_check_app_update",
    "settings_sync_capabilities",
    "provider_service_status",
    "provider_worker_status",
    "provider_scheduler_status"
  ].includes(action.actionId);
  return (
    <button
      className={`${refreshOnly ? "settings-icon-button" : "settings-action-button"} ${primary ? "primary" : ""}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={busyKey !== null}
      onClick={() => onAction({ key, actionId: action.actionId, label, payload: action.payload, confirmationRequired: action.confirmationRequired, previewOnly })}
    >
      {busyKey === key ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : refreshOnly ? <RefreshCw aria-hidden="true" size={13} /> : null}
      {refreshOnly ? <span className="visually-hidden">{label}</span> : label}
    </button>
  );
}

function ManagedComputerUseGroup({
  companion,
  locale,
  busyKey,
  onAction
}: {
  companion: ManagedComputerUseViewModel;
  locale: WorkbenchSettings["locale"];
  busyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
}) {
  const yesNo = (value: boolean) => value
    ? (locale === "zh" ? "是" : "Yes")
    : (locale === "zh" ? "否" : "No");
  const actionLabel = (action: ManagedComputerUseAction): string => {
    const labels: Record<string, [string, string]> = {
      settings_request_computer_use_permissions: ["授予权限", "Allow permissions"],
      settings_recheck_computer_use: ["重新检查", "Recheck"],
      settings_repair_computer_use: ["修复", "Repair"],
      settings_reinstall_computer_use: ["重新安装", "Reinstall"]
    };
    return labels[action.actionId]?.[locale === "zh" ? 0 : 1] ?? action.label;
  };

  return (
    <SettingsGroup title={locale === "zh" ? "OPL 托管" : "OPL managed"}>
      <SettingRow
        label={`${companion.productName}${companion.version ? ` ${companion.version}` : ""}`}
        detail={companion.providerId}
      >
        <StatusValue status={companion.status} locale={locale} />
      </SettingRow>
      <SettingRow label={locale === "zh" ? "安装与启用" : "Install and enablement"}>
        <span data-testid="opl-managed-computer-use-installation">
          {locale === "zh"
            ? `已安装 ${yesNo(companion.installed)} · 已注册 ${yesNo(companion.registered)} · 已启用 ${yesNo(companion.enabled)}`
            : `Installed ${yesNo(companion.installed)} · Registered ${yesNo(companion.registered)} · Enabled ${yesNo(companion.enabled)}`}
        </span>
      </SettingRow>
      <SettingRow label={locale === "zh" ? "权限" : "Permissions"} detail={companion.healthRef}>
        <StatusValue status={companion.permission} locale={locale} />
      </SettingRow>
      {companion.actions.length ? (
        <SettingRow label={locale === "zh" ? "操作" : "Actions"}>
          <span className="runtime-setting-control" data-testid="opl-managed-computer-use-actions">
            {companion.actions.map((action) => {
              const key = `managed-computer-use:${action.actionId}`;
              const label = actionLabel(action);
              const refreshOnly = action.actionId === "settings_recheck_computer_use";
              return (
                <button
                  key={action.actionId}
                  className={`${refreshOnly ? "settings-icon-button" : "settings-action-button"} ${action.dangerLevel === "medium" ? "danger" : ""}`}
                  type="button"
                  aria-label={label}
                  title={label}
                  data-testid={`opl-managed-computer-use-action-${action.actionId}`}
                  disabled={busyKey !== null}
                  onClick={() => onAction({
                    key,
                    actionId: action.actionId,
                    label,
                    payload: {},
                    confirmationRequired: action.confirmationRequired
                  })}
                >
                  {busyKey === key
                    ? <LoaderCircle className="spin" aria-hidden="true" size={13} />
                    : refreshOnly
                      ? <RefreshCw aria-hidden="true" size={13} />
                      : <Wrench aria-hidden="true" size={13} />}
                  {refreshOnly ? <span className="visually-hidden">{label}</span> : label}
                </button>
              );
            })}
          </span>
        </SettingRow>
      ) : null}
    </SettingsGroup>
  );
}

function settingsIntentLabel(intent: SettingsExecutableIntent, locale: WorkbenchSettings["locale"]): string {
  if (intent.transport !== "app_action") return intent.label;
  const semanticLabels: Record<string, [string, string]> = {
    refresh: ["刷新", "Refresh"],
    disconnect: ["断开连接", "Disconnect"],
    repair: ["修复", "Repair"],
    complete_setup: ["完成设置", "Complete setup"],
    use_for_model_access: ["切换为 OPL Gateway", "Switch to OPL Gateway"]
  };
  return (intent.semantic ? semanticLabels[intent.semantic]?.[locale === "zh" ? 0 : 1] : undefined) ?? intent.label;
}

function SettingsIntentButton({
  intent,
  locale,
  busyKey,
  onAction,
  onHostAction,
  primary = false
}: {
  intent?: SettingsExecutableIntent;
  locale: WorkbenchSettings["locale"];
  busyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
  onHostAction?: (intent: SettingsHostActionIntent) => void;
  primary?: boolean;
}) {
  if (!intent || intent.availability !== "ready" || (intent.transport !== "app_action" && !onHostAction)) return null;
  const label = settingsIntentLabel(intent, locale);
  const isRefresh = intent.transport === "app_action"
    ? intent.semantic === "refresh" || intent.semantic === "status" || intent.semantic === "check"
    : intent.operation === "status" || intent.operation === "check";
  return (
    <button
      className={`${isRefresh ? "settings-icon-button" : "settings-action-button"} ${primary ? "primary" : ""}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={busyKey !== null}
      onClick={() => intent.transport === "app_action" ? onAction(intent) : onHostAction?.(intent)}
    >
      {busyKey === intent.key
        ? <LoaderCircle className="spin" aria-hidden="true" size={13} />
        : isRefresh ? <RefreshCw aria-hidden="true" size={13} /> : <Play aria-hidden="true" size={13} />}
      {isRefresh ? <span className="visually-hidden">{label}</span> : label}
    </button>
  );
}

export function formatUpdateChannel(value: string | undefined, locale: WorkbenchSettings["locale"]): string {
  if (!value) return locale === "zh" ? "默认" : "Default";
  const normalized = value.toLowerCase();
  if (normalized === "stable") return locale === "zh" ? "稳定版" : "Stable";
  if (normalized === "preview" || normalized === "beta") return locale === "zh" ? "预览版" : "Preview";
  return locale === "zh" ? "自定义" : "Custom";
}

function formatUpdatePolicy(value: string | undefined, eligible: boolean | null | undefined, locale: WorkbenchSettings["locale"]): string {
  const normalized = value?.toLowerCase();
  if (normalized && ["silent_background", "automatic", "auto", "enabled"].includes(normalized)) {
    return locale === "zh" ? "自动" : "Automatic";
  }
  if (normalized && ["manual", "explicit", "disabled"].includes(normalized)) {
    return locale === "zh" ? "手动" : "Manual";
  }
  if (eligible === true) return locale === "zh" ? "自动" : "Automatic";
  if (eligible === false) return locale === "zh" ? "手动" : "Manual";
  return locale === "zh" ? "待确认" : "Not available";
}

function ManagedUpdateGroup({
  component,
  fallbackLabel,
  managedChannel,
  actions,
  locale,
  busyKey,
  onAction,
  onHostAction,
  unavailableActionLabel
}: {
  component?: ManagedUpdateComponentRef;
  fallbackLabel: string;
  managedChannel?: string;
  actions: SettingsExecutableIntent[];
  locale: WorkbenchSettings["locale"];
  busyKey: string | null;
  onAction: (request: SettingsActionRequest) => void;
  onHostAction?: (intent: SettingsHostActionIntent) => void;
  unavailableActionLabel?: string;
}) {
  const version = component?.installedVersion
    ? component.latestVersion && component.latestVersion !== component.installedVersion
      ? `${component.installedVersion} -> ${component.latestVersion}`
      : component.installedVersion
    : component?.latestVersion ?? "--";
  const autoPolicy = formatUpdatePolicy(component?.autoApplyMode, component?.autoApplyEligible, locale);
  const renderableActions = actions.filter((intent) => (
    intent.availability === "ready" && (intent.transport === "app_action" || Boolean(onHostAction))
  ));
  return (
    <SettingsGroup title={fallbackLabel}>
      <SettingRow label={locale === "zh" ? "状态" : "Status"}>
        <span className="runtime-setting-control">
          <StatusValue status={component?.state} locale={locale} />
          {renderableActions.length
            ? renderableActions.map((intent) => <SettingsIntentButton key={intent.key} intent={intent} locale={locale} busyKey={busyKey} onAction={onAction} onHostAction={onHostAction} />)
            : <span className="settings-muted">{unavailableActionLabel ?? "--"}</span>}
        </span>
      </SettingRow>
      <SettingRow label={locale === "zh" ? "版本" : "Version"}><span>{version}</span></SettingRow>
      <SettingRow label={locale === "zh" ? "更新通道" : "Update channel"}><span>{formatUpdateChannel(component?.channel ?? managedChannel, locale)}</span></SettingRow>
      <SettingRow label={locale === "zh" ? "自动更新" : "Automatic updates"}><span>{autoPolicy}</span></SettingRow>
    </SettingsGroup>
  );
}

export function SettingsPanel({
  model,
  managedUpdate,
  actionViewModel: projectedActionViewModel,
  settings,
  modelOptions,
  resolvedModel,
  resolvedReasoning,
  resolvedReasoningOptions,
  stateStatus,
  stateError,
  carrierDiagnostics,
  capabilityCatalog,
  capabilityStatus,
  capabilityError,
  onRefreshCapabilities,
  activeDestination,
  onRefresh,
  onChangeLogDirectory,
  onSettingChange,
  onReasoningChange,
  onAction,
  onHostAction,
  onGatewayLogin,
  actionBusyKey,
  actionFeedback,
  pendingConfirmation,
  onConfirmAction,
  onCancelAction,
  contributions
}: SettingsPanelProps) {
  const groups = useMemo(() => navigationGroups(settings.locale), [settings.locale]);
  const locale = settings.locale === "zh" ? "zh-CN" : "en-US";
  const copy = navigationCopy[settings.locale].destinations;
  const [subDestination, setSubDestination] = useState<SettingsDestinationId | null>(null);
  const activeGroup = groups.find((group) => group.destinations[0]?.id === activeDestination);
  const selectedDestination = activeGroup?.destinations.some((destination) => destination.id === subDestination)
    ? subDestination!
    : activeDestination;
  const projection = model.settingsProjection;
  const runtime = model.runtimeOverview;
  const gateway = model.gatewayAccount;
  const [gatewayEmail, setGatewayEmail] = useState("");
  const [gatewayPassword, setGatewayPassword] = useState("");
  const [gatewayDeviceLabel, setGatewayDeviceLabel] = useState("");
  const confirmationDialogRef = useRef<HTMLElement | null>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmationOpen = pendingConfirmation !== null;
  const derivedActionViewModel = useMemo(() => buildSettingsActionViewModel(model, managedUpdate), [managedUpdate, model]);
  const actionViewModel = projectedActionViewModel ?? derivedActionViewModel;
  const availableStarters = model.starters.filter((starter) => starter.available).length;
  const officialPackageCount = model.packageLifecycle.filter((item) => item.official && item.packageId !== "missing_bridge").length;
  const unavailableFixedModel = settings.modelAccess !== "__auto" && !resolvedModel;
  const stateLoading = stateStatus === "loading";
  const stateFailed = stateStatus === "error";
  const statePlaceholder = stateLoading
    ? (settings.locale === "zh" ? "正在读取" : "Loading")
    : "--";
  const missingGatewayLabel = stateLoading
    ? (settings.locale === "zh" ? "正在读取账户" : "Loading account")
    : stateFailed
      ? (settings.locale === "zh" ? "账户状态不可用" : "Account status unavailable")
      : (settings.locale === "zh" ? "未连接" : "Not connected");
  const missingGatewayDetail = stateLoading
    ? (settings.locale === "zh" ? "正在读取账户状态" : "Reading account status")
    : stateFailed
      ? (settings.locale === "zh" ? "请刷新状态后重试" : "Refresh state to retry")
      : (settings.locale === "zh" ? "连接账户后可同步用量与访问状态" : "Connect an account to sync usage and access status");
  const readbackStatus = stateLoading ? "loading" : stateFailed ? "attention_needed" : "ready";
  const gatewayAction = (kind: GatewayActionViewModel["kind"]) => actionViewModel.gatewayActions.find((action) => action.kind === kind);
  const modelAccessState = gatewayModelAccessState(projection);

  useEffect(() => {
    if (selectedDestination === "capabilities" && capabilityStatus === "idle") onRefreshCapabilities();
  }, [capabilityStatus, onRefreshCapabilities, selectedDestination]);

  useEffect(() => {
    if (!confirmationOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmationCancelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [confirmationOpen]);

  function settingValueLabel(key: SettingKey, value: WorkbenchSettings[SettingKey]): string {
    if (key === "modelAccess") return value === "__auto" ? (settings.locale === "zh" ? "自动" : "Auto") : modelLabel(value as string, settings.locale);
    if (key === "reasoningLevel") return reasoningLabel(value as string, settings.locale, true);
    if (key === "defaultWorkspace") return settings.locale === "zh" ? "当前工作区" : "Current workspace";
    if (key === "runtimeProfile") return value === "fast" ? (settings.locale === "zh" ? "快速" : "Fast") : (settings.locale === "zh" ? "完整" : "Full");
    if (key === "professionalStarterDefaults") return settings.locale === "zh" ? "科研、基金与演示" : "Research, grant, and presentation";
    if (key === "theme") {
      if (value === "system") return settings.locale === "zh" ? "跟随系统" : "System";
      return value === "dark" ? (settings.locale === "zh" ? "深色" : "Dark") : (settings.locale === "zh" ? "浅色" : "Light");
    }
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
            <option key={effort} value={effort} disabled={!resolvedReasoningOptions.includes(effort)}>{reasoningLabel(effort, settings.locale, true)}</option>
          ))}
        </select>
      );
    }
    if (key === "modelAccess") {
      return (
        <select className="setting-select" data-testid="opl-model-access-entry" value={value} onChange={(event) => onSettingChange("modelAccess", event.currentTarget.value)}>
          <option value="__auto">{autoModelLabel(settings.locale)}</option>
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
    return <span>{settingValueLabel(key, value)}</span>;
  }

  function renderContent() {
    if (selectedDestination === "overview") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "账户" : "Account"}>
            <SettingRow label={settings.locale === "zh" ? "One Person Lab 账户" : "One Person Lab account"}>
              <span className="settings-inline-identity">
                <span className="settings-avatar" aria-hidden="true">{gatewayAccountInitials(gateway?.displayName)}</span>
                <span><strong data-testid="opl-settings-gateway-username">{gateway?.displayName ?? missingGatewayLabel}</strong><small>{gateway?.email ?? missingGatewayDetail}</small></span>
              </span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "连接状态" : "Connection status"}><StatusValue status={gateway?.status ?? (stateLoading ? "loading" : stateFailed ? "attention_needed" : undefined)} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "当前运行状态" : "Current status"}>
            <SettingRow label={settings.locale === "zh" ? "本机助手" : "Local assistant"} detail={projection?.codex.version ? `${settings.locale === "zh" ? "版本" : "Version"} ${projection.codex.version}` : undefined}>
              <StatusValue status={projection?.codex.versionStatus ?? (projection?.codex.installed ? "ready" : undefined)} locale={settings.locale} />
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "模型" : "Model"}><span>{modelLabel(projection?.codex.model ?? resolvedModel?.id ?? "--", settings.locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "工作目录" : "Working directory"}><code>{projection?.workspace.selectedPath ?? statePlaceholder}</code></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "设置状态" : "Settings status"}>
              <StatusValue status={readbackStatus} locale={settings.locale} />
            </SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (selectedDestination === "account") {
      const refreshAction = gatewayAction("refresh");
      const disconnectAction = gatewayAction("disconnect");
      const useForModelAccessAction = gatewayAction("use_for_model_access");
      const exceptionActions = actionViewModel.gatewayActions.filter((action) => (
        action.availability === "ready"
        && action.kind !== "refresh"
        && action.kind !== "disconnect"
        && action.kind !== "use_for_model_access"
      ));
      const gatewayLoginVisible = Boolean(onGatewayLogin) && (!gateway || gateway.status === "reauth_required" || gateway.status === "setup_required");
      return (
        <>
          {gatewayLoginVisible ? (
            <form
              className="gateway-login-form"
              data-testid="opl-settings-gateway-login"
              onSubmit={(event) => {
                event.preventDefault();
                if (!onGatewayLogin || !gatewayEmail.trim() || !gatewayPassword) return;
                const password = gatewayPassword;
                setGatewayPassword("");
                void onGatewayLogin({
                  email: gatewayEmail.trim(),
                  password,
                  ...(gatewayDeviceLabel.trim() ? { deviceLabel: gatewayDeviceLabel.trim() } : {})
                }).then((ok) => {
                  if (ok) {
                    setGatewayEmail("");
                    setGatewayDeviceLabel("");
                  }
                });
              }}
            >
              <label>
                <span>{settings.locale === "zh" ? "邮箱" : "Email"}</span>
                <input type="email" autoComplete="username" value={gatewayEmail} onChange={(event) => setGatewayEmail(event.currentTarget.value)} required />
              </label>
              <label>
                <span>{settings.locale === "zh" ? "密码" : "Password"}</span>
                <input type="password" autoComplete="current-password" value={gatewayPassword} onChange={(event) => setGatewayPassword(event.currentTarget.value)} required />
              </label>
              <label>
                <span>{settings.locale === "zh" ? "设备名称" : "Device name"}</span>
                <input value={gatewayDeviceLabel} onChange={(event) => setGatewayDeviceLabel(event.currentTarget.value)} />
              </label>
              <button className="settings-action-button primary" type="submit" disabled={actionBusyKey !== null || !gatewayEmail.trim() || !gatewayPassword}>
                {actionBusyKey === "gateway:login" ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : <Play aria-hidden="true" size={13} />}
                {settings.locale === "zh" ? "登录" : "Sign in"}
              </button>
            </form>
          ) : null}
          <div className="gateway-identity">
            <span className="settings-avatar large" aria-hidden="true">{gatewayAccountInitials(gateway?.displayName)}</span>
            <span>
              <strong data-testid="opl-settings-gateway-username">{gateway?.displayName ?? missingGatewayLabel}</strong>
              <small>{gateway?.email ?? missingGatewayDetail}</small>
            </span>
            <span className="runtime-setting-control">
              <StatusValue status={gateway?.status ?? (stateLoading ? "loading" : stateFailed ? "attention_needed" : undefined)} locale={settings.locale} />
              <SettingsIntentButton intent={disconnectAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} />
            </span>
          </div>
          <SettingsGroup title={settings.locale === "zh" ? "账户" : "Account"}>
            <SettingRow label={settings.locale === "zh" ? "账户状态" : "Account status"}><StatusValue status={gateway?.accountStatus ?? gateway?.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "余额" : "Balance"}><strong>{formatAmount(gateway?.balance?.amount, gateway?.balance?.currency, locale)}</strong></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "今日用量" : "Usage today"}><span>{formatNumber(gateway?.usage?.todayTokens, locale, true)} {settings.locale === "zh" ? "令牌" : "tokens"} · {formatAmount(gateway?.usage?.todayCost, gateway?.usage?.currency, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "累计用量" : "Total usage"}><span>{formatNumber(gateway?.usage?.totalTokens, locale, true)} {settings.locale === "zh" ? "令牌" : "tokens"} · {formatAmount(gateway?.usage?.totalCost, gateway?.usage?.currency, locale)}</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "此设备" : "This device"}>
            <SettingRow
              label={settings.locale === "zh" ? "本机默认模型来源" : "Default model source on this device"}
              detail={modelAccessState === "unknown"
                ? (settings.locale === "zh" ? "刷新状态后确认" : "Refresh status to confirm")
                : modelAccessState === "different"
                  ? (settings.locale === "zh" ? "当前不是 OPL Gateway" : "OPL Gateway is not the current source")
                  : undefined}
            >
              <span className="runtime-setting-control" data-testid="opl-settings-model-access-source">
                {modelAccessState === "current" ? (
                  <span className="settings-status" data-tone="ready"><span aria-hidden="true" />OPL Gateway</span>
                ) : modelAccessState === "different" ? (
                  <span>{projection?.codex.providerName ?? projection?.codex.modelAccessSource}</span>
                ) : (
                  <span className="settings-muted">{settings.locale === "zh" ? "待确认" : "Not confirmed"}</span>
                )}
                {modelAccessState === "different" ? (
                  <SettingsIntentButton intent={useForModelAccessAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} primary />
                ) : null}
              </span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "设备名称" : "Device name"}><span>{gateway?.installation?.deviceLabel ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "设备访问" : "Device access"}><StatusValue status={gateway?.managedKey?.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "最近刷新" : "Last refresh"} detail={gateway?.freshness?.stale ? (settings.locale === "zh" ? "数据可能已过期" : "Data may be stale") : undefined}>
              <span className="runtime-setting-control">
                <span>{formatDate(gateway?.freshness?.observedAt, locale)}</span>
                <SettingsIntentButton intent={refreshAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} />
              </span>
            </SettingRow>
            {exceptionActions.length ? (
              <SettingRow label={settings.locale === "zh" ? "账户操作" : "Account actions"}>
                <span className="runtime-setting-control">
                  {exceptionActions.map((intent) => <SettingsIntentButton key={intent.key} intent={intent} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} primary />)}
                </span>
              </SettingRow>
            ) : null}
          </SettingsGroup>
          {!refreshAction ? <button className="settings-icon-button settings-page-refresh" type="button" aria-label={settings.locale === "zh" ? "刷新状态" : "Refresh status"} title={settings.locale === "zh" ? "刷新状态" : "Refresh status"} onClick={onRefresh}><RefreshCw aria-hidden="true" size={14} /></button> : null}
        </>
      );
    }

    if (selectedDestination === "models") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "会话配置" : "Session configuration"}>
            <SettingRow label={settings.locale === "zh" ? "模型" : "Model"} detail={unavailableFixedModel ? (settings.locale === "zh" ? "所选模型当前不可用" : "Selected model is unavailable") : undefined}>{renderSettingControl("modelAccess")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "强度" : "Effort"}>{renderSettingControl("reasoningLevel")}</SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "当前配置" : "Current setup"}>
            <SettingRow label={settings.locale === "zh" ? "当前模型" : "Current model"}><span>{modelLabel(projection?.codex.model ?? "--", settings.locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "当前强度" : "Current effort"}><span>{projection?.codex.reasoningEffort ? reasoningLabel(projection.codex.reasoningEffort, settings.locale, true) : "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "模型访问方式" : "Model access"}><span>{projection?.codex.providerName ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "访问状态" : "Access status"}><StatusValue status={projection?.codex.accessStatus} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (selectedDestination === "resources") {
      const dockerActions = projection?.dockerWebui.actions ?? [];
      const diagnoseAction = dockerActions.find((action) => action.actionId === "settings_diagnose_docker_webui");
      const ordinaryActions = dockerActions.filter((action) => (
        action.actionId !== "settings_diagnose_docker_webui"
        && action.state !== "unavailable"
        && actionPayloadComplete(action.payload, action.requiredPayloadFields)
      ));
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "外部连接" : "External connections"}>
            {projection?.externalConnections.length ? projection.externalConnections.map((connection) => (
              <SettingRow key={connection.id} label={connection.name}><StatusValue status={connection.status} locale={settings.locale} /></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "连接" : "Connections"}><span className="settings-muted">{settings.locale === "zh" ? "暂无外部连接" : "No external connections"}</span></SettingRow>}
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "网页访问" : "Web access"}>
            <SettingRow label={settings.locale === "zh" ? "配置状态" : "Configuration"} detail={ordinaryActions.length ? (settings.locale === "zh" ? `${ordinaryActions.length} 个可用操作` : `${ordinaryActions.length} available actions`) : undefined}><StatusValue status={projection?.dockerWebui.status} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行状态" : "Runtime"} detail={settings.locale === "zh" ? "诊断会先生成只读检查结果" : "Diagnostics first produces a read-only check result"}>
              <span className="runtime-setting-control"><StatusValue status={projection?.dockerWebui.runtimeStatus} locale={settings.locale} /><RuntimeActionButton action={diagnoseAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} previewOnly /></span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "恢复能力" : "Recovery"}><StatusValue status={projection?.dockerWebui.recoveryStatus} locale={settings.locale} /></SettingRow>
            {ordinaryActions.length ? (
              <SettingRow label={settings.locale === "zh" ? "可用操作" : "Available actions"}>
                <span className="runtime-setting-control">{ordinaryActions.map((action) => <RuntimeActionButton key={action.actionId} action={action} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} />)}</span>
              </SettingRow>
            ) : null}
          </SettingsGroup>
        </>
      );
    }

    if (selectedDestination === "workspace") {
      return (
        <SettingsGroup title={settings.locale === "zh" ? "工作目录" : "Working directory"}>
          <SettingRow label={settings.locale === "zh" ? "位置" : "Location"}><code>{projection?.workspace.selectedPath ?? "--"}</code></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "目录存在" : "Directory exists"}><span>{projection?.workspace.exists === null || projection?.workspace.exists === undefined ? "--" : projection.workspace.exists ? (settings.locale === "zh" ? "是" : "Yes") : (settings.locale === "zh" ? "否" : "No")}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "可写" : "Writable"}><span>{projection?.workspace.writable === null || projection?.workspace.writable === undefined ? "--" : projection.workspace.writable ? (settings.locale === "zh" ? "是" : "Yes") : (settings.locale === "zh" ? "否" : "No")}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "健康状态" : "Health"}><StatusValue status={projection?.workspace.healthStatus} locale={settings.locale} /></SettingRow>
        </SettingsGroup>
      );
    }

    if (selectedDestination === "storage") {
      const agentStore = projection?.storage.agentPackageStore;
      const webuiStore = projection?.storage.webuiDataVolume;
      const refreshLabel = settings.locale === "zh" ? "刷新存储状态" : "Refresh storage status";
      return (
        <>
          <div className="settings-page-summary settings-page-summary-with-action">
            <span>{settings.locale === "zh" ? "显示 App 返回的真实用量；未盘点时不会显示为 0" : "Shows real usage returned by the App; unknown inventory is never shown as zero"}</span>
            <button className="settings-icon-button" type="button" aria-label={refreshLabel} title={refreshLabel} disabled={stateLoading} onClick={onRefresh}>{stateLoading ? <LoaderCircle className="spin" aria-hidden="true" size={15} /> : <RefreshCw aria-hidden="true" size={15} />}</button>
          </div>
          <SettingsGroup title={settings.locale === "zh" ? "智能体与能力" : "Agents and capabilities"}>
            <SettingRow label={settings.locale === "zh" ? "状态" : "Status"} detail={storageReason(agentStore, settings.locale)}><StatusValue status={storagePresentationStatus(agentStore)} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "已用空间" : "Used space"}><span>{storageAmount(agentStore?.bytes, agentStore, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "可回收" : "Reclaimable"} detail={settings.locale === "zh" ? "只有收到可验证的清理计划后才会显示" : "Shown only after a verifiable cleanup plan is available"}><span>{storageAmount(agentStore?.reclaimableBytes, agentStore, locale)}</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "网页端数据" : "Web app data"}>
            <SettingRow label={settings.locale === "zh" ? "状态" : "Status"} detail={storageReason(webuiStore, settings.locale)}><StatusValue status={storagePresentationStatus(webuiStore)} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "已用空间" : "Used space"}><span>{storageAmount(webuiStore?.bytes, webuiStore, locale)}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "可回收" : "Reclaimable"} detail={webuiStore?.projectedAction?.status === "host_action_required" ? (settings.locale === "zh" ? "当前运行方式尚未提供清理计划" : "This app mode does not currently provide a cleanup plan") : undefined}><span>{storageAmount(webuiStore?.reclaimableBytes, webuiStore, locale)}</span></SettingRow>
          </SettingsGroup>
          {projection?.localEnvironment.stateDir || projection?.localEnvironment.runtimeSourcesRoot ? (
            <SettingsGroup title={settings.locale === "zh" ? "本机位置" : "Local locations"}>
              {projection.localEnvironment.stateDir ? <SettingRow label={settings.locale === "zh" ? "应用数据" : "App data"}><code>{projection.localEnvironment.stateDir}</code></SettingRow> : null}
              {projection.localEnvironment.runtimeSourcesRoot ? <SettingRow label={settings.locale === "zh" ? "运行环境" : "Runtime data"}><code>{projection.localEnvironment.runtimeSourcesRoot}</code></SettingRow> : null}
            </SettingsGroup>
          ) : null}
        </>
      );
    }

    if (selectedDestination === "agents") {
      return (
        <>
          <div className="settings-page-summary">
            <span>{settings.locale === "zh" ? `${officialPackageCount} 项官方内容` : `${officialPackageCount} official items`}</span>
            {statusTone(projection?.statusSummary.agentPackageHealth) !== "neutral"
              ? <StatusValue status={projection?.statusSummary.agentPackageHealth} locale={settings.locale} />
              : null}
          </div>
          <PackageCatalog model={model} settings={settings} actionBusyKey={actionBusyKey} onAction={onAction} />
        </>
      );
    }

    if (selectedDestination === "capabilities") {
      return (
        <>
          <div className="settings-page-summary"><span>{settings.locale === "zh" ? `${availableStarters} 个任务入口 · ${model.packageLifecycle.length} 个扩展` : `${availableStarters} task starters · ${model.packageLifecycle.length} extensions`}</span><span>{settings.locale === "zh" ? "展开条目可查看来源与可用状态" : "Expand an item to inspect its source and availability"}</span></div>
          <CapabilityDirectory catalog={capabilityCatalog} status={capabilityStatus} error={capabilityError} locale={settings.locale} showTechnicalDetails={settings.developerDetails} onRefresh={onRefreshCapabilities} />
          {model.managedComputerUse ? (
            <ManagedComputerUseGroup
              companion={model.managedComputerUse}
              locale={settings.locale}
              busyKey={actionBusyKey}
              onAction={onAction}
            />
          ) : null}
          {contributions ? (
            <section className="settings-contribution-section" data-testid="opl-settings-contributions">
              <h2>{settings.locale === "zh" ? "扩展设置" : "Extension settings"}</h2>
              <div className="opl-contribution-slot">{contributions}</div>
            </section>
          ) : null}
        </>
      );
    }

    if (selectedDestination === "instructions") {
      const userAgents = projection?.personalization.userAgents;
      const defaultAgents = projection?.personalization.oplFlowDefaultUserAgents;
      return (
        <>
          <div className="settings-page-summary"><span>{settings.locale === "zh" ? `${projection?.workspace.personalizationSourceCount ?? 0} 个个性化来源` : `${projection?.workspace.personalizationSourceCount ?? 0} personalization sources`}</span><StatusValue status={readbackStatus} locale={settings.locale} /></div>
          <SettingsGroup title={settings.locale === "zh" ? "全局指令" : "Global instructions"}>
            <InstructionSource title={settings.locale === "zh" ? "你的 Codex 指令" : "Your Codex instructions"} status={userAgents?.status} content={userAgents?.content} detail={userAgents?.sizeBytes !== undefined ? `${formatBytes(userAgents.sizeBytes, locale)} · ${userAgents.path ?? ""}` : userAgents?.path} locale={settings.locale} />
            <InstructionSource title={settings.locale === "zh" ? "OPL Flow 默认指令" : "OPL Flow default instructions"} status={defaultAgents?.status} content={defaultAgents?.content} detail={defaultAgents?.packageVersion ? `${settings.locale === "zh" ? "版本" : "Version"} ${defaultAgents.packageVersion}` : undefined} locale={settings.locale} />
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "当前上下文来源" : "Current context sources"}>
            {model.contextSources.length ? model.contextSources.map((source) => (
              <SettingRow key={source.id} label={source.label} detail={source.summary}><code>{source.ref}</code></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "上下文" : "Context"}><span className="settings-muted">{settings.locale === "zh" ? "当前没有额外上下文来源" : "No additional context sources"}</span></SettingRow>}
          </SettingsGroup>
        </>
      );
    }

    if (selectedDestination === "services") {
      const runtimeActions = runtime?.maintenanceActions ?? [];
      const serviceAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.serviceReady === false ? "provider_service_start" : "provider_service_status"));
      const workerAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.workerReady === false ? "provider_worker_start" : "provider_worker_status"));
      const schedulerAction = runtimeActions.find((action) => action.actionId === (runtime?.temporal.schedulerStatus === "not_installed" ? "provider_scheduler_install" : "provider_scheduler_status"));
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "本机能力" : "Local capabilities"}>
            <SettingRow label={settings.locale === "zh" ? "本机助手" : "Local assistant"} detail={projection?.codex.version ? `${settings.locale === "zh" ? "版本" : "Version"} ${projection.codex.version}` : undefined}><StatusValue status={projection?.codex.installed === true ? projection?.codex.versionStatus ?? "ready" : projection?.codex.installed === false ? "unavailable" : undefined} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "智能体与能力" : "Agents and capabilities"}><StatusValue status={projection?.statusSummary.agentPackageHealth} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行环境" : "Runtime environment"}><StatusValue status={projection?.statusSummary.runtimeSourceHealth} locale={settings.locale} /></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "后台任务" : "Background tasks"}>
            <SettingRow label={settings.locale === "zh" ? "任务服务" : "Task service"}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.serviceStatus} locale={settings.locale} /><RuntimeActionButton action={serviceAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} /></span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "任务处理" : "Task processing"}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.workerStatus} locale={settings.locale} /><RuntimeActionButton action={workerAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} /></span>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "定时任务" : "Scheduled tasks"} detail={runtime?.temporal.observedAt ? formatDate(runtime.temporal.observedAt, locale) : undefined}>
              <span className="runtime-setting-control"><StatusValue status={runtime?.temporal.schedulerStatus} locale={settings.locale} /><RuntimeActionButton action={schedulerAction} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} primary={statusTone(runtime?.temporal.schedulerStatus) === "attention"} /></span>
            </SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? `运行环境 ${runtime?.carriers.healthy ?? 0} / ${runtime?.carriers.total ?? 0}` : `Runtime environments ${runtime?.carriers.healthy ?? 0} / ${runtime?.carriers.total ?? 0}`}>
            {runtime?.carriers.items.length ? runtime.carriers.items.map((carrier) => (
              <SettingRow key={carrier.packageId} label={carrier.label}><StatusValue status={carrier.status} locale={settings.locale} /></SettingRow>
            )) : <SettingRow label={settings.locale === "zh" ? "运行环境" : "Runtime environments"}><span className="settings-muted">--</span></SettingRow>}
          </SettingsGroup>
        </>
      );
    }

    if (selectedDestination === "updates") {
      const component = (componentId: "opl_app" | "opl_base" | "opl_packages") => (
        actionViewModel.managedUpdates.find((item) => item.componentId === componentId)
      );
      return (
        <>
          <div className="settings-page-summary">
            <span>{settings.locale === "zh" ? "分别检查应用、基础服务和智能体能力" : "Updates are checked separately for the app, base services, and agent capabilities"}</span>
            <span>{settings.locale === "zh" ? `状态刷新于 ${formatDate(model.stateGeneratedAt, locale)}` : `Status refreshed ${formatDate(model.stateGeneratedAt, locale)}`}</span>
          </div>
          <ManagedUpdateGroup
            component={component("opl_app")?.component}
            fallbackLabel="One Person Lab"
            managedChannel={managedUpdate?.channel ?? projection?.localEnvironment.releaseChannel ?? projection?.statusSummary.releaseChannel}
            actions={component("opl_app")?.actions ?? []}
            locale={settings.locale}
            busyKey={actionBusyKey}
            onAction={onAction}
            onHostAction={onHostAction}
            unavailableActionLabel={settings.locale === "zh" ? "暂不可用" : "Unavailable"}
          />
          <ManagedUpdateGroup
            component={component("opl_base")?.component}
            fallbackLabel={settings.locale === "zh" ? "基础服务" : "Base services"}
            managedChannel={managedUpdate?.channel}
            actions={component("opl_base")?.actions ?? []}
            locale={settings.locale}
            busyKey={actionBusyKey}
            onAction={onAction}
            onHostAction={onHostAction}
            unavailableActionLabel={settings.locale === "zh" ? "暂不可用" : "Unavailable"}
          />
          <ManagedUpdateGroup
            component={component("opl_packages")?.component}
            fallbackLabel={settings.locale === "zh" ? "智能体与能力" : "Agents and capabilities"}
            managedChannel={managedUpdate?.channel}
            actions={component("opl_packages")?.actions ?? []}
            locale={settings.locale}
            busyKey={actionBusyKey}
            onAction={onAction}
            onHostAction={onHostAction}
            unavailableActionLabel={settings.locale === "zh" ? "暂不可用" : "Unavailable"}
          />
          {actionViewModel.additionalMaintenanceActions.some((intent) => (
            intent.availability === "ready" && (intent.transport === "app_action" || Boolean(onHostAction))
          )) ? (
            <details className="settings-advanced-actions">
              <summary>{settings.locale === "zh" ? "更多维护操作" : "More maintenance actions"}<ChevronDown aria-hidden="true" size={14} /></summary>
              <div>{actionViewModel.additionalMaintenanceActions.map((intent) => <SettingsIntentButton key={intent.key} intent={intent} locale={settings.locale} busyKey={actionBusyKey} onAction={onAction} onHostAction={onHostAction} />)}</div>
            </details>
          ) : null}
        </>
      );
    }

    if (selectedDestination === "diagnostics") {
      const appLogDirectory = carrierDiagnostics.application?.systemInfo.logDir;
      const appLogDirectoryDetail = carrierLogDetail(carrierDiagnostics, settings.locale);
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "日志与诊断" : "Logs and diagnostics"}>
            <SettingRow label={settings.locale === "zh" ? "整体状态" : "Overall status"} detail={stateFailed ? (settings.locale === "zh" ? "请刷新后重试" : "Refresh to try again") : undefined}><StatusValue status={readbackStatus} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "待处理项目" : "Items requiring attention"}><span>{projection?.statusSummary.issueCount ?? "--"}</span></SettingRow>
            <SettingRow
              label={settings.locale === "zh" ? "应用日志" : "Application logs"}
              detail={appLogDirectoryDetail}
            >
              <div className="settings-row-actions">
                <StatusValue status={carrierDiagnostics.status === "available" ? "ready" : carrierDiagnostics.status} locale={settings.locale} />
                {carrierDiagnostics.setLogDirectorySupported ? (
                  <button
                    className="settings-inline-command"
                    type="button"
                    disabled={actionBusyKey === "application.setLogDirectory"}
                    onClick={onChangeLogDirectory}
                  >
                    {actionBusyKey === "application.setLogDirectory"
                      ? <LoaderCircle aria-hidden="true" className="spin" size={14} />
                      : <FolderOpen aria-hidden="true" size={14} />}
                    {settings.locale === "zh" ? "更改目录" : "Change directory"}
                  </button>
                ) : null}
              </div>
            </SettingRow>
            <SettingRow label={settings.locale === "zh" ? "显示技术详情" : "Show technical details"}>{renderSettingControl("developerDetails")}</SettingRow>
          </SettingsGroup>
          {settings.developerDetails ? (
            <SettingsGroup title={settings.locale === "zh" ? "高级详情" : "Advanced details"}>
              <SettingRow label={settings.locale === "zh" ? "应用日志路径" : "Application log path"}><code>{appLogDirectory ?? (settings.locale === "zh" ? "不可用" : "Unavailable")}</code></SettingRow>
              {stateError ? <SettingRow label={settings.locale === "zh" ? "最近错误" : "Latest error"}><code>{stateError}</code></SettingRow> : null}
              {carrierDiagnostics.reasonCode ? <SettingRow label={settings.locale === "zh" ? "状态代码" : "Status code"}><code>{carrierDiagnostics.reasonCode}</code></SettingRow> : null}
              <SettingRow label={settings.locale === "zh" ? "基础服务日志" : "Base service logs"}><code>{projection?.localEnvironment.logsDir ?? "--"}</code></SettingRow>
              <SettingRow label={settings.locale === "zh" ? "应用数据目录" : "Application data directory"}><code>{projection?.localEnvironment.stateDir ?? "--"}</code></SettingRow>
              <SettingRow label={settings.locale === "zh" ? "运行环境目录" : "Runtime directory"}><code>{projection?.localEnvironment.runtimeSourcesRoot ?? "--"}</code></SettingRow>
              <SettingRow label={settings.locale === "zh" ? "本机助手路径" : "Local assistant path"}><code>{projection?.codex.binaryPath ?? "--"}</code></SettingRow>
            </SettingsGroup>
          ) : null}
          <button className="settings-icon-button settings-page-refresh" type="button" aria-label={settings.locale === "zh" ? "刷新状态" : "Refresh status"} title={settings.locale === "zh" ? "刷新状态" : "Refresh status"} onClick={onRefresh}><RefreshCw aria-hidden="true" size={14} /></button>
        </>
      );
    }

    if (selectedDestination === "preferences") {
      return (
        <>
          <SettingsGroup title={settings.locale === "zh" ? "界面" : "Interface"}>
            <SettingRow label={settings.locale === "zh" ? "语言" : "Language"}>{renderSettingControl("locale")}</SettingRow>
            <AppearanceRow
              t={(key) => ({
                "appearance.title": settings.locale === "zh" ? "外观" : "Appearance",
                "appearance.light": settings.locale === "zh" ? "浅色" : "Light",
                "appearance.dark": settings.locale === "zh" ? "深色" : "Dark",
                "appearance.system": settings.locale === "zh" ? "跟随系统" : "System"
              })[key] ?? key}
              setTheme={(theme) => onSettingChange("theme", theme)}
              useStore={(selector) => selector({ preference: settings.theme, revision: 0 })}
              actions={{ sync: () => undefined }}
            />
            <SettingRow label={settings.locale === "zh" ? "文件预览" : "File previews"}>{renderSettingControl("artifactPreviewMode")}</SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "执行" : "Execution"}>
            <SettingRow label={settings.locale === "zh" ? "执行前确认" : "Confirm before execute"}>{renderSettingControl("confirmBeforeExecute")}</SettingRow>
            <SettingRow label={settings.locale === "zh" ? "新任务工作区" : "New task workspace"}>{renderSettingControl("defaultWorkspace")}</SettingRow>
          </SettingsGroup>
        </>
      );
    }

    return (
      <>
        <SettingsGroup title={settings.locale === "zh" ? "One Person Lab 预览版" : "One Person Lab Preview"}>
          <SettingRow label={settings.locale === "zh" ? "版本" : "Version"}><span>0.1.0</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "发布通道" : "Release channel"}><span>{settings.locale === "zh" ? "预览版" : "Preview"}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "本机助手" : "Local assistant"}><span>{projection?.codex.version ?? "--"}</span></SettingRow>
        </SettingsGroup>
      </>
    );
  }

  return (
    <section data-testid="opl-settings-panel" className="settings-page" aria-label={settings.locale === "zh" ? "设置" : "Settings"}>
      <div className="settings-detail">
        <header className="settings-detail-header">
          {activeGroup && activeGroup.label !== copy[selectedDestination] ? <span>{activeGroup.label}</span> : null}
          <h1>{copy[selectedDestination]}</h1>
          {activeGroup && activeGroup.destinations.length > 1 ? (
            <nav className="settings-subnav" aria-label={settings.locale === "zh" ? `${activeGroup.label}分类` : `${activeGroup.label} sections`}>
              {activeGroup.destinations.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  data-active={destination.id === selectedDestination}
                  aria-current={destination.id === selectedDestination ? "page" : undefined}
                  onClick={() => setSubDestination(destination.id)}
                >
                  {destination.label}
                </button>
              ))}
            </nav>
          ) : null}
        </header>
        <div className="settings-content" data-section={selectedDestination}>
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
          <section
            ref={confirmationDialogRef}
            className="settings-action-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-action-dialog-title"
            data-testid="opl-settings-action-confirmation"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCancelAction();
                return;
              }
              trapDialogFocus(event, confirmationDialogRef.current);
            }}
          >
            <div className="settings-action-dialog-icon"><Wrench aria-hidden="true" size={18} /></div>
            <div>
              <h2 id="settings-action-dialog-title">{pendingConfirmation.request.label}</h2>
              <p>{pendingConfirmation.request.actionId === "gateway_account_use_for_model_access"
                ? (settings.locale === "zh"
                    ? "确认后，本机新会话将默认通过 OPL Gateway 访问模型。账户本身不会被修改。"
                    : "New conversations on this device will use OPL Gateway for model access by default. The account itself will not be changed.")
                : (settings.locale === "zh" ? "检查已完成。确认后将执行此操作并刷新最新状态。" : "The check is complete. Confirm to run this action and refresh the latest status.")}</p>
              <small>{settings.locale === "zh" ? "预检查" : "Preview"}: {formatStatus(pendingConfirmation.previewStatus, settings.locale)}</small>
            </div>
            <div className="settings-action-dialog-actions">
              <button ref={confirmationCancelRef} type="button" onClick={onCancelAction}>{settings.locale === "zh" ? "取消" : "Cancel"}</button>
              <button className="primary" type="button" onClick={onConfirmAction} disabled={actionBusyKey !== null}>
                {actionBusyKey ? <LoaderCircle className="spin" aria-hidden="true" size={13} /> : null}
                {pendingConfirmation.request.actionId === "gateway_account_use_for_model_access"
                  ? (settings.locale === "zh" ? "切换为 OPL Gateway" : "Switch to OPL Gateway")
                  : (settings.locale === "zh" ? "确认执行" : "Confirm")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
