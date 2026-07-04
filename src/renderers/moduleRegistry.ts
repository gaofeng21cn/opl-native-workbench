export const rendererModuleRegistry = {
  primitives: ["@radix-ui/react-tabs", "lucide-react", "react-resizable-panels"],
  richText: ["streamdown", "katex", "mermaid", "@codemirror/view", "pdfjs-dist"],
  policy: "oss_modules_only_no_runtime_authority"
} as const;

export type RendererModuleRegistry = typeof rendererModuleRegistry;
