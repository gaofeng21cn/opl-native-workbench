import * as Tabs from "@radix-ui/react-tabs";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleEllipsis,
  Clock3,
  Download,
  FileText,
  Folder,
  MoreVertical,
  PanelLeft,
  PanelRightOpen,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createBrowserBridge, type CodexModelCatalogEntry } from "../bridge/oplBridge";
import {
  ActionReceiptSummary,
  ArtifactPreviewCard,
  ConfirmationCard,
  DeliveryCard,
  RendererModuleRegistryPanel,
  StatusPill
} from "../ui/workbenchPrimitives";
import {
  deriveWorkbenchModelFromState,
  initialWorkbenchModel,
  type WorkbenchActionRef,
  type WorkbenchStarter
} from "./workbenchModel";
import {
  readSettings,
  settingsDefaults,
  settingsSections,
  writeSetting,
  type SettingKey,
  type WorkbenchSettings
} from "./settingsModel";
import { codexWorkbenchStyles } from "./codexWorkbenchStyles";
import {
  autoModelLabel,
  codexModelPolicy,
  modelLabel,
  reasoningLabel,
  type CodexModelId,
  type CodexReasoningEffort
} from "./modelPolicy";

const contextTabs = [
  ["opl-files-panel", "sources"],
  ["opl-artifact-preview-tabs", "results"],
  ["opl-provenance-drawer", "actions"],
  ["opl-starter-forms", "workflows"],
  ["opl-package-lifecycle-panel", "packages"],
  ["opl-runtime-summary", "runtime"],
  ["opl-automations-panel", "scheduled"],
  ["opl-memory-panel", "memory"],
  ["opl-always-on-panel", "alwaysOn"]
] as const;
const contextHomeId = "opl-environment-home" as const;
type ContextTabId = (typeof contextTabs)[number][0];
type ActiveContextTab = ContextTabId | typeof contextHomeId;

const uiCopy = {
  zh: {
    newTask: "新建任务",
    scheduled: "已安排",
    agents: "智能体与能力",
    chat: "聊天",
    projects: "项目",
    local: "本地",
    projectContext: "项目上下文",
    filesOutputs: "文件与结果",
    settings: "设置",
    openSettings: "打开设置",
    hideSidebar: "隐藏侧边栏",
    showSidebar: "显示侧边栏",
    conversationMenu: "对话菜单",
    refreshContext: "刷新项目上下文",
    backToChat: "返回聊天",
    previewExport: "预览导出操作",
    openEnvironment: "打开环境信息",
    closeEnvironment: "关闭环境信息",
    newTaskTitle: "新任务",
    emptyTitle: "想从哪里开始？",
    emptyDescription: (project: string) => `已选择 ${project}。OPL 会在任务需要时使用该项目的上下文。`,
    prompt: "让 OPL 审阅、撰写、导出，或启动专业工作流",
    attachFiles: "添加文件",
    capabilities: "能力",
    working: "正在工作",
    running: "运行中",
    retry: "重试",
    send: "发送",
    high: "高",
    standard: "标准",
    you: "你",
    assistant: "One Person Lab",
    runtime: "运行时",
    codexWorking: "Codex 正在处理...",
    waitingReply: "等待回复。",
    openPreview: "打开预览",
    currentPreview: "当前预览",
    environment: "环境信息",
    environmentStatus: "当前项目的来源、结果、操作、工作流与运行环境。",
    backEnvironment: "返回环境信息",
    close: "关闭",
    refresh: "刷新",
    sources: "来源",
    sourcesDescription: "项目输入、资料和 refs-only 上下文",
    results: "结果与文件",
    resultsDescription: "交付物、附件和内容预览",
    actions: "操作与回执",
    actionsDescription: "预览、确认、执行回执和回滚入口",
    workflows: "工作流",
    workflowsDescription: "OPL 专业智能体的任务启动器",
    packages: "智能体与能力包",
    packagesDescription: "能力包、安装状态和可用入口",
    runtimeMenu: "运行环境",
    runtimeDescription: "Codex、OPL App bridge 和本地状态",
    settingsRuntime: "运行状态",
    stateProfile: "状态配置",
    contextState: "上下文状态",
    refreshState: "立即刷新状态",
    defaultLabel: "默认值",
    on: "开",
    off: "关",
    previewAction: "预览操作",
    executeConfirmed: "确认并执行",
    previewRollback: "预览回滚",
    actionReceipts: "操作回执",
    workflowStarters: "工作流启动器",
    previewFirst: "先预览，再确认",
    previewReceipt: "预览回执",
    unavailable: "不可用",
    previewWorkflow: "预览工作流",
    agentPackages: "智能体能力包",
    readbackOnly: "仅读取",
    fullDrilldown: "查看完整状态",
    deliverables: "交付结果",
    recentRefs: "最近的引用与回执",
    stateProfileHelp: "控制项目状态读取的详细程度。",
    noReadbackTimestamp: "暂无状态读取时间。",
    sourcesBoundary: "由 OPL App state/action 合同提供的 refs-only 界面。",
    traceAndActions: "追踪与操作",
    traceBoundary: "仅显示来源、回执、重放和导出引用，不复制产物正文。",
    appRootRefs: "仅 App/root 引用",
    packageBoundary: "能力包状态和操作来自 App/root 合同；缺少 bridge 或只存在旧模块回退时保持预览或不可用。",
    search: "搜索",
    filterTags: "筛选标签",
    runtimeNoAuthority: "这里不持有领域正文或产物正文。",
    skills: "技能",
    skillsBoundary: "仅显示 Codex Skill 引用，不持有领域权威。",
    routing: "路由",
    routingBoundary: "路由建议继续作为 App 所有的引用和预览操作。",
    memory: "记忆",
    memoryBoundary: "仅显示记忆引用，不持有记忆正文真相。",
    alwaysOn: "常驻上下文",
    alwaysOnBoundary: "常驻上下文只汇总为引用、回执和下一步操作。",
    workflowRun: "工作流运行",
    workflowSteps: ["规划", "检索", "起草", "验证", "完成"],
    receipt: "回执",
    projectGroup: "项目",
    executionGroup: "执行",
    systemGroup: "系统",
    stateLoading: "载入中",
    stateReady: "已连接",
    stateError: "不可用",
    scheduledDescription: "计划任务和自动运行引用",
    memoryDescription: "当前项目的记忆引用与边界",
    alwaysOnDescription: "常驻上下文、回执和下一步"
  },
  en: {
    newTask: "New task",
    scheduled: "Scheduled",
    agents: "Agents & Capabilities",
    chat: "Chat",
    projects: "Projects",
    local: "Local",
    projectContext: "Project context",
    filesOutputs: "Files & outputs",
    settings: "Settings",
    openSettings: "Open settings",
    hideSidebar: "Hide sidebar",
    showSidebar: "Show sidebar",
    conversationMenu: "Conversation menu",
    refreshContext: "Refresh project context",
    backToChat: "Back to chat",
    previewExport: "Preview export action",
    openEnvironment: "Open environment details",
    closeEnvironment: "Close environment details",
    newTaskTitle: "New task",
    emptyTitle: "What should we work on?",
    emptyDescription: (project: string) => `${project} is selected. OPL will use its project context only when the task needs it.`,
    prompt: "Ask OPL to review, draft, export, or start a workflow",
    attachFiles: "Attach files",
    capabilities: "Capabilities",
    working: "Working",
    running: "Running",
    retry: "Retry",
    send: "Send",
    high: "High",
    standard: "Standard",
    you: "You",
    assistant: "One Person Lab",
    runtime: "Runtime",
    codexWorking: "Codex is working...",
    waitingReply: "Waiting for reply.",
    openPreview: "Open preview",
    currentPreview: "Current preview",
    environment: "Environment",
    environmentStatus: "Sources, results, actions, workflows, and runtime for the current project.",
    backEnvironment: "Back to Environment",
    close: "Close",
    refresh: "Refresh",
    sources: "Sources",
    sourcesDescription: "Project inputs, materials, and refs-only context",
    results: "Results & files",
    resultsDescription: "Deliverables, attachments, and content previews",
    actions: "Actions & receipts",
    actionsDescription: "Preview, confirmation, receipts, and rollback",
    workflows: "Workflows",
    workflowsDescription: "Task starters for OPL professional agents",
    packages: "Agents & packages",
    packagesDescription: "Capability packages, install state, and entry points",
    runtimeMenu: "Runtime",
    runtimeDescription: "Codex, OPL App bridge, and local state",
    settingsRuntime: "Runtime readback",
    stateProfile: "State profile",
    contextState: "Context state",
    refreshState: "Refresh state now",
    defaultLabel: "Default",
    on: "on",
    off: "off",
    previewAction: "Preview action",
    executeConfirmed: "Execute confirmed",
    previewRollback: "Preview rollback",
    actionReceipts: "Action receipts",
    workflowStarters: "Workflow starters",
    previewFirst: "Preview first, then confirm",
    previewReceipt: "Preview receipt",
    unavailable: "Unavailable",
    previewWorkflow: "Preview workflow",
    agentPackages: "Agent packages",
    readbackOnly: "Readback only",
    fullDrilldown: "Full drilldown",
    deliverables: "Deliverables",
    recentRefs: "Recent refs and receipts",
    stateProfileHelp: "Controls the level of detail used for project state reads.",
    noReadbackTimestamp: "No current readback timestamp.",
    sourcesBoundary: "Refs-only surface backed by OPL App state/action contracts.",
    traceAndActions: "Trace and actions",
    traceBoundary: "Source, receipt, replay, and export refs without artifact bodies.",
    appRootRefs: "App/root refs only",
    packageBoundary: "Package status and actions come from App/root contracts. Missing bridge or legacy module fallback stays preview/unavailable.",
    search: "Search",
    filterTags: "Filter tags",
    runtimeNoAuthority: "No domain body or artifact body is owned here.",
    skills: "Skills",
    skillsBoundary: "Codex Skill references only; no domain authority is owned here.",
    routing: "Routing",
    routingBoundary: "Route suggestions remain App-owned refs and preview actions.",
    memory: "Memory",
    memoryBoundary: "Memory refs are shown without owning memory body truth.",
    alwaysOn: "Always-on context",
    alwaysOnBoundary: "Always-on context is summarized as refs, receipts, and next actions.",
    workflowRun: "Workflow run",
    workflowSteps: ["Plan", "Retrieve", "Draft", "Validate", "Complete"],
    receipt: "Receipt",
    projectGroup: "Project",
    executionGroup: "Execution",
    systemGroup: "System",
    stateLoading: "Loading",
    stateReady: "Connected",
    stateError: "Unavailable",
    scheduledDescription: "Scheduled task and automation refs",
    memoryDescription: "Memory refs and boundaries for this project",
    alwaysOnDescription: "Persistent context, receipts, and next actions"
  }
} as const;

const localizedPurposeLabels = {
  zh: { research: "审阅结果", grant: "起草标书", presentation: "制作演示", review: "准备交付" },
  en: { research: "Review results", grant: "Draft grant", presentation: "Build deck", review: "Prepare handoff" }
} as const;

const localizedSettingLabels = {
  zh: {
    locale: "界面语言",
    modelAccess: "模型接入",
    reasoningLevel: "推理强度",
    defaultWorkspace: "默认工作区",
    runtimeProfile: "状态读取配置",
    confirmBeforeExecute: "执行前确认",
    artifactPreviewMode: "预览模式",
    professionalStarterDefaults: "默认专业能力",
    theme: "外观",
    developerDetails: "开发者详情"
  },
  en: {
    locale: "Language",
    modelAccess: "Model access",
    reasoningLevel: "Reasoning",
    defaultWorkspace: "Default workspace",
    runtimeProfile: "State profile",
    confirmBeforeExecute: "Confirm before execute",
    artifactPreviewMode: "Preview mode",
    professionalStarterDefaults: "Starter defaults",
    theme: "Theme",
    developerDetails: "Developer details"
  }
} as const;

const localizedSettingsSections = {
  zh: {
    general: "通用",
    access: "模型与推理",
    capabilities: "智能体与能力",
    environment: "本地环境",
    storage: "执行安全",
    appearance: "外观与预览",
    advanced: "高级"
  },
  en: Object.fromEntries(settingsSections.map((section) => [section.id, section.title]))
} as Record<"zh" | "en", Record<(typeof settingsSections)[number]["id"], string>>;

const previewActionRefId = "task_action_receipt_preview";
const exportActionRefId = "task_export_bundle_preview";
const runtimeActionRefId = "provider_scheduler_status";
const chatSessionsStorageKey = "opl.nativeWorkbench.chatSessions.v1";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type ChatSession = {
  id: string;
  title: string;
  threadId?: string;
  messages: ChatMessage[];
  updatedAt: string;
};

type SidebarDisplayItem = {
  id: string;
  label: string;
  ref: string;
  summary: string;
  previewId?: string;
};

function starterPayloadFromDraft(starter: WorkbenchStarter, draft: Record<string, string>): Record<string, unknown> {
  return {
    starterId: starter.id,
    module: starter.module,
    fields: Object.fromEntries(starter.fields.map((field) => [field.name, draft[field.name] ?? field.value]))
  };
}

function formatReceipt(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function firstPreviewAction(actions: WorkbenchActionRef[]): WorkbenchActionRef | undefined {
  return actions.find((action) => action.dryRunSupported && action.payloadFields.length === 0)
    ?? actions.find((action) => action.dryRunSupported);
}

function createIntroMessages(): ChatMessage[] {
  return [];
}

function isDesignExampleMessage(message: ChatMessage): boolean {
  return message.text === "Please review the current results and methods refs, then suggest improvements for clarity and reproducibility."
    || message.text === "I reviewed the available OPL project refs. Key issues are clarity, reproducibility, evidence linkage, and delivery traceability. I can draft revisions, prepare an export packet, or start a workflow preview.";
}

function projectInputItems(sourceRefs: { ref: string; summary: string }[]): SidebarDisplayItem[] {
  const inputNames = ["Project brief.md", "Literature notes", "Data inventory.csv", "Results summary.md"];
  return inputNames.map((label, index) => ({
    id: `project-input-${index}`,
    label,
    ref: `project-context://${label}`,
    summary: sourceRefs[index]?.summary ?? "Optional project input"
  }));
}

function projectAttachmentItems(
  items: { id: string; title: string; ref: string; summary: string }[],
  previews: { id: string; previewKind: string }[]
): SidebarDisplayItem[] {
  return items.slice(0, 4).map((item, index) => ({
    id: item.id,
    label: item.title,
    ref: item.ref,
    summary: item.summary,
    previewId: previews[index % Math.max(previews.length, 1)]?.id
  }));
}

function localizedSessionTitle(title: string, locale: WorkbenchSettings["locale"]): string {
  if (locale !== "zh") return title;
  if (title === "Current project") return "当前项目";
  if (title === "New chat" || title === "New task") return "新任务";
  return title;
}

function sessionStorage() {
  return globalThis.localStorage;
}

function normalizeChatSession(value: unknown): ChatSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChatSession>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.filter((message): message is ChatMessage => Boolean(message && typeof message === "object" && typeof (message as ChatMessage).id === "string"))
    : [];
  const visibleMessages = messages.filter((message) => !isDesignExampleMessage(message));
  return {
    id: candidate.id,
    title: typeof candidate.title === "string" && candidate.title ? candidate.title : "New chat",
    threadId: typeof candidate.threadId === "string" && candidate.threadId ? candidate.threadId : undefined,
    messages: visibleMessages.length ? visibleMessages : createIntroMessages(),
    updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt ? candidate.updatedAt : new Date(0).toISOString()
  };
}

function readChatSessions(): ChatSession[] {
  try {
    const raw = sessionStorage()?.getItem(chatSessionsStorageKey);
    if (!raw) {
      return [{
        id: "session-initial",
        title: "Current project",
        messages: createIntroMessages(),
        updatedAt: new Date().toISOString()
      }];
    }
    const parsed = JSON.parse(raw);
    const sessions = Array.isArray(parsed) ? parsed.map(normalizeChatSession).filter((session): session is ChatSession => Boolean(session)) : [];
    return sessions.length ? sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) : [{
      id: "session-initial",
      title: "Current project",
      messages: createIntroMessages(),
      updatedAt: new Date().toISOString()
    }];
  } catch {
    return [{
      id: "session-initial",
      title: "Current project",
      messages: createIntroMessages(),
      updatedAt: new Date().toISOString()
    }];
  }
}

function writeChatSessions(sessions: ChatSession[]) {
  sessionStorage()?.setItem(chatSessionsStorageKey, JSON.stringify(sessions));
}

function sessionTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user" && message.text.trim());
  return firstUser?.text.trim().slice(0, 40) || "New chat";
}

function formatTimestamp(value: string, locale: WorkbenchSettings["locale"]): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "zh" ? "本地草稿" : "Local draft";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function eventMethod(event: unknown): string {
  if (typeof event === "object" && event && "method" in event && typeof (event as { method?: unknown }).method === "string") {
    return (event as { method: string }).method;
  }
  if (typeof event === "object" && event && "type" in event && typeof (event as { type?: unknown }).type === "string") {
    return (event as { type: string }).type;
  }
  return "";
}

function eventParams(event: unknown): Record<string, unknown> {
  return typeof event === "object" && event && "params" in event && typeof (event as { params?: unknown }).params === "object"
    ? ((event as { params: Record<string, unknown> }).params ?? {})
    : {};
}

function eventDelta(event: unknown): string {
  const params = eventParams(event);
  return typeof params.delta === "string" ? params.delta : "";
}

function eventCompletedText(event: unknown): string {
  const params = eventParams(event);
  const item = typeof params.item === "object" && params.item ? params.item as Record<string, unknown> : {};
  return typeof item.text === "string" ? item.text : "";
}

export function App() {
  const bridge = useMemo(() => createBrowserBridge(), []);
  const initialSessions = useMemo(() => readChatSessions(), []);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>(initialSessions[0]?.messages ?? createIntroMessages());
  const [model, setModel] = useState(initialWorkbenchModel);
  const [stateStatus, setStateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stateError, setStateError] = useState("");
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [lastDryRun, setLastDryRun] = useState("No action preview yet.");
  const [pendingAction, setPendingAction] = useState<{ actionId: string; payload: Record<string, unknown> } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sendState, setSendState] = useState<"idle" | "running" | "error">("idle");
  const [sendError, setSendError] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0]?.id ?? "session-initial");
  const [messages, setMessages] = useState<ChatMessage[]>(initialSessions[0]?.messages ?? createIntroMessages());
  const [eventFeed, setEventFeed] = useState<string[]>(["bridge.preview_only"]);
  const [codexThreadId, setCodexThreadId] = useState<string | undefined>(initialSessions[0]?.threadId);
  const [settings, setSettings] = useState<WorkbenchSettings>(() => readSettings());
  const [codexCatalog, setCodexCatalog] = useState<CodexModelCatalogEntry[]>([]);
  const [starterDrafts, setStarterDrafts] = useState<Record<string, Record<string, string>>>({});
  const [activeContextTab, setActiveContextTab] = useState<ActiveContextTab>(contextHomeId);
  const t = uiCopy[settings.locale];
  const purposeCopy = localizedPurposeLabels[settings.locale];
  const settingCopy = localizedSettingLabels[settings.locale];
  const sectionCopy = localizedSettingsSections[settings.locale];
  const localizedStateStatus = stateStatus === "loading" ? t.stateLoading : stateStatus === "ready" ? t.stateReady : t.stateError;
  const previewAction = firstPreviewAction(model.contextActions);
  const exportAction = model.contextActions.find((action) => action.id === exportActionRefId && action.dryRunSupported) ?? previewAction;
  const purposePreviewAction = model.contextActions.find((action) => action.id === previewActionRefId && action.dryRunSupported) ?? previewAction;
  const runtimeAction = model.contextActions.find((action) => action.id === runtimeActionRefId && action.dryRunSupported);
  const currentSession = chatSessions.find((session) => session.id === currentSessionId) ?? chatSessions[0];
  const contextStatusText = stateStatus === "loading"
    ? "Loading OPL App state..."
    : stateStatus === "error"
      ? `Bridge unavailable. Preview only. ${stateError}`
      : model.stateGeneratedAt
        ? `App state loaded from opl app state --profile fast --json at ${model.stateGeneratedAt}.`
        : "App state loaded from the current App state.";
  const shellBoundaryStatus = stateStatus === "loading"
    ? "App state loading"
    : stateStatus === "ready"
      ? "App state loaded"
      : "Bridge unavailable";
  const currentProject = model.sessions[0]?.workspace ?? settings.defaultWorkspace ?? "Current project";
  const previewItems = useMemo(() => [...model.artifactPreviews].sort((left, right) => {
    if (left.previewKind === right.previewKind) return 0;
    if (left.previewKind === "markdown") return -1;
    if (right.previewKind === "markdown") return 1;
    if (left.previewKind === "pdf") return -1;
    if (right.previewKind === "pdf") return 1;
    return 0;
  }), [model.artifactPreviews]);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | undefined>(previewItems[0]?.id);
  const selectedPreview = previewItems.find((preview) => preview.id === selectedPreviewId) ?? previewItems[0];
  const projectInputs = projectInputItems(model.contextSources);
  const projectAttachments = projectAttachmentItems([...model.deliverables, ...model.results, ...model.receipts], previewItems);
  const sidebarSources = projectInputs;
  const availableModels = useMemo(() => {
    if (!codexCatalog.length) {
      return codexModelPolicy.modelOptions.map((option) => ({
        ...option,
        defaultReasoningEffort: codexModelPolicy.defaultReasoningEffort,
        supportedReasoningEfforts: [...codexModelPolicy.reasoningOptions]
      }));
    }
    return codexModelPolicy.modelOptions.flatMap((option) => {
      const runtime = codexCatalog.find((item) => item.id === option.id || item.model === option.id);
      if (!runtime) return [];
      const supportedReasoningEfforts = runtime.supportedReasoningEfforts
        .filter((effort): effort is CodexReasoningEffort => codexModelPolicy.reasoningOptions.includes(effort as CodexReasoningEffort));
      return [{
        ...option,
        defaultReasoningEffort: codexModelPolicy.reasoningOptions.includes(runtime.defaultReasoningEffort as CodexReasoningEffort)
          ? runtime.defaultReasoningEffort as CodexReasoningEffort
          : supportedReasoningEfforts.at(-1) ?? "medium",
        supportedReasoningEfforts: supportedReasoningEfforts.length ? supportedReasoningEfforts : ["medium"] as CodexReasoningEffort[]
      }];
    });
  }, [codexCatalog]);
  const resolvedModel = availableModels.find((option) => option.id === settings.modelAccess) ?? availableModels[0] ?? {
    ...codexModelPolicy.modelOptions[0],
    defaultReasoningEffort: codexModelPolicy.defaultReasoningEffort,
    supportedReasoningEfforts: [...codexModelPolicy.reasoningOptions]
  };
  const resolvedReasoning = resolvedModel.supportedReasoningEfforts.includes(settings.reasoningLevel)
    ? settings.reasoningLevel
    : resolvedModel.supportedReasoningEfforts.at(-1) ?? resolvedModel.defaultReasoningEffort;
  const environmentItems = [
    { id: "opl-files-panel", group: t.projectGroup, label: t.sources, description: t.sourcesDescription, meta: String(model.contextSources.length), icon: FileText },
    { id: "opl-artifact-preview-tabs", group: t.projectGroup, label: t.results, description: t.resultsDescription, meta: String(projectAttachments.length), icon: Download },
    { id: "opl-provenance-drawer", group: t.executionGroup, label: t.actions, description: t.actionsDescription, meta: String(model.actionReceipts.length), icon: CircleEllipsis },
    { id: "opl-starter-forms", group: t.executionGroup, label: t.workflows, description: t.workflowsDescription, meta: String(model.starters.length), icon: Sparkles },
    { id: "opl-automations-panel", group: t.executionGroup, label: t.scheduled, description: t.scheduledDescription, meta: String(model.contextTrace.filter((item) => item.label.toLowerCase().includes("automation")).length), icon: Clock3 },
    { id: "opl-package-lifecycle-panel", group: t.systemGroup, label: t.packages, description: t.packagesDescription, meta: String(model.packageLifecycle.length), icon: Plug },
    { id: "opl-runtime-summary", group: t.systemGroup, label: t.runtimeMenu, description: t.runtimeDescription, meta: localizedStateStatus, icon: RefreshCw },
    { id: "opl-memory-panel", group: t.systemGroup, label: t.memory, description: t.memoryDescription, meta: "refs", icon: FileText },
    { id: "opl-always-on-panel", group: t.systemGroup, label: t.alwaysOn, description: t.alwaysOnDescription, meta: localizedStateStatus, icon: RefreshCw }
  ] satisfies { id: ContextTabId; group: string; label: string; description: string; meta: string; icon: typeof FileText }[];

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  function commitSession(nextMessages: ChatMessage[], nextThreadId: string | undefined, sessionId = currentSessionId) {
    const nextSession: ChatSession = {
      id: sessionId,
      title: sessionTitleFromMessages(nextMessages),
      threadId: nextThreadId,
      messages: nextMessages,
      updatedAt: new Date().toISOString()
    };
    setMessages(nextMessages);
    setCodexThreadId(nextThreadId);
    setChatSessions((current) => {
      const merged = [nextSession, ...current.filter((session) => session.id !== sessionId)]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      writeChatSessions(merged);
      return merged;
    });
  }

  function loadState(profile = settings.runtimeProfile) {
    setStateStatus("loading");
    setStateError("");
    return bridge
      .readState(profile)
      .then((state) => {
        setModel(deriveWorkbenchModelFromState(state));
        setStateStatus("ready");
      })
      .catch((error) => {
        setStateStatus("error");
        setStateError(String(error));
      });
  }

  useEffect(() => {
    void loadState(settings.runtimeProfile);
  }, [bridge, settings.runtimeProfile]);

  useEffect(() => {
    void bridge.readCodexModels()
      .then((catalog) => setCodexCatalog(catalog.models))
      .catch(() => setCodexCatalog([]));
  }, [bridge]);

  useEffect(() => {
    setStarterDrafts((current) => Object.fromEntries(model.starters.map((starter) => [
      starter.id,
      current[starter.id] ?? Object.fromEntries(starter.fields.map((field) => [field.name, field.value]))
    ])));
  }, [model.starters]);

  useEffect(() => bridge.subscribeEvents((event) => {
    const method = eventMethod(event);
    setEventFeed((items) => [formatEvent(event), ...items].slice(0, 8));
    if (!pendingAssistantIdRef.current) return;
    if (method === "item/agentMessage/delta") {
      const delta = eventDelta(event);
      if (!delta) return;
      setMessages((items) => items.map((item) => item.id === pendingAssistantIdRef.current
        ? { ...item, role: "assistant", text: item.text + delta }
        : item));
      return;
    }
    if (method === "item/completed") {
      const completedText = eventCompletedText(event);
      if (!completedText) return;
      setMessages((items) => items.map((item) => item.id === pendingAssistantIdRef.current
        ? { ...item, role: "assistant", text: completedText }
        : item));
    }
  }), [bridge]);

  function runDryRun(actionId: string, payload: Record<string, unknown> = {}) {
    setPendingAction({ actionId, payload });
    setInspectorOpen(true);
    setActiveContextTab("opl-provenance-drawer");
    void bridge
      .executeAction({ actionId, payload, dryRun: true })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ actionId, dryRun: true, error: String(error) })));
  }

  function executeConfirmedAction() {
    if (!pendingAction) return;
    const receiptId = `${pendingAction.actionId}:${Date.now()}`;
    const rollbackRef = `rollback://${receiptId}`;
    setInspectorOpen(true);
    setActiveContextTab("opl-provenance-drawer");
    void bridge
      .executeAction({
        actionId: pendingAction.actionId,
        payload: { ...pendingAction.payload, confirmed: true, receiptId, rollbackRef },
        dryRun: false
      })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ ...pendingAction, dryRun: false, error: String(error) })));
  }

  function previewRollback() {
    if (!pendingAction) return;
    setInspectorOpen(true);
    setActiveContextTab("opl-provenance-drawer");
    void bridge
      .executeAction({
        actionId: pendingAction.actionId,
        mode: "rollback",
        payload: { ...pendingAction.payload, rollbackRef: `rollback://${pendingAction.actionId}` },
        dryRun: true
      })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ ...pendingAction, mode: "rollback", error: String(error) })));
  }

  function sendCodexMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || sendState === "running") return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: "user", text };
    const pendingId = `assistant-${Date.now()}`;
    const pendingMessage: ChatMessage = { id: pendingId, role: "assistant", text: "" };
    const pendingMessages = messagesRef.current.concat([userMessage, pendingMessage]);
    pendingAssistantIdRef.current = pendingId;
    setMessages(pendingMessages);
    setPrompt("");
    setSendState("running");
    setSendError("");
    void bridge
      .sendMessage({
        prompt: text,
        threadId: codexThreadId,
        model: resolvedModel.id,
        reasoningEffort: resolvedReasoning
      })
      .then((reply) => {
        const nextThreadId = typeof reply === "object" && reply && "threadId" in reply
          ? String((reply as { threadId?: unknown }).threadId ?? "")
          : "";
        const finalMessage = typeof reply === "object" && reply && "finalMessage" in reply
          ? String((reply as { finalMessage?: unknown }).finalMessage ?? "")
          : "";
        const nextMessages = messagesRef.current.map((item) => item.id === pendingId
          ? { id: pendingId, role: "assistant", text: finalMessage || formatReceipt(reply) }
          : item);
        setMessages(nextMessages);
        commitSession(
          nextMessages,
          nextThreadId || codexThreadId
        );
        pendingAssistantIdRef.current = null;
        setSendState("idle");
      })
      .catch((error) => {
        const message = String(error);
        setSendError(message);
        setSendState("error");
        const errorMessage: ChatMessage = { id: pendingId, role: "system", text: formatReceipt({ executor: "codex_app_server", error: message }) };
        const nextMessages = messagesRef.current.map((item) => item.id === pendingId ? errorMessage : item);
        setMessages(nextMessages);
        commitSession(nextMessages, codexThreadId);
        pendingAssistantIdRef.current = null;
      });
  }

  function startNewChat() {
    const sessionId = `session-${Date.now()}`;
    const nextMessages = createIntroMessages();
    setCurrentSessionId(sessionId);
    setPrompt("");
    setPendingAction(null);
    setLastDryRun("No action preview yet.");
    setSendState("idle");
    setSendError("");
    commitSession(nextMessages, undefined, sessionId);
  }

  function openSession(sessionId: string) {
    const session = chatSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setCodexThreadId(session.threadId);
    setPrompt("");
    setSendState("idle");
    setSendError("");
  }

  function updateStarterField(starterId: string, fieldName: string, value: string) {
    setStarterDrafts((current) => ({
      ...current,
      [starterId]: {
        ...(current[starterId] ?? {}),
        [fieldName]: value
      }
    }));
  }

  function updateSetting<Key extends keyof WorkbenchSettings>(key: Key, value: WorkbenchSettings[Key]) {
    setSettings(writeSetting(key, value));
  }

  function settingValueLabel(key: SettingKey, value: WorkbenchSettings[SettingKey]): string {
    if (key === "modelAccess") return value === "__auto" ? autoModelLabel(settings.locale) : modelLabel(value as CodexModelId, settings.locale);
    if (key === "reasoningLevel") return reasoningLabel(value as WorkbenchSettings["reasoningLevel"], settings.locale);
    if (key === "defaultWorkspace") return settings.locale === "zh" ? "OPL App 工作区" : "OPL App workspace";
    if (key === "runtimeProfile") return value === "fast" ? (settings.locale === "zh" ? "快速" : "Fast") : (settings.locale === "zh" ? "完整" : "Full");
    if (key === "professionalStarterDefaults") return settings.locale === "zh" ? "科研、基金与演示" : "Research, grant, and presentation";
    if (key === "theme") return value === "system" ? (settings.locale === "zh" ? "跟随系统" : "System") : (settings.locale === "zh" ? "浅色" : "Light");
    if (key === "artifactPreviewMode") return settings.locale === "zh" ? "丰富预览（仅引用）" : "Rich preview (refs only)";
    if (typeof value === "boolean") return value ? t.on : t.off;
    return String(value);
  }

  function renderSettingControl(key: SettingKey) {
    const value = settings[key];
    if (typeof value === "boolean") {
      return (
        <button className="setting-switch" role="switch" aria-checked={value} type="button" onClick={() => updateSetting(key, !value)}>
          <span className="setting-switch-track" aria-hidden="true"><span /></span>
          <span>{value ? t.on : t.off}</span>
        </button>
      );
    }
    if (key === "locale") {
      return (
        <div className="segmented-control" data-testid="opl-locale-toggle" aria-label="Language">
          <button type="button" data-active={value === "zh"} onClick={() => updateSetting("locale", "zh")}>
            中文
          </button>
          <button type="button" data-active={value === "en"} onClick={() => updateSetting("locale", "en")}>
            English
          </button>
        </div>
      );
    }
    if (key === "reasoningLevel") {
      return (
        <select className="setting-select" data-testid="opl-settings-reasoning" value={resolvedReasoning} onChange={(event) => updateSetting("reasoningLevel", event.currentTarget.value as WorkbenchSettings["reasoningLevel"])}>
          {codexModelPolicy.reasoningOptions.map((effort) => (
            <option key={effort} value={effort} disabled={!resolvedModel.supportedReasoningEfforts.includes(effort)}>{reasoningLabel(effort, settings.locale)}</option>
          ))}
        </select>
      );
    }
    if (key === "modelAccess") {
      return (
        <select className="setting-select" data-testid="opl-model-access-entry" value={value === "__auto" || availableModels.some((option) => option.id === value) ? value : "__auto"} onChange={(event) => updateSetting("modelAccess", event.currentTarget.value as WorkbenchSettings["modelAccess"])}>
          <option value="__auto">{autoModelLabel(settings.locale)}</option>
          {availableModels.map((option) => (
            <option key={option.id} value={option.id}>{modelLabel(option.id, settings.locale)}</option>
          ))}
        </select>
      );
    }
    if (key === "runtimeProfile") {
      return (
        <button className="setting-toggle" type="button" onClick={() => updateSetting("runtimeProfile", value === "fast" ? "full" : "fast")}>
          {settingValueLabel(key, value)}
        </button>
      );
    }
    if (key === "theme") {
      return (
        <button className="setting-toggle" type="button" onClick={() => updateSetting("theme", value === "system" ? "light" : "system")}>
          {settingValueLabel(key, value)}
        </button>
      );
    }
    return (
      <code data-testid={key === "modelAccess" ? "opl-model-access-entry" : undefined}>
        {settingValueLabel(key, value)}
      </code>
    );
  }

  return (
    <main
      data-testid="opl-native-workbench-root"
      data-layout="codex-sidebar-chat"
      className={`opl-native-workbench codex-sidebar-chat ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} ${inspectorOpen ? "inspector-open" : "inspector-closed"}`}
    >
      <style>{codexWorkbenchStyles}</style>

      <aside data-testid="opl-workspace-rail" className="sidebar" aria-label="Workspaces">
        <header className="brand-row">
          <img src="branding/opl-app-logo.png" alt="One Person Lab App" />
          <span className="brand-lockup">
            <strong className="brand-mark">One Person Lab</strong>
            <span className="brand-name">Codex</span>
          </span>
          <button className="icon-button sidebar-search" type="button" aria-label={settings.locale === "zh" ? "搜索对话" : "Search conversations"}>
            <Search aria-hidden="true" size={15} />
          </button>
          <button className="icon-button sidebar-close-mobile" type="button" aria-label={t.hideSidebar} onClick={() => setSidebarOpen(false)}>
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="sidebar-scroll">
          <div className="quick-actions">
            <button type="button" onClick={startNewChat}>
              <Plus aria-hidden="true" size={15} />
              {t.newTask}
              <span className="kbd-hint">⌘N</span>
            </button>
          </div>

          <nav className="sidebar-primary" aria-label="Primary navigation">
            <button type="button" onClick={() => {
              setInspectorOpen(true);
              setActiveContextTab("opl-automations-panel");
            }}>
              <Clock3 aria-hidden="true" size={15} />
              {t.scheduled}
            </button>
            <button type="button" onClick={() => {
              setInspectorOpen(true);
              setActiveContextTab("opl-package-lifecycle-panel");
            }}>
              <Plug aria-hidden="true" size={15} />
              {t.agents}
            </button>
            <button type="button" onClick={() => setActiveView("chat")}>
              <Sparkles aria-hidden="true" size={15} />
              {t.chat}
            </button>
          </nav>

          <section className="sidebar-panel" aria-label="Current project">
          <div className="sidebar-section-head">
              <strong>{t.projects}</strong>
          </div>
            <button className="project-root" type="button" onClick={() => setActiveView("chat")}>
              <Folder aria-hidden="true" size={15} />
              <strong>{currentProject}</strong>
              <span className="project-device">{t.local}</span>
              <span className="project-status-dot" aria-label={shellBoundaryStatus} />
            </button>

            <div className="project-children">
              <div className="project-context-links">
                <button
                  data-testid="opl-project-inputs"
                  type="button"
                  className="project-context-link"
                  onClick={() => {
                    setInspectorOpen(true);
                    setActiveContextTab("opl-files-panel");
                  }}
                >
                  <FileText aria-hidden="true" size={14} />
                  <span>{t.projectContext}</span>
                  <span>{sidebarSources.length}</span>
                </button>
                <button
                  data-testid="opl-project-attachments"
                  type="button"
                  className="project-context-link"
                  onClick={() => {
                    setInspectorOpen(true);
                    setActiveContextTab("opl-artifact-preview-tabs");
                  }}
                >
                  <Download aria-hidden="true" size={14} />
                  <span>{t.filesOutputs}</span>
                  <span>{projectAttachments.length}</span>
                </button>
              </div>

              <section data-testid="opl-project-chats" className="history-list" aria-label="Project chats">
                <ol data-testid="opl-session-list">
                  {chatSessions.map((session) => (
                    <li key={session.id} className={session.id === currentSessionId ? "active" : undefined}>
                      <button type="button" onClick={() => openSession(session.id)}>
                        <strong>{localizedSessionTitle(session.title, settings.locale)}</strong>
                        <span>{session.threadId ? "Codex resumable thread" : "Local draft session"}</span>
                        <small>{formatTimestamp(session.updatedAt, settings.locale)}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </section>
        </div>

        <footer className="sidebar-footer" aria-label="Sidebar controls">
          <button type="button" aria-current={activeView === "settings" ? "page" : undefined} aria-label={t.openSettings} onClick={() => setActiveView("settings")}>
            <span className="account-avatar">OPL</span>
            <span className="account-copy">
              <strong>One Person Lab</strong>
              <small>{t.settings}</small>
            </span>
            <Settings className="settings-glyph" aria-hidden="true" size={14} />
          </button>
          <StatusPill status={shellBoundaryStatus} />
        </footer>
      </aside>

      <section className="chat-shell" aria-label="Single conversation canvas">
        <header className="topbar">
          <div className="topbar-copy">
            <button className="icon-button" type="button" aria-label={sidebarOpen ? t.hideSidebar : t.showSidebar} onClick={() => setSidebarOpen((open) => !open)}>
              <PanelLeft aria-hidden="true" size={16} />
            </button>
            <div className="topbar-title">
              <Folder aria-hidden="true" size={15} />
              <h1>{activeView === "settings" ? t.settings : localizedSessionTitle(currentSession?.title || t.newTaskTitle, settings.locale)}</h1>
            </div>
            <button className="icon-button" type="button" aria-label={t.conversationMenu}>
              <CircleEllipsis aria-hidden="true" size={16} />
            </button>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              data-testid="opl-export-action"
              type="button"
              aria-label={t.previewExport}
              disabled={!exportAction}
              onClick={() => {
                if (exportAction) runDryRun(exportAction.id, { refs: model.deliverables.map((item) => item.ref) });
              }}
            >
              <Download aria-hidden="true" size={15} />
            </button>
            <button className="icon-button" type="button" aria-label={t.refreshContext} onClick={() => void loadState(settings.runtimeProfile)}>
              <RefreshCw aria-hidden="true" size={15} />
            </button>
            {activeView === "settings" ? (
              <button className="icon-button" data-testid="opl-skip-to-chat" type="button" aria-label={t.backToChat} onClick={() => setActiveView("chat")}>
                <X aria-hidden="true" size={16} />
              </button>
            ) : null}
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setInspectorOpen((open) => !open);
                setActiveContextTab(contextHomeId);
              }}
              aria-label={inspectorOpen ? t.closeEnvironment : t.openEnvironment}
              aria-pressed={inspectorOpen}
            >
              <PanelRightOpen aria-hidden="true" size={16} />
            </button>
          </div>
        </header>

        {activeView === "chat" ? (
          <section className="conversation">
            <div className="conversation-inner">
              <section
                data-testid="opl-workbench-delivery-mode"
                className="workflow-strip delivery-workbench"
                aria-label="Suggested outputs"
              >
                <div className="workflow-strip-head">
                  <span>Common OPL actions stay secondary until you ask for them.</span>
                  <span className="delivery-mode-tag" data-testid="opl-delivery-mode">research</span>
                </div>
                <div className="workflow-chip-row">
                  {model.purposes.map((purpose) => (
                    <button
                      key={purpose}
                      data-testid="opl-delivery-mode-option"
                      className="workflow-chip"
                      type="button"
                      disabled={!purposePreviewAction}
                      onClick={() => {
                        if (purposePreviewAction) runDryRun(purposePreviewAction.id, { purpose });
                      }}
                    >
                      {purposeCopy[purpose]}
                    </button>
                  ))}
                </div>
              </section>

              <div className="thread">
                <section className="thread-intro" aria-label="Conversation guidance">
                  <span className="thread-note">{sidebarSources.length} project materials loaded</span>
                  <span className="thread-note">Preview and export actions require confirmation</span>
                  <span className="thread-note">Artifact bodies remain source-owned</span>
                </section>

                {messages.length === 0 ? (
                  <section className="empty-thread" aria-label="Empty conversation">
                    <div className="empty-thread-inner">
                      <strong>{t.emptyTitle}</strong>
                      <p>{t.emptyDescription(currentProject)}</p>
                      <div className="empty-starters" aria-label="Professional agent starters">
                        {model.purposes.slice(0, 3).map((purpose) => (
                          <button
                            key={purpose}
                            data-testid="opl-delivery-mode-option"
                            type="button"
                            onClick={() => setPrompt(settings.locale === "zh" ? `${purposeCopy[purpose]}：${currentProject}` : `${purposeCopy[purpose]} for ${currentProject}`)}
                          >
                            {purposeCopy[purpose]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {messages.map((message, index) => (
                  <article
                    key={message.id}
                    data-testid={message.role === "assistant" ? "opl-conversation-event" : undefined}
                    className={`message ${message.role}`}
                  >
                    {message.role === "user" ? <span className="message-label">{t.you}</span> : null}
                    {message.role === "assistant" ? <span className="message-label">{t.assistant}</span> : null}
                    {message.role === "system" ? <span className="message-label">{t.runtime}</span> : null}
                    <div className="message-frame">
                      <p>{message.text || (sendState === "running" ? t.codexWorking : t.waitingReply)}</p>
                    </div>
                    {message.role === "assistant" && index === messages.length - 1 && sendState === "running" ? (
                      <div className="run-events" aria-label="Current run events">
                        {eventFeed.slice(0, 4).reverse().map((item, eventIndex) => (
                          <span className="run-event" key={`${item}-${eventIndex}`}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "assistant" && index === messages.length - 1 && Boolean(message.text) ? (
                      <section data-testid="opl-assistant-artifact-card" className="assistant-artifact-card" aria-label="Draft artifact">
                        <header>
                          <FileText aria-hidden="true" size={16} />
                          <strong>{selectedPreview?.label ?? t.currentPreview}</strong>
                          <button type="button" onClick={() => {
                            setInspectorOpen(true);
                            setActiveContextTab("opl-artifact-preview-tabs");
                            setSelectedPreviewId(selectedPreview?.id);
                          }}>
                            {t.openPreview}
                          </button>
                          <MoreVertical aria-hidden="true" size={16} />
                        </header>
                        <footer>
                          <span>{t.workflowRun}</span>
                          {t.workflowSteps.map((step) => (
                            <span key={step} className="progress-chip">✓ {step}</span>
                          ))}
                        </footer>
                      </section>
                    ) : null}
                    <span className="message-meta">
                      {message.role === "user"
                        ? "Prompt"
                        : message.role === "system"
                          ? "Action or runtime event"
                          : currentSession?.threadId
                            ? "Streaming via codex app-server"
                            : "Project context loaded"}
                    </span>
                    {message.role === "assistant" ? <span data-testid="opl-codex-reply" hidden /> : null}
                  </article>
                ))}
              </div>

              <form className="composer" onSubmit={sendCodexMessage}>
                <div className="composer-frame">
                  <textarea
                    aria-label="Prompt"
                    placeholder={t.prompt}
                    value={prompt}
                    onChange={(event) => setPrompt(event.currentTarget.value)}
                    disabled={sendState === "running"}
                  />
                  <footer>
                    <div className="composer-meta">
                      <button className="composer-action" type="button" aria-label={t.attachFiles}>
                        <Plus aria-hidden="true" size={15} />
                      </button>
                      <button
                        className="composer-control"
                        data-accent="true"
                        type="button"
                        onClick={() => {
                          setInspectorOpen(true);
                          setActiveContextTab("opl-package-lifecycle-panel");
                        }}
                      >
                        <Plug aria-hidden="true" size={14} />
                        {t.capabilities}
                      </button>
                      <span className={`composer-status ${sendState}`} data-testid="opl-composer-run-state">
                        {sendState === "running" ? t.working : sendState === "error" ? sendError : ""}
                      </span>
                    </div>
                    <div className="composer-actions">
                      <nav data-testid="opl-topbar-model-config" className="composer-model-controls" aria-label="Conversation configuration">
                        <label className="composer-select" data-testid="opl-model-access-entry">
                          <select aria-label={settings.locale === "zh" ? "模型" : "Model"} value={resolvedModel.id} onChange={(event) => updateSetting("modelAccess", event.currentTarget.value as WorkbenchSettings["modelAccess"])}>
                            {availableModels.map((option) => (
                              <option key={option.id} value={option.id}>{modelLabel(option.id, settings.locale)}</option>
                            ))}
                          </select>
                          <ChevronDown aria-hidden="true" size={12} />
                        </label>
                        <label className="composer-select">
                          <select aria-label={settings.locale === "zh" ? "推理强度" : "Reasoning effort"} value={resolvedReasoning} onChange={(event) => updateSetting("reasoningLevel", event.currentTarget.value as WorkbenchSettings["reasoningLevel"])}>
                            {resolvedModel.supportedReasoningEfforts.map((effort) => (
                              <option key={effort} value={effort}>{reasoningLabel(effort, settings.locale, true)}</option>
                            ))}
                          </select>
                          <ChevronDown aria-hidden="true" size={12} />
                        </label>
                      </nav>
                      <button className="composer-submit" type="submit" aria-label={sendState === "running" ? t.running : sendState === "error" ? t.retry : t.send} disabled={!prompt.trim() || sendState === "running"}>
                        <Send aria-hidden="true" size={15} />
                        <span>{sendState === "running" ? t.running : sendState === "error" ? t.retry : t.send}</span>
                      </button>
                    </div>
                  </footer>
                </div>
              </form>
            </div>
          </section>
        ) : (
          <section data-testid="opl-settings-panel" className="settings-page" aria-label="Settings">
            <div className="settings-content">
              <section data-testid="opl-settings-section" data-section="runtime-readback">
                <h2>{t.settingsRuntime}</h2>
                <dl>
                  <div>
                    <dt>{t.stateProfile}</dt>
                    <dd>{settings.runtimeProfile}<small>{t.stateProfileHelp}</small></dd>
                  </div>
                  <div>
                    <dt>{t.contextState}</dt>
                    <dd>{localizedStateStatus}<small>{stateError || model.stateGeneratedAt || t.noReadbackTimestamp}</small></dd>
                  </div>
                </dl>
                <button type="button" onClick={() => void loadState(settings.runtimeProfile)}>{t.refreshState}</button>
              </section>
              {settingsSections.map((section) => (
                <section key={section.id} data-testid="opl-settings-section" data-section={section.id}>
                  <h2>{sectionCopy[section.id]}</h2>
                  <dl>
                    {section.keys.map((key) => (
                      <div key={key}>
                        <dt>{settingCopy[key]}</dt>
                        <dd>
                          {renderSettingControl(key)}
                          <small>{t.defaultLabel}: {settingValueLabel(key, settingsDefaults[key])}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </section>
        )}
      </section>

      <aside
        className={`context-inspector ${inspectorOpen ? "open" : ""}`}
        aria-label="On-demand context panel"
        aria-hidden={!inspectorOpen}
      >
        <header className="inspector-header">
          <div className="environment-detail-header">
            {activeContextTab !== contextHomeId ? (
              <button type="button" aria-label={t.backEnvironment} onClick={() => setActiveContextTab(contextHomeId)}>
                <ChevronLeft aria-hidden="true" size={15} />
              </button>
            ) : null}
            <h2>{activeContextTab === contextHomeId
              ? t.environment
              : environmentItems.find((item) => item.id === activeContextTab)?.label ?? t.environment}</h2>
          </div>
          <button type="button" aria-label={t.close} onClick={() => setInspectorOpen(false)}>
            <X aria-hidden="true" size={15} />
          </button>
        </header>

        <section className="context-summary" aria-live="polite">
          <p className="context-status">{contextStatusText}</p>
        </section>

        <div className="context-scroll">
          <nav data-testid="opl-context-tabs" className="environment-menu" hidden={activeContextTab !== contextHomeId}>
            <p>{t.environmentStatus}</p>
            {environmentItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div className="environment-menu-entry" key={item.id}>
                  {index === 0 || environmentItems[index - 1]?.group !== item.group ? <strong className="environment-menu-group">{item.group}</strong> : null}
                  <button type="button" onClick={() => setActiveContextTab(item.id)}>
                    <span className="environment-menu-icon"><Icon aria-hidden="true" size={16} /></span>
                    <span className="environment-menu-copy">
                      <strong>{item.label}</strong>
                      <small title={item.description}>{item.description}</small>
                    </span>
                    <span className="environment-menu-meta">{item.meta}</span>
                    <ChevronRight aria-hidden="true" size={15} />
                  </button>
                </div>
              );
            })}
          </nav>

          <section data-testid="opl-files-panel" className="context-block" hidden={activeContextTab !== "opl-files-panel"}>
            <div className="context-list-head">
              <strong>{t.sources}</strong>
              <button className="context-quiet-action" type="button" onClick={() => void loadState(settings.runtimeProfile)}>{t.refresh}</button>
            </div>
            <p className="context-empty">{t.sourcesBoundary}</p>
            <ol className="context-list">
              {model.contextSources.map((source) => (
                <li key={source.id}>
                  <strong>{source.label}</strong>
                  <span>{source.summary}</span>
                  <code className="context-code">{source.ref}</code>
                </li>
              ))}
            </ol>
          </section>

          <section className="context-block" hidden={activeContextTab !== "opl-artifact-preview-tabs"}>
            <Tabs.Root
              key={previewItems.map((preview) => preview.id).join(":")}
              data-testid="opl-artifact-preview-tabs"
              className="artifact-preview-tabs"
              value={selectedPreview?.id}
              onValueChange={setSelectedPreviewId}
            >
              <Tabs.List aria-label="Artifact previews">
                {previewItems.slice(0, 3).map((preview, index) => (
                  <Tabs.Trigger key={preview.id} value={preview.id} data-testid="opl-artifact-preview-tab">
                    {index === 0 ? "Markdown" : index === 1 ? t.receipt : `${t.sources} (${model.contextSources.length})`}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {previewItems.slice(0, 3).map((preview) => (
                <Tabs.Content
                  key={preview.id}
                  value={preview.id}
                  data-preview-kind={preview.rendererModuleId}
                  data-testid="opl-artifact-preview-panel"
                  data-selected={preview.id === selectedPreview?.id}
                  className="artifact-preview"
                >
                  {preview.id === selectedPreview?.id ? <span data-testid="opl-selected-artifact-preview" hidden /> : null}
                  <ArtifactPreviewCard preview={preview} />
                </Tabs.Content>
              ))}
            </Tabs.Root>

            <section className="delivery-cards">
              <div className="delivery-head">
                <strong>{t.deliverables}</strong>
                <span className="delivery-note">{t.recentRefs}</span>
              </div>
              <div className="delivery-stack">
                {model.deliverables.slice(0, 3).map((item) => <DeliveryCard key={item.id} item={item} />)}
                {model.receipts.slice(0, 2).map((item) => <DeliveryCard key={item.id} item={item} />)}
              </div>
            </section>
          </section>

          <section data-testid="opl-provenance-drawer" className="context-block provenance-drawer" hidden={activeContextTab !== "opl-provenance-drawer"}>
            <header>
              <h3>{t.traceAndActions}</h3>
              <PanelRightOpen aria-hidden="true" size={18} />
            </header>
            <p data-testid="opl-provenance-ref" className="delivery-note">
              {t.traceBoundary}
            </p>
            <dl className="trace-list">
              {model.contextTrace.map((trace) => (
                <div key={trace.id}>
                  <dt>{trace.label}</dt>
                  <dd>{trace.value}</dd>
                </div>
              ))}
            </dl>
            <div className="provenance-actions">
              <button
                data-testid="opl-export-action-dry-run"
                type="button"
                disabled={!exportAction}
                onClick={() => {
                  if (exportAction) runDryRun(exportAction.id, { refs: model.deliverables.map((item) => item.ref) });
                }}
              >
                <Download aria-hidden="true" size={16} />
                {t.previewAction}
              </button>
              <button
                data-testid="opl-runtime-action-execute"
                type="button"
                disabled={!pendingAction}
                onClick={executeConfirmedAction}
              >
                {t.executeConfirmed}
              </button>
              <button type="button" disabled={!pendingAction} onClick={previewRollback}>{t.previewRollback}</button>
            </div>
            <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>

            <section data-testid="opl-action-receipt-summary-list" className="action-receipt-summary-list">
              <h3>{t.actionReceipts}</h3>
              {model.actionReceipts.map((receipt) => <ActionReceiptSummary key={receipt.id} receipt={receipt} />)}
            </section>

            <ConfirmationCard
              card={model.confirmations[0]!}
              question={model.questions[0]!}
              onDryRun={runDryRun}
            />
          </section>

          <section data-testid="opl-starter-forms" className="context-block starter-forms" aria-label="Workflow starters" hidden={activeContextTab !== "opl-starter-forms"}>
            <div className="context-list-head">
              <strong>{t.workflowStarters}</strong>
              <span className="delivery-note">{t.previewFirst}</span>
            </div>
            <div className="starter-stack">
              {model.contextActions.filter((action) => action.dryRunSupported).slice(0, 8).map((action) => (
                <article key={action.id} className="starter-form" data-testid="opl-starter-form" data-starter={action.id}>
                  <header>
                    <h3>{action.label}</h3>
                    <span>{action.mutates}</span>
                  </header>
                  <p>{action.route}</p>
                  <button type="button" onClick={() => runDryRun(action.id)}>
                    <Send aria-hidden="true" size={16} />
                    {t.previewReceipt}
                  </button>
                </article>
              ))}
              {model.starters.map((starter) => (
                <form
                  key={starter.id}
                  className="starter-form"
                  data-testid="opl-starter-form"
                  data-starter-testid={`opl-starter-form-${starter.purpose}`}
                  data-starter={starter.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const actionId = starter.previewActionId ?? starter.dryRunAction;
                    if (actionId) {
                      runDryRun(
                        actionId,
                        starterPayloadFromDraft(starter, starterDrafts[starter.id] ?? {})
                      );
                    }
                  }}
                >
                  <header>
                    <h3>{starter.title}</h3>
                    <span>{starter.module}</span>
                  </header>
                  <p>{starter.intent}</p>
                  {starter.fields.map((field) => (
                    <label key={field.name} className="starter-field">
                      <span>{field.label}</span>
                      {field.input === "textarea" ? (
                        <textarea
                          value={starterDrafts[starter.id]?.[field.name] ?? field.value}
                          onChange={(event) => updateStarterField(starter.id, field.name, event.currentTarget.value)}
                        />
                      ) : field.input === "select" ? (
                        <select
                          value={starterDrafts[starter.id]?.[field.name] ?? field.value}
                          onChange={(event) => updateStarterField(starter.id, field.name, event.currentTarget.value)}
                        >
                          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={starterDrafts[starter.id]?.[field.name] ?? field.value}
                          onChange={(event) => updateStarterField(starter.id, field.name, event.currentTarget.value)}
                        />
                      )}
                    </label>
                  ))}
                  <small>{starter.sourceRef ?? starter.status ?? "No App action source ref."}</small>
                  <button type="submit" disabled={starter.available === false || !(starter.previewActionId ?? starter.dryRunAction)}>
                    <Send aria-hidden="true" size={16} />
                    {starter.available === false ? t.unavailable : t.previewWorkflow}
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section data-testid="opl-automations-panel" className="context-block" hidden={activeContextTab !== "opl-automations-panel"}>
            <div className="context-list-head">
              <strong>{t.scheduled}</strong>
              <span className="delivery-note">{t.readbackOnly}</span>
            </div>
            <p className="context-empty">{t.scheduledDescription}</p>
            <dl className="trace-list">
              {model.contextTrace.filter((item) => item.label.toLowerCase().includes("automation")).map((item) => (
                <div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>
              ))}
            </dl>
          </section>

          <section
            data-testid="opl-package-lifecycle-panel"
            className="context-block package-lifecycle-panel"
            aria-label="Agent package lifecycle"
            hidden={activeContextTab !== "opl-package-lifecycle-panel"}
          >
            <div className="context-list-head">
              <strong>{t.agentPackages}</strong>
              <span className="delivery-note">{t.appRootRefs}</span>
            </div>
            <p className="context-empty">
              {t.packageBoundary}
            </p>
            <div className="package-lifecycle-list">
              {model.packageLifecycle.map((item) => (
                <article key={item.id} data-testid="opl-package-lifecycle-card" className="package-lifecycle-card">
                  <header>
                    <strong>{item.label}</strong>
                    <span className="delivery-note">{item.packageId} / {item.status}</span>
                    <code className="context-code">{item.sourceRef}</code>
                  </header>
                  <p>{item.summary}</p>
                  <p className="delivery-note">{item.sourceExplanation}</p>
                  <div className="package-filter-list" aria-label={`${item.label} search and filter metadata`}>
                    <div>
                      <dt>{t.search}</dt>
                      <dd><code>{item.searchMetadata.query}</code></dd>
                    </div>
                    <div>
                      <dt>{t.filterTags}</dt>
                      <dd><code>{item.searchMetadata.tags.join(", ")}</code></dd>
                    </div>
                    {item.searchMetadata.filters.map((filter) => (
                      <div key={`${item.id}-filter-${filter.label}-${filter.ref}`}>
                        <dt>{filter.label}</dt>
                        <dd>
                          <code>{filter.ref}</code>
                          <small>{filter.summary}</small>
                        </dd>
                      </div>
                    ))}
                  </div>
                  <div className="package-axis-list" aria-label={`${item.label} status axes`}>
                    {item.statusAxes.map((axis) => (
                      <div key={`${item.id}-${axis.label}`}>
                        <dt>{axis.label}</dt>
                        <dd>
                          <code>{axis.value}</code>
                          <small> {axis.source}</small>
                        </dd>
                      </div>
                    ))}
                  </div>
                  <div className="package-detail-list" aria-label={`${item.label} lifecycle details`}>
                    {item.details.map((detail) => (
                      <div key={`${item.id}-detail-${detail.label}`}>
                        <dt>{detail.label}</dt>
                        <dd>
                          <code>{detail.value}</code>
                          <small> {detail.source}</small>
                          {detail.ref ? <small><code>{detail.ref}</code></small> : null}
                          <small>{detail.summary}</small>
                        </dd>
                      </div>
                    ))}
                  </div>
                  {item.refs.length ? (
                    <div className="package-ref-list" aria-label={`${item.label} refs`}>
                      {item.refs.map((ref) => (
                        <div key={`${item.id}-${ref.label}-${ref.ref}`}>
                          <dt>{ref.label}</dt>
                          <dd>
                            <code>{ref.ref}</code>
                            <small>{ref.summary}</small>
                          </dd>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="package-action-row" aria-label={`${item.label} package actions`}>
                    {item.actions.map((action) => (
                      <div key={`${item.id}-${action.kind}`} className="package-action-detail">
                        <button
                          data-testid="opl-package-lifecycle-action"
                          type="button"
                          disabled={action.status !== "available" || !action.actionId}
                          onClick={() => {
                            if (!action.actionId) return;
                            runDryRun(action.actionId, {
                              package_id: item.packageId,
                              lifecycle_action: action.kind,
                              source_ref: item.sourceRef
                            });
                          }}
                        >
                          {action.label}: {action.status}
                        </button>
                        <small>{action.reason}</small>
                        <code className="context-code">{action.actionId ?? action.sourceRef}</code>
                      </div>
                    ))}
                  </div>
                  <p className="delivery-note">{item.authorityBoundary}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            data-testid="opl-secondary-runtime-context"
            className="context-block runtime-panel"
            hidden={activeContextTab !== "opl-runtime-summary"}
          >
            <div className="context-list-head">
              <h3 data-testid="opl-runtime-summary">{t.runtimeMenu}</h3>
              <span className="delivery-note">{t.readbackOnly}</span>
            </div>
            <div className="runtime-meta">
              <div data-testid="opl-runtime-context-group" className="session-chip">{localizedStateStatus}</div>
              <div data-testid="opl-runtime-context-item" className="runtime-note">{t.runtimeNoAuthority}</div>
            </div>
            <div className="runtime-actions">
              <button
                data-testid="opl-runtime-full-detail-button"
                type="button"
                onClick={() => void bridge.readFullDrilldown()}
              >
                {t.fullDrilldown}
              </button>
              <button
                data-testid="opl-runtime-action-dry-run"
                type="button"
                disabled={!runtimeAction}
                onClick={() => {
                  if (runtimeAction) runDryRun(runtimeAction.id, { source: "runtime-panel" });
                }}
              >
                {t.previewAction}
              </button>
            </div>

            <RendererModuleRegistryPanel />

            <div className="utility-stack">
              <section data-testid="opl-skills-panel" className="context-block">
                <h3>{t.skills}</h3>
                <p className="context-empty">{t.skillsBoundary}</p>
              </section>
              <section data-testid="opl-routing-panel" className="context-block">
                <h3>{t.routing}</h3>
                <p className="context-empty">{t.routingBoundary}</p>
              </section>
            </div>

            <div className="visually-hidden" data-testid="opl-web-transport">window.oplNativeWorkbench / SSE /api/opl-events</div>
            <div className="visually-hidden" data-testid="opl-event-feed">{eventFeed.join(" / ")} tool process diff file receipt user_input permission</div>
          </section>

          <section data-testid="opl-memory-panel" className="context-block" hidden={activeContextTab !== "opl-memory-panel"}>
            <div className="context-list-head">
              <h3>{t.memory}</h3>
              <span className="delivery-note">refs-only</span>
            </div>
            <p className="context-empty">{t.memoryBoundary}</p>
          </section>

          <section data-testid="opl-always-on-panel" className="context-block" hidden={activeContextTab !== "opl-always-on-panel"}>
            <div className="context-list-head">
              <h3>{t.alwaysOn}</h3>
              <span className="delivery-note">{localizedStateStatus}</span>
            </div>
            <p className="context-empty">{t.alwaysOnBoundary}</p>
          </section>

        </div>
      </aside>
    </main>
  );
}

function formatEvent(event: unknown): string {
  if (typeof event === "object" && event && "method" in event) {
    return String((event as { method?: unknown }).method);
  }
  if (typeof event === "object" && event && "type" in event) {
    return String((event as { type?: unknown }).type);
  }
  return "event";
}

export default App;
