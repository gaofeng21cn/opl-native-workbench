export type OplStateProfile = "fast" | "full";

export type OplActionMode = "preview" | "execute" | "rollback";
export type OplActionReceiptKind = OplActionMode | "confirmation_required";

export type OplActionPayload = Record<string, unknown> & {
  confirmed?: boolean;
  confirmationId?: string;
  receiptId?: string;
  rollbackRef?: string;
};

export type OplActionRequest = {
  actionId: string;
  mode?: OplActionMode;
  payload?: OplActionPayload;
  dryRun?: boolean;
};

export type OplActionReceipt = {
  actionId: string;
  dryRun: boolean;
  confirmationRequired: boolean;
  canExecute: boolean;
  receiptKind: OplActionReceiptKind;
  authorityBoundary: "app_bridge_no_domain_authority";
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  confirmationId?: string;
  receiptId?: string;
  rollbackRef?: string;
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
  executeAction(request: OplActionRequest): Promise<OplActionReceipt>;
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
        actionId: request.actionId,
        command: buildActionCommand(request),
        dryRun: request.dryRun !== false,
        confirmationRequired: request.dryRun === false ? request.payload?.confirmed !== true : true,
        canExecute: request.dryRun === false ? request.payload?.confirmed === true : true,
        receiptKind: request.dryRun === false && request.payload?.confirmed !== true
          ? "confirmation_required"
          : request.mode ?? (request.payload?.rollbackRef ? "rollback" : request.dryRun === false ? "execute" : "preview"),
        authorityBoundary: "app_bridge_no_domain_authority",
        exitCode: request.dryRun === false && request.payload?.confirmed !== true ? -1 : 0,
        stdout: "",
        stderr: request.dryRun === false && request.payload?.confirmed !== true ? "confirmation_required" : "",
        timedOut: false,
        confirmationId: request.payload?.confirmationId,
        receiptId: request.payload?.receiptId,
        rollbackRef: request.payload?.rollbackRef
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
