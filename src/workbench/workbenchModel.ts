export type WorkbenchPurpose = "research" | "grant" | "ppt";

export type WorkbenchArtifactRef = {
  id: string;
  title: string;
  kind: "result" | "file" | "receipt" | "deliverable";
  status: "ready" | "needs_review" | "blocked";
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
  activeProjectLines: ActiveProjectLine[];
};

export const initialWorkbenchModel: WorkbenchModel = {
  purposes: ["research", "grant", "ppt"],
  results: [
    { id: "result-summary", title: "Result summary", kind: "result", status: "needs_review" }
  ],
  deliverables: [
    { id: "delivery-package", title: "Delivery package", kind: "deliverable", status: "needs_review" }
  ],
  receipts: [
    { id: "dry-run-receipt", title: "Action dry-run receipt", kind: "receipt", status: "ready" }
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
