import * as Tabs from "@radix-ui/react-tabs";
import { ChevronRight, Download, FileText, GitBranch, PanelRightOpen, Plus, RefreshCw, Search, Send, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createBrowserBridge } from "../bridge/oplBridge";
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
  type WorkbenchPurpose,
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

const contextTabs = [
  ["opl-files-panel", "Sources"],
  ["opl-artifact-preview-tabs", "Preview"],
  ["opl-provenance-drawer", "Trace"],
  ["opl-starter-forms", "Workflows"],
  ["opl-runtime-summary", "Runtime"],
  ["opl-settings-panel", "Settings"]
] as const;

const purposeLabels: Record<WorkbenchPurpose, string> = {
  research: "Review results",
  grant: "Draft grant",
  presentation: "Build deck",
  review: "Prepare handoff"
};

const defaultPreviewActionId = "task_action_receipt_preview";
const defaultExportActionId = "task_export_bundle_preview";
const defaultRuntimeActionId = "provider_scheduler_status";
const chatSessionsStorageKey = "opl.nativeWorkbench.chatSessions.v1";

const settingLabels: Record<SettingKey, string> = {
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
};

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

const workbenchStyles = `
  :root {
    color-scheme: light;
  }

  .opl-native-workbench {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 272px minmax(0, 1fr) 0;
    background:
      radial-gradient(circle at top left, rgba(215, 231, 225, 0.7), transparent 28%),
      linear-gradient(180deg, #f8f5ef 0%, #f4efe7 100%);
    color: #1e2320;
    font-family: "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
  }

  .opl-native-workbench.inspector-open {
    grid-template-columns: 272px minmax(0, 1fr) 368px;
  }

  .opl-native-workbench button,
  .opl-native-workbench input,
  .opl-native-workbench textarea,
  .opl-native-workbench select {
    font: inherit;
  }

  .opl-native-workbench button {
    cursor: pointer;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 16px 16px;
    border-right: 1px solid rgba(48, 56, 51, 0.08);
    background: rgba(250, 248, 243, 0.9);
    backdrop-filter: blur(18px);
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
  }

  .brand-row svg {
    color: #2b6a5d;
  }

  .brand-row strong,
  .sidebar-section-head strong,
  .topbar h1,
  .message-label,
  .inspector-header h2,
  .settings-page h2 {
    letter-spacing: 0;
  }

  .brand-row small,
  .sidebar-section-head span,
  .topbar-copy p,
  .topbar-meta span,
  .thread-note,
  .workflow-strip-head span,
  .context-status,
  .context-empty,
  .settings-hint,
  .runtime-note,
  .delivery-note,
  .composer-meta,
  .history-list li span,
  .history-list li small,
  .message-meta {
    color: #66716b;
  }

  .quick-actions {
    display: flex;
    gap: 8px;
  }

  .quick-actions button,
  .sidebar-footer button,
  .topbar-actions button,
  .workflow-chip,
  .context-tabs button,
  .context-quiet-action,
  .composer-action,
  .composer-submit,
  .setting-toggle,
  .history-list li button {
    border: 1px solid rgba(48, 56, 51, 0.1);
    background: rgba(255, 255, 255, 0.84);
    color: #1f2723;
    transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
  }

  .quick-actions button:hover,
  .sidebar-footer button:hover,
  .topbar-actions button:hover,
  .workflow-chip:hover,
  .context-tabs button:hover,
  .context-quiet-action:hover,
  .composer-action:hover,
  .composer-submit:hover,
  .setting-toggle:hover,
  .history-list li button:hover {
    background: #fff;
    border-color: rgba(43, 106, 93, 0.18);
  }

  .quick-actions button:first-child {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    border-radius: 14px;
    background: #1f2723;
    border-color: #1f2723;
    color: #f8f5ef;
  }

  .quick-actions button:last-child {
    width: 40px;
    height: 40px;
    border-radius: 14px;
  }

  .history-list {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sidebar-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
  }

  .history-list ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: auto;
  }

  .history-list li button {
    width: 100%;
    padding: 10px 12px;
    border-radius: 14px;
    text-align: left;
    display: grid;
    gap: 4px;
  }

  .history-list li.active button {
    background: rgba(43, 106, 93, 0.08);
    border-color: rgba(43, 106, 93, 0.22);
    box-shadow: inset 0 0 0 1px rgba(43, 106, 93, 0.05);
  }

  .sidebar-footer {
    margin-top: auto;
    display: grid;
    gap: 8px;
  }

  .sidebar-footer button {
    height: 38px;
    padding: 0 12px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-start;
  }

  .sidebar-footer [aria-current="page"] {
    background: rgba(43, 106, 93, 0.08);
    border-color: rgba(43, 106, 93, 0.22);
  }

  .chat-shell {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 20px 24px 24px;
  }

  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 0 18px;
  }

  .topbar-copy h1 {
    margin: 2px 0 0;
    font-size: 26px;
    font-weight: 640;
    color: #17201d;
  }

  .topbar-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .topbar-status,
  .session-chip,
  .delivery-mode-tag,
  .composer-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(48, 56, 51, 0.08);
    font-size: 12px;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .topbar-actions button {
    height: 38px;
    padding: 0 12px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .topbar-actions .primary-action,
  .composer-submit {
    background: #1f2723;
    border-color: #1f2723;
    color: #f8f5ef;
  }

  .conversation,
  .settings-page {
    min-height: 0;
    flex: 1;
  }

  .conversation-inner,
  .settings-content {
    width: min(100%, 860px);
    margin: 0 auto;
  }

  .workflow-strip {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
    border: 1px solid rgba(48, 56, 51, 0.08);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.62);
  }

  .workflow-strip-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .workflow-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .workflow-chip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 13px;
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
  }

  .thread-intro {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0 4px 4px;
  }

  .thread-note {
    font-size: 12px;
  }

  .message {
    max-width: 720px;
    display: grid;
    gap: 8px;
  }

  .message.assistant,
  .message.system {
    justify-items: start;
  }

  .message.user {
    justify-items: end;
    margin-left: auto;
  }

  .message-frame {
    width: fit-content;
    max-width: 100%;
    padding: 14px 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.76);
    border: 1px solid rgba(48, 56, 51, 0.08);
    box-shadow: 0 10px 30px rgba(48, 56, 51, 0.04);
  }

  .message.user .message-frame {
    background: #1f2723;
    color: #f7f2ea;
    border-color: #1f2723;
  }

  .message.system .message-frame {
    background: rgba(221, 231, 228, 0.62);
    border-color: rgba(43, 106, 93, 0.12);
  }

  .message-label {
    font-size: 12px;
    font-weight: 600;
    color: #4d5a54;
  }

  .message-frame p {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.55;
  }

  .message-meta {
    font-size: 12px;
  }

  .composer {
    position: sticky;
    bottom: 0;
    padding-top: 8px;
    background: linear-gradient(180deg, rgba(244, 239, 231, 0) 0%, rgba(244, 239, 231, 0.96) 26%, rgba(244, 239, 231, 0.98) 100%);
  }

  .composer-frame {
    border: 1px solid rgba(48, 56, 51, 0.1);
    border-radius: 22px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 18px 42px rgba(42, 49, 45, 0.08);
  }

  .composer textarea {
    width: 100%;
    min-height: 92px;
    resize: vertical;
    border: 0;
    background: transparent;
    outline: none;
    color: #1b221f;
  }

  .composer footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 12px;
  }

  .composer-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .composer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .composer-action {
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }

  .composer-submit {
    min-width: 108px;
    height: 38px;
    padding: 0 14px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .settings-page section,
  .context-block {
    border: 1px solid rgba(48, 56, 51, 0.08);
    border-radius: 18px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.68);
  }

  .settings-content {
    display: grid;
    gap: 12px;
  }

  .settings-page dl {
    margin: 0;
    display: grid;
    gap: 12px;
  }

  .settings-page dl > div {
    display: grid;
    gap: 4px;
  }

  .settings-page dd,
  .settings-page dt {
    margin: 0;
  }

  .settings-page dd {
    display: grid;
    gap: 6px;
  }

  .setting-toggle {
    width: fit-content;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
  }

  .context-inspector {
    display: none;
    border-left: 1px solid rgba(48, 56, 51, 0.08);
    background: rgba(250, 248, 243, 0.94);
    backdrop-filter: blur(18px);
    min-width: 0;
  }

  .context-inspector.open {
    display: flex;
    flex-direction: column;
  }

  .inspector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 18px 8px;
  }

  .inspector-header button {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid rgba(48, 56, 51, 0.1);
    background: rgba(255, 255, 255, 0.8);
  }

  .context-summary {
    padding: 0 18px 14px;
  }

  .context-tabs {
    display: flex;
    gap: 8px;
    padding: 0 18px 14px;
    overflow: auto;
  }

  .context-tabs button {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .context-tabs button[data-active="true"] {
    background: rgba(43, 106, 93, 0.08);
    border-color: rgba(43, 106, 93, 0.22);
  }

  .context-scroll {
    min-height: 0;
    overflow: auto;
    display: grid;
    gap: 12px;
    padding: 0 18px 20px;
    align-content: start;
  }

  .context-block header,
  .delivery-head,
  .provenance-drawer header,
  .starter-form header,
  .context-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .context-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 10px;
  }

  .context-list li,
  .trace-list div,
  .settings-inline-list div {
    display: grid;
    gap: 4px;
  }

  .context-code,
  .trace-list dd,
  .runtime-note,
  .context-empty,
  .settings-page small,
  .settings-hint,
  .starter-form small,
  .starter-form p,
  .delivery-note {
    font-size: 12px;
  }

  .artifact-preview-tabs [role="tablist"] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .artifact-preview-tabs [role="tab"] {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(48, 56, 51, 0.1);
    background: rgba(255, 255, 255, 0.72);
  }

  .delivery-stack,
  .starter-stack,
  .utility-stack {
    display: grid;
    gap: 10px;
  }

  .provenance-actions,
  .runtime-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }

  .provenance-actions button,
  .runtime-actions button,
  .starter-form button,
  .context-button {
    min-height: 36px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(48, 56, 51, 0.1);
    background: rgba(255, 255, 255, 0.84);
  }

  .trace-list,
  .settings-inline-list {
    margin: 0;
    display: grid;
    gap: 10px;
  }

  .trace-list dt,
  .settings-inline-list dt {
    font-weight: 600;
  }

  .starter-form {
    border: 1px solid rgba(48, 56, 51, 0.08);
    border-radius: 16px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.62);
    display: grid;
    gap: 10px;
  }

  .starter-field {
    display: grid;
    gap: 6px;
  }

  .starter-field textarea,
  .starter-field input,
  .starter-field select {
    border: 1px solid rgba(48, 56, 51, 0.1);
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.88);
  }

  .starter-form button[type="submit"] {
    justify-self: start;
  }

  .action-receipt-summary-list,
  .artifact-preview-tabs,
  .delivery-cards,
  .provenance-drawer,
  .starter-forms,
  .runtime-panel,
  .settings-inline-panel {
    display: grid;
    gap: 12px;
  }

  .settings-inline-panel .context-button {
    justify-self: start;
  }

  .runtime-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 1220px) {
    .opl-native-workbench,
    .opl-native-workbench.inspector-open {
      grid-template-columns: 240px minmax(0, 1fr);
    }

    .context-inspector {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(400px, 92vw);
      z-index: 10;
      box-shadow: -16px 0 40px rgba(32, 38, 35, 0.12);
    }
  }

  @media (max-width: 900px) {
    .opl-native-workbench,
    .opl-native-workbench.inspector-open {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: 0;
      border-bottom: 1px solid rgba(48, 56, 51, 0.08);
    }

    .chat-shell {
      padding: 16px;
    }

    .topbar {
      flex-direction: column;
    }
  }
`;

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
  return [{
    id: "seed-user",
    role: "user",
    text: "Use the current project to prepare a review or deliverable."
  }, {
    id: "seed-assistant",
    role: "assistant",
    text: "Codex is connected to OPL project context.\nAsk for a result review, export draft, or workflow request. Sources, previews, trace, and receipts stay in Context; execution requires confirmation."
  }];
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
  return {
    id: candidate.id,
    title: typeof candidate.title === "string" && candidate.title ? candidate.title : "New chat",
    threadId: typeof candidate.threadId === "string" && candidate.threadId ? candidate.threadId : undefined,
    messages: messages.length ? messages : createIntroMessages(),
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

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Local draft";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [lastDryRun, setLastDryRun] = useState("No action preview yet.");
  const [pendingAction, setPendingAction] = useState<{ actionId: string; payload: Record<string, unknown> } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sendState, setSendState] = useState<"idle" | "running" | "error">("idle");
  const [sendError, setSendError] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialSessions[0]?.id ?? "session-initial");
  const [messages, setMessages] = useState<ChatMessage[]>(initialSessions[0]?.messages ?? createIntroMessages());
  const [eventFeed, setEventFeed] = useState<string[]>(["bridge.ready"]);
  const [codexThreadId, setCodexThreadId] = useState<string | undefined>(initialSessions[0]?.threadId);
  const [settings, setSettings] = useState<WorkbenchSettings>(() => readSettings());
  const [starterDrafts, setStarterDrafts] = useState<Record<string, Record<string, string>>>({});
  const [activeContextTab, setActiveContextTab] = useState<(typeof contextTabs)[number][0]>(contextTabs[0][0]);
  const previewAction = firstPreviewAction(model.contextActions);
  const currentSession = chatSessions.find((session) => session.id === currentSessionId) ?? chatSessions[0];
  const contextStatusText = stateStatus === "loading"
    ? "Loading OPL fast state..."
    : stateStatus === "error"
      ? `Using fallback context model. ${stateError}`
      : model.stateGeneratedAt
        ? `Loaded from opl app state --profile fast --json at ${model.stateGeneratedAt}.`
        : "Context is ready from the current App state.";

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
      .sendMessage({ prompt: text, threadId: codexThreadId })
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
    const nextMessages = [{
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: "New OPL workbench chat. Ask for review, drafting, export, or a workflow starter."
    }] satisfies ChatMessage[];
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

  function renderSettingControl(key: SettingKey) {
    const value = settings[key];
    if (typeof value === "boolean") {
      return (
        <button className="setting-toggle" type="button" onClick={() => updateSetting(key, !value)}>
          {value ? "on" : "off"}
        </button>
      );
    }
    if (key === "locale") {
      return (
        <button className="setting-toggle" data-testid="opl-locale-toggle" type="button" onClick={() => updateSetting("locale", value === "zh" ? "en" : "zh")}>
          {value === "zh" ? "Chinese" : "English"}
        </button>
      );
    }
    if (key === "reasoningLevel") {
      return (
        <button className="setting-toggle" type="button" data-testid="opl-settings-reasoning" onClick={() => updateSetting("reasoningLevel", value === "high" ? "standard" : "high")}>
          {value}
        </button>
      );
    }
    if (key === "runtimeProfile") {
      return (
        <button className="setting-toggle" type="button" onClick={() => updateSetting("runtimeProfile", value === "fast" ? "full" : "fast")}>
          {value}
        </button>
      );
    }
    if (key === "theme") {
      return (
        <button className="setting-toggle" type="button" onClick={() => updateSetting("theme", value === "system" ? "light" : "system")}>
          {value}
        </button>
      );
    }
    return (
      <code data-testid={key === "modelAccess" ? "opl-model-access-entry" : undefined}>
        {String(value)}
      </code>
    );
  }

  return (
    <main
      data-testid="opl-native-workbench-root"
      data-layout="codex-sidebar-chat"
      className={`opl-native-workbench codex-sidebar-chat ${inspectorOpen ? "inspector-open" : "inspector-closed"}`}
    >
      <style>{workbenchStyles}</style>

      <aside data-testid="opl-workspace-rail" className="sidebar" aria-label="Workspaces">
        <header className="brand-row">
          <GitBranch aria-hidden="true" size={16} />
          <div>
            <strong>One Person Lab</strong>
            <small>Codex workbench</small>
          </div>
        </header>

        <div className="quick-actions">
          <button type="button" onClick={startNewChat}>
            <Plus aria-hidden="true" size={15} />
            New chat
          </button>
          <button type="button" aria-label="Search">
            <Search aria-hidden="true" size={15} />
          </button>
        </div>

        <section className="history-list" aria-label="History">
          <div className="sidebar-section-head">
            <strong>Chats</strong>
            <span>{chatSessions.length}</span>
          </div>
          <ol data-testid="opl-session-list">
            {chatSessions.map((session) => (
              <li key={session.id} className={session.id === currentSessionId ? "active" : undefined}>
                <button type="button" onClick={() => openSession(session.id)}>
                  <strong>{session.title}</strong>
                  <span>{session.threadId ? "Codex resumable thread" : "Local draft session"}</span>
                  <small>{formatTimestamp(session.updatedAt)}</small>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <footer className="sidebar-footer" aria-label="Sidebar controls">
          <button type="button" onClick={() => {
            setInspectorOpen(true);
            setActiveContextTab("opl-files-panel");
          }}>
            <FileText aria-hidden="true" size={14} />
            Context
          </button>
          <button type="button" aria-current={activeView === "settings" ? "page" : undefined} onClick={() => setActiveView("settings")}>
            <Settings aria-hidden="true" size={14} />
            Settings
          </button>
          <StatusPill status="connected" />
        </footer>
      </aside>

      <section className="chat-shell" aria-label="Single conversation canvas">
        <header className="topbar">
          <div className="topbar-copy">
            <p>{activeView === "settings" ? "Workbench settings" : "Current workspace"}</p>
            <h1>{activeView === "settings" ? "Settings" : currentSession?.title || "Current project"}</h1>
            <div className="topbar-meta">
              <span className="topbar-status" data-testid="opl-model-access-entry">
                {stateStatus === "loading" ? "Context loading" : stateStatus === "ready" ? "Context ready" : "Context fallback"}
              </span>
              <span className="session-chip">
                {currentSession?.threadId ? "Codex resumable thread" : "Local draft session"}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              data-testid="opl-export-action"
              className="primary-action"
              type="button"
              onClick={() => previewAction
                ? runDryRun(previewAction.id)
                : runDryRun(defaultExportActionId, { refs: model.deliverables.map((item) => item.ref) })}
            >
              <Download aria-hidden="true" size={15} />
              Preview action
            </button>
            <button type="button" onClick={() => void loadState(settings.runtimeProfile)}>
              <RefreshCw aria-hidden="true" size={15} />
              Refresh context
            </button>
            {activeView === "settings" ? (
              <button data-testid="opl-skip-to-chat" type="button" onClick={() => setActiveView("chat")}>
                <ChevronRight aria-hidden="true" size={15} />
                Back to chat
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setInspectorOpen(true);
                setActiveContextTab("opl-files-panel");
              }}
              aria-label="Open workspace"
            >
              <PanelRightOpen aria-hidden="true" size={16} />
              Context
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
                  <span>Workflow starters stay secondary until you need them.</span>
                  <span className="delivery-mode-tag" data-testid="opl-delivery-mode">research</span>
                </div>
                <div className="workflow-chip-row">
                  {model.purposes.map((purpose) => (
                    <button
                      key={purpose}
                      data-testid="opl-delivery-mode-option"
                      className="workflow-chip"
                      type="button"
                      onClick={() => runDryRun(defaultPreviewActionId, { purpose })}
                    >
                      {purposeLabels[purpose]}
                    </button>
                  ))}
                </div>
              </section>

              <div className="thread">
                <section className="thread-intro" aria-label="Conversation guidance">
                  <span className="thread-note">Project sources loaded</span>
                  <span className="thread-note">Preview and export actions require confirmation</span>
                  <span className="thread-note">Artifact bodies remain source-owned</span>
                </section>

                {messages.map((message) => (
                  <article
                    key={message.id}
                    data-testid={message.role === "assistant" ? "opl-conversation-event" : undefined}
                    className={`message ${message.role}`}
                  >
                    {message.role === "assistant" ? <span className="message-label">One Person Lab</span> : null}
                    {message.role === "system" ? <span className="message-label">Runtime</span> : null}
                    <div className="message-frame">
                      <p>{message.text || (sendState === "running" ? "Codex is working..." : "Waiting for reply.")}</p>
                    </div>
                    <span className="message-meta">
                      {message.role === "user"
                        ? "Prompt"
                        : message.role === "system"
                          ? "Action or runtime event"
                          : currentSession?.threadId
                            ? "Streaming via codex app-server"
                            : "Connected to project context"}
                    </span>
                    {message.role === "assistant" ? <span data-testid="opl-codex-reply" hidden /> : null}
                  </article>
                ))}
              </div>

              <form className="composer" onSubmit={sendCodexMessage}>
                <div className="composer-frame">
                  <textarea
                    aria-label="Prompt"
                    placeholder="Ask OPL to review, draft, export, or start a workflow"
                    value={prompt}
                    onChange={(event) => setPrompt(event.currentTarget.value)}
                    disabled={sendState === "running"}
                  />
                  <footer>
                    <div className="composer-meta">
                      <span className={`composer-status ${sendState}`} data-testid="opl-composer-run-state">
                        {sendState === "running" ? "Codex running" : sendState === "error" ? `Codex error: ${sendError}` : "Ready"}
                      </span>
                      <span className="thread-note">Context and receipts stay in the right inspector.</span>
                    </div>
                    <div className="composer-actions">
                      <button className="composer-action" type="button" aria-label="Attach">
                        <Plus aria-hidden="true" size={15} />
                      </button>
                      <button className="composer-submit" type="submit" disabled={!prompt.trim() || sendState === "running"}>
                        <Send aria-hidden="true" size={16} />
                        {sendState === "running" ? "Running" : sendState === "error" ? "Retry" : "Send"}
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
                <h2>Runtime readback</h2>
                <dl>
                  <div>
                    <dt>State profile</dt>
                    <dd>{settings.runtimeProfile}<small>Drives `opl app state --profile ...` reads.</small></dd>
                  </div>
                  <div>
                    <dt>Context state</dt>
                    <dd>{stateStatus}<small>{stateError || model.stateGeneratedAt || "No current readback timestamp."}</small></dd>
                  </div>
                </dl>
                <button type="button" onClick={() => void loadState(settings.runtimeProfile)}>Refresh state now</button>
              </section>
              {settingsSections.map((section) => (
                <section key={section.id} data-testid="opl-settings-section" data-section={section.id}>
                  <h2>{section.title}</h2>
                  <dl>
                    {section.keys.map((key) => (
                      <div key={key}>
                        <dt>{settingLabels[key]}</dt>
                        <dd>
                          {renderSettingControl(key)}
                          <small>Default: {String(settingsDefaults[key])}</small>
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
          <h2>Context</h2>
          <button type="button" aria-label="Close context" onClick={() => setInspectorOpen(false)}>
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </header>

        <section className="context-summary" aria-live="polite">
          <p className="context-status">{contextStatusText}</p>
        </section>

        <nav data-testid="opl-context-tabs" className="context-tabs">
          {contextTabs.map(([testId, label]) => (
            <button key={testId} type="button" data-active={activeContextTab === testId} onClick={() => setActiveContextTab(testId)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="context-scroll">
          <section data-testid="opl-files-panel" className="context-block" hidden={activeContextTab !== "opl-files-panel"}>
            <div className="context-list-head">
              <strong>Sources</strong>
              <button className="context-quiet-action" type="button" onClick={() => void loadState(settings.runtimeProfile)}>Refresh</button>
            </div>
            <p className="context-empty">Refs-only surface backed by OPL App state/action contracts.</p>
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
              key={model.artifactPreviews[0]?.id}
              data-testid="opl-artifact-preview-tabs"
              className="artifact-preview-tabs"
              defaultValue={model.artifactPreviews[0]?.id}
            >
              <Tabs.List aria-label="Artifact previews">
                {model.artifactPreviews.map((preview) => (
                  <Tabs.Trigger key={preview.id} value={preview.id} data-testid="opl-artifact-preview-tab">
                    {preview.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {model.artifactPreviews.map((preview) => (
                <Tabs.Content
                  key={preview.id}
                  value={preview.id}
                  data-preview-kind={preview.rendererModuleId}
                  data-testid="opl-artifact-preview-panel"
                  className="artifact-preview"
                >
                  <ArtifactPreviewCard preview={preview} />
                </Tabs.Content>
              ))}
            </Tabs.Root>

            <section className="delivery-cards">
              <div className="delivery-head">
                <strong>Deliverables</strong>
                <span className="delivery-note">Recent refs and receipts</span>
              </div>
              <div className="delivery-stack">
                {model.deliverables.slice(0, 3).map((item) => <DeliveryCard key={item.id} item={item} />)}
                {model.receipts.slice(0, 2).map((item) => <DeliveryCard key={item.id} item={item} />)}
              </div>
            </section>
          </section>

          <section data-testid="opl-provenance-drawer" className="context-block provenance-drawer" hidden={activeContextTab !== "opl-provenance-drawer"}>
            <header>
              <h3>Trace and actions</h3>
              <PanelRightOpen aria-hidden="true" size={18} />
            </header>
            <p data-testid="opl-provenance-ref" className="delivery-note">
              Source refs, receipt refs, replay refs, and export refs without artifact bodies.
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
                onClick={() => previewAction
                  ? runDryRun(previewAction.id)
                  : runDryRun(defaultExportActionId, { refs: model.deliverables.map((item) => item.ref) })}
              >
                <Download aria-hidden="true" size={16} />
                Preview action
              </button>
              <button
                data-testid="opl-runtime-action-execute"
                type="button"
                disabled={!pendingAction}
                onClick={executeConfirmedAction}
              >
                Execute confirmed
              </button>
              <button type="button" disabled={!pendingAction} onClick={previewRollback}>Preview rollback</button>
            </div>
            <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>

            <section data-testid="opl-action-receipt-summary-list" className="action-receipt-summary-list">
              <h3>Action receipts</h3>
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
              <strong>Workflow starters</strong>
              <span className="delivery-note">Preview first, then confirm</span>
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
                    Preview receipt
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
                    runDryRun(
                      starter.previewActionId ?? starter.dryRunAction,
                      starterPayloadFromDraft(starter, starterDrafts[starter.id] ?? {})
                    );
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
                  <button type="submit" disabled={starter.available === false}>
                    <Send aria-hidden="true" size={16} />
                    {starter.available === false ? "Unavailable" : "Preview workflow"}
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section
            data-testid="opl-secondary-runtime-context"
            className="context-block runtime-panel"
            hidden={activeContextTab !== "opl-runtime-summary"}
          >
            <div className="context-list-head">
              <h3 data-testid="opl-runtime-summary">Runtime</h3>
              <span className="delivery-note">Readback only</span>
            </div>
            <div className="runtime-meta">
              <div data-testid="opl-runtime-context-group" className="session-chip">needs_attention</div>
              <div data-testid="opl-runtime-context-item" className="runtime-note">No domain body or artifact body is owned here.</div>
            </div>
            <div className="runtime-actions">
              <button
                data-testid="opl-runtime-full-detail-button"
                type="button"
                onClick={() => void bridge.readFullDrilldown()}
              >
                Full drilldown
              </button>
              <button
                data-testid="opl-runtime-action-dry-run"
                type="button"
                onClick={() => runDryRun(defaultRuntimeActionId, { source: "runtime-panel" })}
              >
                Preview action
              </button>
            </div>

            <RendererModuleRegistryPanel />

            <div className="utility-stack">
              <section data-testid="opl-skills-panel" className="context-block">
                <h3>Skills</h3>
                <p className="context-empty">Codex Skill references only; no domain authority is owned here.</p>
              </section>
              <section data-testid="opl-routing-panel" className="context-block">
                <h3>Routing</h3>
                <p className="context-empty">Route suggestions remain App-owned refs and preview actions.</p>
              </section>
              <section data-testid="opl-memory-panel" className="context-block">
                <h3>Memory</h3>
                <p className="context-empty">Memory refs are shown without owning memory body truth.</p>
              </section>
              <section data-testid="opl-always-on-panel" className="context-block">
                <h3>Always-on context</h3>
                <p className="context-empty">Always-on context is summarized as refs, receipts, and next actions.</p>
              </section>
            </div>

            <div className="visually-hidden" data-testid="opl-web-transport">window.oplNativeWorkbench / SSE /api/opl-events</div>
            <div className="visually-hidden" data-testid="opl-event-feed">{eventFeed.join(" / ")} tool process diff file receipt user_input permission</div>
          </section>

          <section data-testid="opl-settings-panel" className="context-block settings-inline-panel" hidden={activeContextTab !== "opl-settings-panel"}>
            <div className="context-list-head">
              <strong>Settings</strong>
              <span className="settings-hint">Primary route stays in the main column.</span>
            </div>
            <dl className="settings-inline-list">
              <div>
                <dt>Language</dt>
                <dd>{settings.locale}</dd>
              </div>
              <div>
                <dt>State profile</dt>
                <dd>{settings.runtimeProfile}</dd>
              </div>
              <div>
                <dt>Confirm before execute</dt>
                <dd>{String(settings.confirmBeforeExecute)}</dd>
              </div>
            </dl>
            <button className="context-button" type="button" onClick={() => setActiveView("settings")}>
              Open full settings
            </button>
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
