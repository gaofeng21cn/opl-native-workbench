import {
  ArrowLeft,
  Bot,
  Boxes,
  CircleUserRound,
  FolderCog,
  Gauge,
  Info,
  Link2,
  RefreshCw,
  SlidersHorizontal,
  Wrench,
  X
} from "lucide-react";
import { useMemo, type PointerEventHandler, type ReactNode } from "react";
import type { WorkbenchModel } from "./workbenchModel";
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
  onReasoningChange
}: SettingsPanelProps) {
  const groups = useMemo(() => navigationGroups(settings.locale), [settings.locale]);
  const locale = settings.locale === "zh" ? "zh-CN" : "en-US";
  const copy = navigationCopy[settings.locale].destinations;
  const activeGroup = groups.find((group) => group.destinations.some((destination) => destination.id === activeDestination));
  const projection = model.settingsProjection;
  const gateway = model.gatewayAccount;
  const packageRows = model.packageLifecycle.filter((item) => item.packageId !== "missing_bridge").slice(0, 8);
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
        <SettingsGroup title={settings.locale === "zh" ? "智能体" : "Agents"}>
          <SettingRow label={settings.locale === "zh" ? "功能健康" : "Functional health"}><span>{projection?.statusSummary.agentPackageHealth ?? "--"}</span></SettingRow>
          {packageRows.length ? packageRows.map((item) => (
            <SettingRow key={item.id} label={item.label} detail={item.summary}><StatusValue status={item.status} locale={settings.locale} /></SettingRow>
          )) : <SettingRow label={settings.locale === "zh" ? "智能体目录" : "Agent directory"}><span className="settings-muted">{settings.locale === "zh" ? "暂无可用投影" : "No projection available"}</span></SettingRow>}
        </SettingsGroup>
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
      return (
        <>
          <SettingsGroup title="Codex CLI">
            <SettingRow label={settings.locale === "zh" ? "安装状态" : "Installation"}><StatusValue status={projection?.codex.installed === true ? "ready" : projection?.codex.installed === false ? "unavailable" : undefined} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "版本" : "Version"}><span>{projection?.codex.version ?? "--"}</span></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "兼容性" : "Compatibility"}><StatusValue status={projection?.codex.versionStatus} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "二进制" : "Binary"}><code>{projection?.codex.binaryPath ?? "--"}</code></SettingRow>
          </SettingsGroup>
          <SettingsGroup title={settings.locale === "zh" ? "本地服务" : "Local services"}>
            <SettingRow label="Temporal"><StatusValue status={projection?.localEnvironment.temporalProvider ?? projection?.statusSummary.temporalProvider} locale={settings.locale} /></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行时来源" : "Runtime sources"}><span>{projection?.statusSummary.runtimeSourceHealth ?? "--"}</span></SettingRow>
          </SettingsGroup>
        </>
      );
    }

    if (activeDestination === "updates") {
      return (
        <SettingsGroup title={settings.locale === "zh" ? "更新与修复" : "Updates & repair"}>
          <SettingRow label={settings.locale === "zh" ? "发布通道" : "Release channel"}><span>{formatStatus(projection?.localEnvironment.releaseChannel ?? projection?.statusSummary.releaseChannel, settings.locale)}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "Codex 更新" : "Codex update"}><span>{projection?.codex.updateAvailable === null || projection?.codex.updateAvailable === undefined ? (settings.locale === "zh" ? "尚未检查" : "Not checked") : projection.codex.updateAvailable ? (settings.locale === "zh" ? "有可用更新" : "Update available") : (settings.locale === "zh" ? "已是当前版本" : "Up to date")}</span></SettingRow>
          <SettingRow label={settings.locale === "zh" ? "状态配置" : "State profile"}>{renderSettingControl("runtimeProfile")}</SettingRow>
          <SettingRow label={settings.locale === "zh" ? "最近读取" : "Last readback"}><span>{formatDate(model.stateGeneratedAt, locale)}</span></SettingRow>
        </SettingsGroup>
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
          <SettingsGroup title={settings.locale === "zh" ? "位置" : "Locations"}>
            <SettingRow label={settings.locale === "zh" ? "日志" : "Logs"}><code>{projection?.localEnvironment.logsDir ?? "--"}</code></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "状态目录" : "State directory"}><code>{projection?.localEnvironment.stateDir ?? "--"}</code></SettingRow>
            <SettingRow label={settings.locale === "zh" ? "运行时来源" : "Runtime sources"}><code>{projection?.localEnvironment.runtimeSourcesRoot ?? "--"}</code></SettingRow>
          </SettingsGroup>
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
        <div className="settings-content" data-section={activeDestination}>{renderContent()}</div>
      </div>
    </section>
  );
}
