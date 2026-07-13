import { Folder, FolderOpen, Inbox, MessageSquare, MoreHorizontal } from "lucide-react";
import type { WorkbenchProjectGroup, WorkbenchThreadItem } from "../workbenchModel";

type ThreadRailProps = {
  projects: WorkbenchProjectGroup[];
  selectedProjectId?: string;
  selectedThreadId?: string;
  locale: "zh" | "en";
  scope: "current" | "all" | "archived";
  loading: boolean;
  error?: string;
  onSelectProject: (projectId: string) => void;
  onScopeChange: (scope: "current" | "all" | "archived") => void;
  onSelectThread: (thread: WorkbenchThreadItem) => void;
  onOpenDetail: (thread: WorkbenchThreadItem) => void;
};

function threadTimestamp(value: string | undefined, locale: "zh" | "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ThreadRail({
  projects,
  selectedProjectId,
  selectedThreadId,
  locale,
  scope,
  loading,
  error,
  onSelectProject,
  onScopeChange,
  onSelectThread,
  onOpenDetail
}: ThreadRailProps) {
  const copy = locale === "zh"
    ? { noProject: "未归属项目", current: "当前", all: "全部", archived: "归档", empty: "暂无对话", loading: "正在读取对话", unavailable: "对话目录不可用", detail: "对话详情" }
    : { noProject: "No project", current: "Current", all: "All", archived: "Archived", empty: "No threads", loading: "Loading threads", unavailable: "Thread directory unavailable", detail: "Thread details" };

  return (
    <div data-testid="opl-real-thread-directory" className="project-directory">
      <div data-testid="opl-thread-scope-filter" className="thread-scope-filter" role="group" aria-label="Thread scope">
        {(["current", "all", "archived"] as const).map((item) => (
          <button key={item} type="button" data-active={scope === item} onClick={() => onScopeChange(item)}>{copy[item]}</button>
        ))}
      </div>
      {loading ? <p className="thread-directory-state">{copy.loading}</p> : null}
      {error ? <p className="thread-directory-state error" title={error}>{copy.unavailable}</p> : null}
      {!loading && !error && !projects.length ? <p className="thread-directory-state">{copy.empty}</p> : null}
      {projects.map((project) => {
        const selected = project.id === selectedProjectId;
        const ProjectIcon = project.projectless ? Inbox : selected ? FolderOpen : Folder;
        return (
          <section className="project-directory-group" key={project.id} data-projectless={project.projectless || undefined}>
            <button
              className="project-root"
              type="button"
              aria-expanded={selected}
              onClick={() => onSelectProject(project.id)}
            >
              <ProjectIcon aria-hidden="true" size={15} />
              <strong>{project.projectless
                ? `${copy.noProject}${project.workspace ? ` / ${project.workspace.split("/").filter(Boolean).at(-1) ?? project.workspace}` : ""}`
                : project.label}</strong>
              <span className="project-device">{project.threads.length}</span>
            </button>

            {selected ? (
              <div className="project-children">
                <section className="history-list" aria-label="Current project threads">
                  <ol>
                    {project.threads.map((thread) => (
                      <li key={thread.id} className={thread.id === selectedThreadId ? "active" : undefined}>
                        <div className="thread-directory-row">
                          <button type="button" className="thread-directory-open" onClick={() => onSelectThread(thread)}>
                            <MessageSquare aria-hidden="true" size={13} />
                            <span className="thread-directory-copy">
                              <strong>{thread.title}</strong>
                              <small>{thread.preview || thread.status}</small>
                            </span>
                            <time>{threadTimestamp(thread.updatedAt, locale)}</time>
                          </button>
                          <button
                            data-testid="opl-thread-detail-trigger"
                            className="thread-directory-detail"
                            type="button"
                            aria-label={`${copy.detail}: ${thread.title}`}
                            onClick={() => onOpenDetail(thread)}
                          >
                            <MoreHorizontal aria-hidden="true" size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {!project.threads.length ? <p className="thread-directory-state">{copy.empty}</p> : null}
                </section>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
