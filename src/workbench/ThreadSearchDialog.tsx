import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkbenchProjectGroup, WorkbenchThreadItem } from "./workbenchModel";

type ThreadSearchDialogProps = {
  open: boolean;
  locale: "zh" | "en";
  projects: WorkbenchProjectGroup[];
  onOpenChange(open: boolean): void;
  onSelect(thread: WorkbenchThreadItem): void;
};

export function ThreadSearchDialog({
  open,
  locale,
  projects,
  onOpenChange,
  onSelect
}: ThreadSearchDialogProps) {
  const [query, setQuery] = useState("");
  const copy = locale === "zh"
    ? { title: "搜索对话", placeholder: "搜索对话", empty: "没有匹配的对话", recent: "对话" }
    : { title: "Search conversations", placeholder: "Search conversations", empty: "No matching conversations", recent: "Conversations" };
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return projects
      .flatMap((project) => project.threads.map((thread) => ({ project, thread })))
      .filter(({ project, thread }) => !normalized || [thread.title, thread.preview, thread.workspace, project.label]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized)))
      .sort((left, right) => String(right.thread.updatedAt ?? "").localeCompare(String(left.thread.updatedAt ?? "")))
      .slice(0, 60);
  }, [projects, query]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) setQuery("");
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="thread-search-overlay" />
        <Dialog.Content className="thread-search-dialog" aria-describedby={undefined}>
          <Dialog.Title className="visually-hidden">{copy.title}</Dialog.Title>
          <div className="thread-search-input">
            <Search aria-hidden="true" size={16} />
            <input
              autoFocus
              value={query}
              placeholder={copy.placeholder}
              aria-label={copy.placeholder}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Dialog.Close aria-label={locale === "zh" ? "关闭" : "Close"}>
              <X aria-hidden="true" size={15} />
            </Dialog.Close>
          </div>
          <div className="thread-search-results">
            <strong className="thread-search-group-label">{copy.recent}</strong>
            {results.map(({ project, thread }) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  onSelect(thread);
                  onOpenChange(false);
                  setQuery("");
                }}
              >
                <span className="thread-search-result-copy">
                  <strong>{thread.title}</strong>
                  {thread.preview && thread.preview !== thread.title ? <small>{thread.preview}</small> : null}
                </span>
                {!thread.isTemporaryWorkspace && !project.projectless ? <span className="thread-search-project">{project.label}</span> : null}
              </button>
            ))}
            {!results.length ? <p className="thread-search-empty">{copy.empty}</p> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
