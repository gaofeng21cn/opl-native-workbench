import { MessageText, Pill } from "@deepseek-ai/dsh-client-ui-primitives";
import { Streamdown } from "streamdown";
import {
  CircleEllipsis,
  Download,
  FileText,
  Folder,
  Plug,
  RefreshCw,
  Search,
  Send,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import {
  createBrowserBridge,
  type CodexCapabilityCatalog,
  type CodexModelCatalogEntry,
  type CodexPickedInput,
  type CodexSkillCapability,
  type OplActionReceipt
} from "../bridge/oplBridge";
import type { CodexThread } from "../threads/types";
import {
  ActionReceiptSummary,
  ArtifactPreviewCard,
  ConfirmationCard,
  RendererModuleRegistryPanel
} from "../ui/workbenchPrimitives";
import {
  deriveWorkbenchModelFromState,
  deriveThreadDirectory,
  deriveThreadMessages,
  initialWorkbenchModel,
  type WorkbenchProjectGroup,
  type WorkbenchActionRef,
  type WorkbenchStarter,
  type WorkbenchThreadItem,
  type WorkbenchThreadMessage
} from "./workbenchModel";
import {
  migrateStorageValue,
  readSettings,
  writeSetting,
  writeSettings,
  type WorkbenchSettings
} from "./settingsModel";
import { codexWorkbenchStyles } from "./codexWorkbenchStyles";
import {
  codexModelPolicy,
  conversationModelLabel,
  modelLabel,
  reasoningLabel,
  resolveCodexModelOptions,
  resolveCodexSelection
} from "./modelPolicy";
import {
  SettingsPanel,
  type SettingsActionConfirmation,
  type SettingsActionFeedback,
  type SettingsActionRequest,
  type SettingsDestinationId
} from "./SettingsPanel";
import { ThreadDetailPopover } from "./threads/ThreadDetailPopover";
import { ThreadLifecycleConfirmationDialog } from "./threads/ThreadLifecycleConfirmationDialog";
import type { ThreadLifecycleAction } from "./threads/ThreadLifecycleConfirmationDialog";
import { ThreadRail } from "./threads/ThreadRail";
import { assistantDisplayMarkdown } from "./messageDisplay";
import {
  ComposerCapabilityPalette,
  type ComposerSelection
} from "./ComposerCapabilityPalette";
import { ThreadSearchDialog } from "./ThreadSearchDialog";
import type {
  OplContributionAction,
  OplUiContributionsProjection,
  RenderOplContributionSlot
} from "../composition/contributionProjection";
import type { RenderOplStudioShell } from "../composition/oplStudioSurface";

const contextTabs = [
  "opl-files-panel",
  "opl-artifact-preview-tabs",
  "opl-provenance-drawer",
  "opl-starter-forms",
  "opl-package-lifecycle-panel",
  "opl-runtime-summary",
  "opl-automations-panel",
  "opl-memory-panel",
  "opl-always-on-panel"
] as const;
type ContextTabId = (typeof contextTabs)[number];

const assistantMarkdownLinkSafety = { enabled: false } as const;
const assistantMarkdownControls = {
  code: { copy: true, download: false },
  table: true,
  mermaid: true
} as const;

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
    agentPermissions: "Agent 权限",
    fullAccess: "完全访问",
    workspaceAccess: "工作区访问",
    readOnlyAccess: "只读",
    working: "正在工作",
    running: "运行中",
    retry: "重试",
    send: "发送",
    sendFailed: "发送失败，请重试。",
    modelSelectionUnavailable: "所选固定模型当前不可用，请选择自动或其他模型。",
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
    agentPermissions: "Agent permissions",
    fullAccess: "Full access",
    workspaceAccess: "Workspace access",
    readOnlyAccess: "Read only",
    working: "Working",
    running: "Running",
    retry: "Retry",
    send: "Send",
    sendFailed: "Message could not be sent. Please retry.",
    modelSelectionUnavailable: "The selected fixed model is unavailable. Choose Auto or another model.",
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

const previewActionRefId = "task_action_receipt_preview";
const exportActionRefId = "task_export_bundle_preview";
const runtimeActionRefId = "provider_scheduler_status";
const emptyCapabilityCatalog: CodexCapabilityCatalog = {
  source: "bridge_unavailable",
  skills: [],
  plugins: [],
  apps: [],
  errors: []
};
const legacyChatSessionsStorageKey = "opl.nativeWorkbench.chatSessions.v1";
const legacyChatSessionsBackupKey = "opl.studio.chatSessions.legacyReadOnlyBackup.v1";
const legacyChatSessionsBackupStorageKey = "opl.nativeWorkbench.chatSessions.legacyReadOnlyBackup.v1";
const uiMetadataStorageKey = "opl.studio.uiMetadata.v2";
const legacyUiMetadataStorageKey = "opl.nativeWorkbench.uiMetadata.v2";
const draftStorageKey = "opl.studio.drafts.v2";
const legacyDraftStorageKey = "opl.nativeWorkbench.drafts.v2";
const defaultSidebarWidth = 236;
const minimumSidebarWidth = 200;
const maximumSidebarWidth = 420;

type ThreadScope = "current" | "all" | "archived";

type WorkbenchUiMetadata = {
  selectedProjectId?: string;
  selectedThreadId?: string;
  threadScope: ThreadScope;
  sidebarWidth: number;
};

type WorkbenchDrafts = {
  prompts: Record<string, string>;
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

type ChatMessage = WorkbenchThreadMessage;

function projectInputItems(sourceRefs: { id: string; label: string; ref: string; summary: string }[]): SidebarDisplayItem[] {
  return sourceRefs.map((source) => ({
    id: source.id,
    label: source.label,
    ref: source.ref,
    summary: source.summary
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

function clampSidebarWidth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultSidebarWidth;
  return Math.min(maximumSidebarWidth, Math.max(minimumSidebarWidth, Math.round(value)));
}

function readPersistedWorkbenchUi(): { metadata: WorkbenchUiMetadata; drafts: WorkbenchDrafts } {
  const storage = sessionStorage();
  const fallback = {
    metadata: { threadScope: "all" as const, sidebarWidth: defaultSidebarWidth },
    drafts: { prompts: {} }
  };
  if (!storage) return fallback;
  try {
    const metadata = JSON.parse(migrateStorageValue(storage, uiMetadataStorageKey, legacyUiMetadataStorageKey) ?? "null") as Partial<WorkbenchUiMetadata> | null;
    const drafts = JSON.parse(migrateStorageValue(storage, draftStorageKey, legacyDraftStorageKey) ?? "null") as Partial<WorkbenchDrafts> | null;
    migrateStorageValue(storage, legacyChatSessionsBackupKey, legacyChatSessionsBackupStorageKey);
    const legacy = storage.getItem(legacyChatSessionsStorageKey);
    let selectedThreadId = typeof metadata?.selectedThreadId === "string" ? metadata.selectedThreadId : undefined;
    if (legacy) {
      if (!storage.getItem(legacyChatSessionsBackupKey)) storage.setItem(legacyChatSessionsBackupKey, legacy);
      if (!selectedThreadId) {
        const legacyRows = JSON.parse(legacy) as unknown;
        const first = Array.isArray(legacyRows) && legacyRows[0] && typeof legacyRows[0] === "object"
          ? legacyRows[0] as { threadId?: unknown }
          : null;
        selectedThreadId = typeof first?.threadId === "string" ? first.threadId : undefined;
      }
      storage.removeItem(legacyChatSessionsStorageKey);
    }
    return {
      metadata: {
        selectedProjectId: typeof metadata?.selectedProjectId === "string" ? metadata.selectedProjectId : undefined,
        selectedThreadId,
        threadScope: metadata?.threadScope === "archived" ? "archived" : "all",
        sidebarWidth: clampSidebarWidth(metadata?.sidebarWidth)
      },
      drafts: {
        prompts: drafts?.prompts && typeof drafts.prompts === "object" ? drafts.prompts : {}
      }
    };
  } catch {
    return fallback;
  }
}

function writeUiMetadata(metadata: WorkbenchUiMetadata) {
  sessionStorage()?.setItem(uiMetadataStorageKey, JSON.stringify(metadata));
}

function writeDrafts(drafts: WorkbenchDrafts) {
  sessionStorage()?.setItem(draftStorageKey, JSON.stringify(drafts));
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

type AppProps = {
  renderShell: RenderOplStudioShell;
  renderContributionSlot?: RenderOplContributionSlot;
  onUiContributionsChange?: (projection: OplUiContributionsProjection) => void;
  onUiContributionsDispose?: () => void;
};

export function App({
  renderShell,
  renderContributionSlot,
  onUiContributionsChange,
  onUiContributionsDispose
}: AppProps) {
  const bridge = useMemo(() => createBrowserBridge(), []);
  const persistedUi = useMemo(() => readPersistedWorkbenchUi(), []);
  const conversationRef = useRef<HTMLElement | null>(null);
  const pendingAssistantIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>(createIntroMessages());
  const [model, setModel] = useState(initialWorkbenchModel);
  const [stateStatus, setStateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stateError, setStateError] = useState("");
  const [activeSettingsDestination, setActiveSettingsDestination] = useState<SettingsDestinationId>("overview");
  const [detailsRequestRevision, setDetailsRequestRevision] = useState(0);
  const [lastDryRun, setLastDryRun] = useState("No action preview yet.");
  const [settingsActionBusyKey, setSettingsActionBusyKey] = useState<string | null>(null);
  const [settingsActionFeedback, setSettingsActionFeedback] = useState<SettingsActionFeedback | null>(null);
  const [settingsActionConfirmation, setSettingsActionConfirmation] = useState<SettingsActionConfirmation | null>(null);
  const [uiMetadata, setUiMetadata] = useState<WorkbenchUiMetadata>(persistedUi.metadata);
  const [drafts, setDrafts] = useState<WorkbenchDrafts>(persistedUi.drafts);
  const [prompt, setPrompt] = useState(persistedUi.drafts.prompts[persistedUi.metadata.selectedThreadId ?? "new"] ?? "");
  const [sendState, setSendState] = useState<"idle" | "running" | "error">("idle");
  const [threadProjects, setThreadProjects] = useState<WorkbenchProjectGroup[]>([]);
  const [archivedThreadProjects, setArchivedThreadProjects] = useState<WorkbenchProjectGroup[]>([]);
  const [threadDirectoryStatus, setThreadDirectoryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [threadDirectoryError, setThreadDirectoryError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(createIntroMessages());
  const [eventFeed, setEventFeed] = useState<string[]>(["bridge.preview_only"]);
  const [codexThreadId, setCodexThreadId] = useState<string | undefined>(persistedUi.metadata.selectedThreadId);
  const [threadDetail, setThreadDetail] = useState<WorkbenchThreadItem | null>(null);
  const [threadActionBusy, setThreadActionBusy] = useState(false);
  const [threadActionError, setThreadActionError] = useState("");
  const [lifecycleConfirmation, setLifecycleConfirmation] = useState<{ thread: WorkbenchThreadItem; action: ThreadLifecycleAction } | null>(null);
  const [settings, setSettings] = useState<WorkbenchSettings>(() => readSettings());
  const [codexCatalog, setCodexCatalog] = useState<CodexModelCatalogEntry[]>([]);
  const [capabilityCatalog, setCapabilityCatalog] = useState<CodexCapabilityCatalog>(emptyCapabilityCatalog);
  const [capabilityStatus, setCapabilityStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [capabilityError, setCapabilityError] = useState("");
  const [composerPaletteOpen, setComposerPaletteOpen] = useState(false);
  const [composerSelections, setComposerSelections] = useState<ComposerSelection[]>([]);
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [starterDrafts, setStarterDrafts] = useState<Record<string, Record<string, string>>>({});
  const [activeContextTab, setActiveContextTab] = useState<ContextTabId>("opl-runtime-summary");
  const t = uiCopy[settings.locale];
  const contextTabLabels: Record<ContextTabId, string> = {
    "opl-files-panel": t.sources,
    "opl-artifact-preview-tabs": t.results,
    "opl-provenance-drawer": t.actions,
    "opl-starter-forms": t.workflows,
    "opl-package-lifecycle-panel": t.packages,
    "opl-runtime-summary": t.runtimeMenu,
    "opl-automations-panel": t.scheduled,
    "opl-memory-panel": t.memory,
    "opl-always-on-panel": t.alwaysOn
  };
  const purposeCopy = localizedPurposeLabels[settings.locale];
  const previewAction = firstPreviewAction(model.contextActions);
  const exportAction = model.contextActions.find((action) => action.id === exportActionRefId && action.dryRunSupported) ?? previewAction;
  const purposePreviewAction = model.contextActions.find((action) => action.id === previewActionRefId && action.dryRunSupported) ?? previewAction;
  const runtimeAction = model.contextActions.find((action) => action.id === runtimeActionRefId && action.dryRunSupported);
  const activeThreads = useMemo(() => threadProjects.flatMap((project) => project.threads), [threadProjects]);
  const archivedThreads = useMemo(() => archivedThreadProjects.flatMap((project) => project.threads), [archivedThreadProjects]);
  const allThreads = useMemo(() => [...activeThreads, ...archivedThreads], [activeThreads, archivedThreads]);
  const currentSession = allThreads.find((thread) => thread.id === codexThreadId);
  const selectedProject = threadProjects.find((project) => project.id === uiMetadata.selectedProjectId)
    ?? threadProjects.find((project) => project.threads.some((thread) => thread.id === codexThreadId))
    ?? threadProjects[0];
  const visibleThreadProjects = uiMetadata.threadScope === "archived"
    ? archivedThreadProjects
    : threadProjects;
  const currentProject = selectedProject?.label ?? settings.defaultWorkspace ?? "Current project";
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
  const modelOptions = useMemo(() => resolveCodexModelOptions(codexCatalog), [codexCatalog]);
  const {
    model: resolvedModel,
    reasoningEffort: resolvedReasoning,
    reasoningOptions: resolvedReasoningOptions,
    effectiveSelection
  } = resolveCodexSelection(modelOptions, settings.modelAccess, settings.reasoningLevel);
  const unavailableFixedModel = settings.modelAccess !== "__auto" && !resolvedModel;
  const resolvedConversationModelLabel = conversationModelLabel(
    settings.modelAccess,
    resolvedModel?.id,
    settings.locale
  );
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!codexThreadId || !messages.length) return;
    globalThis.requestAnimationFrame?.(() => {
      const conversation = conversationRef.current;
      if (conversation) conversation.scrollTop = conversation.scrollHeight;
    });
  }, [codexThreadId, messages.length]);

  function updateUiMetadata(next: Partial<WorkbenchUiMetadata>) {
    setUiMetadata((current) => {
      const merged = { ...current, ...next };
      writeUiMetadata(merged);
      return merged;
    });
  }

  function updateDrafts(next: (current: WorkbenchDrafts) => WorkbenchDrafts) {
    setDrafts((current) => {
      const merged = next(current);
      writeDrafts(merged);
      return merged;
    });
  }

  function updatePrompt(value: string) {
    setPrompt(value);
    const key = codexThreadId ?? "new";
    updateDrafts((current) => ({ ...current, prompts: { ...current.prompts, [key]: value } }));
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

  function settingsReceiptFeedback(receipt: OplActionReceipt, label: string): SettingsActionFeedback {
    if (receipt.status === "executed") {
      return {
        tone: "success",
        message: settings.locale === "zh" ? `${label}已完成，状态已刷新。` : `${label} completed and state was refreshed.`
      };
    }
    if (receipt.status === "blocked_read_only") {
      return {
        tone: "attention",
        message: settings.locale === "zh" ? "当前以只读评估模式运行，预检查可用，但执行已被阻止。" : "The app is running in read-only evaluation mode. Preview is available, but execution is blocked."
      };
    }
    return {
      tone: "attention",
      message: receipt.blockedReason || receipt.stderr || (settings.locale === "zh" ? `${label}未完成。` : `${label} did not complete.`)
    };
  }

  async function runSettingsAction(request: SettingsActionRequest) {
    setSettingsActionBusyKey(request.key);
    setSettingsActionFeedback(null);
    try {
      if (request.confirmationRequired) {
        const preview = await bridge.executeAction({ actionId: request.actionId, payload: request.payload, dryRun: true });
        if (preview.status === "error" || preview.status === "timed_out") {
          setSettingsActionFeedback(settingsReceiptFeedback(preview, request.label));
          return;
        }
        setSettingsActionConfirmation({ request, previewStatus: preview.status });
        return;
      }
      const receipt = await bridge.executeAction({
        actionId: request.actionId,
        payload: { ...request.payload, confirmed: true },
        dryRun: false
      });
      if (receipt.status === "executed") await loadState(settings.runtimeProfile);
      setSettingsActionFeedback(settingsReceiptFeedback(receipt, request.label));
    } catch (error) {
      setSettingsActionFeedback({ tone: "attention", message: String(error) });
    } finally {
      setSettingsActionBusyKey(null);
    }
  }

  async function confirmSettingsAction() {
    const confirmation = settingsActionConfirmation;
    if (!confirmation) return;
    setSettingsActionBusyKey(confirmation.request.key);
    setSettingsActionFeedback(null);
    try {
      const receipt = await bridge.executeAction({
        actionId: confirmation.request.actionId,
        payload: { ...confirmation.request.payload, confirmed: true },
        dryRun: false
      });
      if (receipt.status === "executed") await loadState(settings.runtimeProfile);
      setSettingsActionFeedback(settingsReceiptFeedback(receipt, confirmation.request.label));
      setSettingsActionConfirmation(null);
    } catch (error) {
      setSettingsActionFeedback({ tone: "attention", message: String(error) });
    } finally {
      setSettingsActionBusyKey(null);
    }
  }

  async function openThread(thread: WorkbenchThreadItem) {
    setThreadActionBusy(true);
    setThreadActionError("");
    setCodexThreadId(thread.id);
    updateUiMetadata({
      selectedThreadId: thread.id,
      selectedProjectId: threadProjects.find((project) => project.threads.some((item) => item.id === thread.id))?.id
        ?? uiMetadata.selectedProjectId
    });
    setPrompt(drafts.prompts[thread.id] ?? "");
    setSendState("idle");
    setComposerSelections([]);
    setComposerPaletteOpen(false);
    try {
      const readback = await bridge.readThread({ threadId: thread.id, includeTurns: true });
      const nextMessages = deriveThreadMessages(readback);
      setMessages(nextMessages);
      messagesRef.current = nextMessages;
      setThreadDetail(null);
    } catch (error) {
      setThreadActionError(String(error));
    } finally {
      setThreadActionBusy(false);
    }
  }

  async function resumeThreadAndOpen(thread: WorkbenchThreadItem) {
    setThreadActionBusy(true);
    setThreadActionError("");
    try {
      await bridge.resumeThread({ threadId: thread.id });
      await openThread(thread);
      await loadThreadDirectory(false);
    } catch (error) {
      setThreadActionError(String(error));
    } finally {
      setThreadActionBusy(false);
    }
  }

  async function loadThreadDirectory(openSavedThread = false, scope = uiMetadata.threadScope) {
    if (typeof bridge.listThreads !== "function") {
      setThreadDirectoryStatus("error");
      setThreadDirectoryError("Codex thread adapter is unavailable.");
      return;
    }
    setThreadDirectoryStatus("loading");
    setThreadDirectoryError("");
    try {
      const active = scope === "archived"
        ? null
        : await bridge.listThreads({ archived: false, limit: 100 });
      const archived = scope === "archived"
        ? await bridge.listThreads({ archived: true, limit: 100 })
        : null;
      const activeProjects = active ? deriveThreadDirectory(active) : threadProjects;
      const archivedProjects = archived ? deriveThreadDirectory(archived) : archivedThreadProjects;
      if (active) setThreadProjects(activeProjects);
      if (archived) setArchivedThreadProjects(archivedProjects);
      const selectedThreadId = uiMetadata.selectedThreadId;
      const directoryProjects = scope === "archived" ? archivedProjects : activeProjects;
      const selectedThreadProject = directoryProjects.find((project) => project.threads.some((thread) => thread.id === selectedThreadId));
      const currentWorkspaceProject = directoryProjects.find((project) => project.threads.some((thread) => thread.currentWorkspace));
      const persistedProject = directoryProjects.find((project) => project.id === uiMetadata.selectedProjectId);
      const selectedProject = scope === "current"
        ? currentWorkspaceProject ?? selectedThreadProject ?? persistedProject ?? directoryProjects[0]
        : persistedProject ?? selectedThreadProject ?? currentWorkspaceProject
          ?? directoryProjects.find((project) => !project.projectless)
          ?? directoryProjects[0];
      if (selectedProject && selectedProject.id !== uiMetadata.selectedProjectId) updateUiMetadata({ selectedProjectId: selectedProject.id });
      setThreadDirectoryStatus("ready");
      if (openSavedThread && scope !== "archived" && selectedThreadId) {
        const savedThread = activeProjects.flatMap((project) => project.threads).find((thread) => thread.id === selectedThreadId);
        if (savedThread) await openThread(savedThread);
      }
    } catch (error) {
      setThreadDirectoryStatus("error");
      setThreadDirectoryError(String(error));
    }
  }

  useEffect(() => {
    void loadState(settings.runtimeProfile);
  }, [bridge, settings.runtimeProfile]);

  useEffect(() => {
    onUiContributionsChange?.(model.uiContributions);
  }, [model.uiContributions, onUiContributionsChange]);

  useEffect(() => () => onUiContributionsDispose?.(), [onUiContributionsDispose]);

  useEffect(() => {
    void loadThreadDirectory(true);
  }, [bridge]);

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

  function requestDetails(tab: ContextTabId) {
    setActiveContextTab(tab);
    setDetailsRequestRevision((revision) => revision + 1);
  }

  function runDryRun(actionId: string, payload: Record<string, unknown> = {}) {
    requestDetails("opl-provenance-drawer");
    void bridge
      .executeAction({ actionId, payload, dryRun: true })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ actionId, dryRun: true, error: String(error) })));
  }

  const contributionActionAvailable = model.contextActions.some(
    (action) => action.id === "package_contribution_execute"
  );
  const handleContributionAction: OplContributionAction = (entry, command) => {
    if (!contributionActionAvailable) return;
    runDryRun("package_contribution_execute", {
      package_id: entry.packageId,
      ref: command.actionRef,
      input: {},
      confirmed: false
    });
  };
  const contributionOwner = {
    locale: settings.locale,
    actionAvailable: contributionActionAvailable,
    onAction: handleContributionAction
  };
  const hasContribution = (slot: "composer.palette" | "runtime.detail" | "settings.section") => (
    model.uiContributions.entries.some((entry) => entry.slot === slot)
  );

  async function forkThread(thread: WorkbenchThreadItem) {
    setThreadActionBusy(true);
    setThreadActionError("");
    try {
      const forked: CodexThread = await bridge.forkThread({
        threadId: thread.id,
        throughTurnId: thread.activeTurnId
      });
      await loadThreadDirectory(false);
      const forkedView = deriveThreadDirectory({ data: [forked] })[0]?.threads[0];
      if (forkedView) await openThread(forkedView);
    } catch (error) {
      setThreadActionError(String(error));
    } finally {
      setThreadActionBusy(false);
    }
  }

  async function confirmThreadLifecycle() {
    if (!lifecycleConfirmation) return;
    setThreadActionBusy(true);
    setThreadActionError("");
    try {
      if (lifecycleConfirmation.action === "fork") {
        await bridge.forkThread({
          threadId: lifecycleConfirmation.thread.id,
          throughTurnId: lifecycleConfirmation.thread.activeTurnId
        });
      } else {
        await bridge.setArchived({
          threadId: lifecycleConfirmation.thread.id,
          archived: lifecycleConfirmation.action === "archive",
          confirmed: true,
          confirmationId: `opl-studio:${Date.now()}`
        });
      }
      setLifecycleConfirmation(null);
      setThreadDetail(null);
      if (lifecycleConfirmation.thread.id === codexThreadId && lifecycleConfirmation.action === "archive") startNewChat();
      await loadThreadDirectory(false);
    } catch (error) {
      setThreadActionError(String(error));
    } finally {
      setThreadActionBusy(false);
    }
  }

  function sendCodexMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    const pendingSelections = composerSelections;
    if ((!text && !pendingSelections.length) || sendState === "running" || !resolvedModel) return;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text || pendingSelections.map((selection) => selection.label).join("\n")
    };
    const pendingId = `assistant-${Date.now()}`;
    const pendingMessage: ChatMessage = { id: pendingId, role: "assistant", text: "" };
    const pendingMessages = messagesRef.current.concat([userMessage, pendingMessage]);
    pendingAssistantIdRef.current = pendingId;
    messagesRef.current = pendingMessages;
    setMessages(pendingMessages);
    updatePrompt("");
    setComposerSelections([]);
    setComposerPaletteOpen(false);
    setSendState("running");
    void bridge
      .sendMessage({
        prompt: text,
        inputs: pendingSelections.map((selection) => selection.input),
        threadId: codexThreadId,
        model: resolvedModel.id,
        reasoningEffort: resolvedReasoning,
        permissions: settings.agentPermissions
      })
      .then((reply) => {
        const nextThreadId = typeof reply === "object" && reply && "threadId" in reply
          ? String((reply as { threadId?: unknown }).threadId ?? "")
          : "";
        const finalMessage = typeof reply === "object" && reply && "finalMessage" in reply
          ? String((reply as { finalMessage?: unknown }).finalMessage ?? "")
          : "";
        const nextMessages = messagesRef.current.map((item) => item.id === pendingId
          ? { id: pendingId, role: "assistant" as const, text: finalMessage || formatReceipt(reply) }
          : item);
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
        const resolvedThreadId = nextThreadId || codexThreadId;
        setCodexThreadId(resolvedThreadId);
        updateUiMetadata({ selectedThreadId: resolvedThreadId });
        if (resolvedThreadId) {
          updateDrafts((current) => ({ ...current, prompts: { ...current.prompts, [resolvedThreadId]: "" } }));
        }
        pendingAssistantIdRef.current = null;
        setSendState("idle");
        void loadThreadDirectory(false);
      })
      .catch(() => {
        const message = t.sendFailed;
        updatePrompt(text);
        setComposerSelections(pendingSelections);
        setSendState("error");
        const errorMessage: ChatMessage = { id: pendingId, role: "system", text: message };
        const nextMessages = messagesRef.current.map((item) => item.id === pendingId ? errorMessage : item);
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
        pendingAssistantIdRef.current = null;
      });
  }

  function startNewChat() {
    const currentWorkspaceProject = threadProjects.find((project) => project.threads.some((thread) => thread.currentWorkspace));
    const nextMessages = createIntroMessages();
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setCodexThreadId(undefined);
    updateUiMetadata({
      selectedThreadId: undefined,
      selectedProjectId: currentWorkspaceProject?.id ?? uiMetadata.selectedProjectId
    });
    setPrompt(drafts.prompts.new ?? "");
    setLastDryRun("No action preview yet.");
    setThreadActionError("");
    setSendState("idle");
    setComposerSelections([]);
    setComposerPaletteOpen(false);
  }

  async function loadCapabilities() {
    if (capabilityStatus === "loading") return;
    setCapabilityStatus("loading");
    setCapabilityError("");
    try {
      const catalog = await bridge.readCodexCapabilities(codexThreadId);
      setCapabilityCatalog(catalog);
      if (catalog.errors.length && !catalog.skills.length && !catalog.plugins.length && !catalog.apps.length) {
        setCapabilityStatus("error");
        setCapabilityError(catalog.errors.join("\n"));
      } else {
        setCapabilityStatus("ready");
      }
    } catch (error) {
      setCapabilityStatus("error");
      setCapabilityError(String(error));
    }
  }

  function openComposerPalette() {
    setComposerPaletteOpen(true);
    if (capabilityStatus === "idle" || capabilityStatus === "error") void loadCapabilities();
  }

  function addPickedInputs(items: CodexPickedInput[]) {
    const selections = items.map((item): ComposerSelection => ({
      id: `${item.kind}:${item.path}`,
      kind: item.kind,
      label: item.name,
      detail: item.path,
      input: item.kind === "image"
        ? { type: "localImage", path: item.path, detail: "auto" }
        : { type: "mention", name: item.name, path: item.path }
    }));
    setComposerSelections((current) => [
      ...current,
      ...selections.filter((selection) => !current.some((item) => item.id === selection.id))
    ]);
  }

  async function pickComposerFiles() {
    setComposerPaletteOpen(false);
    try {
      addPickedInputs(await bridge.pickFiles());
    } catch (error) {
      setCapabilityError(String(error));
      setCapabilityStatus("error");
    }
  }

  async function pickComposerDirectory() {
    setComposerPaletteOpen(false);
    try {
      addPickedInputs(await bridge.pickDirectory());
    } catch (error) {
      setCapabilityError(String(error));
      setCapabilityStatus("error");
    }
  }

  function toggleComposerSkill(skill: CodexSkillCapability) {
    const id = `skill:${skill.path}`;
    setComposerSelections((current) => current.some((item) => item.id === id)
      ? current.filter((item) => item.id !== id)
      : current.concat({
        id,
        kind: "skill",
        label: skill.name,
        detail: skill.description,
        input: { type: "skill", name: skill.name, path: skill.path }
      }));
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

  function updateReasoning(reasoningLevel: WorkbenchSettings["reasoningLevel"]) {
    if (!resolvedModel) return;
    const modelAccess = effectiveSelection === "__auto" && reasoningLevel !== codexModelPolicy.defaultReasoningEffort
      ? resolvedModel.id
      : effectiveSelection;
    setSettings(writeSettings({ modelAccess, reasoningLevel }));
  }

  const studioWorkspaceRail = (
    <div data-testid="opl-workspace-rail" className="opl-dsh-workspace-rail" aria-label="Workspaces">
      <div className="opl-dsh-rail-actions">
        <button type="button" onClick={() => setThreadSearchOpen(true)}><Search aria-hidden="true" size={15} />{settings.locale === "zh" ? "搜索" : "Search"}</button>
        <button type="button" onClick={() => requestDetails("opl-runtime-summary")}><RefreshCw aria-hidden="true" size={15} />{t.runtimeMenu}</button>
        <button type="button" onClick={() => requestDetails("opl-package-lifecycle-panel")}><Plug aria-hidden="true" size={15} />{t.agents}</button>
      </div>
      <section className="opl-dsh-projects" aria-label="Codex projects and conversations">
        <header><strong>{uiMetadata.threadScope === "archived" ? (settings.locale === "zh" ? "归档对话" : "Archived") : t.projects}</strong><button type="button" aria-label={settings.locale === "zh" ? "搜索对话" : "Search conversations"} onClick={() => setThreadSearchOpen(true)}><Search aria-hidden="true" size={14} /></button></header>
        <div data-testid="opl-project-chats">
          <div data-testid="opl-session-list">
            <ThreadRail
              projects={visibleThreadProjects}
              selectedProjectId={uiMetadata.selectedProjectId}
              selectedThreadId={codexThreadId}
              locale={settings.locale}
              scope={uiMetadata.threadScope}
              loading={threadDirectoryStatus === "loading"}
              error={threadDirectoryStatus === "error" ? threadDirectoryError : undefined}
              onScopeChange={(threadScope) => {
                updateUiMetadata({ threadScope, selectedProjectId: threadScope === "archived" ? archivedThreadProjects[0]?.id : threadProjects[0]?.id });
                if (threadScope === "archived" && !archivedThreadProjects.length) void loadThreadDirectory(false, "archived");
              }}
              onSelectProject={(selectedProjectId) => updateUiMetadata({ selectedProjectId })}
              onSelectThread={(thread) => void openThread(thread)}
              onOpenDetail={setThreadDetail}
            />
          </div>
        </div>
      </section>
      {selectedProject ? (
        <div className="opl-dsh-project-context">
          <strong><Folder aria-hidden="true" size={14} />{currentProject}</strong>
          <button data-testid="opl-project-inputs" type="button" onClick={() => requestDetails("opl-files-panel")}><FileText aria-hidden="true" size={14} />{t.projectContext}<span>{sidebarSources.length}</span></button>
          <button data-testid="opl-project-attachments" type="button" onClick={() => requestDetails("opl-artifact-preview-tabs")}><Download aria-hidden="true" size={14} />{t.filesOutputs}<span>{projectAttachments.length}</span></button>
        </div>
      ) : null}
    </div>
  );

  const studioConversationBody = (
    <div className="opl-dsh-thread" ref={conversationRef as never}>
      {threadActionError ? <p className="thread-read-error" role="alert">{threadActionError}</p> : null}
      {messages.map((message, index) => (
        <article key={message.id} data-testid={message.role === "assistant" ? "opl-conversation-event" : undefined} className={`message ${message.role}${message.subagent ? " subagent" : ""}`}>
          {message.role === "system" ? <span className="message-label">{message.subagent ? (settings.locale === "zh" ? "子智能体" : "Subagent") : t.runtime}</span> : null}
          <div className="message-frame">
            {message.role === "assistant" ? (
              <Streamdown controls={assistantMarkdownControls} lineNumbers={false} linkSafety={assistantMarkdownLinkSafety} mode="static">{assistantDisplayMarkdown(message.text || (sendState === "running" ? t.codexWorking : t.waitingReply))}</Streamdown>
            ) : <MessageText text={message.text || (sendState === "running" ? t.codexWorking : t.waitingReply)} />}
          </div>
          {message.role === "assistant" && index === messages.length - 1 && sendState === "running" ? <div className="run-events">{eventFeed.slice(0, 4).reverse().map((item, eventIndex) => <span key={`${item}-${eventIndex}`}>{item}</span>)}</div> : null}
          {message.role === "assistant" ? <span data-testid="opl-codex-reply" hidden /> : null}
        </article>
      ))}
    </div>
  );

  const studioHeroActions = (
    <div data-testid="opl-workbench-delivery-mode" className="opl-dsh-hero-actions" aria-label="Suggested outputs">
      {model.purposes.map((purpose) => <Pill key={purpose} data-testid="opl-delivery-mode-option" disabled={!purposePreviewAction} onClick={() => { if (purposePreviewAction) runDryRun(purposePreviewAction.id, { purpose }); }}>{purposeCopy[purpose]}</Pill>)}
      <span data-testid="opl-delivery-mode" hidden>research</span>
    </div>
  );

  const studioComposerAccessory = (
    <>
      {composerSelections.length ? (
        <div className="composer-selections" aria-label={settings.locale === "zh" ? "已添加的内容" : "Added content"}>
          {composerSelections.map((selection) => <span key={selection.id} className="composer-selection" title={selection.detail}><FileText aria-hidden="true" size={13} /><span>{selection.label}</span><button type="button" aria-label={`${settings.locale === "zh" ? "移除" : "Remove"} ${selection.label}`} onClick={() => setComposerSelections((current) => current.filter((item) => item.id !== selection.id))}><X aria-hidden="true" size={12} /></button></span>)}
        </div>
      ) : null}
      <span
        className={`composer-status ${sendState === "error" || unavailableFixedModel ? "error" : sendState}`}
        data-testid="opl-composer-run-state"
        aria-live="polite"
      >
        {sendState === "running" ? t.working : sendState === "error" ? t.sendFailed : unavailableFixedModel ? t.modelSelectionUnavailable : ""}
      </span>
    </>
  );

  const studioComposerOverlay = (
    <ComposerCapabilityPalette
      open={composerPaletteOpen}
      locale={settings.locale}
      catalog={capabilityCatalog}
      status={capabilityStatus}
      error={capabilityError}
      selections={composerSelections}
      onClose={() => setComposerPaletteOpen(false)}
      onPickFiles={() => void pickComposerFiles()}
      onPickDirectory={() => void pickComposerDirectory()}
      onToggleSkill={toggleComposerSkill}
      contributions={hasContribution("composer.palette") ? renderContributionSlot?.("composer.palette", contributionOwner) : null}
    />
  );

  const studioModelControls = (
    <span className="composer-model-controls" data-testid="opl-topbar-model-config">
      <select data-testid="opl-model-access-entry" aria-label={settings.locale === "zh" ? "模型" : "Model"} value={effectiveSelection} onChange={(event) => updateSetting("modelAccess", event.currentTarget.value)}>
        <option value="__auto">{resolvedConversationModelLabel}</option>
        {modelOptions.map((option) => <option key={option.id} value={option.id} disabled={!option.available}>{modelLabel(option.id, settings.locale)}</option>)}
      </select>
      <select aria-label={settings.locale === "zh" ? "推理强度" : "Reasoning effort"} value={resolvedReasoning} disabled={!resolvedModel} onChange={(event) => updateReasoning(event.currentTarget.value as WorkbenchSettings["reasoningLevel"])}>
        {codexModelPolicy.reasoningOptions.map((effort) => <option key={effort} value={effort} disabled={!resolvedReasoningOptions.includes(effort)}>{reasoningLabel(effort, settings.locale)}</option>)}
      </select>
    </span>
  );

  const studioDetails = (
    <aside className="opl-dsh-context-panel" aria-label="On-demand context panel">
      <nav data-testid="opl-context-tabs" className="environment-menu">
        {contextTabs.map((id) => <button key={id} type="button" data-active={activeContextTab === id} onClick={() => setActiveContextTab(id)}>{contextTabLabels[id]}</button>)}
      </nav>
      <div className="context-scroll">
        <section data-testid="opl-files-panel" className="context-block" hidden={activeContextTab !== "opl-files-panel"}><h3>{t.projectContext}</h3>{sidebarSources.length ? sidebarSources.map((source) => <div key={source.id}>{source.label}</div>) : <p className="context-empty">{settings.locale === "zh" ? "暂无项目上下文" : "No project context"}</p>}</section>
        <section data-testid="opl-artifact-preview-tabs" className="context-block artifact-preview-tabs" hidden={activeContextTab !== "opl-artifact-preview-tabs"}>
          <div role="tablist" aria-label="Artifact previews">
            {previewItems.slice(0, 3).map((preview) => (
              <button
                key={preview.id}
                role="tab"
                aria-selected={preview.id === selectedPreview?.id}
                data-testid="opl-artifact-preview-tab"
                type="button"
                onClick={() => setSelectedPreviewId(preview.id)}
              >
                {preview.title}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            data-testid="opl-artifact-preview-panel"
            className="artifact-preview"
            data-preview-kind={selectedPreview?.rendererModuleId}
          >
            {selectedPreview ? (
              <>
                <span data-testid="opl-selected-artifact-preview" hidden />
                <ArtifactPreviewCard preview={selectedPreview} />
              </>
            ) : <p className="context-empty">{settings.locale === "zh" ? "暂无产物" : "No artifacts"}</p>}
          </div>
          <button data-testid="opl-export-action" type="button" disabled={!exportAction} onClick={() => { if (exportAction) runDryRun(exportAction.id, { source: "artifact-panel" }); }}><Download aria-hidden="true" size={14} /><span data-testid="opl-export-action-dry-run">{t.previewExport}</span></button>
        </section>
        <section data-testid="opl-provenance-drawer" className="context-block provenance-drawer" hidden={activeContextTab !== "opl-provenance-drawer"}>
          <header><h3>{t.traceAndActions}</h3></header>
          <p data-testid="opl-provenance-ref" className="delivery-note">{t.traceBoundary}</p>
          <dl className="trace-list">
            {model.contextTrace.map((trace) => <div key={trace.id}><dt>{trace.label}</dt><dd>{trace.value}</dd></div>)}
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
          </div>
          <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>
          <section data-testid="opl-action-receipt-summary-list" className="action-receipt-summary-list">
            <h3>{t.actionReceipts}</h3>
            {model.actionReceipts.map((receipt) => <ActionReceiptSummary key={receipt.id} receipt={receipt} />)}
          </section>
          {model.confirmations[0] && model.questions[0] ? (
            <ConfirmationCard card={model.confirmations[0]} question={model.questions[0]} onDryRun={runDryRun} />
          ) : null}
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
          <p className="context-empty">{t.packageBoundary}</p>
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
                <div className="package-ref-list" aria-label={`${item.label} source refs`}>
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
                <div className="package-action-list">
                  {item.actions.map((action) => (
                    <div key={`${item.id}-${action.kind}-${action.actionId ?? action.label}`}>
                      <button
                        data-testid="opl-package-lifecycle-action"
                        type="button"
                        disabled={action.status !== "available" || !action.actionId}
                        onClick={() => runDryRun(action.actionId, action.payload)}
                      >
                        {action.label}: {action.status}
                      </button>
                      <small>{action.reason}</small>
                      <code className="context-code">{action.actionId}</code>
                    </div>
                  ))}
                </div>
                <p className="delivery-note">{item.authorityBoundary}</p>
              </article>
            ))}
          </div>
        </section>
        <section data-testid="opl-secondary-runtime-context" className="context-block" hidden={activeContextTab !== "opl-runtime-summary"}><h3 data-testid="opl-runtime-summary">{t.runtimeMenu}</h3><button data-testid="opl-runtime-full-detail-button" type="button" onClick={() => void bridge.readFullDrilldown()}>{t.fullDrilldown}</button><button data-testid="opl-runtime-action-dry-run" type="button" disabled={!runtimeAction} onClick={() => { if (runtimeAction) runDryRun(runtimeAction.id, { source: "runtime-panel" }); }}>{t.previewAction}</button><div data-testid="opl-runtime-action-receipt">{lastDryRun}</div><RendererModuleRegistryPanel /><div data-testid="opl-skills-panel">{t.skills}</div><div data-testid="opl-routing-panel">{t.routing}</div></section>
        <section data-testid="opl-automations-panel" className="context-block" hidden={activeContextTab !== "opl-automations-panel"}><h3>{t.scheduled}</h3><p className="context-empty">{settings.locale === "zh" ? "暂无计划任务" : "No scheduled tasks"}</p></section>
        <section data-testid="opl-memory-panel" className="context-block" hidden={activeContextTab !== "opl-memory-panel"}><h3>{t.memory}</h3><p>{t.memoryBoundary}</p></section>
        <section data-testid="opl-always-on-panel" className="context-block" hidden={activeContextTab !== "opl-always-on-panel"}><h3>{t.alwaysOn}</h3><p>{t.alwaysOnBoundary}</p></section>
        <div className="visually-hidden" data-testid="opl-web-transport">window.oplStudio / SSE /api/opl-events</div>
      </div>
    </aside>
  );

  const studioSettings = (
    <SettingsPanel
      model={model}
      settings={settings}
      modelOptions={modelOptions}
      resolvedModel={resolvedModel}
      resolvedReasoning={resolvedReasoning}
      resolvedReasoningOptions={resolvedReasoningOptions}
      stateStatus={stateStatus}
      stateError={stateError}
      activeDestination={activeSettingsDestination}
      onDestinationChange={setActiveSettingsDestination}
      onRefresh={() => void loadState(settings.runtimeProfile)}
      onSettingChange={updateSetting}
      onReasoningChange={updateReasoning}
      onAction={(request) => void runSettingsAction(request)}
      actionBusyKey={settingsActionBusyKey}
      actionFeedback={settingsActionFeedback}
      pendingConfirmation={settingsActionConfirmation}
      onConfirmAction={() => void confirmSettingsAction()}
      onCancelAction={() => setSettingsActionConfirmation(null)}
    />
  );

  return renderShell({
    locale: settings.locale,
    projectTitle: currentProject,
    sessionTitle: localizedSessionTitle(currentSession?.title || t.newTaskTitle, settings.locale),
    workspacePath: selectedProject?.workspace ?? currentProject,
    prompt,
    promptRevision: prompt.length,
    conversationBlank: messages.length === 0,
    sending: sendState === "running",
    contributionOwner,
    uiContributions: model.uiContributions,
    workspaceRail: studioWorkspaceRail,
    conversationHeader: <><Folder aria-hidden="true" size={15} /><h1>{localizedSessionTitle(currentSession?.title || t.newTaskTitle, settings.locale)}</h1><button type="button" aria-label={t.conversationMenu} disabled={!currentSession} onClick={() => setThreadDetail(currentSession ?? null)}><CircleEllipsis aria-hidden="true" size={16} /></button></>,
    conversationBody: studioConversationBody,
    heroActions: studioHeroActions,
    composerAccessory: studioComposerAccessory,
    composerOverlay: studioComposerOverlay,
    composerModelControls: studioModelControls,
    details: studioDetails,
    settings: studioSettings,
    overlay: <><style>{codexWorkbenchStyles}</style><ThreadSearchDialog open={threadSearchOpen} locale={settings.locale} projects={uiMetadata.threadScope === "archived" ? archivedThreadProjects : threadProjects} onOpenChange={setThreadSearchOpen} onSelect={(thread) => void openThread(thread)} /><ThreadDetailPopover thread={threadDetail} locale={settings.locale} busy={threadActionBusy} onClose={() => setThreadDetail(null)} onResume={(thread) => void resumeThreadAndOpen(thread)} onFork={(thread) => void forkThread(thread)} onRequestArchive={(thread, archived) => { setLifecycleConfirmation({ thread, action: archived ? "archive" : "unarchive" }); setThreadActionError(""); setThreadDetail(null); }} /><ThreadLifecycleConfirmationDialog thread={lifecycleConfirmation?.thread ?? null} action={lifecycleConfirmation?.action ?? "archive"} locale={settings.locale} busy={threadActionBusy} error={threadActionError} onClose={() => setLifecycleConfirmation(null)} onConfirm={() => void confirmThreadLifecycle()} /></>,
    detailsRequestRevision,
    startSession: startNewChat,
    updatePrompt,
    submitPrompt: sendCodexMessage,
    openComposerPalette
  });

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
