export const OPL_UI_CONTRIBUTION_SLOTS = [
  "composer.palette",
  "runtime.detail",
  "settings.section"
] as const;

export type OplUiContributionSlot = (typeof OPL_UI_CONTRIBUTION_SLOTS)[number];
export type OplStudioLocale = "zh" | "en";

export type OplUiLocalizedText = Record<string, string>;

export type OplUiContributionCommand = {
  commandId: string;
  label: OplUiLocalizedText;
  actionRef: string;
  confirmationRequired: boolean;
};

export type OplContributionInput = Record<string, unknown>;

export type OplChannelAccessAction = {
  commandId: string;
  input: OplContributionInput;
};

export type OplChannelAccessConnection = {
  state: "disconnected" | "connecting" | "qr_ready" | "qr_scanned" | "connected" | "attention";
  accountDisplayName?: string;
  reasonCode?: string;
  qrChallenge?: {
    payload: string;
    expiresAtMs: number;
  };
};

export type OplChannelAccessPairing = {
  pairingId: string;
  platformUserId?: string;
  displayName?: string;
  requestedAtMs: number;
  expiresAtMs: number;
  actions: OplChannelAccessAction[];
};

export type OplChannelAccessUser = {
  userId: string;
  platformUserId?: string;
  displayName?: string;
  authorizedAtMs: number;
  lastActiveAtMs?: number;
  actions: OplChannelAccessAction[];
};

export type OplChannelAccessResult = {
  schemaVersion: "opl-app-channel-access.v1";
  status: "available" | "unavailable";
  channelId: string;
  unavailableReason?: string;
  connection?: OplChannelAccessConnection;
  actions: OplChannelAccessAction[];
  pendingPairings: OplChannelAccessPairing[];
  authorizedUsers: OplChannelAccessUser[];
  refreshAfterMs?: number;
};

export type OplUiContributionBadge = {
  badgeId: string;
  label: OplUiLocalizedText;
  dataRef: string;
  tone: string;
};

export type OplUiContributionView = {
  viewId: string;
  viewType: string;
  title: OplUiLocalizedText;
  dataRef: string;
  emptyState?: OplUiLocalizedText;
};

export type OplUiContribution = {
  contributionKey: string;
  contributionId: string;
  packageId: string;
  slot: OplUiContributionSlot;
  contributionKind: string;
  trustTier: string;
  scope: string;
  sortOrder: number;
  view?: OplUiContributionView;
  commands: OplUiContributionCommand[];
  badges: OplUiContributionBadge[];
};

export type OplUiContributionsProjection = {
  surfaceKind: "opl_app_ui_contributions_projection.v1" | "unavailable";
  entries: OplUiContribution[];
};

/**
 * Settings contributions are placed by their declared view semantics. The
 * client does not inspect package IDs or recreate package-specific policy.
 */
export type OplSettingsContributionDestination = "resources" | "services" | "capabilities";

export function settingsContributionDestination(entry: Pick<OplUiContribution, "view">): OplSettingsContributionDestination {
  switch (entry.view?.viewType) {
    case "channel_access":
      return "resources";
    case "activity_log":
      return "services";
    default:
      return "capabilities";
  }
}

export const emptyUiContributionsProjection: OplUiContributionsProjection = {
  surfaceKind: "unavailable",
  entries: []
};

export type OplContributionAction = (
  entry: OplUiContribution,
  command: OplUiContributionCommand,
  input?: OplContributionInput
) => void;
export type OplContributionActionRequest = {
  actionId: "package_contribution_execute";
  payload: {
    package_id: string;
    ref: string;
    input: Record<string, unknown>;
    confirmed: boolean;
  };
  dryRun: false;
};
export type OplRuntimeDetailIdentity = {
  agentId: string;
  domainId: string;
  workItemId: string;
  domainWorkItemId: string;
  workItemScopeId: string;
  identityState: "resolved";
};
export type OplContributionSlotOwner = {
  locale: OplStudioLocale;
  actionAvailable: boolean;
  runtimeDetailIdentity?: OplRuntimeDetailIdentity;
  readData(entry: OplUiContribution, input?: OplContributionInput): Promise<unknown>;
  refreshRevision: number;
  onAction: OplContributionAction;
};

export function createOplContributionReadInput(
  entry: OplUiContribution,
  identity?: OplRuntimeDetailIdentity
): OplContributionInput | undefined {
  if (entry.slot !== "runtime.detail" || !identity) return undefined;
  return {
    work_item_identity: {
      agent_id: identity.agentId,
      domain_id: identity.domainId,
      work_item_id: identity.workItemId,
      domain_work_item_id: identity.domainWorkItemId,
      work_item_scope_id: identity.workItemScopeId,
      identity_state: identity.identityState
    }
  };
}

export type RenderOplContributionSlot = (
  slot: OplUiContributionSlot,
  owner: OplContributionSlotOwner,
  options?: { only?: string }
) => import("react").ReactNode;

export function createOplContributionActionRequest(
  entry: OplUiContribution,
  command: OplUiContributionCommand,
  confirmed: boolean,
  input: OplContributionInput = {}
): OplContributionActionRequest {
  return {
    actionId: "package_contribution_execute",
    payload: {
      package_id: entry.packageId,
      ref: command.actionRef,
      input,
      confirmed
    },
    dryRun: false
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStableId(value: unknown): string | null {
  const normalized = asString(value);
  return normalized
    && normalized.length <= 128
    && /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(normalized)
    ? normalized
    : null;
}

function asBoundedString(value: unknown, maximum: number): string | null {
  const normalized = asString(value);
  return normalized && normalized.length <= maximum ? normalized : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(record).every((key) => keys.includes(key));
}

function parseChannelAccessInput(
  value: unknown,
  scope: "channel" | "pairing" | "user"
): OplContributionInput | null {
  const input = asRecord(value);
  const channelId = asStableId(input?.channel_id);
  if (!input || !channelId) return null;
  const pairingId = asBoundedString(input.pairing_id, 512);
  const userId = asBoundedString(input.user_id, 512);
  if (scope === "pairing" && pairingId && hasOnlyKeys(input, ["channel_id", "pairing_id"])) {
    return { channel_id: channelId, pairing_id: pairingId };
  }
  if (scope === "user" && userId && hasOnlyKeys(input, ["channel_id", "user_id"])) {
    return { channel_id: channelId, user_id: userId };
  }
  return scope === "channel" && hasOnlyKeys(input, ["channel_id"])
    ? { channel_id: channelId }
    : null;
}

function parseChannelAccessAction(
  value: unknown,
  scope: "channel" | "pairing" | "user"
): OplChannelAccessAction | null {
  const action = asRecord(value);
  const commandId = asStableId(action?.command_id);
  const input = parseChannelAccessInput(action?.input, scope);
  return action && commandId && input && hasOnlyKeys(action, ["command_id", "input"])
    ? { commandId, input }
    : null;
}

function parseChannelAccessActions(
  value: unknown,
  maximum: number,
  scope: "channel" | "pairing" | "user"
): OplChannelAccessAction[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const actions = value.map((action) => parseChannelAccessAction(action, scope));
  if (!actions.every((action): action is OplChannelAccessAction => action !== null)) return null;
  return new Set(actions.map((action) => JSON.stringify(action))).size === actions.length ? actions : null;
}

function parseChannelAccessConnection(value: unknown): OplChannelAccessConnection | null {
  const connection = asRecord(value);
  const state = asString(connection?.state);
  if (
    !connection
    || !hasOnlyKeys(connection, ["state", "account_display_name", "reason_code", "qr_challenge"])
    || !state
    || !["disconnected", "connecting", "qr_ready", "qr_scanned", "connected", "attention"].includes(state)
  ) {
    return null;
  }
  const accountDisplayName = asBoundedString(connection.account_display_name, 256);
  const reasonCode = asStableId(connection.reason_code);
  if (connection.account_display_name !== undefined && !accountDisplayName) return null;
  if (connection.reason_code !== undefined && !reasonCode) return null;
  const qrChallengeRecord = connection.qr_challenge === undefined ? null : asRecord(connection.qr_challenge);
  const qrPayload = asBoundedString(qrChallengeRecord?.payload, 8192);
  const qrExpiresAtMs = asInteger(qrChallengeRecord?.expires_at_ms);
  if (
    connection.qr_challenge !== undefined
    && (
      !qrChallengeRecord
      || !hasOnlyKeys(qrChallengeRecord, ["payload", "expires_at_ms"])
      || !qrPayload
      || qrExpiresAtMs === null
    )
  ) return null;
  return {
    state: state as OplChannelAccessConnection["state"],
    ...(accountDisplayName ? { accountDisplayName } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    ...(qrPayload && qrExpiresAtMs !== null ? { qrChallenge: { payload: qrPayload, expiresAtMs: qrExpiresAtMs } } : {})
  };
}

function parseChannelAccessPairing(value: unknown): OplChannelAccessPairing | null {
  const pairing = asRecord(value);
  if (!pairing || !hasOnlyKeys(pairing, ["pairing_id", "platform_user_id", "display_name", "requested_at_ms", "expires_at_ms", "actions"])) return null;
  const pairingId = asBoundedString(pairing.pairing_id, 512);
  const requestedAtMs = asInteger(pairing?.requested_at_ms);
  const expiresAtMs = asInteger(pairing?.expires_at_ms);
  const actions = parseChannelAccessActions(pairing?.actions, 20, "pairing");
  if (!pairingId || requestedAtMs === null || expiresAtMs === null || actions === null) return null;
  const platformUserId = asBoundedString(pairing.platform_user_id, 512);
  const displayName = asBoundedString(pairing.display_name, 256);
  if (pairing.platform_user_id !== undefined && !platformUserId) return null;
  if (pairing.display_name !== undefined && !displayName) return null;
  return {
    pairingId,
    ...(platformUserId ? { platformUserId } : {}),
    ...(displayName ? { displayName } : {}),
    requestedAtMs,
    expiresAtMs,
    actions
  };
}

function parseChannelAccessUser(value: unknown): OplChannelAccessUser | null {
  const user = asRecord(value);
  if (!user || !hasOnlyKeys(user, ["user_id", "platform_user_id", "display_name", "authorized_at_ms", "last_active_at_ms", "actions"])) return null;
  const userId = asBoundedString(user.user_id, 512);
  const authorizedAtMs = asInteger(user?.authorized_at_ms);
  const actions = parseChannelAccessActions(user?.actions, 20, "user");
  if (!userId || authorizedAtMs === null || actions === null) return null;
  const platformUserId = asBoundedString(user.platform_user_id, 512);
  const displayName = asBoundedString(user.display_name, 256);
  if (user.platform_user_id !== undefined && !platformUserId) return null;
  if (user.display_name !== undefined && !displayName) return null;
  const lastActiveAtMs = user.last_active_at_ms === undefined ? null : asInteger(user.last_active_at_ms);
  if (user.last_active_at_ms !== undefined && lastActiveAtMs === null) return null;
  return {
    userId,
    ...(platformUserId ? { platformUserId } : {}),
    ...(displayName ? { displayName } : {}),
    authorizedAtMs,
    ...(lastActiveAtMs !== null ? { lastActiveAtMs } : {}),
    actions
  };
}

export function readChannelAccessResult(value: unknown): OplChannelAccessResult | null {
  const result = asRecord(value);
  const channelId = asStableId(result?.channel_id);
  const status = asString(result?.status);
  if (
    !result
    || !hasOnlyKeys(result, ["schema_version", "status", "channel_id", "unavailable_reason", "connection", "actions", "pending_pairings", "authorized_users", "refresh_after_ms"])
    || result.schema_version !== "opl-app-channel-access.v1"
    || !channelId
    || !status
  ) return null;
  if (status === "unavailable") {
    const unavailableReason = asStableId(result.unavailable_reason);
    if (!unavailableReason || !hasOnlyKeys(result, ["schema_version", "status", "channel_id", "unavailable_reason"])) {
      return null;
    }
    return {
      schemaVersion: "opl-app-channel-access.v1",
      status,
      channelId,
      unavailableReason,
      actions: [],
      pendingPairings: [],
      authorizedUsers: []
    };
  }
  if (status !== "available") return null;
  const connection = parseChannelAccessConnection(result.connection);
  const actions = parseChannelAccessActions(result.actions, 20, "channel");
  const pairings = Array.isArray(result.pending_pairings) && result.pending_pairings.length <= 100
    ? result.pending_pairings.map(parseChannelAccessPairing)
    : null;
  const users = Array.isArray(result.authorized_users) && result.authorized_users.length <= 100
    ? result.authorized_users.map(parseChannelAccessUser)
    : null;
  if (
    !connection
    || actions === null
    || !pairings
    || pairings.some((pairing) => pairing === null)
    || !users
    || users.some((user) => user === null)
  ) return null;
  if (result.unavailable_reason !== undefined) return null;
  if (new Set(pairings.map((pairing) => JSON.stringify(pairing))).size !== pairings.length) return null;
  if (new Set(users.map((user) => JSON.stringify(user))).size !== users.length) return null;
  const refreshAfterMs = result.refresh_after_ms === undefined ? null : asInteger(result.refresh_after_ms);
  if (result.refresh_after_ms !== undefined && (refreshAfterMs === null || refreshAfterMs < 250 || refreshAfterMs > 60_000)) return null;
  return {
    schemaVersion: "opl-app-channel-access.v1",
    status,
    channelId,
    connection,
    actions,
    pendingPairings: pairings as OplChannelAccessPairing[],
    authorizedUsers: users as OplChannelAccessUser[],
    ...(refreshAfterMs !== null ? { refreshAfterMs } : {})
  };
}

function localizedText(value: unknown): OplUiLocalizedText {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).flatMap(([locale, text]) => {
    const normalized = asString(text);
    return normalized ? [[locale, normalized]] : [];
  }));
}

function parseCommand(value: unknown): OplUiContributionCommand | null {
  const command = asRecord(value);
  const commandId = asString(command?.command_id);
  const actionRef = asString(command?.action_ref);
  if (!commandId || !actionRef) return null;
  return {
    commandId,
    label: localizedText(command?.label_i18n),
    actionRef,
    confirmationRequired: command?.confirmation_required === true
  };
}

function parseBadge(value: unknown): OplUiContributionBadge | null {
  const badge = asRecord(value);
  const badgeId = asString(badge?.badge_id);
  const dataRef = asString(badge?.data_ref);
  if (!badgeId || !dataRef) return null;
  return {
    badgeId,
    label: localizedText(badge?.label_i18n),
    dataRef,
    tone: asString(badge?.tone) ?? "neutral"
  };
}

function parseView(value: unknown): OplUiContributionView | undefined {
  const view = asRecord(value);
  const viewId = asString(view?.view_id);
  const viewType = asString(view?.view_type);
  const dataRef = asString(view?.data_ref);
  if (!viewId || !viewType || !dataRef) return undefined;
  const emptyState = localizedText(view?.empty_state_i18n);
  return {
    viewId,
    viewType,
    title: localizedText(view?.title_i18n),
    dataRef,
    ...(Object.keys(emptyState).length ? { emptyState } : {})
  };
}

function parseEntry(value: unknown): OplUiContribution | null {
  const entry = asRecord(value);
  const contributionKey = asString(entry?.contribution_key);
  const contributionId = asString(entry?.contribution_id);
  const packageId = asString(entry?.package_id);
  const slot = asString(entry?.slot);
  if (
    !contributionKey
    || !contributionId
    || !packageId
    || contributionKey !== `${packageId}:${contributionId}`
    || !slot
    || !OPL_UI_CONTRIBUTION_SLOTS.includes(slot as OplUiContributionSlot)
  ) return null;

  const view = parseView(entry?.view);
  return {
    contributionKey,
    contributionId,
    packageId,
    slot: slot as OplUiContributionSlot,
    contributionKind: asString(entry?.contribution_kind) ?? "unknown",
    trustTier: asString(entry?.trust_tier) ?? "unknown",
    scope: asString(entry?.scope) ?? "root",
    sortOrder: typeof entry?.sort_order === "number" && Number.isFinite(entry.sort_order)
      ? entry.sort_order
      : 0,
    ...(view ? { view } : {}),
    commands: Array.isArray(entry?.commands)
      ? entry.commands.map(parseCommand).filter((command): command is OplUiContributionCommand => command !== null)
      : [],
    badges: Array.isArray(entry?.badges)
      ? entry.badges.map(parseBadge).filter((badge): badge is OplUiContributionBadge => badge !== null)
      : []
  };
}

export function readUiContributionsProjection(state: unknown): OplUiContributionsProjection {
  const root = asRecord(state);
  const appState = asRecord(root?.app_state) ?? root;
  const projection = asRecord(appState?.ui_contributions);
  if (projection?.surface_kind !== "opl_app_ui_contributions_projection.v1") {
    return emptyUiContributionsProjection;
  }

  const entries = Array.isArray(projection.entries)
    ? projection.entries.map(parseEntry).filter((entry): entry is OplUiContribution => entry !== null)
    : [];
  return {
    surfaceKind: "opl_app_ui_contributions_projection.v1",
    entries: entries.sort((left, right) => (
      left.sortOrder - right.sortOrder
      || left.packageId.localeCompare(right.packageId)
      || left.contributionId.localeCompare(right.contributionId)
    ))
  };
}

export function contributionLabel(text: OplUiLocalizedText, locale: OplStudioLocale, fallback: string): string {
  const preferred = locale === "zh"
    ? ["zh-CN", "zh", "en-US", "en"]
    : ["en-US", "en", "zh-CN", "zh"];
  return preferred.map((key) => text[key]).find(Boolean)
    ?? Object.values(text).find(Boolean)
    ?? fallback;
}
