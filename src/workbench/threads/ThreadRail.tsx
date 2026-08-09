import { Folder, FolderOpen, MoreHorizontal } from "lucide-react";
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
    ? { current: "当前", all: "全部", archived: "归档", empty: "暂无对话", loading: "正在读取对话", unavailable: "对话目录不可用", detail: "对话详情" }
    : { current: "Current", all: "All", archived: "Archived", empty: "No threads", loading: "Loading threads", unavailable: "Thread directory unavailable", detail: "Thread details" };

  return (
    <div data-testid="opl-real-thread-directory" className="project-directory">
      <div data-testid="opl-thread-scope-filter" className="thread-scope-filter" role="group" aria-label="Thread scope" hidden>
        <button type="button" data-active={scope === "all"} onClick={() => onScopeChange("all")}>{copy.all}</button>
        <button type="button" data-active={scope === "archived"} onClick={() => onScopeChange("archived")}>{copy.archived}</button>
      </div>
      {loading ? <p className="thread-directory-state">{copy.loading}</p> : null}
      {error ? <p className="thread-directory-state error" title={error}>{copy.unavailable}</p> : null}
      {!loading && !error && !projects.length ? <p className="thread-directory-state">{copy.empty}</p> : null}
      {projects.map((project) => {
        const selected = project.id === selectedProjectId;
        const visibleThreads = project.projectless ? project.threads : selected ? project.threads : project.threads.slice(0, 2);
        const ProjectIcon = selected ? FolderOpen : Folder;
        return (
          <section className="project-directory-group" key={project.id} data-projectless={project.projectless || undefined}>
            {!project.projectless ? (
              <button className="project-root" type="button" aria-expanded={selected} onClick={() => onSelectProject(project.id)}>
                <ProjectIcon aria-hidden="true" size={15} />
                <strong>{project.label}</strong>
              </button>
            ) : null}

            {visibleThreads.length ? (
              <div className={project.projectless ? "projectless-threads" : "project-children"}>
                <section className="history-list" aria-label="Current project threads">
                  <ol>
                    {visibleThreads.map((thread) => (
                      <li key={thread.id} className={thread.id === selectedThreadId ? "active" : undefined}>
                        <div className="thread-directory-row">
                          <button
                            type="button"
                            className="thread-directory-open"
                            title={(thread.agentNickname ?? thread.agentRole ?? thread.preview) || thread.status}
                            onClick={() => onSelectThread(thread)}
                          >
                            <span className="thread-directory-copy">
                              <strong>{thread.title}</strong>
                            </span>
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
