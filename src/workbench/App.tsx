import * as Tabs from "@radix-ui/react-tabs";
import { Download, FileText, GitBranch, PanelRightOpen, Plus, Search, Send, Settings } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserBridge } from "../bridge/oplBridge";
import {
  ActionReceiptSummary,
  ArtifactPreviewCard,
  ConfirmationCard,
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

function starterPayload(starter: WorkbenchStarter): Record<string, unknown> {
  return {
    starterId: starter.id,
    module: starter.module,
    fields: Object.fromEntries(starter.fields.map((field) => [field.name, field.value]))
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

export function App() {
  const bridge = useMemo(() => createBrowserBridge(), []);
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "seed-user", role: "user", text: "Use the current project to prepare a review or deliverable." },
    {
      id: "seed-assistant",
      role: "assistant",
      text: "Codex is connected to OPL project context.\nAsk for a result review, export draft, or workflow request. Sources, previews, trace, and receipts stay in Context; execution requires confirmation."
    }
  ]);
  const [eventFeed, setEventFeed] = useState<string[]>(["bridge.ready"]);
  const [codexThreadId, setCodexThreadId] = useState<string | undefined>();
  const [settings, setSettings] = useState<WorkbenchSettings>(() => readSettings());
  const previewAction = firstPreviewAction(model.contextActions);

  useEffect(() => {
    let cancelled = false;
    bridge
      .readState("fast")
      .then((state) => {
        if (cancelled) return;
        setModel(deriveWorkbenchModelFromState(state));
        setStateStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setStateStatus("error");
        setStateError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => bridge.subscribeEvents((event) => {
    setEventFeed((items) => [formatEvent(event), ...items].slice(0, 8));
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
    void bridge
      .executeAction({
        actionId: pendingAction.actionId,
        payload: { ...pendingAction.payload, confirmed: true },
        dryRun: false
      })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ ...pendingAction, dryRun: false, error: String(error) })));
  }

  function sendCodexMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || sendState === "running") return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: "user", text };
    const pendingId = `assistant-${Date.now()}`;
    setMessages((items) => [...items, userMessage, { id: pendingId, role: "system", text: "Codex is working..." }]);
    setPrompt("");
    setSendState("running");
    setSendError("");
    void bridge
      .sendMessage({ prompt: text, threadId: codexThreadId })
      .then((reply) => {
        const nextThreadId = typeof reply === "object" && reply && "threadId" in reply
          ? String((reply as { threadId?: unknown }).threadId ?? "")
          : "";
        if (nextThreadId) setCodexThreadId(nextThreadId);
        const finalMessage = typeof reply === "object" && reply && "finalMessage" in reply
          ? String((reply as { finalMessage?: unknown }).finalMessage ?? "")
          : "";
        setMessages((items) => items.map((item) => item.id === pendingId
          ? { id: pendingId, role: "assistant", text: finalMessage || formatReceipt(reply) }
          : item));
        setSendState("idle");
      })
      .catch((error) => {
        const message = String(error);
        setSendError(message);
        setSendState("error");
        setMessages((items) => items.map((item) => item.id === pendingId
          ? { id: pendingId, role: "system", text: formatReceipt({ executor: "codex_app_server", error: message }) }
          : item));
      });
  }

  function startNewChat() {
    setCodexThreadId(undefined);
    setPrompt("");
    setMessages([{
      id: `assistant-${Date.now()}`,
      role: "assistant",
      text: "New OPL workbench chat. Ask for review, drafting, export, or a workflow starter."
    }]);
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
            {model.sessions.map((session, index) => (
              <li key={session.id} className={index === 1 ? "active" : undefined}>
                <strong>{session.session}</strong>
                <span>{session.workspace}</span>
                <small>{session.nextStep}</small>
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
              : runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
          >
            <Download aria-hidden="true" size={15} />
            Preview action
          </button>
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
                <p>{message.text}</p>
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
                    onClick={() => runDryRun("candidate.delivery.mode", { purpose })}
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
              : runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
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
            >
              <header>
                <h3>{starter.title}</h3>
                <span>{starter.module}</span>
              </header>
              <p>{starter.intent}</p>
              <button
                type="button"
                onClick={() => runDryRun(starter.dryRunAction, starterPayload(starter))}
              >
                <Send aria-hidden="true" size={16} />
                Preview workflow
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
            onClick={() => runDryRun("candidate.inspect", { source: "runtime-panel" })}
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
