import * as CodeMirrorView from "@codemirror/view";
import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixTabs from "@radix-ui/react-tabs";
import * as KaTeX from "katex";
import * as LucideIcons from "lucide-react";
import * as Mermaid from "mermaid";
import * as PdfJs from "pdfjs-dist";
import * as ResizablePanels from "react-resizable-panels";
import * as Streamdown from "streamdown";

export const rendererModuleBindings = {
  codeMirrorView: CodeMirrorView,
  radixDialog: RadixDialog,
  radixTabs: RadixTabs,
  katex: KaTeX,
  lucideIcons: LucideIcons,
  mermaid: Mermaid,
  pdfJs: PdfJs,
  resizablePanels: ResizablePanels,
  streamdown: Streamdown
} as const;

export type RendererModuleRegistration = {
  id: string;
  packageName: string;
  surface: string;
  adapter: string;
  previewKinds?: RendererPreviewKind[];
  evidenceTestId: string;
  authorityBoundary: string;
};

export type RendererPreviewKind = "markdown" | "pdf" | "code" | "mermaid" | "math" | "json";

export const previewKindRendererModuleMap: Record<RendererPreviewKind, string> = {
  markdown: "streamdown",
  math: "katex",
  mermaid: "mermaid",
  code: "@codemirror/view",
  json: "@codemirror/view",
  pdf: "pdfjs-dist"
};

export function rendererModuleIdForPreviewKind(previewKind: RendererPreviewKind): string {
  return previewKindRendererModuleMap[previewKind];
}

export const rendererModuleRegistry: RendererModuleRegistration[] = [
  {
    id: "radix-tabs",
    packageName: "@radix-ui/react-tabs",
    surface: "Artifact preview tabs",
    adapter: "Tabs.Root/List/Trigger/Content",
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "UI primitive only"
  },
  {
    id: "radix-dialog",
    packageName: "@radix-ui/react-dialog",
    surface: "Provenance and confirmation drawer",
    adapter: "Dialog.Content as always-visible inspector shell",
    evidenceTestId: "opl-provenance-drawer",
    authorityBoundary: "No release or owner receipt authority"
  },
  {
    id: "lucide-react",
    packageName: "lucide-react",
    surface: "Workbench action icons",
    adapter: "Icon components inside action buttons and cards",
    evidenceTestId: "opl-export-action",
    authorityBoundary: "Visual affordance only"
  },
  {
    id: "react-resizable-panels",
    packageName: "react-resizable-panels",
    surface: "Workspace rail / chat / inspector layout",
    adapter: "PanelGroup with three resizable product regions",
    evidenceTestId: "opl-workspace-rail",
    authorityBoundary: "Renderer layout only"
  },
  {
    id: "streamdown",
    packageName: "streamdown",
    surface: "Markdown result preview",
    adapter: "Streaming markdown renderer slot",
    previewKinds: ["markdown"],
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "Refs-only artifact preview"
  },
  {
    id: "katex",
    packageName: "katex",
    surface: "Math preview",
    adapter: "Formula renderer slot",
    previewKinds: ["math"],
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "Refs-only artifact preview"
  },
  {
    id: "mermaid",
    packageName: "mermaid",
    surface: "Diagram preview",
    adapter: "Diagram renderer slot",
    previewKinds: ["mermaid"],
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "Refs-only artifact preview"
  },
  {
    id: "@codemirror/view",
    packageName: "@codemirror/view",
    surface: "Code and diff preview",
    adapter: "EditorView-based read-only code slot",
    previewKinds: ["code", "json"],
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "Refs-only artifact preview"
  },
  {
    id: "pdfjs-dist",
    packageName: "pdfjs-dist",
    surface: "PDF export preview",
    adapter: "PDF.js document preview slot",
    previewKinds: ["pdf"],
    evidenceTestId: "opl-artifact-preview-tabs",
    authorityBoundary: "Local preview only"
  },
  {
    id: "shadcn-compatible",
    packageName: "local shadcn-compatible primitives",
    surface: "Cards, forms, tabs, drawer composition",
    adapter: "Radix primitives plus lucide icons; no shadcn CLI runtime dependency",
    evidenceTestId: "opl-renderer-module-registry",
    authorityBoundary: "Component recipe only"
  }
];
