import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArchiveRestore, X } from "lucide-react";
import type { WorkbenchThreadItem } from "../workbenchModel";

type ThreadLifecycleConfirmationDialogProps = {
  thread: WorkbenchThreadItem | null;
  archived: boolean;
  locale: "zh" | "en";
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ThreadLifecycleConfirmationDialog({
  thread,
  archived,
  locale,
  busy,
  error,
  onClose,
  onConfirm
}: ThreadLifecycleConfirmationDialogProps) {
  const copy = locale === "zh"
    ? { archive: "确认归档", restore: "确认恢复", archiveAction: "归档对话", restoreAction: "恢复对话", close: "关闭", confirmation: "确认", thread: "对话" }
    : { archive: "Confirm archive", restore: "Confirm restore", archiveAction: "Archive thread", restoreAction: "Restore thread", close: "Close", confirmation: "Confirmation", thread: "Thread" };
  const Icon = archived ? Archive : ArchiveRestore;

  return (
    <Dialog.Root open={Boolean(thread)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="coordination-overlay" />
        <Dialog.Content data-testid="opl-thread-lifecycle-confirmation" className="thread-confirmation-dialog" aria-describedby={undefined}>
          <header>
            <span className="coordination-dialog-icon"><Icon aria-hidden="true" size={17} /></span>
            <Dialog.Title>{archived ? copy.archive : copy.restore}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={copy.close}><X aria-hidden="true" size={16} /></button></Dialog.Close>
          </header>
          <dl>
            <div><dt>{copy.thread}</dt><dd>{thread?.title ?? "-"}</dd></div>
            <div><dt>{copy.confirmation}</dt><dd><code>{thread?.id ?? "-"}</code></dd></div>
          </dl>
          {error ? <p className="coordination-error" role="alert">{error}</p> : null}
          <footer>
            <button className="primary" type="button" disabled={busy || !thread} onClick={onConfirm}>
              <Icon aria-hidden="true" size={14} />{archived ? copy.archiveAction : copy.restoreAction}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
