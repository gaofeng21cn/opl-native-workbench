import type { ReactNode } from "react";
import type { SettingsDestinationId } from "../workbench/SettingsPanel";
import type { OplContributionSlotOwner, OplUiContributionsProjection } from "./contributionProjection";

export type OplStudioSurface = {
  locale: "zh" | "en";
  projectTitle: string;
  sessionTitle: string;
  workspacePath: string;
  prompt: string;
  promptRevision: number;
  conversationBlank: boolean;
  sending: boolean;
  contributionOwner: OplContributionSlotOwner;
  uiContributions: OplUiContributionsProjection;
  workspaceRail: ReactNode;
  conversationHeader: ReactNode;
  conversationBody: ReactNode;
  heroActions: ReactNode;
  composerAccessory: ReactNode;
  composerOverlay: ReactNode;
  composerModelControls: ReactNode;
  details: ReactNode;
  renderSettings(destination: SettingsDestinationId): ReactNode;
  overlay: ReactNode;
  detailsRequestRevision: number;
  startSession(): void;
  updatePrompt(value: string): void;
  submitPrompt(): void;
  openComposerPalette(): void;
  stopTurn?(): void;
};

export type RenderOplStudioShell = (surface: OplStudioSurface) => ReactNode;
