import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Download, GitBranch, PanelRightOpen, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { createBrowserBridge } from "../bridge/oplBridge";
import {
  ConfirmationCard,
  DeliveryCard,
  RendererModuleRegistryPanel,
  StatusPill
} from "../ui/workbenchPrimitives";
import { initialWorkbenchModel, type WorkbenchStarter } from "./workbenchModel";

const contextTabs = [
  ["opl-files-panel", "Files"],
  ["opl-skills-panel", "Skills"],
  ["opl-routing-panel", "Routing"],
  ["opl-memory-panel", "Memory"],
  ["opl-always-on-panel", "Always-On"],
  ["opl-runtime-summary", "Runtime"],
  ["opl-settings-panel", "Settings"]
] as const;

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
  const [lastDryRun, setLastDryRun] = useState("No dry-run request yet.");

  function runDryRun(actionId: string, payload: Record<string, unknown> = {}) {
    void bridge
      .executeAction({ actionId, payload, dryRun: true })
      .then((receipt) => setLastDryRun(formatReceipt(receipt)))
      .catch((error) => setLastDryRun(formatReceipt({ actionId, dryRun: true, error: String(error) })));
  }

  return (
    <main data-testid="opl-native-workbench-root" className="opl-native-workbench">
      <PanelGroup direction="horizontal" className="workbench-shell">
        <Panel defaultSize={18} minSize={14} order={1}>
          <aside data-testid="opl-workspace-rail" className="workspace-rail" aria-label="Workspaces">
            <header>
              <button type="button" onClick={() => runDryRun("candidate.workspace.refresh")}>
                <GitBranch aria-hidden="true" size={16} />
                Workspace
              </button>
              <StatusPill status="non_live_candidate" />
            </header>
            <ol data-testid="opl-session-list">
              {model.sessions.map((session) => (
                <li key={session.id}>
                  <strong>{session.workspace}</strong>
                  <span>{session.session}</span>
                  <small>{session.nextStep}</small>
                </li>
              ))}
            </ol>
          </aside>
        </Panel>

        <PanelResizeHandle aria-label="Resize workspace rail" />

        <Panel defaultSize={54} minSize={36} order={2}>
          <section className="chat-canvas" aria-label="Conversation">
            <header className="topbar">
              <button data-testid="opl-locale-toggle" type="button">中 / EN</button>
              <span data-testid="opl-model-access-entry">gpt-5.5 xhigh</span>
              <button data-testid="opl-skip-to-chat" type="button">Skip to chat</button>
            </header>

            <section className="conversation">
              <article data-testid="opl-conversation-event">
                <h2>OPL Native Workbench</h2>
                <p>Chat-first workbench with results, deliverables, receipts, and refs close to the task.</p>
              </article>

              <section
                data-testid="opl-workbench-delivery-mode"
                className="delivery-workbench delivery-mode"
                aria-label="Delivery mode"
              >
                <div data-testid="opl-delivery-mode">
                  {model.purposes.map((purpose) => (
                    <button
                      key={purpose}
                      data-testid="opl-delivery-mode-option"
                      type="button"
                      onClick={() => runDryRun("candidate.delivery.mode", { purpose })}
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
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

              <section className="delivery-strip" aria-label="Results and delivery">
                {model.results.concat(model.deliverables, model.receipts).map((item) => (
                  <DeliveryCard key={item.id} item={item} />
                ))}
              </section>

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
                    {starter.fields.map((field) => (
                      <label key={field.name}>
                        {field.label}
                        {field.input === "textarea" ? (
                          <textarea name={field.name} defaultValue={field.value} />
                        ) : field.input === "select" ? (
                          <select name={field.name} defaultValue={field.value}>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input name={field.name} defaultValue={field.value} />
                        )}
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => runDryRun(starter.dryRunAction, starterPayload(starter))}
                    >
                      <Send aria-hidden="true" size={16} />
                      Dry-run starter
                    </button>
                  </form>
                ))}
              </section>

              <form className="composer">
                <textarea aria-label="Prompt" placeholder="Ask OPL to produce a result or delivery artifact" />
                <button type="button" onClick={() => runDryRun("candidate.chat.submit", { source: "composer" })}>
                  <Send aria-hidden="true" size={16} />
                  Dry-run chat
                </button>
              </form>
            </section>
          </section>
        </Panel>

        <PanelResizeHandle aria-label="Resize inspector" />

        <Panel defaultSize={28} minSize={22} order={3}>
          <aside className="context-inspector" aria-label="Context inspector">
            <nav data-testid="opl-context-tabs">
              {contextTabs.map(([testId, label]) => (
                <button key={testId} type="button">{label}</button>
              ))}
            </nav>

            <Dialog.Root open modal={false}>
              <Dialog.Content data-testid="opl-provenance-drawer" className="provenance-drawer">
                <header>
                  <PanelRightOpen aria-hidden="true" size={18} />
                  <h3>Provenance and actions</h3>
                </header>
                <p data-testid="opl-provenance-ref">
                  Artifact refs, receipt refs, replay refs, and export refs without artifact bodies.
                </p>
                <button
                  data-testid="opl-export-action"
                  type="button"
                  className="export-action"
                  onClick={() => runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
                >
                  <Download aria-hidden="true" size={16} />
                  Prepare export
                </button>
                <button
                  data-testid="opl-export-action-dry-run"
                  type="button"
                  onClick={() => runDryRun("artifact.export.prepare", { refs: model.deliverables.map((item) => item.ref) })}
                >
                  <Download aria-hidden="true" size={16} />
                  Dry-run export
                </button>
                <output data-testid="opl-runtime-action-receipt">{lastDryRun}</output>
              </Dialog.Content>
            </Dialog.Root>

            <ConfirmationCard
              card={model.confirmations[0]!}
              question={model.questions[0]!}
              onDryRun={runDryRun}
            />

            <RendererModuleRegistryPanel />

            <section data-testid="opl-files-panel">
              <h3>Files</h3>
              <p>Refs-only surface backed by OPL App state/action contracts.</p>
            </section>
            <section data-testid="opl-skills-panel">
              <h3>Skills</h3>
              <p>Codex Skill references only; no domain authority is owned here.</p>
            </section>
            <section data-testid="opl-routing-panel">
              <h3>Routing</h3>
              <p>Route suggestions remain App-owned refs and dry-run actions.</p>
            </section>
            <section data-testid="opl-memory-panel">
              <h3>Memory</h3>
              <p>Memory refs are shown without owning memory body truth.</p>
            </section>
            <section data-testid="opl-always-on-panel">
              <h3>Always-On</h3>
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
                Dry run
              </button>
            </section>
            <div data-testid="opl-web-transport">window.oplNativeWorkbench / SSE /api/opl-events</div>
            <div data-testid="opl-event-feed">tool process diff file receipt user_input permission</div>
          </aside>
        </Panel>
      </PanelGroup>
    </main>
  );
}

export default App;
