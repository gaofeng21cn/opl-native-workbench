export type OplStateProfile = "fast" | "full";

export type OplActionRequest = {
  actionId: string;
  payload?: Record<string, unknown>;
  dryRun?: boolean;
};

export type CodexMessageRequest = {
  prompt: string;
  threadId?: string;
};

export const OPL_COMMANDS = {
  fastState: "opl app state --profile fast --json",
  fullState: "opl app state --profile full --json",
  fullDrilldown: "opl runtime app-operator-drilldown --detail full --json",
  actionPrefix: "opl app action execute --action"
} as const;

export const CODEX_APP_SERVER = {
  transport: "codex app-server --stdio",
  threadStart: "thread/start",
  turnStart: "turn/start",
  resume: "thread/resume",
  streamEvent: "item/agentMessage/delta",
  itemCompleted: "item/completed",
  turnCompleted: "turn/completed",
  defaultSandbox: "read-only",
  approvalPolicy: "never",
  requestTimeoutSeconds: 45,
  turnTimeoutSeconds: 180
} as const;

export type OplBridge = {
  readState(profile?: OplStateProfile): Promise<unknown>;
  readFullDrilldown(): Promise<unknown>;
  executeAction(request: OplActionRequest): Promise<unknown>;
  sendMessage(request: CodexMessageRequest): Promise<unknown>;
  subscribeEvents(onEvent: (event: unknown) => void): () => void;
};

export function buildActionCommand(request: OplActionRequest): string {
  const payload = request.payload ? ` --payload '${JSON.stringify(request.payload)}'` : "";
  const dryRun = request.dryRun === false ? "" : " --dry-run";
  return `${OPL_COMMANDS.actionPrefix} ${request.actionId}${payload}${dryRun} --json`;
}

export function createBrowserBridge(): OplBridge {
  const candidate = (globalThis as Record<string, any>).window?.oplNativeWorkbench;
  return {
    readState(profile = "fast") {
      return candidate?.readState?.(profile) ?? Promise.resolve({ profile, source: OPL_COMMANDS.fastState });
    },
    readFullDrilldown() {
      return candidate?.readFullDrilldown?.() ?? Promise.resolve({ source: OPL_COMMANDS.fullDrilldown });
    },
    executeAction(request) {
      return candidate?.executeAction?.(request) ?? Promise.resolve({
        command: buildActionCommand(request),
        dryRun: request.dryRun !== false
      });
    },
    sendMessage(request) {
      return candidate?.sendMessage?.(request) ?? Promise.resolve({
        command: CODEX_APP_SERVER.transport,
        threadStart: CODEX_APP_SERVER.threadStart,
        turnStart: CODEX_APP_SERVER.turnStart,
        resume: CODEX_APP_SERVER.resume,
        streamEvent: CODEX_APP_SERVER.streamEvent,
        itemCompleted: CODEX_APP_SERVER.itemCompleted,
        turnCompleted: CODEX_APP_SERVER.turnCompleted,
        defaultSandbox: CODEX_APP_SERVER.defaultSandbox,
        approvalPolicy: CODEX_APP_SERVER.approvalPolicy,
        prompt: request.prompt,
        executor: "codex_app_server",
        simulated: true
      });
    },
    subscribeEvents(onEvent) {
      if (candidate?.subscribeEvents) return candidate.subscribeEvents(onEvent);
      onEvent({ type: "bridge.ready", source: "browser-placeholder" });
      return () => undefined;
    }
  };
}
