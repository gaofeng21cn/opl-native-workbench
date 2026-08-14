import { Bot, Check, FilePlus2, FolderPlus, Plug, Search, Sparkles, X } from "lucide-react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CodexCapabilityCatalog,
  CodexComposerInput,
  CodexSkillCapability
} from "../bridge/oplBridge";
import {
  agentPackageSelectionIntent,
  type AgentPackageLifecycleRef,
  type AgentPackageSelectionIntent
} from "./workbenchModel";

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
  standardAgents: AgentPackageLifecycleRef[];
  selectedAgentPackageId?: string;
  contributions?: ReactNode;
  onClose(): void;
  onPickFiles(): void;
  onPickDirectory(): void;
  onToggleSkill(skill: CodexSkillCapability): void;
  onSelectAgent?(intent: AgentPackageSelectionIntent): void;
};

function localizedAgentText(
  value: AgentPackageLifecycleRef["displayNameI18n"],
  locale: "zh" | "en",
  fallback: string
): string {
  return (locale === "zh" ? value.zh : value.en) ?? fallback;
}

export function ComposerCapabilityPalette({
  open,
  locale,
  catalog,
  status,
  error,
  selections,
  standardAgents,
  selectedAgentPackageId,
  contributions,
  onClose,
  onPickFiles,
  onPickDirectory,
  onToggleSkill,
  onSelectAgent
}: ComposerCapabilityPaletteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const copy = locale === "zh" ? {
    title: "添加到对话",
    search: "搜索文件、智能体、Skill 和连接",
    local: "本地输入",
    files: "添加文件",
    filesHelp: "图片和文件",
    folder: "添加文件夹",
    folderHelp: "将文件夹作为上下文",
    agents: "OPL 标准智能体",
    agentReady: "可用",
    agentChecking: "检查中",
    agentUnavailable: "暂不可用",
    skills: "Skills",
    connections: "应用与连接",
    loaded: "已加载",
    loading: "正在读取能力",
    empty: "没有匹配的能力"
  } : {
    title: "Add to conversation",
    search: "Search files, agents, Skills, and connections",
    local: "Local input",
    files: "Add files",
    filesHelp: "Images and files",
    folder: "Add folder",
    folderHelp: "Use a folder as context",
    agents: "OPL standard agents",
    agentReady: "Available",
    agentChecking: "Checking",
    agentUnavailable: "Unavailable",
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
  const agents = useMemo(() => standardAgents
    .map((agent) => ({
      agent,
      label: localizedAgentText(agent.displayNameI18n, locale, agent.label),
      description: localizedAgentText(agent.descriptionI18n, locale, agent.description)
    }))
    .filter(({ agent, label, description }) => [label, description, agent.packageId]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))), [locale, normalizedQuery, standardAgents]);
  const agentOwnedSkills = useMemo(() => new Set(standardAgents.flatMap((agent) => [
    ...agent.requiredSkillIds,
    ...(agent.homeShortcuts.flatMap((shortcut) => shortcut.route?.codexVisibleEntry ?? []))
  ]).map((value) => value.toLocaleLowerCase())), [standardAgents]);
  const skills = useMemo(() => {
    const seenSkillNames = new Set<string>();
    return catalog.skills.filter((skill) => {
      const key = skill.name.toLocaleLowerCase();
      if (!skill.enabled || agentOwnedSkills.has(key) || seenSkillNames.has(key)) return false;
      const matches = [skill.name, skill.description]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      if (matches) seenSkillNames.add(key);
      return matches;
    });
  }, [agentOwnedSkills, catalog.skills, normalizedQuery]);
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
        <Button
          variant="ghost"
          size="sm"
          aria-label={locale === "zh" ? "关闭" : "Close"}
          icon={<X aria-hidden="true" size={14} />}
          onClick={onClose}
        />
      </header>
      <Input
        className="composer-palette-search"
        icon={<Search aria-hidden="true" size={14} />}
        autoFocus
        value={query}
        placeholder={copy.search}
        aria-label={copy.search}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <div className="composer-palette-scroll">
        {localVisible ? (
          <section>
            <strong className="composer-palette-group">{copy.local}</strong>
            <Button variant="ghost" className="composer-palette-row" onClick={onPickFiles}>
              <span className="composer-palette-icon"><FilePlus2 aria-hidden="true" size={16} /></span>
              <span><strong>{copy.files}</strong><small>{copy.filesHelp}</small></span>
            </Button>
            <Button variant="ghost" className="composer-palette-row" onClick={onPickDirectory}>
              <span className="composer-palette-icon"><FolderPlus aria-hidden="true" size={16} /></span>
              <span><strong>{copy.folder}</strong><small>{copy.folderHelp}</small></span>
            </Button>
          </section>
        ) : null}
        {status === "loading" ? <p className="composer-palette-state">{copy.loading}</p> : null}
        {agents.length ? (
          <section data-testid="opl-standard-agents">
            <strong className="composer-palette-group">{copy.agents}</strong>
            {agents.map(({ agent, label, description }) => {
              const selected = selectedAgentPackageId === agent.packageId;
              const routeAvailable = agent.homeShortcuts.some((shortcut) => shortcut.route);
              const statusLabel = agent.readiness.selectionStatus === "available" && routeAvailable
                ? copy.agentReady
                : agent.readiness.selectionStatus === "unavailable"
                  ? copy.agentUnavailable
                  : copy.agentChecking;
              return (
                <Button
                  key={agent.packageId}
                  variant="ghost"
                  className="composer-palette-row"
                  aria-pressed={selected}
                  disabled={!onSelectAgent || !agent.readiness.selectable || !routeAvailable}
                  onClick={() => {
                    if (!onSelectAgent) return;
                    onSelectAgent(agentPackageSelectionIntent(agent));
                    onClose();
                  }}
                >
                  <span className="composer-palette-icon"><Bot aria-hidden="true" size={16} /></span>
                  <span><strong>{label}</strong><small>{description || agent.packageId}</small></span>
                  {selected ? <Check aria-hidden="true" size={15} /> : <small className="composer-palette-loaded">{statusLabel}</small>}
                </Button>
              );
            })}
          </section>
        ) : null}
        {skills.length ? (
          <section>
            <strong className="composer-palette-group">{copy.skills}</strong>
            {skills.map((skill) => {
              const selected = selections.some((item) => item.kind === "skill" && item.input.path === skill.path);
              return (
                <Button key={skill.path} variant="ghost" className="composer-palette-row" aria-pressed={selected} onClick={() => onToggleSkill(skill)}>
                  <span className="composer-palette-icon"><Sparkles aria-hidden="true" size={16} /></span>
                  <span><strong>{skill.name}</strong><small>{skill.description}</small></span>
                  {selected ? <Check aria-hidden="true" size={15} /> : null}
                </Button>
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
        {contributions ? (
          <section data-testid="opl-composer-contributions">
            <strong className="composer-palette-group">
              {locale === "zh" ? "其他模块" : "Other modules"}
            </strong>
            <div className="opl-contribution-slot">{contributions}</div>
          </section>
        ) : null}
        {status === "error" ? <p className="composer-palette-state error">{error}</p> : null}
        {status !== "loading" && !localVisible && !agents.length && !skills.length && !connections.length ? <p className="composer-palette-state">{copy.empty}</p> : null}
      </div>
    </div>
  );
}
