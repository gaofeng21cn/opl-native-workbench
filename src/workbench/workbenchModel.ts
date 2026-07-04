export type WorkbenchPurpose = "research" | "grant" | "ppt";

export type WorkbenchArtifactRef = {
  id: string;
  title: string;
  kind: "result" | "file" | "receipt" | "deliverable";
  status: "ready" | "needs_review" | "blocked";
  previewKind?: "markdown" | "pdf" | "code" | "mermaid" | "math";
  ref?: string;
};

export type WorkbenchStarter = {
  id: "mas" | "mag" | "rca" | "bookforge";
  purpose: "research" | "grant" | "presentation" | "book";
  title: string;
  requiredSkill: string;
  fields: string[];
  dryRunAction: string;
};

export type ActiveProjectLine = {
  status: string;
  activeRunId: string | null;
  nextVisibleStep: string;
  progressDeltaClassification: string;
  deliverableProgressDelta: string;
  platformRepairDelta: string;
  nextForcedDelta: string;
};

export type WorkbenchModel = {
  purposes: WorkbenchPurpose[];
  results: WorkbenchArtifactRef[];
  deliverables: WorkbenchArtifactRef[];
  receipts: WorkbenchArtifactRef[];
  starters: WorkbenchStarter[];
  activeProjectLines: ActiveProjectLine[];
};

export const initialWorkbenchModel: WorkbenchModel = {
  purposes: ["research", "grant", "ppt"],
  results: [
    { id: "result-summary", title: "Result summary", kind: "result", status: "needs_review", previewKind: "markdown", ref: "opl://result/summary" },
    { id: "figure-preview", title: "Figure preview", kind: "file", status: "ready", previewKind: "pdf", ref: "opl://artifact/figure-preview" }
  ],
  deliverables: [
    { id: "delivery-package", title: "Delivery package", kind: "deliverable", status: "needs_review", previewKind: "code", ref: "opl://delivery/package" }
  ],
  receipts: [
    { id: "dry-run-receipt", title: "Action dry-run receipt", kind: "receipt", status: "ready", ref: "opl://receipt/dry-run" }
  ],
  starters: [
    { id: "mas", purpose: "research", title: "Research / MAS", requiredSkill: "mas", fields: ["question", "cohort", "deliverable"], dryRunAction: "starter.mas.dry_run" },
    { id: "mag", purpose: "grant", title: "Grant / MAG", requiredSkill: "mag", fields: ["funding_call", "specific_aims", "deadline"], dryRunAction: "starter.mag.dry_run" },
    { id: "rca", purpose: "presentation", title: "Presentation / RCA", requiredSkill: "rca", fields: ["audience", "storyline", "format"], dryRunAction: "starter.rca.dry_run" },
    { id: "bookforge", purpose: "book", title: "Book / BookForge", requiredSkill: "opl-bookforge", fields: ["chapter", "voice", "export_target"], dryRunAction: "starter.bookforge.dry_run" }
  ],
  activeProjectLines: [
    {
      status: "candidate_surface_only",
      activeRunId: null,
      nextVisibleStep: "Consume opl app state/action refs",
      progressDeltaClassification: "platform_or_observability_delta",
      deliverableProgressDelta: "result refs visible",
      platformRepairDelta: "native workbench shell skeleton",
      nextForcedDelta: "owner adoption gate"
    }
  ]
};
