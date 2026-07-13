import type { WorkbenchCoordinationEvent, WorkbenchCoordinationOperation } from "../workbenchModel";

type CoordinationEventsProps = {
  operation: WorkbenchCoordinationOperation | null;
  events: WorkbenchCoordinationEvent[];
  locale: "zh" | "en";
};

export function CoordinationEvents({ operation, events, locale }: CoordinationEventsProps) {
  const directionLabel = locale === "zh"
    ? { source: "源对话", target: "目标对话", system: "协调队列" }
    : { source: "Source", target: "Target", system: "Coordination" };
  const phaseLabel = locale === "zh"
    ? { proposal: "提案", confirmation: "待确认", queued: "队列中", conflict: "冲突", result: "结果" }
    : { proposal: "Proposal", confirmation: "Confirmation", queued: "Queued", conflict: "Conflict", result: "Result" };

  return (
    <section data-testid="opl-coordination-events" className="coordination-events" aria-live="polite">
      {operation ? (
        <div className="coordination-current-state" data-phase={operation.phase}>
          <span>{phaseLabel[operation.phase]}</span>
          <p>{operation.conflict ?? operation.result ?? operation.summary}</p>
          {operation.queuePosition !== undefined ? <small>#{operation.queuePosition}</small> : null}
        </div>
      ) : null}
      {events.length ? (
        <ol>
          {events.map((event) => (
            <li key={event.id} data-phase={event.phase}>
              <header>
                <span data-direction={event.direction}>{directionLabel[event.direction]}</span>
                <strong>{event.label}</strong>
                <small>{phaseLabel[event.phase]}</small>
              </header>
              {event.detail ? <p>{event.detail}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
