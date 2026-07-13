import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArchiveRestore, GitFork, Network, Play, X } from "lucide-react";
import type { WorkbenchThreadItem } from "../workbenchModel";

type ThreadDetailPopoverProps = {
  thread: WorkbenchThreadItem | null;
  locale: "zh" | "en";
  busy: boolean;
  onClose: () => void;
  onResume: (thread: WorkbenchThreadItem) => void;
  onFork: (thread: WorkbenchThreadItem) => void;
  onRequestArchive: (thread: WorkbenchThreadItem, archived: boolean) => void;
  onCoordinate: (thread: WorkbenchThreadItem) => void;
};

export function ThreadDetailPopover({ thread, locale, busy, onClose, onResume, onFork, onRequestArchive, onCoordinate }: ThreadDetailPopoverProps) {
  const copy = locale === "zh"
    ? { title: "对话详情", project: "项目", workspace: "工作区", goal: "目标", host: "Host", lineage: "上游", activeTurn: "活动 Turn", writeSet: "写集", status: "状态", id: "Thread ID", resume: "恢复对话", fork: "派生对话", archive: "归档", restore: "恢复", coordinate: "协调任务", close: "关闭" }
    : { title: "Thread details", project: "Project", workspace: "Workspace", goal: "Goal", host: "Host", lineage: "Lineage", activeTurn: "Active turn", writeSet: "Write set", status: "Status", id: "Thread ID", resume: "Resume thread", fork: "Fork thread", archive: "Archive", restore: "Restore", coordinate: "Coordinate", close: "Close" };

  return (
    <Dialog.Root open={Boolean(thread)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="coordination-overlay" />
        <Dialog.Content data-testid="opl-thread-detail-popover" className="thread-detail-popover" aria-describedby={undefined}>
          <header>
            <Dialog.Title>{copy.title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" type="button" aria-label={copy.close}><X aria-hidden="true" size={15} /></button>
            </Dialog.Close>
          </header>
          {thread ? (
            <>
              <strong className="thread-detail-title">{thread.title}</strong>
              <dl>
                <div><dt>{copy.project}</dt><dd>{thread.projectLabel ?? (thread.projectId ? thread.projectId : locale === "zh" ? "未归属" : "None")}</dd></div>
                <div><dt>{copy.workspace}</dt><dd><code>{thread.workspace ?? "-"}</code></dd></div>
                <div><dt>{copy.goal}</dt><dd>{thread.goal ?? "-"}</dd></div>
                <div><dt>{copy.host}</dt><dd><code>{thread.hostId ?? "-"}</code></dd></div>
                <div><dt>{copy.lineage}</dt><dd><code>{[thread.parentThreadId, ...thread.ancestorThreadIds].filter(Boolean).join(" / ") || "-"}</code></dd></div>
                <div><dt>{copy.activeTurn}</dt><dd><code>{thread.activeTurnId ?? "-"}</code></dd></div>
                <div><dt>{copy.writeSet}</dt><dd><code>{thread.writeSet.join("\n") || "-"}</code></dd></div>
                <div><dt>{copy.status}</dt><dd>{thread.status}</dd></div>
                <div><dt>{copy.id}</dt><dd><code>{thread.id}</code></dd></div>
              </dl>
              <div className="thread-detail-actions">
                {thread.status === "unloaded" || thread.status === "notLoaded" ? (
                  <button data-testid="opl-thread-resume" type="button" disabled={busy} onClick={() => onResume(thread)}><Play aria-hidden="true" size={14} />{copy.resume}</button>
                ) : null}
                <button type="button" disabled={busy} onClick={() => onCoordinate(thread)}><Network aria-hidden="true" size={14} />{copy.coordinate}</button>
                <button type="button" disabled={busy} onClick={() => onFork(thread)}><GitFork aria-hidden="true" size={14} />{copy.fork}</button>
                <button type="button" disabled={busy} onClick={() => onRequestArchive(thread, !thread.archived)}>
                  {thread.archived ? <ArchiveRestore aria-hidden="true" size={14} /> : <Archive aria-hidden="true" size={14} />}
                  {thread.archived ? copy.restore : copy.archive}
                </button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
