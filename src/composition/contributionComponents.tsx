import { Button, Pill, StateDot, Tooltip, type StateDotState } from "@deepseek-ai/dsh-client-ui-primitives";
import { Boxes, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  contributionLabel,
  type OplContributionSlotOwner,
  type OplUiContribution,
  type OplUiContributionBadge
} from "./contributionProjection";

function badgeState(badge: OplUiContributionBadge): StateDotState {
  if (badge.tone === "success") return "done";
  if (badge.tone === "warning") return "warning";
  if (badge.tone === "critical") return "error";
  return "ongoing";
}

function ContributionHeader({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const title = entry.view
    ? contributionLabel(entry.view.title, owner.locale, entry.contributionId)
    : entry.contributionId;
  return (
    <header className="opl-contribution-header">
      <span className="opl-contribution-title">
        <Boxes aria-hidden="true" size={15} />
        <strong>{title}</strong>
      </span>
      <span className="opl-contribution-meta">
        <Pill>{entry.packageId}</Pill>
        <Pill active={entry.trustTier === "trusted_first_party_renderer"}>
          {entry.trustTier === "trusted_first_party_renderer" ? "OPL" : "JSON"}
        </Pill>
      </span>
    </header>
  );
}

function ContributionBadges({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  if (!entry.badges.length) return null;
  return (
    <div className="opl-contribution-badges">
      {entry.badges.map((badge) => (
        <Pill key={badge.badgeId}>
          <StateDot state={badgeState(badge)} size={9} />
          {contributionLabel(badge.label, owner.locale, badge.badgeId)}
        </Pill>
      ))}
    </div>
  );
}

function ContributionActions({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  if (!entry.commands.length) return null;
  return (
    <div className="opl-contribution-actions">
      {entry.commands.map((command) => {
        const label = contributionLabel(command.label, owner.locale, command.commandId);
        return (
          <Tooltip
            key={command.commandId}
            label={!owner.actionAvailable
              ? (owner.locale === "zh" ? "当前 App action catalog 未提供此操作" : "Unavailable in the current App action catalog")
              : command.confirmationRequired
                ? (owner.locale === "zh" ? "先预览，再确认执行" : "Preview before confirmation")
                : (owner.locale === "zh" ? "通过 OPL App 预览操作" : "Preview through OPL App")}
            side="top"
          >
            <Button
              variant={command.confirmationRequired ? "outline" : "ghost"}
              size="sm"
              icon={<Play aria-hidden="true" size={13} />}
              disabled={!owner.actionAvailable}
              onClick={() => owner.onAction(entry, command)}
            >
              {label}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function fieldLabel(value: string, locale: OplContributionSlotOwner["locale"]): string {
  const labels: Record<string, [string, string]> = {
    hypothesis: ["假设", "Hypothesis"],
    hypotheses: ["假设", "Hypotheses"],
    roadmap: ["路线图", "Roadmap"],
    milestones: ["里程碑", "Milestones"],
    status: ["状态", "Status"],
    next_step: ["下一步", "Next step"],
    next_steps: ["下一步", "Next steps"],
    owner: ["负责人", "Owner"],
    blockers: ["阻塞项", "Blockers"],
    evidence: ["证据", "Evidence"],
    updated_at: ["更新时间", "Updated"]
  };
  const localized = labels[value.toLowerCase()];
  if (localized) return localized[locale === "zh" ? 0 : 1];
  return value.replaceAll("_", " ");
}

function StructuredValue({ value, locale, depth = 0 }: {
  value: unknown;
  locale: OplContributionSlotOwner["locale"];
  depth?: number;
}): ReactNode {
  if (value === null || value === undefined) return <span className="opl-structured-empty">-</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="opl-structured-scalar">{String(value)}</span>;
  }
  if (depth >= 5) return <span className="opl-structured-empty">...</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="opl-structured-empty">{locale === "zh" ? "暂无内容" : "No items"}</span>;
    return (
      <ul className="opl-structured-list">
        {value.slice(0, 100).map((item, index) => <li key={index}><StructuredValue value={item} locale={locale} depth={depth + 1} /></li>)}
      </ul>
    );
  }
  if (typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>).slice(0, 100);
    if (!fields.length) return <span className="opl-structured-empty">{locale === "zh" ? "暂无内容" : "No fields"}</span>;
    return (
      <dl className="opl-structured-fields">
        {fields.map(([key, item]) => (
          <div key={key}>
            <dt>{fieldLabel(key, locale)}</dt>
            <dd><StructuredValue value={item} locale={locale} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="opl-structured-scalar">{String(value)}</span>;
}

function ContributionView({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const view = entry.view;

  useEffect(() => {
    if (!view) return;
    let active = true;
    setState("loading");
    setError("");
    void owner.readData(entry).then((value) => {
      if (!active) return;
      setResult(value);
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setResult(null);
      setError(String(reason));
      setState("error");
    });
    return () => { active = false; };
  }, [entry.packageId, owner.readData, view?.dataRef]);

  if (!view) return null;
  if (state === "loading") {
    return <p className="opl-contribution-fallback" role="status"><StateDot state="ongoing" size={10} />{owner.locale === "zh" ? "正在读取模块数据" : "Loading module data"}</p>;
  }
  if (state === "error") {
    return <p className="opl-contribution-fallback" role="status" title={error}><StateDot state="warning" size={10} />{view.emptyState ? contributionLabel(view.emptyState, owner.locale, "") : (owner.locale === "zh" ? "模块数据当前不可用" : "Module data is unavailable")}</p>;
  }
  return (
    <div className="opl-contribution-result" data-view-type={view.viewType} data-testid={`opl-ui-contribution-result-${entry.contributionKey}`}>
      <StructuredValue value={result} locale={owner.locale} />
    </div>
  );
}

export function ProjectedContribution({ entry, owner }: {
  entry: OplUiContribution;
  owner: OplContributionSlotOwner;
}) {
  const supported = entry.contributionKind === "command_group"
    || (entry.contributionKind === "view" && entry.view !== undefined);
  return (
    <section
      className="opl-contribution"
      data-slot={entry.slot}
      data-testid={`opl-ui-contribution-${entry.contributionKey}`}
    >
      <ContributionHeader entry={entry} owner={owner} />
      {supported ? (
        <>
          <ContributionView entry={entry} owner={owner} />
          <ContributionBadges entry={entry} owner={owner} />
          <ContributionActions entry={entry} owner={owner} />
        </>
      ) : (
        <p className="opl-contribution-fallback" role="status">
          <StateDot state="warning" size={10} />
          {owner.locale === "zh"
            ? `暂不支持 ${entry.contributionKind}，其他模块仍可使用。`
            : `${entry.contributionKind} is not supported; other modules remain available.`}
        </p>
      )}
    </section>
  );
}
