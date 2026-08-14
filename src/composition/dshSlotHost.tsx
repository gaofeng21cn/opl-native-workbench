import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Folder, PanelRight, Settings as SettingsIcon, X } from "lucide-react";
import {
  SlotCore,
  type HostObservable,
  type SessionMaybeProvideInfo,
  type SlotRendererHost
} from "@deepseek-ai/dsh-client-ui-slots";
import { createSlotRenderer } from "@deepseek-ai/dsh-client-web-react";
import { AppFrame } from "@opl-vendor/dsh-app-frame";
import { SidebarRoot } from "@opl-vendor/dsh-sidebar-root";
import { ConversationRoot } from "@opl-vendor/dsh-conversation-root";
import { InputBar } from "@opl-vendor/dsh-input-bar";
import { SettingsRoot } from "@opl-vendor/dsh-settings-root";
import App from "../workbench/App";
import { ProjectedContribution } from "./contributionComponents";
import {
  OPL_UI_CONTRIBUTION_SLOTS,
  contributionLabel,
  type OplUiContribution,
  type OplUiContributionsProjection,
  type OplUiContributionSlot
} from "./contributionProjection";
import type { OplStudioSurface } from "./oplStudioSurface";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface SlotMap {
    root: { kind: "single"; scope: "root" };
    sidebar: { kind: "single"; scope: "root"; owner: { collapsed: boolean; width: number } };
    conversation: { kind: "single"; scope: "root"; owner: object };
    details: { kind: "single"; scope: "root"; owner: object };
    "shell.overlay": { kind: "list"; scope: "root"; owner: object };
    "sidebar.workspaces": { kind: "single"; scope: "root"; owner: { wide: boolean; expandSidebar(): void } };
    "sidebar.settings": { kind: "single"; scope: "root"; owner: { wide: boolean } };
    "sidebar.footer.action": { kind: "list"; scope: "root"; owner: { wide: boolean } };
    "conversation.session.header": { kind: "single"; scope: "root"; owner: object };
    "conversation.session": { kind: "single"; scope: "root"; owner: object };
    "conversation.composer.bar": { kind: "single"; scope: "root"; owner: Record<string, unknown> };
    "conversation.input.overlay": { kind: "single"; scope: "root"; owner: object };
    "conversation.input.left": { kind: "list"; scope: "root"; owner: object };
    "conversation.input.right": { kind: "list"; scope: "root"; owner: object };
    "conversation.input.plan": { kind: "single"; scope: "root"; owner: object };
    "conversation.input.model": { kind: "single"; scope: "root"; owner: object };
    "conversation.input.dock": { kind: "list"; scope: "root"; owner: object };
    "conversation.composer.dock": { kind: "list"; scope: "root"; owner: object };
    "conversation.hero.workspace": { kind: "single"; scope: "root"; owner: object };
    "conversation.hero.agentPreset": { kind: "single"; scope: "root"; owner: object };
    "settings.trigger": { kind: "single"; scope: "root"; owner: { wide: boolean } };
    "settings.header": { kind: "single"; scope: "root"; owner: object };
    "settings.action": { kind: "list"; scope: "root"; owner: object };
    "settings.close": { kind: "single"; scope: "root"; owner: object };
    "settings.section": { kind: "list"; scope: "root"; owner: object };
    "settings.onboarding": { kind: "list"; scope: "root"; owner: object };
    "composer.palette": { kind: "list"; scope: "root"; owner: object };
    "runtime.detail": { kind: "list"; scope: "root"; owner: object };
  }
}

const emptyArraySnapshot = Object.freeze([]) as readonly unknown[];
const noSessionSnapshot: SessionMaybeProvideInfo = Object.freeze({ sessionId: undefined, hooks: Object.freeze({}), props: Object.freeze({}) });

function constantObservable<T>(snapshot: T): HostObservable<T> {
  return { getSnapshot: () => snapshot, subscribe: () => () => undefined };
}

type ActiveRegistration = { fingerprint: string; dispose(): void };
type StudioContextValue = OplStudioSurface & {
  narrow: boolean;
  detailsOpen: boolean;
  toggleSidebar(): void;
  toggleDetails(): void;
  closeDetails(): void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("OPL Studio DSH slot rendered outside the Studio surface");
  return value;
}

function translate(locale: "zh" | "en", key: string, params?: Record<string, unknown>): string {
  const copy: Record<string, [string, string]> = {
    "session.new.label": ["新建任务", "New task"], "session.new": ["新建任务", "New task"],
    "toggle.open": ["展开侧栏", "Expand sidebar"], "toggle.collapse": ["收起侧栏", "Collapse sidebar"],
    "hero.headline": ["今天要推进什么？", "What will you move forward today?"], "hero.preview": ["OPL Studio", "OPL Studio"],
    "hero.chooseWorkspace": ["选择工作区", "Choose workspace"], "placeholder.workspace": ["先选择工作区", "Choose a workspace first"],
    "placeholder.hero": ["向 OPL 描述你的目标", "Describe your goal to OPL"], "placeholder.default": ["向 OPL 描述你的目标", "Describe your goal to OPL"],
    "placeholder.unavailable": ["当前不可输入", "Input unavailable"], "placeholder.parentOffline": ["父任务当前离线", "Parent task is offline"],
    "placeholder.steerQueue": ["输入后续指令", "Add a follow-up"], "placeholder.plan": ["描述计划", "Describe the plan"],
    "input.commands": ["添加文件、Skill 或模块", "Add files, Skills, or modules"], "input.send": ["发送", "Send"], "input.stop": ["停止", "Stop"],
    "input.accessMode": ["权限：{name}", "Access: {name}"], "context.aria": ["上下文已用 {percent}", "{percent} of context used"],
    "context.used": ["上下文用量", "Context usage"], "context.system": ["系统", "System"], "context.tools": ["工具", "Tools"], "context.messages": ["消息", "Messages"],
    "access.confirm.title": ["启用完整权限", "Enable full access"], "access.confirm.description": ["完整权限允许任务修改本机文件。", "Full access allows the task to modify local files."],
    "access.confirm.acknowledge": ["我了解此权限", "I understand this access"], "access.confirm.cancel": ["取消", "Cancel"], "access.confirm.enable": ["启用", "Enable"]
  };
  let value = copy[key]?.[locale === "zh" ? 0 : 1] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function StudioFrame({ surface, renderSlot }: { surface: OplStudioSurface; renderSlot: any }) {
  const [panels, setPanels] = useState({ sidebar: 280, details: 0, narrow: false, narrowExpanded: false });
  const actions = useMemo(() => ({
    setSidebar: (px: number) => setPanels((current) => ({ ...current, sidebar: Math.min(420, Math.max(264, px)) })),
    setDetails: (px: number) => setPanels((current) => ({ ...current, details: Math.min(520, Math.max(300, px)) })),
    toggleSidebar: () => setPanels((current) => current.narrow ? { ...current, narrowExpanded: !current.narrowExpanded } : { ...current, sidebar: current.sidebar === 0 ? 280 : 0 }),
    setNarrow: (narrow: boolean) => setPanels((current) => current.narrow === narrow ? current : { ...current, narrow, narrowExpanded: false }),
    openDetails: () => setPanels((current) => ({ ...current, details: current.details || 360 })),
    closeDetails: () => setPanels((current) => ({ ...current, details: 0 }))
  }), []);
  const sessions = { phase: "ready", current: "opl-current", byId: { "opl-current": { blank: false, cwd: surface.workspacePath } } };
  const value = useMemo(() => ({
    ...surface,
    narrow: panels.narrow,
    detailsOpen: panels.details > 0,
    toggleSidebar: actions.toggleSidebar,
    toggleDetails: () => setPanels((current) => ({ ...current, details: current.details === 0 ? 360 : 0 })),
    closeDetails: actions.closeDetails
  }), [actions, panels.details, panels.narrow, surface]);
  const lastDetailsRequest = useRef(surface.detailsRequestRevision);
  useEffect(() => {
    if (lastDetailsRequest.current === surface.detailsRequestRevision) return;
    lastDetailsRequest.current = surface.detailsRequestRevision;
    actions.openDetails();
  }, [actions, surface.detailsRequestRevision]);
  return (
    <StudioContext.Provider value={value}>
      <main data-testid="opl-studio-root" className="opl-studio-dsh-root codex-sidebar-chat with-rail without-inspector">
        <AppFrame
          useStore={(selector: (state: typeof panels) => unknown) => selector(panels)}
          useSessions={(selector: (state: typeof sessions) => unknown) => selector(sessions)}
          actions={actions}
          renderSlot={renderSlot}
        />
      </main>
    </StudioContext.Provider>
  );
}

function OplStudioRoot({ renderSlot }: { renderSlot: any }) {
  return <App renderShell={(surface) => <StudioFrame surface={surface} renderSlot={renderSlot} />} renderContributionSlot={(slot, owner) => renderSlot(slot, owner)} onUiContributionsChange={(projection) => slotHost.replaceProjection(projection)} onUiContributionsDispose={() => slotHost.clearProjection()} />;
}

function SidebarSlot({ collapsed, width, renderSlot }: { collapsed: boolean; width: number; renderSlot: any }) {
  const studio = useStudio();
  return <SidebarRoot collapsed={collapsed} width={width} startSession={studio.startSession} toggleSidebar={studio.toggleSidebar} t={(key: string, params?: Record<string, unknown>) => translate(studio.locale, key, params)} renderSlot={renderSlot} />;
}

function SidebarWorkspacesSlot({ wide, expandSidebar }: { wide: boolean; expandSidebar(): void }) {
  const studio = useStudio();
  if (wide) return <>{studio.workspaceRail}</>;
  return <button type="button" className="opl-dsh-rail-browser" aria-label={studio.locale === "zh" ? "展开项目" : "Expand projects"} onClick={expandSidebar}><Folder aria-hidden="true" size={18} /></button>;
}

function ConversationSlot({ renderSlot }: { renderSlot: any }) {
  const studio = useStudio();
  const sessionId = "opl-current";
  const session = { openState: "open", composerPhase: studio.conversationBlank ? "blank" : "active", pending: [], promptError: null, running: studio.sending, subagent: null, removed: false };
  const sessions = { phase: "ready", current: sessionId, byId: { [sessionId]: { blank: studio.conversationBlank, cwd: studio.workspacePath } } };
  const workspaces = { phase: "ready", items: [{ workspaceId: "opl-workspace", title: studio.projectTitle, sessionIds: [sessionId] }] };
  const input = { draft: studio.prompt, imageIds: [], draftRev: studio.promptRevision, phase: "plain", occurrences: [], queue: [] };
  return <ConversationRoot sessionId={sessionId} useSession={(selector: any) => selector(session)} useSessions={(selector: any) => selector(sessions)} useWorkspaces={(selector: any) => selector(workspaces)} useInput={(selector: any) => selector(input)} useComposerBlock={(selector: any) => selector(undefined)} renderSlot={renderSlot} renderSlotChain={(_key: string, _owner: unknown, options: { fallback: ReactNode }) => options.fallback} selectWorkspace={async () => undefined} t={(key: string, params?: Record<string, unknown>) => translate(studio.locale, key, params)} />;
}

function ConversationHeaderSlot() {
  const studio = useStudio();
  const label = studio.locale === "zh" ? "打开详细信息" : "Open details";
  return <div className="opl-dsh-conversation-header">{studio.conversationHeader}<button type="button" aria-label={label} title={label} onClick={studio.toggleDetails}><PanelRight aria-hidden="true" size={16} /></button></div>;
}

function ConversationBodySlot() { return <>{useStudio().conversationBody}</>; }
function HeroActionsSlot() { return <>{useStudio().heroActions}</>; }
function ComposerOverlaySlot() { return <>{useStudio().composerOverlay}</>; }
function ComposerModelSlot() { return <>{useStudio().composerModelControls}</>; }

function InputBarSlot({ renderSlot, ...owner }: Record<string, any>) {
  const studio = useStudio();
  const input = { draft: studio.prompt, imageIds: [], draftRev: studio.promptRevision, phase: "plain", occurrences: [], queue: [] };
  const keyboard = {
    snapshot: input, setDraft: studio.updatePrompt, submit: studio.submitPrompt, steerQueue: () => undefined,
    undo: () => undefined, redo: () => undefined,
    pasteBegin: (text: string, selection: { start: number; end: number }) => studio.updatePrompt(`${studio.prompt.slice(0, selection.start)}${text}${studio.prompt.slice(selection.end)}`),
    invalidatePaste: () => undefined, track: () => undefined, arbitrate: () => "pass", space: () => false, dismissPopup: () => undefined
  };
  return <InputBar {...owner} sessionId="opl-current" useSession={(selector: any) => selector({ promptError: null, running: studio.sending, subagent: null, removed: false })} useInput={(selector: any) => selector(input)} inputActions={{ setDraft: studio.updatePrompt, addImages: () => false, removeImage: () => undefined, pruneImages: () => undefined, submit: studio.submitPrompt }} keyboard={keyboard} draftImages={() => []} resolveSubmitMode={() => "append"} toggleCommandMenu={studio.openComposerPalette} stop={studio.stopTurn} t={(key: string, params?: Record<string, unknown>) => translate(studio.locale, key, params)} renderSlot={renderSlot} useNotices={(selector: any) => selector(null)} useLexicon={(selector: any) => selector(new Map())} useMenuLauncher={(selector: any) => selector(undefined)} useProjection={(_key: string, selector?: (value: undefined) => unknown) => selector ? selector(undefined) : undefined} accessory={studio.composerAccessory} />;
}

function DetailsSlot() {
  const studio = useStudio();
  if (studio.narrow) return null;
  return <div className="opl-dsh-details">{studio.details}</div>;
}

function ShellOverlaySlot() {
  const studio = useStudio();
  return <>
    {studio.overlay}
    {studio.narrow && studio.detailsOpen ? (
      <section className="opl-mobile-details-overlay" aria-label={studio.locale === "zh" ? "任务详情" : "Task details"}>
        <header>
          <strong>{studio.locale === "zh" ? "任务详情" : "Task details"}</strong>
          <button type="button" aria-label={studio.locale === "zh" ? "关闭详情" : "Close details"} onClick={studio.closeDetails}><X aria-hidden="true" size={18} /></button>
        </header>
        <div className="opl-mobile-details-body">{studio.details}</div>
      </section>
    ) : null}
  </>;
}

function SettingsSlot({ wide, renderSlot }: { wide: boolean; renderSlot: any }) {
  const studio = useStudio();
  const contributionRows = studio.uiContributions.entries.filter((entry) => entry.slot === "settings.section").map((entry) => ({ id: entry.contributionKey, order: entry.sortOrder, label: entry.view ? contributionLabel(entry.view.title, studio.locale, entry.contributionId) : entry.contributionId }));
  const rows = [{ id: "opl-studio-settings", order: 0, label: studio.locale === "zh" ? "OPL 设置" : "OPL Settings" }, ...contributionRows];
  const sessions = { phase: "ready", current: "opl-current", byId: { "opl-current": { blank: false } } };
  return <SettingsRoot wide={wide} useSections={(selector: any) => selector(rows)} useOnboardingSteps={(selector: any) => selector([])} useSessions={(selector: any) => selector(sessions)} renderSlot={renderSlot} />;
}

function SettingsTriggerSlot({ wide }: { wide: boolean }) {
  const studio = useStudio();
  return <><SettingsIcon aria-hidden="true" size={16} />{wide ? <span>{studio.locale === "zh" ? "设置" : "Settings"}</span> : null}</>;
}

function SettingsHeaderSlot() { return <>OPL Studio</>; }
function SettingsCloseSlot() { return <>{useStudio().locale === "zh" ? "关闭" : "Close"}</>; }
function SettingsMainSlot() { return <>{useStudio().settings}</>; }

export class OplStudioDshSlotHost {
  readonly core = new SlotCore();
  private readonly renderer = createSlotRenderer();
  private readonly registrations = new Map<string, ActiveRegistration>();
  private readonly host: SlotRendererHost;

  constructor() {
    this.host = {
      subscribe: (key, listener) => this.core.subscribe(key, listener), getVersion: (key) => this.core.getVersion(key),
      entriesOf: (key) => this.core.entries(key), entriesOfSlot: (key) => this.core.entriesOfSlot(key),
      reportEntryError: (key, entry, error, info) => this.core.reportEntryError(key, entry, error, info), specOf: (key) => this.core.specDynamic(key),
      isLive: (entry) => this.core.isLive(entry), storeOf: () => undefined,
      sessions: { list: constantObservable(emptyArraySnapshot), provideInfo: constantObservable(noSessionSnapshot) }, workspaces: { list: constantObservable(emptyArraySnapshot) }
    };
    this.core.onEntryError((key, entry, error) => console.error("OPL Studio UI slot failed", { slot: key, registrant: entry.registrant, error }));
    this.registerStaticSlots();
  }

  private registerStaticSlots() {
    const register = (spec: Record<string, unknown>, component: unknown) => this.core.register(spec as any, component as any);
    register({ name: "root", registrant: "opl-studio", children: { sidebar: { kind: "single", scope: "root" }, conversation: { kind: "single", scope: "root" }, details: { kind: "single", scope: "root" }, "shell.overlay": { kind: "list", scope: "root" }, "composer.palette": { kind: "list", scope: "root" } } }, OplStudioRoot);
    register({ name: "sidebar", registrant: "dsh-ui-sidebar", children: { "sidebar.workspaces": { kind: "single", scope: "root" }, "sidebar.settings": { kind: "single", scope: "root" }, "sidebar.footer.action": { kind: "list", scope: "root" } } }, SidebarSlot);
    register({ name: "sidebar.workspaces", registrant: "opl-studio" }, SidebarWorkspacesSlot);
    register({ name: "sidebar.settings", registrant: "dsh-ui-settings", children: { "settings.trigger": { kind: "single", scope: "root" }, "settings.header": { kind: "single", scope: "root" }, "settings.action": { kind: "list", scope: "root" }, "settings.close": { kind: "single", scope: "root" }, "settings.section": { kind: "list", scope: "root" }, "settings.onboarding": { kind: "list", scope: "root" } } }, SettingsSlot);
    register({ name: "settings.trigger", registrant: "opl-studio" }, SettingsTriggerSlot);
    register({ name: "settings.header", registrant: "opl-studio" }, SettingsHeaderSlot);
    register({ name: "settings.close", registrant: "opl-studio" }, SettingsCloseSlot);
    register({ name: "settings.section", id: "opl-studio-settings", order: 0, label: "OPL Settings", registrant: "opl-studio" }, SettingsMainSlot);
    register({ name: "conversation", registrant: "dsh-ui-conversation", children: { "conversation.session.header": { kind: "single", scope: "root" }, "conversation.session": { kind: "single", scope: "root" }, "conversation.composer.bar": { kind: "single", scope: "root" }, "conversation.input.overlay": { kind: "single", scope: "root" }, "conversation.input.left": { kind: "list", scope: "root" }, "conversation.input.right": { kind: "list", scope: "root" }, "conversation.input.dock": { kind: "list", scope: "root" }, "conversation.composer.dock": { kind: "list", scope: "root" }, "conversation.hero.workspace": { kind: "single", scope: "root" }, "conversation.hero.agentPreset": { kind: "single", scope: "root" } } }, ConversationSlot);
    register({ name: "conversation.session.header", registrant: "opl-studio" }, ConversationHeaderSlot);
    register({ name: "conversation.session", registrant: "opl-studio" }, ConversationBodySlot);
    register({ name: "conversation.input.overlay", registrant: "opl-studio" }, ComposerOverlaySlot);
    register({ name: "conversation.composer.bar", registrant: "dsh-ui-conversation", children: { "conversation.input.plan": { kind: "single", scope: "root" }, "conversation.input.model": { kind: "single", scope: "root" } } }, InputBarSlot);
    register({ name: "conversation.input.model", registrant: "opl-studio" }, ComposerModelSlot);
    register({ name: "conversation.hero.agentPreset", registrant: "opl-studio" }, HeroActionsSlot);
    register({ name: "details", registrant: "opl-studio", children: { "runtime.detail": { kind: "list", scope: "root" } } }, DetailsSlot);
    register({ name: "shell.overlay", id: "opl-studio-overlay", order: 0, registrant: "opl-studio" }, ShellOverlaySlot);
  }

  renderRoot() { return this.renderer.renderRoot(this.host, {}); }

  replaceProjection(projection: OplUiContributionsProjection) {
    const next = new Map(projection.entries.map((entry) => [entry.contributionKey, entry]));
    for (const [key, active] of this.registrations) {
      const entry = next.get(key); const fingerprint = entry ? JSON.stringify(entry) : null;
      if (!entry || fingerprint !== active.fingerprint) { active.dispose(); this.registrations.delete(key); }
    }
    for (const entry of projection.entries) if (!this.registrations.has(entry.contributionKey)) this.registerContribution(entry);
  }

  clearProjection() { for (const active of this.registrations.values()) active.dispose(); this.registrations.clear(); }

  private registerContribution(entry: OplUiContribution) {
    const fingerprint = JSON.stringify(entry);
    const Component = () => { const studio = useStudio(); return <ProjectedContribution entry={entry} owner={studio.contributionOwner} />; };
    const dispose = this.core.register({ name: entry.slot, id: entry.contributionKey, order: entry.sortOrder, label: entry.contributionId, registrant: entry.packageId } as any, Component as any);
    this.registrations.set(entry.contributionKey, { fingerprint, dispose });
  }
}

const slotHost = new OplStudioDshSlotHost();

export function renderOplStudioRoot() { return slotHost.renderRoot(); }
export function clearOplStudioContributionProjection() { slotHost.clearProjection(); }
export function dshSlotSnapshot(slot?: OplUiContributionSlot) { return slotHost.core.snapshot(slot); }
export { OPL_UI_CONTRIBUTION_SLOTS };
