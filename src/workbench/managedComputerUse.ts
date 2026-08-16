const MANAGED_COMPUTER_USE_SURFACE_KIND = "opl_managed_computer_use_projection";

export const MANAGED_COMPUTER_USE_ACTION_IDS = [
  "settings_request_computer_use_permissions",
  "settings_recheck_computer_use",
  "settings_repair_computer_use",
  "settings_reinstall_computer_use"
] as const;

export type ManagedComputerUseActionId = (typeof MANAGED_COMPUTER_USE_ACTION_IDS)[number];

export type ManagedComputerUseAction = {
  actionId: ManagedComputerUseActionId;
  label: string;
  confirmationRequired: boolean;
  dangerLevel?: string;
};

export type ManagedComputerUseViewModel = {
  providerId: string;
  productName: string;
  version?: string;
  status: string;
  ready: boolean;
  installed: boolean;
  registered: boolean;
  enabled: boolean;
  permission: string;
  healthRef?: string;
  actions: ManagedComputerUseAction[];
};

const managedComputerUseActionIds = new Set<string>(MANAGED_COMPUTER_USE_ACTION_IDS);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function appStateRecord(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value);
  const first = asRecord(root?.app_state) ?? root;
  return asRecord(first?.app_state) ?? first;
}

export function isManagedComputerUseActionId(value: string): value is ManagedComputerUseActionId {
  return managedComputerUseActionIds.has(value);
}

export function readManagedComputerUse(value: unknown): ManagedComputerUseViewModel | null {
  const appState = appStateRecord(value);
  if (!appState || !Array.isArray(appState.managed_companions)) return null;

  const companion = appState.managed_companions
    .map(asRecord)
    .find((entry) => asString(entry?.surface_kind) === MANAGED_COMPUTER_USE_SURFACE_KIND);
  const providerId = asString(companion?.provider_id);
  const productName = asString(companion?.product_name);
  if (!companion || !providerId || !productName) return null;

  const actionCatalog = new Map(
    (Array.isArray(appState.actions) ? appState.actions : []).flatMap((value): [string, Record<string, unknown>][] => {
      const action = asRecord(value);
      const actionId = asString(action?.action_id);
      return action && actionId ? [[actionId, action]] : [];
    })
  );

  const actions = (Array.isArray(companion.available_actions) ? companion.available_actions : [])
    .flatMap((value): ManagedComputerUseAction[] => {
      const actionId = asString(value);
      if (!actionId || !isManagedComputerUseActionId(actionId)) return [];
      const action = actionCatalog.get(actionId);
      if (
        !action
        || asString(action.surface) !== "opl app action execute"
        || asString(action.submit_via) !== "opl app action execute"
        || action.can_submit_to_safe_action_shell !== true
        || action.route_requires_domain_or_app_payload !== false
        || !Array.isArray(action.payload_fields)
        || action.payload_fields.length !== 0
      ) return [];
      const dangerLevel = asString(action.danger_level);
      return [{
        actionId,
        label: asString(action.label) ?? actionId,
        confirmationRequired: action.confirmation_required === true,
        ...(dangerLevel ? { dangerLevel } : {})
      }];
    });

  const version = asString(companion.version);
  const healthRef = asString(companion.health_ref);
  return {
    providerId,
    productName,
    ...(version ? { version } : {}),
    status: asString(companion.status) ?? "unknown",
    ready: companion.ready === true,
    installed: companion.installed === true,
    registered: companion.registered === true,
    enabled: companion.enabled === true,
    permission: asString(companion.permission) ?? "unknown",
    ...(healthRef ? { healthRef } : {}),
    actions
  };
}
