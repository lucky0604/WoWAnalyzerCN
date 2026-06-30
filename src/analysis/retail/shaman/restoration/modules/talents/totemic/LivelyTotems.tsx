import { t } from '@lingui/core/macro';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import TALENTS from 'common/TALENTS/shaman';
import Events, { CastEvent } from 'parser/core/Events';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import TalentSpellText from 'parser/ui/TalentSpellText';
import ItemHealingDone from 'parser/ui/ItemHealingDone';
import ItemManaGained from 'parser/ui/ItemManaGained';
import { isLivelyTotemsChainHealCast } from '../../../normalizers/EventLinkNormalizer';
import ChainHealAnalyzer from '../../../normalizers/ChainHealNormalizer';
import { formatNumber } from 'common/format';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

export default class LivelyTotemsAnalyzer extends Analyzer {
  static dependencies = {
    ...Analyzer.dependencies,
    chainHealAnalyzer: ChainHealAnalyzer,
  };
  protected chainHealAnalyzer!: ChainHealAnalyzer;

  manaSavedFromTalent = 0;
  healingDoneFromTalent = 0;
  overhealingDoneFromTalent = 0;
  chainHealCasts = 0;

  constructor(options: Options) {
    super(options);
    this.active = this.selectedCombatant.hasTalent(TALENTS.LIVELY_TOTEMS_TALENT);
    if (!this.active) {
      return;
    }
    this.addEventListener(
      Events.cast.by(SELECTED_PLAYER).spell(TALENTS.CHAIN_HEAL_TALENT),
      this.onChainHealCast,
    );
  }

  private onChainHealCast(event: CastEvent) {
    // Only chain heals that are linked back to a totem summon count for this talent
    if (!isLivelyTotemsChainHealCast(event)) {
      return;
    }

    this.chainHealCasts += 1;

    const healEvents = this.chainHealAnalyzer.normalizeChainHealOrder(event);
    healEvents.forEach((heal) => {
      this.healingDoneFromTalent += heal.amount + (heal.absorbed ?? 0);
      this.overhealingDoneFromTalent += heal.overheal ?? 0;
    });

    if (event.resourceCost) {
      this.manaSavedFromTalent += event.resourceCost[RESOURCE_TYPES.MANA.id] ?? 0;
    }
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.HERO_TALENTS}
        tooltip={
          <>
            <strong>
              {t({
                id: 'shaman.restoration.livelyTotems.tooltip',
                message: '{0} bonus healing ({1} overhealing)',
                values: {
                  0: formatNumber(this.healingDoneFromTalent),
                  1: formatNumber(this.overhealingDoneFromTalent),
                },
              })}
            </strong>
            <br />
            {t({
              id: 'shaman.restoration.livelyTotems.tooltip.mana',
              message: '{0} free chain heals, saving {1} mana.',
              values: {
                0: this.chainHealCasts,
                1: formatNumber(this.manaSavedFromTalent),
              },
            })}
          </>
        }
      >
        <TalentSpellText talent={TALENTS.LIVELY_TOTEMS_TALENT}>
          <div>
            <ItemHealingDone amount={this.healingDoneFromTalent} />{' '}
          </div>
          <div>
            <ItemManaGained amount={this.manaSavedFromTalent} useAbbrev />
          </div>
        </TalentSpellText>
      </Statistic>
    );
  }
}
