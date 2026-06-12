import { t } from '@lingui/core/macro';
import { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import MajorCooldown, {
  CooldownTrigger,
  createChecklistItem,
  createSpellUse,
} from 'parser/core/MajorCooldowns/MajorCooldown';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import Events, { CastEvent } from 'parser/core/Events';
import { ChecklistUsageInfo, SpellUse } from 'parser/core/SpellUsage/core';
import { ReactNode } from 'react';
import SpellLink from 'interface/SpellLink';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Enemies from 'parser/shared/modules/Enemies';
import Enemy from 'parser/core/Enemy';
import {
  getMatchingDeathmarkOrKingsbaneCast,
  getMatchingShivOrKingsbaneCast,
  SHIV_KINGSBANE_BUFFER_MS,
} from 'analysis/retail/rogue/assassination/normalizers/KingsbaneLinkNormalizer';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import CooldownUsage from 'parser/core/MajorCooldowns/CooldownUsage';
import { formatDurationMillisMinSec } from 'common/format';
import uptimeBarSubStatistic from 'parser/ui/UptimeBarSubStatistic';
import {
  ExplanationSection,
  RoundedPanelWithBottomMargin,
} from 'analysis/retail/rogue/shared/styled-components';
import { ExperimentalKingsbaneHider } from 'analysis/retail/rogue/assassination/guide/ExperimentalKingsbaneContext';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';

interface KingsbaneCooldownTrigger extends CooldownTrigger<CastEvent> {
  enemy: Enemy | null;
}

interface KingsbaneCooldownTriggerWithEnemy extends KingsbaneCooldownTrigger {
  enemy: Enemy;
}

function hasEnemy(trigger: KingsbaneCooldownTrigger): trigger is KingsbaneCooldownTriggerWithEnemy {
  return Boolean(trigger.enemy);
}

export default class Kingsbane extends MajorCooldown<KingsbaneCooldownTrigger> {
  static dependencies = {
    ...MajorCooldown.dependencies,
    enemies: Enemies,
    spellUsable: SpellUsable,
  };

  protected enemies!: Enemies;
  protected spellUsable!: SpellUsable;

  constructor(options: Options) {
    super({ spell: TALENTS.KINGSBANE_TALENT }, options);

    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.KINGSBANE_TALENT),
      this.onCast,
    );
  }

  description(): ReactNode {
    return (
      <>
        <ExplanationSection>
          <p>
            <>
              <strong>
                <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              </strong>{' '}
              {t({
                id: 'rogue.assassination.kingsbane.description.text',
                message:
                  'is one of your core burst cooldowns that gets stronger with every Lethal Poison applied.',
              })}
            </>
          </p>
        </ExplanationSection>
        <ExplanationSection>
          <p>
            <>
              <strong>
                <SpellLink spell={SPELLS.ENVENOM} />
              </strong>{' '}
              {t({
                id: 'rogue.assassination.kingsbane.envenomUptimeNote.p1',
                message:
                  'uptime is very important for your Kingsbane windows. Try to maintain 100% uptime on ',
              })}
              <SpellLink spell={SPELLS.ENVENOM} />
              {t({
                id: 'rogue.assassination.kingsbane.envenomUptimeNote.p2',
                message: ' during your windows.',
              })}
            </>
          </p>
        </ExplanationSection>
      </>
    );
  }

  explainPerformance(trigger: KingsbaneCooldownTrigger): SpellUse {
    if (!hasEnemy(trigger)) {
      return createSpellUse(trigger, [
        createChecklistItem('hit-a-valid-target', trigger, {
          performance: QualitativePerformance.Fail,
          summary: (
            <div>
              {t({
                id: 'rogue.assassination.kingsbane.hitValidTarget',
                message: 'Hit a Valid Target',
              })}
            </div>
          ),
          details: (
            <div>
              {t({
                id: 'rogue.assassination.kingsbane.hitValidTargetDetail',
                message:
                  'Did not hit a valid target. Try to ensure that you hit a valid target with your important casts.',
              })}
            </div>
          ),
        }),
      ]);
    }

    return createSpellUse(trigger, [
      this.explainDeathmarkPerformance(trigger),
      this.explainEnvenomPerformance(trigger),
      this.explainShivPerformance(trigger),
    ]);
  }

  get guideSubsection(): ReactNode {
    return (
      <ExperimentalKingsbaneHider
        fallback={explanationAndDataSubsection(
          <div>
            <>
              <strong>
                <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              </strong>{' '}
              {t({
                id: 'rogue.assassination.kingsbane.breakdownComingSoon.text',
                message: 'cast breakdown coming soon!',
              })}
            </>
          </div>,
          <></>,
        )}
      >
        <CooldownUsage
          analyzer={this}
          abovePerformanceDetails={
            <RoundedPanelWithBottomMargin>
              <div>
                <>
                  <strong>
                    <SpellLink spell={SPELLS.ENVENOM} />
                    {t({
                      id: 'rogue.assassination.kingsbane.envenomUptimeHeader.bold',
                      message: ' uptime',
                    })}
                  </strong>
                  <small>
                    {t({
                      id: 'rogue.assassination.kingsbane.envenomUptimeHeader.text',
                      message: ' - Try to get as close to 100% as the encounter allows!',
                    })}
                  </small>
                </>
              </div>
              {uptimeBarSubStatistic(this.owner.fight, {
                spells: [SPELLS.ENVENOM],
                uptimes: this.envenomBuffUptimes,
              })}
            </RoundedPanelWithBottomMargin>
          }
          warning={{
            children: (
              <>
                <p>
                  <>
                    <strong>
                      <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
                    </strong>{' '}
                    {t({
                      id: 'rogue.assassination.kingsbane.experimentalWarning.text',
                      message:
                        'analysis is experimental and should be taken with a grain of salt. Thanks for being willing to try it out!',
                    })}
                  </>
                </p>
                <p>
                  {t({
                    id: 'rogue.assassination.kingsbane.notYetImplemented',
                    message: 'The below items are not yet implemented:',
                  })}
                </p>
                <ul>
                  <li>
                    <SpellLink spell={TALENTS.DEATHMARK_TALENT} />{' '}
                    {t({
                      id: 'rogue.assassination.kingsbane.usage',
                      message: 'usage',
                    })}
                  </li>
                  <li>
                    <>
                      {t({
                        id: 'rogue.assassination.kingsbane.fullyAccurateShiv.p1',
                        message: 'Fully accurate ',
                      })}
                      <SpellLink spell={TALENTS.SHIV_TALENT} />
                      {t({
                        id: 'rogue.assassination.kingsbane.fullyAccurateShiv.p2',
                        message: ' usage',
                      })}
                    </>
                    <ul>
                      <li>
                        <>
                          {t({
                            id: 'rogue.assassination.kingsbane.shivImplementationNote.p1',
                            message: 'Current implementation requires ',
                          })}
                          <SpellLink spell={TALENTS.SHIV_TALENT} />
                          {t({
                            id: 'rogue.assassination.kingsbane.shivImplementationNote.p2',
                            message: ' within ',
                          })}
                          {formatDurationMillisMinSec(SHIV_KINGSBANE_BUFFER_MS)}
                          {t({
                            id: 'rogue.assassination.kingsbane.shivImplementationNote.p3',
                            message: ' of casting ',
                          })}
                          <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
                        </>
                      </li>
                    </ul>
                  </li>
                </ul>
              </>
            ),
            style: { marginBottom: '30px' },
          }}
        />
      </ExperimentalKingsbaneHider>
    );
  }

  private get envenomBuffUptimes() {
    return this.selectedCombatant.getBuffHistory(SPELLS.ENVENOM.id).map((buff) => ({
      start: buff.start,
      end: buff.end ?? this.owner.fight.end_time,
    }));
  }

  private onCast(event: CastEvent) {
    const enemy = this.enemies.getEntity(event);

    this.recordCooldown({
      event,
      enemy,
    });
  }

  /*
  Kingsbane should be cast ~2s after Deathmark when Deathmark is available.
  Entirety of Kingsbane should fit within a Deathmark window.
   */
  /*
    TODO: implement the below behavior
    Whispyr — Yesterday at 11:38 PM
    :Cat_Nod:
    Envenom
    Deathmark
    Shiv
    Shadow dance + kingsbane (in that order)
    Garrote
    Envenom
    Is basically a set in stone sequence
    Topple — Yesterday at 11:40 PM
    :BearNotesTaking:
    Whispyr — Yesterday at 11:41 PM
    Sometimes garrote will be on cd
    But typically something like that
    Topple — Yesterday at 11:44 PM
    shadow dance + kingsbane is like a macro?
    Whispyr — Yesterday at 11:44 PM
    Yeah
    As long as the dance is before the kingsbane
    Even a microsecond after and it doesn’t snapshot
    So it’s doomed
     */
  private explainDeathmarkPerformance(
    trigger: KingsbaneCooldownTriggerWithEnemy,
  ): ChecklistUsageInfo | undefined {
    if (!this.selectedCombatant.hasTalent(TALENTS.DEATHMARK_TALENT)) {
      return undefined;
    }

    const summary = (
      <div>
        <>
          {t({
            id: 'rogue.assassination.kingsbane.fitWithinDeathmark.p1',
            message: 'Fit within ',
          })}
          <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
          {t({
            id: 'rogue.assassination.kingsbane.fitWithinDeathmark.p2',
            message: ' window',
          })}
        </>
      </div>
    );

    const isDeathmarkAvailable = this.spellUsable.isAvailable(TALENTS.DEATHMARK_TALENT.id);

    const deathmarkCast = getMatchingDeathmarkOrKingsbaneCast(trigger.event);
    if (!deathmarkCast && isDeathmarkAvailable) {
      return createChecklistItem('deathmark', trigger, {
        performance: QualitativePerformance.Fail,
        summary,
        details: (
          <div>
            <>
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkAvailableDetail.p1',
                message: 'You cast ',
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkAvailableDetail.p2',
                message: ' while ',
              })}
              <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkAvailableDetail.p3',
                message: ' was available and off cooldown. Try to always cast ',
              })}
              <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkAvailableDetail.p4',
                message: " before ",
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkAvailableDetail.p5',
                message: " when it's available.",
              })}
            </>
          </div>
        ),
      });
    }

    const anyEnemyHasDeathMark = Object.values(this.enemies.getEntities()).some(
      (it) => it.hasBuff(TALENTS.DEATHMARK_TALENT.id),
      trigger.event.timestamp,
    );
    const enemyHasDeathmark = trigger.enemy.hasBuff(
      TALENTS.DEATHMARK_TALENT.id,
      trigger.event.timestamp,
    );
    if (anyEnemyHasDeathMark && !enemyHasDeathmark) {
      return createChecklistItem('deathmark', trigger, {
        performance: QualitativePerformance.Fail,
        summary,
        details: (
          <div>
            <>
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkDifferentTargetDetail.p1',
                message: 'You cast ',
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkDifferentTargetDetail.p2',
                message: ' on a different target than you cast ',
              })}
              <SpellLink spell={TALENTS.DEATHMARK_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.deathmarkDifferentTargetDetail.p3',
                message: '. Always try to cast them on the same target.',
              })}
            </>
          </div>
        ),
      });
    }

    // TODO: finish
    return undefined;
  }

  /*
  TODO: implement the below behavior
  Whispyr — Yesterday at 11:38 PM
  :Cat_Nod:
  Envenom
  Deathmark
  Shiv
  Shadow dance + kingsbane (in that order)
  Garrote
  Envenom
  Is basically a set in stone sequence
  Topple — Yesterday at 11:40 PM
  :BearNotesTaking:
  Whispyr — Yesterday at 11:41 PM
  Sometimes garrote will be on cd
  But typically something like that
  Topple — Yesterday at 11:44 PM
  shadow dance + kingsbane is like a macro?
  Whispyr — Yesterday at 11:44 PM
  Yeah
  As long as the dance is before the kingsbane
  Even a microsecond after and it doesn’t snapshot
  So it’s doomed
   */

  /*
  TODO: implement the below behavior
  Topple — Today at 12:06 AM
  for the shiv in Kingsbane
  does the timing matter as long as it's during Kingsbane?
  Whispyr — Today at 12:06 AM
  Kinda? Should be as close to the expiration of the first as possible
  But if it’s like a gcd apart or whatever it’s not the end of the world
  Topple — Today at 12:07 AM
  okay, so tied to expiration of buff, got it
  is refreshing okay?
  Whispyr — Today at 12:07 AM
  Generally would want to avoid
  It doesn’t pandemic
  You just wanna back to back them
   */
  private explainShivPerformance(
    trigger: KingsbaneCooldownTriggerWithEnemy,
  ): ChecklistUsageInfo | undefined {
    const summary = (
      <div>
        <>
          <SpellLink spell={TALENTS.SHIV_TALENT} />
          {t({
            id: 'rogue.assassination.kingsbane.shivWithinWindow.text',
            message: ' within ',
          })}
          {formatDurationMillisMinSec(SHIV_KINGSBANE_BUFFER_MS)}
          {t({
            id: 'rogue.assassination.kingsbane.shivWithinWindow.suffix',
            message: ' after cast',
          })}
        </>
      </div>
    );
    const matchingShiv = getMatchingShivOrKingsbaneCast(trigger.event);

    if (!matchingShiv) {
      return createChecklistItem('shiv-after', trigger, {
        performance: QualitativePerformance.Fail,
        summary,
        details: (
          <div>
            <>
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p1',
                message: 'You did not cast ',
              })}
              <SpellLink spell={TALENTS.SHIV_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p2',
                message: ' within ',
              })}
              {formatDurationMillisMinSec(SHIV_KINGSBANE_BUFFER_MS)}
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p3',
                message: ' after casting ',
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />.
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p4',
                message: ' Try to always cast ',
              })}
              <SpellLink spell={TALENTS.SHIV_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p5',
                message: ' within ',
              })}
              {formatDurationMillisMinSec(SHIV_KINGSBANE_BUFFER_MS)}
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p6',
                message: ' after casting ',
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />
              {t({
                id: 'rogue.assassination.kingsbane.shivNotCastDetail.p7',
                message: ' so that your poison application buffs your ',
              })}
              <SpellLink spell={TALENTS.KINGSBANE_TALENT} />.
            </>
          </div>
        ),
      });
    }

    return createChecklistItem('shiv-after', trigger, {
      performance: QualitativePerformance.Good,
      summary,
      details: (
        <div>
          <>
            {t({
              id: 'rogue.assassination.kingsbane.shivCastDetail.p1',
              message: 'You cast ',
            })}
            <SpellLink spell={TALENTS.SHIV_TALENT} />
            {t({
              id: 'rogue.assassination.kingsbane.shivCastDetail.p2',
              message: ' within ',
            })}
            {formatDurationMillisMinSec(SHIV_KINGSBANE_BUFFER_MS)}
            {t({
              id: 'rogue.assassination.kingsbane.shivCastDetail.p3',
              message: ' after casting ',
            })}
            <SpellLink spell={TALENTS.KINGSBANE_TALENT} />.
            {t({
              id: 'rogue.assassination.kingsbane.shivCastDetail.p4',
              message: ' Good job!',
            })}
          </>
        </div>
      ),
    });
  }

  private explainEnvenomPerformance(
    trigger: KingsbaneCooldownTrigger,
  ): ChecklistUsageInfo | undefined {
    return undefined;
  }
}
