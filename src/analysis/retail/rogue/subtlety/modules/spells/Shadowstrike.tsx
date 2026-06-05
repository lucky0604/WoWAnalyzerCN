import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { CastEvent } from 'parser/core/Events';
import SPELLS from 'common/SPELLS/rogue';
import SpellLink from 'interface/SpellLink';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import { HideGoodCastsSpellUsageSubSection } from 'parser/core/SpellUsage/HideGoodCastsSpellUsageSubSection';
import { logSpellUseEvent } from 'parser/core/SpellUsage/SpellUsageSubSection';
import CastPerformanceSummary from 'analysis/retail/demonhunter/shared/guide/CastPerformanceSummary';
import { createSpellUse, createChecklistItem } from 'parser/core/MajorCooldowns/MajorCooldown';
import { SpellUse } from 'parser/core/SpellUsage/core';

const STEALTH_BUFFS = [
  SPELLS.STEALTH.id,
  SPELLS.VANISH_BUFF.id,
  SPELLS.SHADOW_DANCE.id,
  SPELLS.SUBTERFUGE_BUFF.id,
];

export default class Shadowstrike extends Analyzer {
  private cooldownUses: SpellUse[] = [];

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.SHADOWSTRIKE), this.onCast);
  }

  get guideSubsection() {
    const goodCasts = this.cooldownUses.filter(
      (it) => it.performance !== QualitativePerformance.Fail,
    ).length;
    const totalCasts = this.cooldownUses.length;

    const explanation = (
      <p>
        <strong>
          <SpellLink spell={SPELLS.SHADOWSTRIKE} />
        </strong>{' '}
        {t({ id: 'rogue.subtlety.shadowstrike.explanation', message: 'should' })}{' '}
        <strong>{t({ id: 'rogue.subtlety.shadowstrike.onlyBeUsed', message: 'only be used' })}</strong>{' '}
        {t({ id: 'rogue.subtlety.shadowstrike.explanationDuring', message: 'during Shadow Dance, Stealth or Vanish Buff. Using it outside of these conditions is a waste.' })}
      </p>
    );

    return (
      <HideGoodCastsSpellUsageSubSection
        hideGoodCasts
        explanation={explanation}
        uses={this.cooldownUses}
        castBreakdownSmallText={<> - {t({ id: 'rogue.subtlety.shadowstrike.redIsBadCast', message: 'Red is a bad cast.' })}</>}
        onPerformanceBoxClick={logSpellUseEvent}
        abovePerformanceDetails={
          <div style={{ marginBottom: 10 }}>
            <CastPerformanceSummary
              spell={SPELLS.SHADOWSTRIKE}
              casts={goodCasts}
              performance={QualitativePerformance.Good}
              totalCasts={totalCasts}
            />
          </div>
        }
        noCastsTexts={{
          noCastsOverride: t({ id: 'rogue.subtlety.shadowstrike.allCorrectCasts', message: 'All of your casts of Shadowstrike were correctly used!' }),
        }}
      />
    );
  }

  private onCast(event: CastEvent) {
    const isStealthActive = STEALTH_BUFFS.some((buffId) =>
      this.selectedCombatant.hasBuff(buffId, event.timestamp),
    );

    const checklistItem = createChecklistItem(
      'shadowstrike-stealth-check',
      { event },
      {
        performance: isStealthActive ? QualitativePerformance.Good : QualitativePerformance.Fail,
        summary: isStealthActive ? (
          <div>{t({ id: 'rogue.subtlety.shadowstrike.goodUsage', message: 'Good usage during stealth or Shadow Dance.' })}</div>
        ) : (
          <div>{t({ id: 'rogue.subtlety.shadowstrike.incorrectUsage', message: 'Incorrect usage outside stealth or Shadow Dance.' })}</div>
        ),
        details: isStealthActive ? (
          <div>
            {t({ id: 'rogue.subtlety.shadowstrike.goodUsageDetail', message: 'You correctly cast Shadowstrike during Shadow Dance or stealth.' })}
          </div>
        ) : (
          <div>
            <strong>{t({ id: 'rogue.subtlety.shadowstrike.incorrectCast', message: 'Incorrect cast:' })}</strong>{' '}
            {t({ id: 'rogue.subtlety.shadowstrike.incorrectUsageDetail', message: 'You used Shadowstrike outside of Shadow Dance or stealth, which is a waste of resources.' })}
          </div>
        ),
      },
    );

    this.cooldownUses.push(createSpellUse({ event }, [checklistItem]));
  }
}
