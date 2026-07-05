import {
  ClipboardCheck,
  FileCode,
  FileText,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShieldQuestion
} from "lucide-react";
import { previewKindRendererModuleMap, rendererModuleRegistry } from "../renderers/moduleRegistry";
import type {
  ActionReceiptSummary as ActionReceiptSummaryModel,
  ArtifactPreview,
  ConfirmationCard as ConfirmationCardModel,
  InterviewQuestion,
  WorkbenchArtifactRef
} from "../workbench/workbenchModel";

export function StatusPill({ status }: { status: string }) {
  return <span className="status-pill">{status.replaceAll("_", " ")}</span>;
}

export function DeliveryCard({ item }: { item: WorkbenchArtifactRef }) {
  const Icon = item.kind === "receipt" ? ReceiptText : item.kind === "deliverable" ? PackageCheck : FileText;
  return (
    <article className="delivery-card" data-kind={item.kind}>
      <header>
        <Icon aria-hidden="true" size={18} />
        <div>
          <h3>{item.title}</h3>
          <StatusPill status={item.status} />
        </div>
      </header>
      <p>{item.summary}</p>
      <dl>
        <dt>Ref</dt>
        <dd>{item.ref}</dd>
        <dt>Trace</dt>
        <dd>{item.provenance.join(" / ")}</dd>
      </dl>
      <ul>
        {item.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </article>
  );
}

export type QuestionCardProps = {
  question: InterviewQuestion;
};

export function QuestionCard({ question }: QuestionCardProps) {
  return (
    <article data-testid="opl-question-card" className="question-card">
      <header>
        <ShieldQuestion aria-hidden="true" size={18} />
        <h4>{question.question}</h4>
      </header>
      <p>{question.whyItMatters}</p>
      <small>{question.answerType}</small>
    </article>
  );
}

export function ArtifactPreviewCard({ preview }: { preview: ArtifactPreview }) {
  return (
    <article data-testid="opl-artifact-preview-card" className="artifact-preview-card">
      <header>
        <FileCode aria-hidden="true" size={18} />
        <div>
          <h3>{preview.title}</h3>
          <StatusPill status={preview.previewKind} />
        </div>
      </header>
      <p>{preview.summary}</p>
      <dl>
        <dt>Renderer</dt>
        <dd>{preview.rendererModuleId}</dd>
        <dt>Ref</dt>
        <dd>{preview.ref}</dd>
      </dl>
    </article>
  );
}

export function ActionReceiptSummary({ receipt }: { receipt: ActionReceiptSummaryModel }) {
  return (
    <article data-testid="opl-action-receipt-summary" className="action-receipt-summary">
      <header>
        <ReceiptText aria-hidden="true" size={18} />
        <div>
          <h3>{receipt.title}</h3>
          <StatusPill status={receipt.status} />
        </div>
      </header>
      <p>{receipt.summary}</p>
      <dl>
        <dt>Action</dt>
        <dd>{receipt.actionId}</dd>
        <dt>Receipt ref</dt>
        <dd>{receipt.receiptRef}</dd>
      </dl>
    </article>
  );
}

export type ConfirmationCardProps = {
  card: ConfirmationCardModel;
  question: InterviewQuestion;
  onDryRun: (actionId: string, payload: Record<string, unknown>) => void;
};

export function ConfirmationCard({ card, question, onDryRun }: ConfirmationCardProps) {
  return (
    <article data-testid="opl-confirmation-card" className="confirmation-card">
      <header>
        <ClipboardCheck aria-hidden="true" size={18} />
        <div>
          <h3>{card.title}</h3>
          <p>{card.question}</p>
        </div>
      </header>
      <QuestionCard question={question} />
      <section data-testid="opl-interview-card">
        <h4>Decision note</h4>
        <p>Confirm the action before execution; preview receipts stay separate.</p>
      </section>
      <section>
        <h4>Risk</h4>
        <ul>{card.risks.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h4>Will change</h4>
        <ul>{card.willChange.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h4>Will not change</h4>
        <ul>{card.willNotChange.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <footer>
        <span>{card.receipt}</span>
        <span>
          <RotateCcw aria-hidden="true" size={14} />
          {card.rollback}
        </span>
        <button
          type="button"
          onClick={() => onDryRun(card.dryRunAction, { confirmationId: card.id, questionId: question.id })}
        >
          Preview action
        </button>
      </footer>
    </article>
  );
}

export function RendererModuleRegistryPanel() {
  return (
    <section data-testid="opl-renderer-module-registry" className="module-registry">
      <h3>Preview engines</h3>
      <p>OSS renderers are registered as candidate adapters only.</p>
      <ul>
        {rendererModuleRegistry.map((module) => (
          <li key={module.id} data-testid="opl-renderer-module-card">
            <strong>{module.packageName}</strong>
            <span>{module.surface}</span>
            <small>{module.adapter}</small>
            {module.previewKinds?.length ? <code>{module.previewKinds.join(", ")}</code> : null}
          </li>
        ))}
      </ul>
      <dl>
        {Object.entries(previewKindRendererModuleMap).map(([kind, moduleId]) => (
          <div key={kind}>
            <dt>{kind}</dt>
            <dd>{moduleId}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
