import type { JSX } from 'react';
import EventHistory from 'parser/shared/modules/EventHistory';
import ShadowDance, { ShadowDanceData } from '../modules/spells/ShadowDance';
import Analyzer from 'parser/core/Analyzer';
import SPELLS from 'common/SPELLS/rogue';
import TALENTS from 'common/TALENTS/rogue';
import SpellUsable from 'parser/shared/modules/SpellUsable';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { formatPercentage, formatNumber, formatDurationMillisMinSec } from 'common/format';
import GuideSection from 'interface/guide/components/GuideSection';
import { SpellLink } from 'interface';
import {
  SpellSequence,
  type CastSequenceEntry,
  type CastInSequence,
} from 'interface/guide/components/CastSequence';
import CastOverview from 'interface/guide/components/CastOverview';
import CastDetail, { type PerCastData } from 'interface/guide/components/CastDetail';
import { EventType } from 'parser/core/Events';
import DamageDone from 'parser/shared/modules/throughput/DamageDone';
import InformationIcon from 'interface/icons/Information';
import { defineMessage, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { i18n } from '@lingui/core';

class ShadowDanceGuide extends Analyzer.withDependencies({
  damageDone: DamageDone,
  shadowDance: ShadowDance,
  eventHistory: EventHistory,
  spellUsable: SpellUsable,
}) {
  protected damageDone!: DamageDone;
  protected shadowDance!: ShadowDance;
  protected eventHistory!: EventHistory;
  protected spellUsable!: SpellUsable;

  isTrickster = this.selectedCombatant.hasTalent(TALENTS.UNSEEN_BLADE_TALENT);
  isDeathstalker = this.selectedCombatant.hasTalent(TALENTS.DEATHSTALKERS_MARK_TALENT);

  private evaluateShadowDanceUsage(dance: ShadowDanceData) {
    const energyAtCast = dance.energyAtCast;
    const comboPointsAtCast = dance.comboPointsAtCast;
    const hasShadowBladesActive =
      this.shadowDance.hasShadowBlades &&
      this.selectedCombatant.hasBuff(TALENTS.SHADOW_BLADES_TALENT, dance.applied);
    const secTecOnCooldown = this.spellUsable.isOnCooldown(SPELLS.SECRET_TECHNIQUE.id);
    const cooldownsReady = secTecOnCooldown && !hasShadowBladesActive;
    const enoughEnergyForEviscerate =
      hasShadowBladesActive && secTecOnCooldown && energyAtCast < 35;
    const enoughEnergyForSecTec = !secTecOnCooldown && energyAtCast < 30;
    const maxAbilities = Math.ceil(dance.duration / 1000);
    const abilitiesUsed = dance.numberAbilitiesUsed || 0;

    // Cooldown Availability
    if (cooldownsReady) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Fail,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.cooldownsReady',
            message:
              'Shadow Dance was used when neither Shadow Blades was active nor Secret Technique was available.',
          }),
        ),
      };
    }

    // Energy check for second SD cast during Shadow Blades
    if (enoughEnergyForEviscerate) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Fail,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.energyForEviscerate',
            message: `Entered Shadow Dance without enough energy for Eviscerate(35). Had ${energyAtCast} energy.`,
          }),
        ),
      };
    }

    // Energy check for SD and SecTec (with our without Shadow Blades)
    if (enoughEnergyForSecTec) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Fail,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.energyForSecTec',
            message: `Entered Shadow Dance without enough energy for Secret Technique(30). Had ${energyAtCast} energy.`,
          }),
        ),
      };
    }

    // Combo Point check
    if (comboPointsAtCast < 6) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Fail,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.comboPoints',
            message: `Entered Shadow Dance with suboptimal combo points. Had ${comboPointsAtCast} combo points.`,
          }),
        ),
      };
    }

    if (abilitiesUsed === maxAbilities) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Perfect,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.perfect',
            message: 'Excellent Shadow Dance usage! You spend all possible gcds using abilities.',
          }),
        ),
      };
    }

    if (abilitiesUsed === maxAbilities - 1) {
      return {
        timestamp: dance.applied,
        performance: QualitativePerformance.Good,
        reason: i18n._(
          defineMessage({
            id: 'rogue.subtlety.shadowDance.evaluation.good',
            message:
              'Good Shadow Dance usage! You could have cast one more ability during this Shadow Dance.',
          }),
        ),
      };
    }

    return {
      timestamp: dance.applied,
      performance: QualitativePerformance.Fail,
      reason: i18n._(
        defineMessage({
          id: 'rogue.subtlety.shadowDance.evaluation.suboptimal',
          message: `Shadow Dance uptime was suboptimal. You missed ${maxAbilities - abilitiesUsed} abilities.`,
        }),
      ),
    };
  }

  get guideSubsection(): JSX.Element {
    const shadowDance = <SpellLink spell={SPELLS.SHADOW_DANCE} />;
    const secretTechniques = <SpellLink spell={SPELLS.SECRET_TECHNIQUE} />;
    const shadowBlades = <SpellLink spell={TALENTS.SHADOW_BLADES_TALENT} />;
    const deepeningShadows = <SpellLink spell={TALENTS.DEEPENING_SHADOWS_TALENT} />;

    const explanation = (
      <div>
        <p>
          <Trans id="rogue.subtlety.shadowDance.explanation.main">
            {shadowDance} is our main short time cooldown. It interacts with several talents in our
            tree. During {shadowDance} we have increased damage and enhanced combo point and energy
            generation.
          </Trans>
        </p>
        <Trans id="rogue.subtlety.shadowDance.explanation.maximizeIntro">
          In order to maximize damage you want to:
        </Trans>
        <ul>
          {this.isTrickster && (
            <li>
              <Trans id="rogue.subtlety.shadowDance.explanation.trickster">
                Enter with 6+ combo points.
              </Trans>
            </li>
          )}
          {this.isDeathstalker && (
            <li>
              <Trans id="rogue.subtlety.shadowDance.explanation.deathstalker">
                Enter with low combo points.
              </Trans>
            </li>
          )}
          <li>
            <Trans id="rogue.subtlety.shadowDance.explanation.alignCooldown">
              Align this cooldown with {secretTechniques}, except in the second use during{' '}
              {shadowBlades}.
            </Trans>
          </li>
          <li>
            <Trans id="rogue.subtlety.shadowDance.explanation.energy">
              Make sure you have enough energy to instantly throw your finisher, this is a common
              mistake.
            </Trans>
          </li>
          <li>
            <Trans id="rogue.subtlety.shadowDance.explanation.castAbilities">
              Cast as many abilities as you can.
            </Trans>
          </li>
        </ul>
        <h5>
          <InformationIcon />
          <i>
            <Trans id="rogue.subtlety.shadowDance.explanation.hasteNotes">
              Haste and GCDs notes
            </Trans>
          </i>
        </h5>
        <p>
          <Trans id="rogue.subtlety.shadowDance.explanation.hasteDetail">
            {shadowDance} duration increases with flat haste stat due to {deepeningShadows}. You
            will want to fit the maximum amount of GCDs within your {shadowDance}.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.subtlety.shadowDance.explanation.hasteExample">
            i.e. if your {shadowDance} lasts 7.1s, you will want to squeeze 8 abilities within it.
            Sometimes that .1s window is very tight.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.subtlety.shadowDance.explanation.macros">
            If you're struggling to squeeze that last ability, you might want to increase your haste
            a bit. Macros are of particular interest here. They will allow you to send {shadowDance}{' '}
            and the first GCD at the exact same time.
          </Trans>
        </p>
        <p>
          <Trans id="rogue.subtlety.shadowDance.explanation.macroLinks">
            Check
            <a href="https://www.wowhead.com/guide/classes/rogue/subtlety/addons-macro-ui-imports#macros-macros-combining-abilities">
              {' '}
              wowhead{' '}
            </a>
            or
            <a href="https://www.icy-veins.com/wow/subtlety-rogue-pve-dps-macros-addons">
              {' '}
              icy-veins{' '}
            </a>
            macros section for more information.
          </Trans>
        </p>
      </div>
    );

    const totalDamageTooltip = (
      <>
        <Trans id="rogue.subtlety.shadowDance.tooltip.totalDamage">
          Total Damage done through all {shadowDance} Uses.
        </Trans>
      </>
    );

    const percentageDuringShadowDanceTooltip = (
      <>
        <Trans id="rogue.subtlety.shadowDance.tooltip.damageFraction">
          Fraction of total damage done through all {shadowDance} Uses.
        </Trans>
      </>
    );

    const activeTimeDuringShadowDanceTooltip = (
      <>
        <Trans id="rogue.subtlety.shadowDance.tooltip.activeTime">
          Average active time during {shadowDance} casts.
        </Trans>
      </>
    );

    // Get cast sequences for each Shadow Dance window
    const danceSequenceEvents: CastSequenceEntry<ShadowDanceData>[] =
      this.shadowDance.danceData.map((dance) => {
        const castEvents = this.eventHistory
          .getEvents([EventType.Cast], {
            searchBackwards: false,
            startTimestamp: dance.applied,
            duration: dance.removed - dance.applied,
          })
          .filter(
            (event) =>
              event.ability.guid === SPELLS.SECRET_TECHNIQUE.id ||
              event.ability.guid === SPELLS.EVISCERATE.id ||
              event.ability.guid === SPELLS.COUP_DE_GRACE_CAST.id ||
              event.ability.guid === SPELLS.BLACK_POWDER.id ||
              event.ability.guid === SPELLS.SHADOWSTRIKE.id ||
              event.ability.guid === SPELLS.SHURIKEN_STORM.id,
          );

        const casts: CastInSequence[] = castEvents.map((event) => ({
          timestamp: event.timestamp,
          spellId: event.ability.guid,
          spellName: event.ability.name,
          icon: event.ability.abilityIcon.replace('.jpg', ''),
          performance: undefined,
        }));

        dance.numberAbilitiesUsed = castEvents.length;

        return {
          data: dance,
          start: dance.applied,
          end: dance.removed,
          casts: casts,
        };
      });

    const perCastData: PerCastData[] = this.shadowDance.danceData.map((dance, index) => {
      const evaluation = this.evaluateShadowDanceUsage(dance);
      const sequenceEntry = danceSequenceEvents[index];
      return {
        performance: evaluation.performance,
        timestamp: this.owner.formatTimestamp(dance.applied),
        stats: [
          {
            value: formatNumber(dance.totalDamage),
            label: i18n._(
              defineMessage({ id: 'rogue.subtlety.shadowDance.stat.damage', message: 'Damage' }),
            ),
            tooltip: (
              <Trans id="rogue.subtlety.shadowDance.stat.damageTooltip">
                Total damage accumulated during this Shadow Dance
              </Trans>
            ),
          },
          {
            value: `${formatDurationMillisMinSec(dance.duration, 2)}`,
            label: i18n._(
              defineMessage({
                id: 'rogue.subtlety.shadowDance.stat.duration',
                message: 'Duration',
              }),
            ),
            tooltip: (
              <Trans id="rogue.subtlety.shadowDance.stat.durationTooltip">
                Duration of this Shadow Dance
              </Trans>
            ),
          },
          {
            value: formatNumber(dance.numberAbilitiesUsed || 0),
            label: i18n._(
              defineMessage({ id: 'rogue.subtlety.shadowDance.stat.casts', message: 'Casts' }),
            ),
            tooltip: (
              <>
                {t({
                  id: 'rogue.subtlety.shadowDance.stat.castsTooltip',
                  message: 'Total casts',
                })}
              </>
            ),
          },
        ],
        details: evaluation.reason,
        additionalContent: sequenceEntry
          ? {
              title: i18n._(
                defineMessage({
                  id: 'rogue.subtlety.shadowDance.stat.castSequence',
                  message: 'Cast Sequence',
                }),
              ),
              content: <SpellSequence casts={sequenceEntry.casts} iconSize={40} />,
            }
          : undefined,
      };
    });

    return (
      <GuideSection spell={SPELLS.SHADOW_DANCE} explanation={explanation}>
        <CastOverview
          spell={SPELLS.SHADOW_DANCE}
          stats={[
            {
              value: `${formatNumber(this.shadowDance.danceTotalDamage)}`,
              label: i18n._(
                defineMessage({
                  id: 'rogue.subtlety.shadowDance.overview.damageLabel',
                  message: 'Damage during Shadow Dance',
                }),
              ),
              tooltip: totalDamageTooltip,
              performance: QualitativePerformance.Good,
            },
            {
              value: `${formatPercentage(this.shadowDance.danceTotalDamage / this.damageDone.total.effective)}%`,
              label: i18n._(
                defineMessage({
                  id: 'rogue.subtlety.shadowDance.overview.damagePctLabel',
                  message: 'of Overall Damage',
                }),
              ),
              tooltip: percentageDuringShadowDanceTooltip,
              performance: QualitativePerformance.Good,
            },
            {
              value: `${formatPercentage(this.shadowDance.averageActiveTime)}%`,
              label: i18n._(
                defineMessage({
                  id: 'rogue.subtlety.shadowDance.overview.activeTimeLabel',
                  message: 'active time during Shadow Dance',
                }),
              ),
              tooltip: activeTimeDuringShadowDanceTooltip,
              performance: QualitativePerformance.Good,
            },
          ]}
        />
        <CastDetail
          title={t({
            id: 'rogue.subtlety.shadowDance.castDetail.title',
            message: 'Shadow Dance Details',
          })}
          casts={perCastData}
        />
      </GuideSection>
    );
  }
}

export default ShadowDanceGuide;
