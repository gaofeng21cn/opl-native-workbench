export type WorkbenchPurpose = "research" | "grant" | "presentation" | "review";

export type WorkbenchArtifactRef = {
  id: string;
  title: string;
  kind: "result" | "file" | "receipt" | "deliverable";
  status: "ready" | "needs_review" | "blocked";
  previewKind: "markdown" | "pdf" | "code" | "mermaid" | "math";
  ref: string;
  summary: string;
  provenance: string[];
  actions: string[];
};

export type WorkspaceSession = {
  id: string;
  workspace: string;
  session: string;
  status: string;
  nextStep: string;
};

export type ArtifactPreview = {
  id: string;
  label: string;
  rendererModuleId: string;
  title: string;
  ref: string;
  summary: string;
};

export type WorkbenchStarterField = {
  name: string;
  label: string;
  input: "text" | "textarea" | "select";
  value: string;
  options?: string[];
};

export type WorkbenchStarter = {
  id: "mas" | "mag" | "rca" | "bookforge";
  purpose: "research" | "grant" | "presentation" | "book";
  title: string;
  requiredSkill: string;
  module: string;
  intent: string;
  fields: WorkbenchStarterField[];
  dryRunAction: string;
};

export type ConfirmationCard = {
  id: string;
  title: string;
  question: string;
  risks: string[];
  willChange: string[];
  willNotChange: string[];
  receipt: string;
  rollback: string;
  dryRunAction: string;
};

export type InterviewQuestion = {
  id: string;
  question: string;
  whyItMatters: string;
  answerType: string;
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
  sessions: WorkspaceSession[];
  results: WorkbenchArtifactRef[];
  deliverables: WorkbenchArtifactRef[];
  receipts: WorkbenchArtifactRef[];
  artifactPreviews: ArtifactPreview[];
  starters: WorkbenchStarter[];
  confirmations: ConfirmationCard[];
  questions: InterviewQuestion[];
  activeProjectLines: ActiveProjectLine[];
};

export const initialWorkbenchModel: WorkbenchModel = {
  purposes: ["research", "grant", "presentation", "review"],
  sessions: [
    {
      id: "workspace-current",
      workspace: "Current workspace",
      session: "Chat to delivery",
      status: "candidate_surface_only",
      nextStep: "Draft from App state refs, then request dry-run confirmation"
    },
    {
      id: "workspace-review",
      workspace: "Delivery review",
      session: "Owner packet",
      status: "needs_human_confirmation",
      nextStep: "Inspect provenance and export dry-run receipt"
    },
    {
      id: "workspace-starters",
      workspace: "Starter lane",
      session: "MAS/MAG/RCA/BookForge forms",
      status: "starter_ready",
      nextStep: "Choose a module form without executing domain CLI"
    }
  ],
  results: [
    {
      id: "result-summary",
      title: "Result summary",
      kind: "result",
      status: "needs_review",
      previewKind: "markdown",
      ref: "opl://result/summary",
      summary: "Chat answer distilled into a refs-only product result.",
      provenance: ["App fast state", "conversation event refs", "candidate plan"],
      actions: ["Open preview", "Ask follow-up", "Prepare export dry-run"]
    },
    {
      id: "gap-map",
      title: "Gap map",
      kind: "result",
      status: "blocked",
      previewKind: "mermaid",
      ref: "opl://result/non-live-gap-map",
      summary: "Non-Live gaps that still need visual, packaged, owner, or release evidence.",
      provenance: ["false-ready boundary", "candidate evidence"],
      actions: ["Route to owner question", "Keep as residual risk"]
    }
  ],
  deliverables: [
    {
      id: "delivery-package",
      title: "Delivery package",
      kind: "deliverable",
      status: "needs_review",
      previewKind: "code",
      ref: "opl://delivery/package",
      summary: "Exportable packet shell for result refs, receipt refs, and reviewer notes.",
      provenance: ["delivery workbench model", "artifact preview tabs"],
      actions: ["Dry-run export", "Attach receipt ref", "Rollback request"]
    },
    {
      id: "owner-brief",
      title: "Owner brief",
      kind: "deliverable",
      status: "ready",
      previewKind: "markdown",
      ref: "opl://delivery/owner-brief",
      summary: "Compact handoff brief that stays below owner-receipt authority.",
      provenance: ["confirmation card", "question card"],
      actions: ["Review risks", "Ask owner question"]
    }
  ],
  receipts: [
    {
      id: "dry-run-receipt",
      title: "Action dry-run receipt",
      kind: "receipt",
      status: "ready",
      previewKind: "code",
      ref: "opl://receipt/dry-run",
      summary: "Bridge dry-run command receipt; no domain execution is implied.",
      provenance: ["opl app action execute --dry-run", "browser bridge"],
      actions: ["Copy command ref", "Compare payload"]
    }
  ],
  artifactPreviews: [
    {
      id: "preview-markdown",
      label: "Markdown",
      rendererModuleId: "streamdown",
      title: "Result narrative",
      ref: "artifact://candidate/result-summary.md",
      summary: "Streaming markdown preview for result prose and reviewer notes."
    },
    {
      id: "preview-math",
      label: "Math",
      rendererModuleId: "katex",
      title: "Methods note",
      ref: "artifact://candidate/methods-equation.tex",
      summary: "KaTeX-backed formula preview for scientific workbench notes."
    },
    {
      id: "preview-diagram",
      label: "Mermaid",
      rendererModuleId: "mermaid",
      title: "Delivery flow",
      ref: "artifact://candidate/delivery-flow.mmd",
      summary: "Mermaid preview slot for routing, confirmation, and receipt flow."
    },
    {
      id: "preview-code",
      label: "Code",
      rendererModuleId: "@codemirror/view",
      title: "Patch excerpt",
      ref: "artifact://candidate/patch-ref.ts",
      summary: "CodeMirror preview slot for diff and code references."
    },
    {
      id: "preview-pdf",
      label: "PDF",
      rendererModuleId: "pdfjs-dist",
      title: "Export proof",
      ref: "artifact://candidate/export-preview.pdf",
      summary: "PDF.js preview slot for local export artifacts."
    }
  ],
  starters: [
    {
      id: "mas",
      purpose: "research",
      title: "Research / MAS",
      requiredSkill: "mas",
      module: "MedAutoScience",
      intent: "Prepare a paper-mission dry-run request from local fields.",
      fields: [
        { name: "study", label: "Study", input: "text", value: "DM-CVD candidate" },
        { name: "question", label: "Scientific question", input: "textarea", value: "What evidence package should be reviewed next?" },
        { name: "output", label: "Output", input: "select", value: "decision_packet", options: ["decision_packet", "figure_refs", "review_response"] }
      ],
      dryRunAction: "starter.mas.dry_run"
    },
    {
      id: "mag",
      purpose: "grant",
      title: "Grant / MAG",
      requiredSkill: "mag",
      module: "MedAutoGrant",
      intent: "Shape a grant-authoring dry-run request without grant authority.",
      fields: [
        { name: "mechanism", label: "Mechanism", input: "text", value: "R01-style concept" },
        { name: "aim", label: "Aim", input: "textarea", value: "Draft specific aims from approved refs only." },
        { name: "stage", label: "Stage", input: "select", value: "outline", options: ["outline", "significance", "approach"] }
      ],
      dryRunAction: "starter.mag.dry_run"
    },
    {
      id: "rca",
      purpose: "presentation",
      title: "Presentation / RCA",
      requiredSkill: "rca",
      module: "RedCube AI",
      intent: "Prepare a visual-deliverable dry-run request from refs.",
      fields: [
        { name: "scene", label: "Scene", input: "text", value: "Mechanism overview" },
        { name: "assets", label: "Assets", input: "textarea", value: "Use approved local refs; no generated authority claim." },
        { name: "format", label: "Format", input: "select", value: "slide_panel", options: ["slide_panel", "poster_panel", "figure_panel"] }
      ],
      dryRunAction: "starter.rca.dry_run"
    },
    {
      id: "bookforge",
      purpose: "book",
      title: "Book / BookForge",
      requiredSkill: "opl-bookforge",
      module: "OPL BookForge",
      intent: "Start a manuscript-structure dry-run request.",
      fields: [
        { name: "book", label: "Book", input: "text", value: "One Person Lab methods" },
        { name: "chapter", label: "Chapter brief", input: "textarea", value: "Turn confirmed results into a chapter outline." },
        { name: "mode", label: "Mode", input: "select", value: "outline", options: ["outline", "section_draft", "revision_map"] }
      ],
      dryRunAction: "starter.bookforge.dry_run"
    }
  ],
  confirmations: [
    {
      id: "confirm-export",
      title: "Export delivery packet",
      question: "Export the current result refs and receipt refs as a candidate delivery packet?",
      risks: ["Refs may be stale until App state is refreshed", "Packet is not owner acceptance"],
      willChange: ["Create an App action dry-run request", "Record the proposed export payload"],
      willNotChange: ["No domain artifact body is written", "No owner receipt or release claim is created"],
      receipt: "Dry-run receipt from opl app action execute --dry-run",
      rollback: "Discard the candidate packet request before explicit execution",
      dryRunAction: "candidate.delivery.export"
    },
    {
      id: "confirm-owner-question",
      title: "Ask owner question",
      question: "Route the unresolved decision as an owner-facing question?",
      risks: ["Owner may reject the proposed route", "Question may require newer runtime readback"],
      willChange: ["Prepare a typed question payload", "Attach refs and rollback path"],
      willNotChange: ["No active-shell adoption", "No runtime/domain truth transfer"],
      receipt: "Question dry-run receipt with source refs",
      rollback: "Remove the question card from the draft packet",
      dryRunAction: "candidate.owner.question"
    }
  ],
  questions: [
    {
      id: "question-authority",
      question: "Which App state ref is authoritative for this delivery?",
      whyItMatters: "The shell can present refs, but the App/domain owner decides truth.",
      answerType: "single source ref"
    },
    {
      id: "question-acceptance",
      question: "What evidence would promote this from candidate UI to visual acceptance?",
      whyItMatters: "Source smoke is not packaged GUI, clean VM, or owner acceptance.",
      answerType: "evidence checklist"
    },
    {
      id: "question-rollback",
      question: "What should be discarded if the dry-run route is rejected?",
      whyItMatters: "Rollback must be explicit before an export or owner question.",
      answerType: "rollback note"
    }
  ],
  activeProjectLines: [
    {
      status: "candidate_surface_only",
      activeRunId: null,
      nextVisibleStep: "Consume opl app state/action refs",
      progressDeltaClassification: "platform_or_observability_delta",
      deliverableProgressDelta: "result refs visible",
      platformRepairDelta: "native workbench non-live delivery surface",
      nextForcedDelta: "owner adoption gate"
    }
  ]
};
