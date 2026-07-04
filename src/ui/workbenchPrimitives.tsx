import { rendererModuleRegistry } from "../renderers/moduleRegistry";

export function RendererModuleRegistryPanel() {
  return (
    <section data-testid="opl-renderer-module-registry" className="module-registry">
      <h3>Renderer modules</h3>
      <p>{rendererModuleRegistry.policy}</p>
      <ul>
        {rendererModuleRegistry.primitives.concat(rendererModuleRegistry.richText).map((moduleName) => (
          <li key={moduleName} data-testid="opl-renderer-module-card">{moduleName}</li>
        ))}
      </ul>
    </section>
  );
}

export type ConfirmationCardProps = {
  title: string;
  questions: string[];
  risks: string[];
  willChange: string[];
  willNotChange: string[];
  receipt: string;
  rollback: string;
};

export function ConfirmationCard(props: ConfirmationCardProps) {
  return (
    <article data-testid="opl-confirmation-card" className="confirmation-card">
      <h3>{props.title}</h3>
      <section data-testid="opl-question-card">
        <h4>Questions</h4>
        <ul>{props.questions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section data-testid="opl-interview-card">
        <h4>Interview</h4>
        <p>Collect user input before execute; dry-run receipts stay separate.</p>
      </section>
      <section>
        <h4>Risk</h4>
        <ul>{props.risks.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h4>Will change</h4>
        <ul>{props.willChange.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h4>Will not change</h4>
        <ul>{props.willNotChange.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <footer>
        <span>{props.receipt}</span>
        <span>{props.rollback}</span>
      </footer>
    </article>
  );
}
