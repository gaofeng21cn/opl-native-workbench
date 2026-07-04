import * as Tabs from "@radix-ui/react-tabs";
import { Download, FileText, GitBranch, PanelRightOpen, Plus, Search, Send, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { createBrowserBridge } from "../bridge/oplBridge";
import {
  ConfirmationCard,
  RendererModuleRegistryPanel,
  StatusPill
} from "../ui/workbenchPrimitives";
import { initialWorkbenchModel, type WorkbenchPurpose, type WorkbenchStarter } from "./workbenchModel";

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

export function App() {
  const bridge = useMemo(() => createBrowserBridge(), []);
  const model = initialWorkbenchModel;
  const [activeView, setActiveView] = useState<"chat" | "settings">("chat");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [lastDryRun, setLastDryRun] = useState("No action preview yet.");
  const [lastCodexReply, setLastCodexReply] = useState("");
  const [codexThreadId, setCodexThreadId] = useState<string | undefined>();

  function runDryRun(actionId: string, payload: Record<string, unknown> = {}) {
    void bridge
      .executeAction({ actionId, payload, dryRun: true })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ actionId, dryRun: true, error: String(error) })));
  }

  function sendCodexMessage(prompt: string) {
    void bridge
      .sendMessage({ prompt, threadId: codexThreadId })
      .then((reply) => {
        const nextThreadId = typeof reply === "object" && reply && "threadId" in reply
          ? String((reply as { threadId?: unknown }).threadId ?? "")
          : "";
        if (nextThreadId) setCodexThreadId(nextThreadId);
        setLastCodexReply(formatReceipt(reply));
      })
      .catch((error) => setLastCodexReply(formatReceipt({ executor: "codex_app_server", error: String(error) })));
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
          <button type="button" onClick={() => runDryRun("candidate.workspace.new")}>
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
          <span className="topbar-status" data-testid="opl-model-access-entry">Codex connected</span>
          <button
            data-testid="opl-export-action"
            type="button"
            onClick={() => runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
          >
            <Download aria-hidden="true" size={15} />
            Prepare export
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
            <article className="message user">Use the current project to prepare a review or deliverable.</article>

            <article data-testid="opl-conversation-event" className="message assistant">
              <small>One Person Lab</small>
              <h2>Codex is connected to OPL project context.</h2>
              <p>
                Ask for a result review, export draft, or workflow request. OPL keeps sources,
                previews, trace, and receipts available in the context panel, and asks before execution.
              </p>
              <div className="event-line">Project sources loaded</div>
              <div className="event-line">Preview and export actions require confirmation</div>
              <div className="event-line">Artifact bodies remain source-owned</div>
              {lastCodexReply ? <pre data-testid="opl-codex-reply">{lastCodexReply}</pre> : null}
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

            <form className="composer">
              <textarea aria-label="Prompt" placeholder="Ask OPL to review, draft, export, or start a workflow" />
              <footer>
                <button type="button" aria-label="Attach">
                  <Plus aria-hidden="true" size={15} />
                </button>
                <button type="button" onClick={() => sendCodexMessage("Answer from OPL App context. Keep it concise.")}>
                  <Send aria-hidden="true" size={16} />
                  Send
                </button>
              </footer>
            </form>
          </div>
        </section> : (
          <section data-testid="opl-settings-panel" className="settings-page" aria-label="Settings">
            <div className="settings-content">
              <section>
                <h2>Execution</h2>
                <p>Codex is the local executor for this build. Model and reasoning controls belong here, not in the composer.</p>
                <button type="button" data-testid="opl-model-access-entry">Codex CLI managed</button>
              </section>
              <section>
                <h2>Interface</h2>
                <p>Language is a global interface preference, not a per-message send option.</p>
                <button data-testid="opl-locale-toggle" type="button">Chinese</button>
              </section>
              <section>
                <h2>Runtime</h2>
                <p>Conversation backend uses Codex app-server JSON-RPC: initialize, thread/start, turn/start, stream deltas, and thread resume.</p>
                <code>codex app-server --stdio</code>
              </section>
              <section>
                <h2>Project</h2>
                <p>The default project is the OPL App repo. Artifact bodies and domain truth remain outside this shell.</p>
              </section>
              <section>
                <h2>About</h2>
                <p>This is a local candidate build. AionUI remains the active shell until release gates pass.</p>
              </section>
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

        <nav data-testid="opl-context-tabs" className="context-tabs">
          {contextTabs.map(([testId, label]) => (
            <button key={testId} type="button">{label}</button>
          ))}
        </nav>

        <section data-testid="opl-files-panel">
          <h3>Sources</h3>
          <p>Refs-only surface backed by OPL App state/action contracts.</p>
          <ol>
            {model.artifactPreviews.map((preview) => (
              <li key={preview.id}>{preview.ref}</li>
            ))}
          </ol>
        </section>

        <Tabs.Root
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
              <header>
                <h3>{preview.title}</h3>
                <span>{preview.rendererModuleId}</span>
              </header>
              <p>{preview.summary}</p>
              <code>{preview.ref}</code>
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
          <button
            data-testid="opl-export-action-dry-run"
            type="button"
            onClick={() => runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
          >
            <Download aria-hidden="true" size={16} />
            Preview export
          </button>
          <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>
        </section>

        <ConfirmationCard
          card={model.confirmations[0]!}
          question={model.questions[0]!}
          onDryRun={runDryRun}
        />

        <section data-testid="opl-starter-forms" className="starter-forms" aria-label="Workflow starters">
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
        <div data-testid="opl-event-feed">tool process diff file receipt user_input permission</div>
      </aside>
    </main>
  );
}

export default App;
