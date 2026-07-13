import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Network, Send, X } from "lucide-react";
import type { CoordinationIntent } from "../../coordination/types";
import type {
  WorkbenchCoordinationEvent,
  WorkbenchCoordinationOperation,
  WorkbenchThreadItem
} from "../workbenchModel";
import { CoordinationEvents } from "./CoordinationEvents";

const coordinationIntents = ["delegate", "inform", "review", "block", "handoff"] as const;

export type CoordinationDraftFields = {
  reason: string;
  intent: CoordinationIntent | "";
  message: string;
  summary: string;
  expectedWriteSet: string;
};

type CoordinationDialogProps = {
  open: boolean;
  locale: "zh" | "en";
  sourceThread: WorkbenchThreadItem | null;
  threads: WorkbenchThreadItem[];
  targetThreadId: string;
  draft: CoordinationDraftFields;
  operation: WorkbenchCoordinationOperation | null;
  reviewConfirmation: boolean;
  steerConfirmed: boolean;
  events: WorkbenchCoordinationEvent[];
  busy: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onTargetChange: (threadId: string) => void;
  onDraftChange: (field: keyof CoordinationDraftFields, value: string) => void;
  onSteerConfirmedChange: (confirmed: boolean) => void;
  onPrepare: () => void;
  onReview: () => void;
  onDispatch: () => void;
};

export function CoordinationDialog({
  open,
  locale,
  sourceThread,
  threads,
  targetThreadId,
  draft,
  operation,
  reviewConfirmation,
  steerConfirmed,
  events,
  busy,
  error,
  onOpenChange,
  onTargetChange,
  onDraftChange,
  onSteerConfirmedChange,
  onPrepare,
  onReview,
  onDispatch
}: CoordinationDialogProps) {
  const copy = locale === "zh"
    ? { title: "跨对话协调", source: "源对话", target: "目标对话", reason: "原因", intent: "意图", intents: { delegate: "委派", inform: "告知", review: "审阅", block: "阻塞", handoff: "移交" }, message: "消息", summary: "摘要", writeSet: "预期写集", steer: "确认引导目标对话的活动 Turn", select: "选择目标对话", selectIntent: "选择意图", prepare: "生成提案", review: "审阅并确认", dispatch: "确认并派发", close: "关闭", missingSource: "请先打开一个真实对话", missingTarget: "请选择另一个目标对话" }
    : { title: "Cross-thread coordination", source: "Source thread", target: "Target thread", reason: "Reason", intent: "Intent", intents: { delegate: "Delegate", inform: "Inform", review: "Review", block: "Block", handoff: "Handoff" }, message: "Message", summary: "Summary", writeSet: "Expected write set", steer: "Confirm steering the target thread's active turn", select: "Select a target thread", selectIntent: "Select intent", prepare: "Prepare proposal", review: "Review and confirm", dispatch: "Confirm and dispatch", close: "Close", missingSource: "Open a real thread first", missingTarget: "Select another target thread" };
  const targets = threads.filter((thread) => thread.id !== sourceThread?.id && !thread.archived);
  const canPrepare = Boolean(sourceThread && targetThreadId && draft.reason.trim() && draft.intent && draft.message.trim() && draft.summary.trim() && !busy);
  const effectivePhase = reviewConfirmation ? "confirmation" : operation?.phase;
  const activeSteer = operation?.plannedDispatch === "steered";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="coordination-overlay" />
        <Dialog.Content data-testid="opl-coordination-dispatch-dialog" className="coordination-dialog" aria-describedby={undefined}>
          <header className="coordination-dialog-header">
            <span className="coordination-dialog-icon"><Network aria-hidden="true" size={17} /></span>
            <Dialog.Title>{copy.title}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={copy.close}><X aria-hidden="true" size={16} /></button></Dialog.Close>
          </header>

          <div className="coordination-route">
            <label>
              <span>{copy.source}</span>
              <strong>{sourceThread?.title ?? copy.missingSource}</strong>
            </label>
            <ArrowRight aria-hidden="true" size={16} />
            <label>
              <span>{copy.target}</span>
              <select value={targetThreadId} disabled={busy || !sourceThread} onChange={(event) => onTargetChange(event.currentTarget.value)}>
                <option value="">{targets.length ? copy.select : copy.missingTarget}</option>
                {targets.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.projectLabel ?? thread.projectKey ?? (locale === "zh" ? "未归属" : "No project")} / {thread.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="coordination-fields">
            <label>
              <span>{copy.reason}</span>
              <input value={draft.reason} disabled={busy} onChange={(event) => onDraftChange("reason", event.currentTarget.value)} />
            </label>
            <label>
              <span>{copy.intent}</span>
              <select value={draft.intent} disabled={busy} onChange={(event) => onDraftChange("intent", event.currentTarget.value as CoordinationIntent)}>
                <option value="">{copy.selectIntent}</option>
                {coordinationIntents.map((intent) => <option key={intent} value={intent}>{copy.intents[intent]}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.message}</span>
              <textarea value={draft.message} disabled={busy} onChange={(event) => onDraftChange("message", event.currentTarget.value)} />
            </label>
            <label>
              <span>{copy.summary}</span>
              <input value={draft.summary} disabled={busy} onChange={(event) => onDraftChange("summary", event.currentTarget.value)} />
            </label>
            <label>
              <span>{copy.writeSet}</span>
              <textarea className="coordination-write-set" value={draft.expectedWriteSet} disabled={busy} onChange={(event) => onDraftChange("expectedWriteSet", event.currentTarget.value)} />
            </label>
          </div>

          <CoordinationEvents operation={operation ? { ...operation, phase: effectivePhase ?? operation.phase } : null} events={events} locale={locale} />
          {activeSteer && reviewConfirmation ? (
            <label className="coordination-steer-confirmation">
              <input type="checkbox" checked={steerConfirmed} onChange={(event) => onSteerConfirmedChange(event.currentTarget.checked)} />
              <span>{copy.steer}</span>
            </label>
          ) : null}
          {error ? <p className="coordination-error" role="alert">{error}</p> : null}

          <footer>
            {!operation || operation.phase === "conflict" ? (
              <button data-testid="opl-coordination-prepare" type="button" disabled={!canPrepare} onClick={onPrepare}>{copy.prepare}</button>
            ) : operation.phase === "proposal" && !reviewConfirmation ? (
              <button data-testid="opl-coordination-review" type="button" disabled={busy} onClick={onReview}>{copy.review}</button>
            ) : reviewConfirmation || operation.phase === "confirmation" ? (
              <button data-testid="opl-coordination-dispatch" className="primary" type="button" disabled={busy || (activeSteer && !steerConfirmed)} onClick={onDispatch}>
                <Send aria-hidden="true" size={14} />{copy.dispatch}
              </button>
            ) : null}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
