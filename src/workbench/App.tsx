import * as Tabs from "@radix-ui/react-tabs";
import { Download, FileText, GitBranch, PanelRightOpen, Plus, Search, Send, Settings } from "lucide-react";
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
  const previewAction = firstPreviewAction(model.contextActions);

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
    void bridge
      .executeAction({ actionId, payload, dryRun: true })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ actionId, dryRun: true, error: String(error) })));
  }

  function executeConfirmedAction() {
    if (!pendingAction) return;
    const receiptId = `${pendingAction.actionId}:${Date.now()}`;
    const rollbackRef = `rollback://${receiptId}`;
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
        <button type="button" onClick={() => updateSetting(key, !value)}>
          {value ? "on" : "off"}
        </button>
      );
    }
    if (key === "locale") {
      return (
        <button data-testid="opl-locale-toggle" type="button" onClick={() => updateSetting("locale", value === "zh" ? "en" : "zh")}>
          {value === "zh" ? "Chinese" : "English"}
        </button>
      );
    }
    if (key === "reasoningLevel") {
      return (
        <button type="button" data-testid="opl-settings-reasoning" onClick={() => updateSetting("reasoningLevel", value === "high" ? "standard" : "high")}>
          {value}
        </button>
      );
    }
    if (key === "runtimeProfile") {
      return (
        <button type="button" onClick={() => updateSetting("runtimeProfile", value === "fast" ? "full" : "fast")}>
          {value}
        </button>
      );
    }
    if (key === "theme") {
      return (
        <button type="button" onClick={() => updateSetting("theme", value === "system" ? "light" : "system")}>
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
      className="opl-native-workbench codex-sidebar-chat"
    >
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
          <h3>Chats</h3>
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
          <button type="button" onClick={() => setInspectorOpen(true)}>
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
          <h1>{activeView === "settings" ? "Settings" : "Current project"}</h1>
          <span className="topbar-status" data-testid="opl-model-access-entry">
            {stateStatus === "loading" ? "Context loading" : stateStatus === "ready" ? "Context ready" : "Context fallback"}
          </span>
          <button
            data-testid="opl-export-action"
            type="button"
            onClick={() => previewAction
              ? runDryRun(previewAction.id)
              : runDryRun(defaultExportActionId, { refs: model.deliverables.map((item) => item.ref) })}
          >
            <Download aria-hidden="true" size={15} />
            Preview action
          </button>
          <button type="button" onClick={() => void loadState(settings.runtimeProfile)}>Refresh context</button>
          {activeView === "settings" ? (
            <button data-testid="opl-skip-to-chat" type="button" onClick={() => setActiveView("chat")}>Back to chat</button>
          ) : null}
          <button type="button" onClick={() => setInspectorOpen(true)} aria-label="Open workspace">
            <PanelRightOpen aria-hidden="true" size={16} />
          </button>
        </header>

        {activeView === "chat" ? <section className="conversation">
          <div className="thread">
            {messages.map((message) => (
              <article
                key={message.id}
                data-testid={message.role === "assistant" ? "opl-conversation-event" : undefined}
                className={`message ${message.role}`}
              >
                {message.role === "assistant" ? <small>One Person Lab</small> : null}
                <p>{message.text || (sendState === "running" ? "Codex is working..." : "Waiting for reply.")}</p>
                {message.role === "assistant" ? <span data-testid="opl-codex-reply" hidden /> : null}
              </article>
            ))}

            <article className="message assistant">
              <div className="event-line">Project sources loaded</div>
              <div className="event-line">Preview and export actions require confirmation</div>
              <div className="event-line">Artifact bodies remain source-owned</div>
              <section
                data-testid="opl-workbench-delivery-mode"
                className="delivery-workbench capability-row inline-context"
                aria-label="Suggested outputs"
              >
                {model.purposes.map((purpose) => (
                  <button
                    key={purpose}
                    data-testid="opl-delivery-mode-option"
                    type="button"
                    onClick={() => runDryRun(defaultPreviewActionId, { purpose })}
                  >
                    {purposeLabels[purpose]}
                  </button>
                ))}
                <span data-testid="opl-delivery-mode">research</span>
              </section>
            </article>

            <form className="composer" onSubmit={sendCodexMessage}>
              <textarea
                aria-label="Prompt"
                placeholder="Ask OPL to review, draft, export, or start a workflow"
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                disabled={sendState === "running"}
              />
              <footer>
                <span className={`composer-status ${sendState}`} data-testid="opl-composer-run-state">
                  {sendState === "running" ? "Codex running" : sendState === "error" ? `Codex error: ${sendError}` : "Ready"}
                </span>
                <button type="button" aria-label="Attach">
                  <Plus aria-hidden="true" size={15} />
                </button>
                <button type="submit" disabled={!prompt.trim() || sendState === "running"}>
                  <Send aria-hidden="true" size={16} />
                  {sendState === "running" ? "Running" : sendState === "error" ? "Retry" : "Send"}
                </button>
              </footer>
            </form>
          </div>
        </section> : (
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
        <header>
          <h2>Context</h2>
          <button type="button" onClick={() => setInspectorOpen(false)}>Close</button>
        </header>

        <section aria-live="polite">
          {stateStatus === "loading" ? <p>Loading OPL fast state...</p> : null}
          {stateStatus === "error" ? <p>Using fallback context model. {stateError}</p> : null}
          {stateStatus === "ready" && model.stateGeneratedAt ? <p>Loaded from opl app state --profile fast --json at {model.stateGeneratedAt}.</p> : null}
        </section>

        <nav data-testid="opl-context-tabs" className="context-tabs">
          {contextTabs.map(([testId, label]) => (
            <button key={testId} type="button">{label}</button>
          ))}
        </nav>

        <section data-testid="opl-files-panel">
          <h3>Sources</h3>
          <p>Refs-only surface backed by OPL App state/action contracts.</p>
          <ol>
            {model.contextSources.map((source) => (
              <li key={source.id}>
                <strong>{source.label}</strong>
                <span>{source.summary}</span>
                <code>{source.ref}</code>
              </li>
            ))}
          </ol>
        </section>

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
          <h3>Deliverables</h3>
          {model.deliverables.slice(0, 3).map((item) => <DeliveryCard key={item.id} item={item} />)}
          {model.receipts.slice(0, 2).map((item) => <DeliveryCard key={item.id} item={item} />)}
        </section>

        <section data-testid="opl-provenance-drawer" className="provenance-drawer">
          <header>
            <PanelRightOpen aria-hidden="true" size={18} />
          <h3>Trace and actions</h3>
          </header>
          <p data-testid="opl-provenance-ref">
            Source refs, receipt refs, replay refs, and export refs without artifact bodies.
          </p>
          <dl>
            {model.contextTrace.map((trace) => (
              <div key={trace.id}>
                <dt>{trace.label}</dt>
                <dd>{trace.value}</dd>
              </div>
            ))}
          </dl>
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
          <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>
        </section>

        <section data-testid="opl-action-receipt-summary-list" className="action-receipt-summary-list">
          <h3>Action receipts</h3>
          {model.actionReceipts.map((receipt) => <ActionReceiptSummary key={receipt.id} receipt={receipt} />)}
        </section>

        <ConfirmationCard
          card={model.confirmations[0]!}
          question={model.questions[0]!}
          onDryRun={runDryRun}
        />

        <section data-testid="opl-starter-forms" className="starter-forms" aria-label="Workflow starters">
          {model.contextActions.filter((action) => action.dryRunSupported).slice(0, 8).map((action) => (
            <article key={action.id} data-testid="opl-starter-form" data-starter={action.id}>
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
              <button
                type="submit"
                disabled={starter.available === false}
              >
                <Send aria-hidden="true" size={16} />
                {starter.available === false ? "Unavailable" : "Preview workflow"}
              </button>
            </form>
          ))}
        </section>

        <RendererModuleRegistryPanel />

        <section data-testid="opl-skills-panel">
          <h3>Skills</h3>
          <p>Codex Skill references only; no domain authority is owned here.</p>
        </section>
        <section data-testid="opl-routing-panel">
          <h3>Routing</h3>
          <p>Route suggestions remain App-owned refs and preview actions.</p>
        </section>
        <section data-testid="opl-memory-panel">
          <h3>Memory</h3>
          <p>Memory refs are shown without owning memory body truth.</p>
        </section>
        <section data-testid="opl-always-on-panel">
          <h3>Always-on context</h3>
          <p>Always-on context is summarized as refs, receipts, and next actions.</p>
        </section>
        <section data-testid="opl-settings-panel">
          <h3>Settings</h3>
          <p>Settings consume App state and product profile refs.</p>
        </section>
        <section data-testid="opl-secondary-runtime-context">
          <h3 data-testid="opl-runtime-summary">Runtime</h3>
          <div data-testid="opl-runtime-context-group">needs_attention</div>
          <div data-testid="opl-runtime-context-item">No domain body or artifact body is owned here.</div>
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
        </section>
        <div data-testid="opl-web-transport">window.oplNativeWorkbench / SSE /api/opl-events</div>
        <div data-testid="opl-event-feed">{eventFeed.join(" / ")} tool process diff file receipt user_input permission</div>
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
