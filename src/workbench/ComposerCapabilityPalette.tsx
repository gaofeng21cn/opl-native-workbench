import { Check, FilePlus2, FolderPlus, Plug, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CodexCapabilityCatalog,
  CodexComposerInput,
  CodexSkillCapability
} from "../bridge/oplBridge";

export type ComposerSelection = {
  id: string;
  kind: "file" | "folder" | "image" | "skill";
  label: string;
  detail: string;
  input: CodexComposerInput;
};

type ComposerCapabilityPaletteProps = {
  open: boolean;
  locale: "zh" | "en";
  catalog: CodexCapabilityCatalog;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  selections: ComposerSelection[];
  onClose(): void;
  onPickFiles(): void;
  onPickDirectory(): void;
  onToggleSkill(skill: CodexSkillCapability): void;
};

export function ComposerCapabilityPalette({
  open,
  locale,
  catalog,
  status,
  error,
  selections,
  onClose,
  onPickFiles,
  onPickDirectory,
  onToggleSkill
}: ComposerCapabilityPaletteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const copy = locale === "zh" ? {
    title: "添加到对话",
    search: "搜索文件、Skill 和连接",
    local: "本地输入",
    files: "添加文件",
    filesHelp: "图片和文件",
    folder: "添加文件夹",
    folderHelp: "将文件夹作为上下文",
    skills: "Skills",
    connections: "应用与连接",
    loaded: "已加载",
    loading: "正在读取能力",
    empty: "没有匹配的能力"
  } : {
    title: "Add to conversation",
    search: "Search files, Skills, and connections",
    local: "Local input",
    files: "Add files",
    filesHelp: "Images and files",
    folder: "Add folder",
    folderHelp: "Use a folder as context",
    skills: "Skills",
    connections: "Apps and connections",
    loaded: "Loaded",
    loading: "Loading capabilities",
    empty: "No matching capabilities"
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open, onClose]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const skills = useMemo(() => {
    const seenSkillNames = new Set<string>();
    return catalog.skills.filter((skill) => {
      const key = skill.name.toLocaleLowerCase();
      if (!skill.enabled || seenSkillNames.has(key)) return false;
      const matches = [skill.name, skill.description]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      if (matches) seenSkillNames.add(key);
      return matches;
    });
  }, [catalog.skills, normalizedQuery]);
  const connections = useMemo(() => [...catalog.plugins, ...catalog.apps]
    .filter((item, index, items) => item.enabled && items.findIndex((candidate) => candidate.id === item.id) === index)
    .filter((item) => [item.name, item.description].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))), [catalog.apps, catalog.plugins, normalizedQuery]);
  const localVisible = !normalizedQuery || [copy.files, copy.filesHelp, copy.folder, copy.folderHelp]
    .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));

  if (!open) return null;
  return (
    <div ref={rootRef} className="composer-palette" role="dialog" aria-label={copy.title}>
      <header>
        <strong>{copy.title}</strong>
        <button type="button" aria-label={locale === "zh" ? "关闭" : "Close"} onClick={onClose}>
          <X aria-hidden="true" size={14} />
        </button>
      </header>
      <label className="composer-palette-search">
        <Search aria-hidden="true" size={14} />
        <input autoFocus value={query} placeholder={copy.search} onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      <div className="composer-palette-scroll">
        {localVisible ? (
          <section>
            <strong className="composer-palette-group">{copy.local}</strong>
            <button type="button" className="composer-palette-row" onClick={onPickFiles}>
              <span className="composer-palette-icon"><FilePlus2 aria-hidden="true" size={16} /></span>
              <span><strong>{copy.files}</strong><small>{copy.filesHelp}</small></span>
            </button>
            <button type="button" className="composer-palette-row" onClick={onPickDirectory}>
              <span className="composer-palette-icon"><FolderPlus aria-hidden="true" size={16} /></span>
              <span><strong>{copy.folder}</strong><small>{copy.folderHelp}</small></span>
            </button>
          </section>
        ) : null}
        {status === "loading" ? <p className="composer-palette-state">{copy.loading}</p> : null}
        {skills.length ? (
          <section>
            <strong className="composer-palette-group">{copy.skills}</strong>
            {skills.map((skill) => {
              const selected = selections.some((item) => item.kind === "skill" && item.input.path === skill.path);
              return (
                <button key={skill.path} type="button" className="composer-palette-row" aria-pressed={selected} onClick={() => onToggleSkill(skill)}>
                  <span className="composer-palette-icon"><Sparkles aria-hidden="true" size={16} /></span>
                  <span><strong>{skill.name}</strong><small>{skill.description}</small></span>
                  {selected ? <Check aria-hidden="true" size={15} /> : null}
                </button>
              );
            })}
          </section>
        ) : null}
        {connections.length ? (
          <section>
            <strong className="composer-palette-group">{copy.connections}</strong>
            {connections.map((item) => (
              <div key={item.id} className="composer-palette-row loaded">
                <span className="composer-palette-icon"><Plug aria-hidden="true" size={16} /></span>
                <span><strong>{item.name}</strong><small>{item.description}</small></span>
                <small className="composer-palette-loaded">{copy.loaded}</small>
              </div>
            ))}
          </section>
        ) : null}
        {status === "error" ? <p className="composer-palette-state error">{error}</p> : null}
        {status !== "loading" && !localVisible && !skills.length && !connections.length ? <p className="composer-palette-state">{copy.empty}</p> : null}
      </div>
    </div>
  );
}
