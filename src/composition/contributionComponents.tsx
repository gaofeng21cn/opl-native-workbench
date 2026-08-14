import { Button, Pill, StateDot, Tooltip, type StateDotState } from "@deepseek-ai/dsh-client-ui-primitives";
import { Boxes, Play } from "lucide-react";
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
          {entry.view ? (
            <div className="opl-contribution-view">
              <span>{entry.view.viewType.replaceAll("_", " ")}</span>
              <code>{entry.view.dataRef}</code>
            </div>
          ) : null}
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
