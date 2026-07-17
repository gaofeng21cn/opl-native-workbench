import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArchiveRestore, GitFork, X } from "lucide-react";
import type { WorkbenchThreadItem } from "../workbenchModel";

export type ThreadLifecycleAction = "fork" | "archive" | "unarchive";

type ThreadLifecycleConfirmationDialogProps = {
  thread: WorkbenchThreadItem | null;
  action: ThreadLifecycleAction;
  locale: "zh" | "en";
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ThreadLifecycleConfirmationDialog({
  thread,
  action,
  locale,
  busy,
  error,
  onClose,
  onConfirm
}: ThreadLifecycleConfirmationDialogProps) {
  const copy = locale === "zh"
    ? { fork: "确认派生", archive: "确认归档", restore: "确认恢复", forkAction: "派生对话", archiveAction: "归档对话", restoreAction: "恢复对话", close: "关闭", confirmation: "确认", thread: "对话" }
    : { fork: "Confirm fork", archive: "Confirm archive", restore: "Confirm restore", forkAction: "Fork thread", archiveAction: "Archive thread", restoreAction: "Restore thread", close: "Close", confirmation: "Confirmation", thread: "Thread" };
  const Icon = action === "fork" ? GitFork : action === "archive" ? Archive : ArchiveRestore;
  const title = action === "fork" ? copy.fork : action === "archive" ? copy.archive : copy.restore;
  const actionLabel = action === "fork" ? copy.forkAction : action === "archive" ? copy.archiveAction : copy.restoreAction;

  return (
    <Dialog.Root open={Boolean(thread)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content data-testid="opl-thread-lifecycle-confirmation" className="thread-confirmation-dialog" aria-describedby={undefined}>
          <header>
            <span className="dialog-icon"><Icon aria-hidden="true" size={17} /></span>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={copy.close}><X aria-hidden="true" size={16} /></button></Dialog.Close>
          </header>
          <dl>
            <div><dt>{copy.thread}</dt><dd>{thread?.title ?? "-"}</dd></div>
            <div><dt>{copy.confirmation}</dt><dd><code>{thread?.id ?? "-"}</code></dd></div>
          </dl>
          {error ? <p className="dialog-error" role="alert">{error}</p> : null}
          <footer>
            <button className="primary" type="button" disabled={busy || !thread} onClick={onConfirm}>
              <Icon aria-hidden="true" size={14} />{actionLabel}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
