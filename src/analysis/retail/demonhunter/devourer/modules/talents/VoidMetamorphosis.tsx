import type { JSX } from 'react';
import SPELLS from 'common/SPELLS/demonhunter';
import { ResourceLink, SpellLink } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { GUIDE_CORE_EXPLANATION_PERCENT } from '../../Guide';
import Events, { CastEvent, DeathEvent, FightEndEvent, RemoveBuffEvent } from 'parser/core/Events';
import { SubSection } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import CooldownExpandable, {
  CooldownExpandableItem,
} from 'interface/guide/components/CooldownExpandable';
import { getAveragePerf, QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { formatNumber, formatPercentage } from 'common/format';
import { PerformanceMark } from 'interface/guide';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import AlwaysBeCasting from 'parser/shared/modules/AlwaysBeCasting';
import Abilities from '../Abilities';
import { VOID_RAY_COOLDOWN_VOID_METAMORPHOSIS } from '../../constants';
import StatTracker from 'parser/shared/modules/StatTracker';

interface VoidMetamorphosisTracker {
  startTimestamp: number;
  endTimestamp: number;
  totalCasts: number;
  totalCullCasts: number;
  smuggledToll: boolean;
}

interface castBreakdownItem {
  performance: QualitativePerformance;
  checklistItem: CooldownExpandableItem;
}

class VoidMetamorphosis extends Analyzer.withDependencies({
  alwaysBeCasting: AlwaysBeCasting,
  statTracker: StatTracker,
  abilities: Abilities,
}) {
  #castTrackers: VoidMetamorphosisTracker[] = [];
  #momentOfCravingTalented = this.selectedCombatant.hasTalent(
    TALENTS_DEMON_HUNTER.MOMENT_OF_CRAVING_TALENT,
  );
  #hungeringSlashTalented = this.selectedCombatant.hasTalent(
    TALENTS_DEMON_HUNTER.HUNGERING_SLASH_TALENT,
  );

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(SPELLS.VOID_METAMORPHOSIS_CAST),
      this.#onVoidMetamorphosisCast,
    );

    this.addEventListener(
      Events.removebuff.by(SELECTED_PLAYER).spell(SPELLS.VOID_METAMORPHOSIS_BUFF),
      this.#onVoidMetamorphosisEnd,
    );

    this.addEventListener(Events.death.to(SELECTED_PLAYER), this.#onFightEndOrDeath);

    this.addEventListener(Events.fightend, this.#onFightEndOrDeath);

    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.CULL), this.#onCast);
  }

  #onVoidMetamorphosisCast(event: CastEvent) {
    const smuggledToll = this.selectedCombatant.hasBuff(SPELLS.REAPERS_TOLL_BUFF);

    this.#castTrackers.push({
      startTimestamp: event.timestamp,
      endTimestamp: 0,
      totalCasts: 0,
      totalCullCasts: 0,
      smuggledToll: smuggledToll,
    });
  }

  #onFightEndOrDeath(event: DeathEvent | FightEndEvent) {
    if (!this.selectedCombatant.hasBuff(SPELLS.VOID_METAMORPHOSIS_BUFF)) {
      return;
    }
    this.#castTrackers.at(-1)!.endTimestamp = event.timestamp;
  }

  #onVoidMetamorphosisEnd(event: RemoveBuffEvent) {
    this.#castTrackers.at(-1)!.endTimestamp = event.timestamp;
  }

  #onCast(cast: CastEvent) {
    if (!this.selectedCombatant.hasBuff(SPELLS.VOID_METAMORPHOSIS_BUFF)) {
      return;
    }

    if (cast.ability.guid === SPELLS.CULL.id) {
      this.#castTrackers.at(-1)!.totalCullCasts += 1;
    }
  }

  get #buffHistory() {
    return this.selectedCombatant.getBuffHistory(SPELLS.VOID_METAMORPHOSIS_BUFF.id);
  }

  #computeExpectedCullCasts(cast: VoidMetamorphosisTracker): number {
    const currentHastePercentage = this.deps.statTracker.currentHastePercentage;
    const cullAbility = this.deps.abilities.getAbility(SPELLS.CULL.id);
    const voidMetamorphosiCastDurationSeconds = (cast.endTimestamp - cast.startTimestamp) / 1000;
    const potentialVoidRayCasts = Math.floor(
      voidMetamorphosiCastDurationSeconds /
        VOID_RAY_COOLDOWN_VOID_METAMORPHOSIS(currentHastePercentage),
    );

    let expectedCullCasts = Math.floor(voidMetamorphosiCastDurationSeconds / cullAbility!.cooldown);
    // Void Ray resets the cooldown of Cull with Moment of Craving
    if (this.#momentOfCravingTalented) {
      expectedCullCasts += potentialVoidRayCasts;
    }
    if (cullAbility!.charges > 1) expectedCullCasts += 1;

    return expectedCullCasts;
  }

  #getCullItem(cast: VoidMetamorphosisTracker): castBreakdownItem {
    const expectedCullCasts = this.#computeExpectedCullCasts(cast);

    let cullPerformance = QualitativePerformance.Fail;
    if (cast.totalCullCasts >= expectedCullCasts) {
      cullPerformance = QualitativePerformance.Perfect;
    } else if (cast.totalCullCasts >= expectedCullCasts - 2) {
      cullPerformance = QualitativePerformance.Good;
    } else if (cast.totalCullCasts >= expectedCullCasts - 4) {
      cullPerformance = QualitativePerformance.Ok;
    }

    const cullChecklistItem: CooldownExpandableItem = {
      label: (
        <>
          <SpellLink spell={SPELLS.CULL} />{' '}
          {t({ id: 'guide.demonhunter.devourer.vm.casts', message: 'casts' })}
        </>
      ),
      result: <PerformanceMark perf={cullPerformance} />,
      details: <>{formatNumber(cast.totalCullCasts)}</>,
    };

    return { performance: cullPerformance, checklistItem: cullChecklistItem };
  }

  #getActiveTimeItem(cast: VoidMetamorphosisTracker): castBreakdownItem {
    let activeTimePerformance = QualitativePerformance.Fail;
    const activeTimePercentageDuringWindow =
      this.deps.alwaysBeCasting.getActiveTimePercentageInWindow(
        cast.startTimestamp,
        cast.endTimestamp,
      );

    if (activeTimePercentageDuringWindow >= 0.98) {
      activeTimePerformance = QualitativePerformance.Perfect;
    } else if (activeTimePercentageDuringWindow >= 0.95) {
      activeTimePerformance = QualitativePerformance.Good;
    } else if (activeTimePercentageDuringWindow >= 0.9) {
      activeTimePerformance = QualitativePerformance.Ok;
    }

    const activeTimeChecklistItem: CooldownExpandableItem = {
      label: t({ id: 'guide.demonhunter.devourer.vm.activeTime', message: 'Active time' }),
      result: <PerformanceMark perf={activeTimePerformance} />,
      details: <>{formatPercentage(activeTimePercentageDuringWindow)}%</>,
    };

    return { performance: activeTimePerformance, checklistItem: activeTimeChecklistItem };
  }

  #getSmugglingItem(cast: VoidMetamorphosisTracker): castBreakdownItem {
    const smugglingPerformance = cast.smuggledToll
      ? QualitativePerformance.Good
      : QualitativePerformance.Fail;
    const smugglingChecklistItem: CooldownExpandableItem = {
      label: (
        <>
          {t({ id: 'guide.demonhunter.devourer.vm.smuggled.p1', message: 'Smuggled ' })}
          <SpellLink spell={SPELLS.HUNGERING_SLASH_CAST} />
        </>
      ),
      result: <PerformanceMark perf={smugglingPerformance} />,
      details: (
        <>
          {cast.smuggledToll
            ? t({ id: 'guide.demonhunter.devourer.vm.yes', message: 'Yes' })
            : t({ id: 'guide.demonhunter.devourer.vm.no', message: 'No' })}
        </>
      ),
    };

    return { performance: smugglingPerformance, checklistItem: smugglingChecklistItem };
  }

  #getCastBreakdownItems(
    cast: VoidMetamorphosisTracker,
  ): [QualitativePerformance[], CooldownExpandableItem[]] {
    const performances: QualitativePerformance[] = [];
    const checklistItems: CooldownExpandableItem[] = [];

    const activeTimeItem = this.#getActiveTimeItem(cast);
    performances.push(activeTimeItem.performance);
    checklistItems.push(activeTimeItem.checklistItem);

    const cullItem = this.#getCullItem(cast);
    performances.push(cullItem.performance);
    checklistItems.push(cullItem.checklistItem);

    if (this.#hungeringSlashTalented) {
      const smugglingItem = this.#getSmugglingItem(cast);
      performances.push(smugglingItem.performance);
      checklistItems.push(smugglingItem.checklistItem);
    }

    return [performances, checklistItems];
  }

  #castBreakdownGuidePart(): JSX.Element {
    const explanation = (
      <>
        <p>
          {t({ id: 'guide.demonhunter.devourer.vm.explanation1.p1', message: 'As ' })}
          <span className="DemonHunter">{t({ id: 'guide.demonhunter.devourer.vm.explanation1.span', message: 'Devourer' })}</span>
          {t({ id: 'guide.demonhunter.devourer.vm.explanation1.p2', message: ', the greater share of your damage is dealt during ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation1.p3', message: '.' })}
        </p>
        <p>
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p1', message: 'During ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p2', message: ', ' })}
          <ResourceLink id={RESOURCE_TYPES.FURY.id} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p3', message: ' is constantly consumed. Fight this process by generating ' })}
          <ResourceLink id={RESOURCE_TYPES.FURY.id} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p4', message: ' using your abilities. ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_RAY_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p5', message: ', ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOIDBLADE_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p6', message: ' and ' })}
          <SpellLink spell={TALENTS_DEMON_HUNTER.THE_HUNT_DEVOURER_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation2.p7', message: ' stop the fury drain\u2014 use them on cooldown!' })}
          <div>
            {t({ id: 'guide.demonhunter.devourer.vm.explanation3.p1', message: 'In order to extend ' })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
            {t({ id: 'guide.demonhunter.devourer.vm.explanation3.p2', message: ' the longest, it is mandatory to keep up near-perfect active time.' })}
          </div>
        </p>
        <hr />
        <p>
          <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation4.p1', message: ' upgrades ' })}
          <SpellLink spell={SPELLS.REAP} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation4.p2', message: ' to ' })}
          <SpellLink spell={SPELLS.CULL} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation4.p3', message: '. The latter becomes uncommonly powerful and should be used as much as possible with 4 ' })}
          <SpellLink spell={SPELLS.SOUL_FRAGMENT_DEVOUR} />
          {t({ id: 'guide.demonhunter.devourer.vm.explanation4.p4', message: ' or more.' })}
        </p>
        {this.selectedCombatant.hasTalent(TALENTS_DEMON_HUNTER.HUNGERING_SLASH_TALENT) && (
          <>
            <hr />
            <p>
              <SpellLink spell={SPELLS.HUNGERING_SLASH_CAST} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p1', message: ' becomes ' })}
              <SpellLink spell={SPELLS.REAPERS_TOLL_CAST} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p2', message: ' for much higher damage. You can press ' })}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VOIDBLADE_TALENT} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p3', message: ' or ' })}
              <SpellLink spell={TALENTS_DEMON_HUNTER.THE_HUNT_DEVOURER_TALENT} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p4', message: ' right before entering ' })}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p5', message: ' to convert one to the other. This allows for at least three ' })}
              <SpellLink spell={SPELLS.REAPERS_TOLL_CAST} />
              {t({ id: 'guide.demonhunter.devourer.vm.explanation5.p6', message: ' casts during your cooldown window, instead of two. This is referred to as smuggling.' })}
            </p>
          </>
        )}
      </>
    );

    const data = (
      <div>
        <b>
          {t({
            id: 'guide.demonhunter.devourer.vm.perCastBreakdown',
            message: 'Per-Cast Breakdown',
          })}
        </b>
        <small>
          {t({ id: 'guide.demonhunter.devourer.vm.clickToExpand', message: '- click to expand' })}
        </small>
        {this.#castTrackers.map((cast, index) => {
          const header = (
            <>
              @ {this.owner.formatTimestamp(cast.startTimestamp)} &mdash;{' '}
              <SpellLink spell={TALENTS_DEMON_HUNTER.VOID_METAMORPHOSIS_TALENT} />
            </>
          );

          const castBreakdownItems = this.#getCastBreakdownItems(cast);
          const averagePerformance = getAveragePerf(castBreakdownItems[0]);
          const checklistItems = castBreakdownItems[1];

          return (
            <CooldownExpandable
              header={header}
              checklistItems={checklistItems}
              perf={averagePerformance}
              key={index}
            />
          );
        })}
      </div>
    );

    return explanationAndDataSubsection(explanation, data, GUIDE_CORE_EXPLANATION_PERCENT);
  }

  #uptimeGuidePart(): JSX.Element {
    return (
      <>
        <div>
          <b>{t({ id: 'guide.demonhunter.devourer.vm.uptimeGraph', message: 'Uptime graph' })}</b>{' '}
          <Trans id="guide.demonhunter.devourer.vm.uptimeGraphDesc">
            - grey segments show when the buff was not active, yellow segments show when it was
            active.
          </Trans>
        </div>
        <>
          {uptimeBarSubStatistic(this.owner.fight, {
            spells: [SPELLS.VOID_METAMORPHOSIS_BUFF],
            uptimes: this.#buffHistory.map((buff) => ({
              start: buff.start,
              end: buff.end ?? this.owner.fight.end_time,
            })),
          })}
        </>
      </>
    );
  }

  guideSubsection(): JSX.Element {
    return (
      <SubSection
        title={t({
          id: 'guide.demonhunter.devourer.vm.title',
          message: 'Void Metamorphosis',
        })}
      >
        {this.#uptimeGuidePart()}
        {this.#castBreakdownGuidePart()}
      </SubSection>
    );
  }
}

export default VoidMetamorphosis;
