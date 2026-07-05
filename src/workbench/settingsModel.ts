export const SETTINGS_STORAGE_KEY = "opl.nativeWorkbench.settings.v1";

export type SettingsSectionId =
  | "general"
  | "access"
  | "capabilities"
  | "environment"
  | "storage"
  | "appearance"
  | "advanced";

export type SettingKey =
  | "locale"
  | "modelAccess"
  | "reasoningLevel"
  | "defaultWorkspace"
  | "runtimeProfile"
  | "confirmBeforeExecute"
  | "artifactPreviewMode"
  | "professionalStarterDefaults"
  | "theme"
  | "developerDetails";

export type WorkbenchSettings = {
  locale: "zh" | "en";
  modelAccess: "codex_cli_managed";
  reasoningLevel: "standard" | "high";
  defaultWorkspace: "opl_app";
  runtimeProfile: "fast" | "full";
  confirmBeforeExecute: boolean;
  artifactPreviewMode: "rich_refs_only";
  professionalStarterDefaults: "research_grant_presentation";
  theme: "system" | "light";
  developerDetails: boolean;
};

export type SettingsSection = {
  id: SettingsSectionId;
  title: string;
  keys: SettingKey[];
};

export const settingsSections: SettingsSection[] = [
  { id: "general", title: "General", keys: ["locale", "defaultWorkspace"] },
  { id: "access", title: "Access", keys: ["modelAccess", "reasoningLevel"] },
  { id: "capabilities", title: "Agents & Capabilities", keys: ["professionalStarterDefaults"] },
  { id: "environment", title: "Local Environment", keys: ["runtimeProfile"] },
  { id: "storage", title: "Storage", keys: ["confirmBeforeExecute"] },
  { id: "appearance", title: "Appearance", keys: ["theme", "artifactPreviewMode"] },
  { id: "advanced", title: "Advanced", keys: ["developerDetails"] }
];

export const settingsDefaults: WorkbenchSettings = {
  locale: "zh",
  modelAccess: "codex_cli_managed",
  reasoningLevel: "standard",
  defaultWorkspace: "opl_app",
  runtimeProfile: "fast",
  confirmBeforeExecute: true,
  artifactPreviewMode: "rich_refs_only",
  professionalStarterDefaults: "research_grant_presentation",
  theme: "system",
  developerDetails: false
};

const allowedSettingsValues = {
  locale: ["zh", "en"],
  modelAccess: ["codex_cli_managed"],
  reasoningLevel: ["standard", "high"],
  defaultWorkspace: ["opl_app"],
  runtimeProfile: ["fast", "full"],
  confirmBeforeExecute: [true, false],
  artifactPreviewMode: ["rich_refs_only"],
  professionalStarterDefaults: ["research_grant_presentation"],
  theme: ["system", "light"],
  developerDetails: [true, false]
} as const;

type WorkbenchSettingsPatch = Partial<WorkbenchSettings>;
type SettingsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStorage(): SettingsStorage | undefined {
  const storage = (globalThis as { localStorage?: SettingsStorage }).localStorage;
  return storage;
}

function normalizeSetting<Key extends SettingKey>(key: Key, value: unknown): WorkbenchSettings[Key] {
  const allowed = allowedSettingsValues[key] as readonly unknown[];
  return allowed.includes(value) ? value as WorkbenchSettings[Key] : settingsDefaults[key];
}

function normalizeSettings(value: unknown): WorkbenchSettings {
  const candidate = typeof value === "object" && value ? value as WorkbenchSettingsPatch : {};
  return Object.fromEntries(
    (Object.keys(settingsDefaults) as SettingKey[])
      .map((key) => [key, normalizeSetting(key, candidate[key])])
  ) as WorkbenchSettings;
}

export function readSettings(storage = browserStorage()): WorkbenchSettings {
  if (!storage) return settingsDefaults;
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return settingsDefaults;
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return settingsDefaults;
  }
}

export function writeSettings(patch: WorkbenchSettingsPatch, storage = browserStorage()): WorkbenchSettings {
  const nextSettings = normalizeSettings({ ...readSettings(storage), ...patch });
  storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
}

export function readSetting<Key extends SettingKey>(key: Key, storage = browserStorage()): WorkbenchSettings[Key] {
  return readSettings(storage)[key];
}

export function writeSetting<Key extends SettingKey>(
  key: Key,
  value: WorkbenchSettings[Key],
  storage = browserStorage()
): WorkbenchSettings {
  return writeSettings({ [key]: value } as WorkbenchSettingsPatch, storage);
}
