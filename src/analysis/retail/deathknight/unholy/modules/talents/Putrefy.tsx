import { formatPercentage } from 'common/format';
import DK_SPELLS from 'common/SPELLS/deathknight';
import TALENTS from 'common/TALENTS/deathknight';
import { SpellLink } from 'interface';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { BoxRowEntry, PerformanceBoxRow } from 'interface/guide/components/PerformanceBoxRow';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, {
  SummonEvent,
  UpdateSpellUsableEvent,
  UpdateSpellUsableType,
} from 'parser/core/Events';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import DonutChart from 'parser/ui/DonutChart';
import { QualitativePerformance } from 'parser/ui/QualitativePerformance';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import type { CSSProperties, JSX } from 'react';
import SpellUsable from '../core/SpellUsable';
import { t } from '@lingui/core/macro';

// Cooldown reduction (in milliseconds) applied to Putrefy when Harbinger of Doom summons a Lesser Ghoul
const HARBINGER_OF_DOOM_PUTREFY_CDR_MS = 2500;

const LEGEND_DOT_BASE_STYLE: CSSProperties = {
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  marginRight: '6px',
};

class Putrefy extends Analyzer.withDependencies({
  spellUsable: SpellUsable,
}) {
  private chargesSpentDuringDarkTransformation = 0;
  private chargesSpentOutsideDarkTransformation = 0;
  private readonly entries: BoxRowEntry[] = [];

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS.PUTREFY_TALENT);
    if (!this.active) {
      return;
    }

    this.addEventListener(
      Events.UpdateSpellUsable.by(SELECTED_PLAYER).spell(TALENTS.PUTREFY_TALENT),
      this.onPutrefyCooldownUpdate,
    );

    if (this.selectedCombatant.hasTalent(TALENTS.HARBINGER_OF_DOOM_TALENT)) {
      this.addEventListener(
        Events.summon.by(SELECTED_PLAYER).spell(DK_SPELLS.LESSER_GHOUL),
        this.onHarbingerOfDoomLesserGhoulSummon,
      );
    }
  }

  private onPutrefyCooldownUpdate(event: UpdateSpellUsableEvent) {
    if (
      event.updateType !== UpdateSpellUsableType.BeginCooldown &&
      event.updateType !== UpdateSpellUsableType.UseCharge
    ) {
      return;
    }

    if (this.selectedCombatant.hasBuff(DK_SPELLS.DARK_TRANSFORMATION_BUFF)) {
      this.chargesSpentDuringDarkTransformation += 1;
      this.entries.push({
        value: QualitativePerformance.Good,
        tooltip: (
          <>
            {t({
              id: 'deathknight.unholy.putrefy.tooltipSpentDuringDT',
              message: 'Spent @ {timestamp} during ',
              values: { timestamp: this.owner.formatTimestamp(event.timestamp) },
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />.
          </>
        ),
      });
      return;
    }

    this.chargesSpentOutsideDarkTransformation += 1;
    this.entries.push({
      value: QualitativePerformance.Fail,
        tooltip: (
          <>
            {t({
              id: 'deathknight.unholy.putrefy.tooltipSpentOutsideDT',
              message: 'Spent @ {timestamp} outside ',
              values: { timestamp: this.owner.formatTimestamp(event.timestamp) },
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />.
          </>
        ),
    });
  }

  private onHarbingerOfDoomLesserGhoulSummon(_event: SummonEvent) {
    this.deps.spellUsable.reduceCooldown(
      TALENTS.PUTREFY_TALENT.id,
      HARBINGER_OF_DOOM_PUTREFY_CDR_MS,
    );
  }

  get totalChargesSpent(): number {
    return this.chargesSpentDuringDarkTransformation + this.chargesSpentOutsideDarkTransformation;
  }

  get efficiency(): number {
    return this.totalChargesSpent > 0
      ? 1 - this.chargesSpentOutsideDarkTransformation / this.totalChargesSpent
      : 1;
  }

  private get breakdownItems() {
    return [
      {
        color: '#22c55e',
        label: (
          <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF}>
            {t({
              id: 'deathknight.unholy.putrefy.labelDuringDT',
              message: 'During Dark Transformation',
            })}
          </SpellLink>
        ),
        value: this.chargesSpentDuringDarkTransformation,
        valuePercent: false,
        valueTooltip: (
          <>
            {t({
              id: 'deathknight.unholy.putrefy.tooltipChargesDuringDT',
              message: '{charges} ',
              values: { charges: this.chargesSpentDuringDarkTransformation },
            })}
            <SpellLink spell={TALENTS.PUTREFY_TALENT} />
            {t({
              id: 'deathknight.unholy.putrefy.tooltipChargesDuringDT.p2',
              message: ' charges spent during ',
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />
          </>
        ),
      },
      {
        color: '#ef4444',
        label: (
          <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF}>
            {t({
              id: 'deathknight.unholy.putrefy.labelOutsideDT',
              message: 'Outside Dark Transformation',
            })}
          </SpellLink>
        ),
        value: this.chargesSpentOutsideDarkTransformation,
        valuePercent: false,
        valueTooltip: (
          <>
            {t({
              id: 'deathknight.unholy.putrefy.tooltipChargesOutsideDT',
              message: '{charges} ',
              values: { charges: this.chargesSpentOutsideDarkTransformation },
            })}
            <SpellLink spell={TALENTS.PUTREFY_TALENT} />
            {t({
              id: 'deathknight.unholy.putrefy.tooltipChargesOutsideDT.p2',
              message: ' charges spent outside ',
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />
          </>
        ),
      },
    ];
  }

  get guideSubsection(): JSX.Element {
    const explanation = (
      <p>
        <strong>
          <SpellLink spell={TALENTS.PUTREFY_TALENT} />
        </strong>
        {t({
          id: 'deathknight.unholy.putrefy.guideExplanation',
          message: ' should only be used during ',
        })}
        <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />
        {t({
          id: 'deathknight.unholy.putrefy.guideExplanation.p2',
          message:
            '. Spending charges outside this window is a damage loss, so your goal is 100% ',
        })}
        <SpellLink spell={TALENTS.PUTREFY_TALENT} />
        {t({
          id: 'deathknight.unholy.putrefy.guideExplanation.p3',
          message: ' usage during ',
        })}
        <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />.
      </p>
    );

    const data = (
      <div>
        <div style={{ marginBottom: '6px' }}>
          <strong>
            <SpellLink spell={TALENTS.PUTREFY_TALENT} />
            {t({
              id: 'deathknight.unholy.putrefy.guideChargeUsage',
              message: ' charge usage',
            })}
          </strong>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>{formatPercentage(this.efficiency, 0)}%</strong>{' '}
          <small>
            {t({
              id: 'deathknight.unholy.putrefy.labelEfficiency',
              message: 'efficiency',
            })}
          </small>
        </div>
        <p style={{ margin: '0 0 8px 0' }}>
          {t({
            id: 'deathknight.unholy.putrefy.guideOnlyDuringDT',
            message: 'Only use ',
          })}
          <SpellLink spell={TALENTS.PUTREFY_TALENT} />
          {t({
            id: 'deathknight.unholy.putrefy.guideOnlyDuringDT.p2',
            message: ' charges during ',
          })}
          <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />.
        </p>
        <small style={{ display: 'grid', gap: '2px', marginBottom: '6px' }}>
          <span>
            <span
              style={{
                ...LEGEND_DOT_BASE_STYLE,
                backgroundColor: '#4caf50',
              }}
            />
            {t({
              id: 'deathknight.unholy.putrefy.legendDuringDT',
              message: 'During ',
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />
          </span>
          <span>
            <span
              style={{
                ...LEGEND_DOT_BASE_STYLE,
                backgroundColor: '#ef5350',
              }}
            />
            {t({
              id: 'deathknight.unholy.putrefy.legendOutsideDT',
              message: 'Outside ',
            })}
            <SpellLink spell={DK_SPELLS.DARK_TRANSFORMATION_BUFF} />
          </span>
        </small>
        <div style={{ marginBottom: '8px' }}>
          <PerformanceBoxRow values={this.entries} />
        </div>
      </div>
    );

    return explanationAndDataSubsection(explanation, data, 40);
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(13)}
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
      >
        <BoringSpellValueText spell={TALENTS.PUTREFY_TALENT}>
          <div>
            {formatPercentage(this.efficiency, 0)}%{' '}
            <small>
              {t({
                id: 'deathknight.unholy.putrefy.labelEfficiency',
                message: 'efficiency',
              })}
            </small>
          </div>
        </BoringSpellValueText>
        <div style={{ padding: '8px' }}>
          <DonutChart items={this.breakdownItems} />
        </div>
      </Statistic>
    );
  }
}

export default Putrefy;
