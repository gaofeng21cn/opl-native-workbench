import { createBrowserBridge } from "../bridge/oplBridge";
import { initialWorkbenchModel } from "./workbenchModel";

const contextTabs = [
  ["opl-files-panel", "Files"],
  ["opl-skills-panel", "Skills"],
  ["opl-routing-panel", "Routing"],
  ["opl-memory-panel", "Memory"],
  ["opl-always-on-panel", "Always-On"],
  ["opl-runtime-summary", "Runtime"],
  ["opl-settings-panel", "Settings"]
] as const;

export function App() {
  const bridge = createBrowserBridge();
  const model = initialWorkbenchModel;

  return (
    <main data-testid="opl-native-workbench-root" className="opl-native-workbench">
      <aside data-testid="opl-workspace-rail" className="workspace-rail" aria-label="Workspaces">
        <button type="button">Workspace</button>
        <ol data-testid="opl-session-list">
          <li>Current conversation</li>
          <li>Delivery review</li>
        </ol>
      </aside>

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
          <section className="delivery-strip" aria-label="Results and delivery">
            {model.results.concat(model.deliverables, model.receipts).map((item) => (
              <button key={item.id} type="button" data-kind={item.kind}>
                {item.title}
              </button>
            ))}
          </section>
          <form className="composer">
            <button type="button">Research</button>
            <button type="button">Grant</button>
            <button type="button">Presentation</button>
            <textarea aria-label="Prompt" placeholder="Ask OPL to produce a result or delivery artifact" />
          </form>
        </section>
      </section>

      <aside className="context-inspector" aria-label="Context inspector">
        <nav data-testid="opl-context-tabs">
          {contextTabs.map(([testId, label]) => (
            <button key={testId} type="button">{label}</button>
          ))}
        </nav>
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
            onClick={() => bridge.readFullDrilldown()}
          >
            Full drilldown
          </button>
          <button
            data-testid="opl-runtime-action-dry-run"
            type="button"
            onClick={() => bridge.executeAction({ actionId: "candidate.inspect", dryRun: true })}
          >
            Dry run
          </button>
          <output data-testid="opl-runtime-action-receipt">dry-run first</output>
        </section>
        <div data-testid="opl-web-transport">window.oplNativeWorkbench / SSE /api/opl-events</div>
        <div data-testid="opl-event-feed">tool process diff file receipt user_input permission</div>
      </aside>
    </main>
  );
}

export default App;
