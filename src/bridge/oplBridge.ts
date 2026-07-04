export type OplStateProfile = "fast" | "full";

export type OplActionRequest = {
  actionId: string;
  payload?: Record<string, unknown>;
  dryRun?: boolean;
};

export const OPL_COMMANDS = {
  fastState: "opl app state --profile fast --json",
  fullState: "opl app state --profile full --json",
  fullDrilldown: "opl runtime app-operator-drilldown --detail full --json",
  actionPrefix: "opl app action execute --action"
} as const;

export type OplBridge = {
  readState(profile?: OplStateProfile): Promise<unknown>;
  readFullDrilldown(): Promise<unknown>;
  executeAction(request: OplActionRequest): Promise<unknown>;
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
    subscribeEvents(onEvent) {
      if (candidate?.subscribeEvents) return candidate.subscribeEvents(onEvent);
      onEvent({ type: "bridge.ready", source: "browser-placeholder" });
      return () => undefined;
    }
  };
}
