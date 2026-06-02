import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellIcon } from 'interface';
import Analyzer, { Options } from 'parser/core/Analyzer';
import EventFilter from 'parser/core/EventFilter';
import Events, { ChangeHasteEvent, EventType } from 'parser/core/Events';
import BoringValue from 'parser/ui/BoringValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import talents from 'common/TALENTS/monk';

import BlackOxBrew from '../spells/BlackOxBrew';
import KegSmash from '../spells/KegSmash';
import TigerPalm from '../spells/TigerPalm';
import AnvilStave from '../talents/AnvilStave';
import { Abilities } from '../../gen';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

const deps = {
  ks: KegSmash,
  tp: TigerPalm,
  bob: BlackOxBrew,
  anvilStave: AnvilStave,
  abilities: Abilities,
};

class BrewCDR extends Analyzer.withDependencies(deps) {
  _totalHaste = 0;
  _newHaste = 0;
  _lastHasteChange = 0;

  constructor(options: Options) {
    super(options);
    this._lastHasteChange = this.owner.fight.start_time;

    this.addEventListener(new EventFilter(EventType.ChangeHaste), this._updateHaste);
    this.addEventListener(Events.fightend, this._finalizeHaste);
  }

  get meanHaste() {
    return this._totalHaste / this.owner.fightDuration;
  }

  get totalCDR() {
    const { ks, tp, bob, anvilStave } = this.deps;
    let totalCDR = 0;
    // add in KS CDR...
    totalCDR += ks.cdr;
    totalCDR += ks.bocCDR;
    // ...and TP...
    totalCDR += tp.cdr;
    totalCDR += tp.fpCdr;
    // ...and BoB...
    totalCDR += bob.cdr[talents.PURIFYING_BREW_TALENT.id];
    totalCDR += anvilStave.cdr;
    return totalCDR;
  }

  get maxTotalCDR() {
    const { ks, tp, bob } = this.deps;
    // some passive talents like anvil & stave don't track wasted cdr (yet?)
    return (
      ks.wastedCDR +
      ks.wastedBocCDR +
      tp.wastedCDR +
      tp.wastedFpCdr +
      bob.wastedCDR[talents.PURIFYING_BREW_TALENT.id] +
      this.totalCDR
    );
  }

  // The idea here is pretty simple: we have an amount of time that has
  // passed (fightDuration) and an amount of time that has "passed"
  // via flat cooldown reduction on abilities (totalCDR). For example,
  // Keg Smash effetively causes 4 seconds to "pass" when cast. So we
  // want to know what fraction of time that has passed was caused by
  // cooldown reduction effects, which is:
  //
  // cdr% = totalCDR / (fightDuration + totalCDR)
  //
  // related:
  // https://github.com/WoWAnalyzer/WoWAnalyzer/pull/1238#discussion_r163734298
  get cooldownReductionRatio() {
    return this.totalCDR / (this.owner.fightDuration + this.totalCDR);
  }

  get maxCooldownReductionRatio() {
    return this.maxTotalCDR / (this.owner.fightDuration + this.maxTotalCDR);
  }

  get minAttainableCooldown() {
    return this.avgCooldown * (1 - this.maxCooldownReductionRatio);
  }

  get avgCooldown() {
    const ability = this.deps.abilities.getAbility(talents.PURIFYING_BREW_TALENT.id)!;
    return ability.getCooldown(this.meanHaste);
  }

  statistic() {
    const { ks, tp, bob, anvilStave } = this.deps;
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL()}
        size="flexible"
        tooltip={
          <>
            {t({
              id: 'monk.brewmaster.cdr.reduced_by',
              message: 'Your cooldowns were reduced by:',
            })}
            <ul>
              <li>
                {(() => {
                  const casts = ks.totalCasts;
                  const cdr = (ks.cdr / 1000).toFixed(2);
                  const wasted = (ks.wastedCDR / 1000).toFixed(2);
                  return (
                    <Trans id="monk.brewmaster.cdr.ks">
                      {casts} Keg Smash casts — <strong>{cdr}s</strong> (<strong>{wasted}s</strong>{' '}
                      wasted)
                    </Trans>
                  );
                })()}
              </li>
              {ks.bocHits > 0 && (
                <li>
                  {(() => {
                    const hits = ks.bocHits;
                    const cdr = (ks.bocCDR / 1000).toFixed(2);
                    const wasted = (ks.wastedBocCDR / 1000).toFixed(2);
                    return (
                      <Trans id="monk.brewmaster.cdr.ks_boc">
                        Using Blackout Combo on {hits} Keg Smash hits — <strong>{cdr}s</strong> (
                        <strong>{wasted}s</strong> wasted)
                      </Trans>
                    );
                  })()}
                </li>
              )}
              <>
                <li>
                  {(() => {
                    const casts = tp.totalCasts;
                    const cdr = (tp.cdr / 1000).toFixed(2);
                    const wasted = (tp.wastedCDR / 1000).toFixed(2);
                    return (
                      <Trans id="monk.brewmaster.cdr.tp">
                        {casts} Tiger Palm hits — <strong>{cdr}s</strong> (
                        <strong>{wasted}s</strong> wasted)
                      </Trans>
                    );
                  })()}
                </li>
                {this.selectedCombatant.hasTalent(talents.FACE_PALM_TALENT) && (
                  <li>
                    {(() => {
                      const triggers = tp.totalCasts;
                      const cdr = (tp.fpCdr / 1000).toFixed(2);
                      const wasted = (tp.wastedFpCdr / 1000).toFixed(2);
                      return (
                        <Trans id="monk.brewmaster.cdr.tp_fp">
                          {triggers} Face Palm triggers — <strong>{cdr}s</strong> (
                          <strong>{wasted}s</strong> wasted)
                        </Trans>
                      );
                    })()}
                  </li>
                )}
              </>
              {bob.active && (
                <li>
                  {(() => {
                    const casts = bob.casts;
                    const cdr = (bob.cdr[talents.PURIFYING_BREW_TALENT.id] / 1000).toFixed(2);
                    const wasted = (bob.wastedCDR[talents.PURIFYING_BREW_TALENT.id] / 1000).toFixed(
                      2,
                    );
                    return (
                      <Trans id="monk.brewmaster.cdr.bob">
                        {casts} Black Ox Brew casts — <strong>{cdr}s</strong> (
                        <strong>{wasted}s</strong> wasted)
                      </Trans>
                    );
                  })()}
                </li>
              )}
              {anvilStave.active && (
                <li>
                  {(() => {
                    const triggers = anvilStave.count;
                    const cdr = (anvilStave.cdr / 1000).toFixed(2);
                    return (
                      <Trans id="monk.brewmaster.cdr.anvil">
                        {triggers} Anvil & Stave triggers - <strong>{cdr}s</strong>
                      </Trans>
                    );
                  })()}
                </li>
              )}
            </ul>
            <strong>
              {t({ id: 'monk.brewmaster.cdr.total', message: 'Total cooldown reduction:' })}
            </strong>{' '}
            {(this.totalCDR / 1000).toFixed(2)}s.
          </>
        }
      >
        <BoringValue
          label={
            <Trans id="monk.brewmaster.cdr.effective_brew_cdr">
              <SpellIcon spell={SPELLS.TIGER_PALM} /> Effective Brew CDR
            </Trans>
          }
        >
          <>{formatPercentage(this.cooldownReductionRatio)} %</>
        </BoringValue>
      </Statistic>
    );
  }

  private _updateHaste(event: ChangeHasteEvent) {
    this._totalHaste += event.oldHaste! * (event.timestamp - this._lastHasteChange);
    this._lastHasteChange = event.timestamp;
    this._newHaste = event.newHaste!;
  }

  private _finalizeHaste() {
    this._totalHaste += this._newHaste * (this.owner.fight.end_time - this._lastHasteChange);
  }
}

export default BrewCDR;
