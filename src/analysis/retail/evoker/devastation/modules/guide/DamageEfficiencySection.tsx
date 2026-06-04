import { GuideProps, PassFailCheckmark, Section, SubSection } from 'interface/guide';
import { ResourceLink, SpellLink } from 'interface';
import { TALENTS_EVOKER } from 'common/TALENTS';
import CombatLogParser from '../../CombatLogParser';
import SPELLS from 'common/SPELLS';

import PassFailBar from 'interface/guide/components/PassFailBar';
import { ExplanationAndDataSubSection } from 'interface/guide/components/ExplanationRow';
import { TIERS } from 'game/TIERS';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';
import { IMMINENT_DESTRUCTION_INITIAL_STACKS_DEVA } from 'analysis/retail/evoker/shared';
import { STRAFING_RUN_DURATION } from 'analysis/retail/evoker/devastation/constants';
import { formatDurationMillisMinSec } from 'common/format';
import { InformationIcon } from 'interface/icons';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

const EXPLANATION_PERCENTAGE = 70;
function PassFail({
  value,
  total,
  passed,
  customTotal,
}: {
  value: number;
  total: number;
  passed: boolean;
  customTotal?: number;
}) {
  return (
    <div>
      <PassFailBar pass={value} total={customTotal ?? total} />
      &nbsp; <PassFailCheckmark pass={passed} />
      <p>
        {value} / {total} ({((value / total) * 100).toFixed(2)}%)
      </p>
    </div>
  );
}

export function DamageEfficiency(props: GuideProps<typeof CombatLogParser>) {
  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.title',
        message: 'Damage Efficiency',
      })}
    >
      <DisintegrateSubsection {...props} />
      <NoWastedProcsSubsection {...props} />
      <NoWastedBuffsSubsection {...props} />
    </Section>
  );
}

function DisintegrateSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const tickData = modules.disintegrate.tickData;
  if (tickData.regularTicks === 0) {
    return null;
  }

  const isEarlyChainingOptimal = false;

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.title',
        message: 'Clipping/Chaining Disintegrate',
      })}
    >
      <p>
        <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.summary">
          You should always aim to chain <SpellLink spell={SPELLS.DISINTEGRATE} />. Chaining refers
          to recasting <SpellLink spell={SPELLS.DISINTEGRATE} /> while already channeling a{' '}
          <SpellLink spell={SPELLS.DISINTEGRATE} /> after the penultimate (second to last) tick in
          order to channel two <SpellLink spell={SPELLS.DISINTEGRATE} /> in a row without downtime or
          losing a tick. This is essentially just the same Pandemic effect that DoTs have since{' '}
          <SpellLink spell={SPELLS.DISINTEGRATE} /> functions as a DoT.
        </Trans>
      </p>
      {isEarlyChainingOptimal && (
        <p>
          <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.earlyChaining">
            Inside of <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} /> you should be clipping{' '}
            <SpellLink spell={SPELLS.DISINTEGRATE} /> after the third tick with more important spells
            such <SpellLink spell={SPELLS.FIRE_BREATH} />,{' '}
            <SpellLink spell={SPELLS.ETERNITY_SURGE} />,{' '}
            <SpellLink spell={SPELLS.SHATTERING_STAR} /> or{' '}
            <SpellLink spell={SPELLS.BURNOUT_BUFF} />. As well as early chaining your{' '}
            <SpellLink spell={SPELLS.DISINTEGRATE} /> after the third tick to maximize resources
            generation and expenditure.
          </Trans>
        </p>
      )}
      <p>
        <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.wowhead">
          See the{' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/devastation/rotation-cooldowns-pve-dps#advanced-disintegrate-chaining-and-clipping">
            Disintegrate Chaining and Clipping
          </a>{' '}
          section on wowhead for a more in-depth explanation.
        </Trans>
      </p>
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <div>
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.outsideDR">
                <SpellLink spell={SPELLS.DISINTEGRATE} /> efficiency outside of{' '}
                <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />
              </Trans>
            </p>
            <p>
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.noDropTicks',
                message: 'You should not be dropping any ticks here.',
              })}
            </p>
          </div>
        }
        data={
          <PassFail
            value={tickData.regularTicks}
            total={tickData.totalPossibleRegularTicks}
            passed={tickData.regularTickRatio > 0.95}
          />
        }
      />
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <div>
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.duringDR">
                <SpellLink spell={SPELLS.DISINTEGRATE} /> efficiency during{' '}
                <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />
              </Trans>
            </p>
            <p>
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.clipBeneficial',
                message:
                  'It can sometimes be beneficial to clip Disintegrate early in order to cast more important spells.',
              })}
            </p>
          </div>
        }
        data={
          <PassFail
            value={tickData.dragonRageTicks}
            total={tickData.totalPossibleDragonRageTicks}
            /*customTotal={tickData.totalPossibleDragonRageTicks * 0.75}*/
            passed={tickData.dragonRageTickRatio > 0.9}
          />
        }
      />

      {info.combatant.hasTalent(TALENTS_EVOKER.MASS_DISINTEGRATE_TALENT) && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <div>
              <p>
                <Trans id="guide.evoker.devastation.sections.damageEfficiency.disintegrate.massDisintegrate">
                  <SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} /> efficiency
                </Trans>
              </p>
              <p>
                {t({
                  id: 'guide.evoker.devastation.sections.damageEfficiency.disintegrate.noDropTicks',
                  message: 'You should not be dropping any ticks here.',
                })}
              </p>
            </div>
          }
          data={
            <PassFail
              value={tickData.massDisintegrateTicks}
              total={tickData.totalPossibleMassDisintegrateTicks}
              passed={
                tickData.massDisintegrateTicks === tickData.totalPossibleMassDisintegrateTicks
              }
            />
          }
        />
      )}
      {modules.disintegrate.guideSubSection()}
    </SubSection>
  );
}

function NoWastedProcsSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const hasMID1TierSet = info.combatant.has2PieceByTier(TIERS.MID1);

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.title',
        message: 'No Wasted Procs',
      })}
    >
      <p>
        <InformationIcon />{' '}
        {t({
          id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.note',
          message:
            "Note that procs that weren't used by the time the fight ended are counted as wasted.",
        })}
      </p>
      <ExplanationAndDataSubSection
        explanationPercent={EXPLANATION_PERCENTAGE}
        explanation={
          <p>
            <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.essenceBurst">
              <SpellLink spell={SPELLS.ESSENCE_BURST_BUFF} /> procs are essential because they help
              you cast your primary damaging spells,
              <SpellLink spell={SPELLS.DISINTEGRATE} /> and{' '}
              <SpellLink spell={TALENTS_EVOKER.PYRE_TALENT} />, for free.
              <div>
                <strong>None should go to waste.</strong>
              </div>
            </Trans>
          </p>
        }
        data={
          <PassFail
            value={modules.essenceBurst.consumedProcs}
            total={Math.max(modules.essenceBurst.procs, modules.essenceBurst.consumedProcs)}
            passed={
              modules.essenceBurst.consumedProcs ===
              Math.max(modules.essenceBurst.procs, modules.essenceBurst.consumedProcs)
            }
          />
        }
      />
      {!hasMID1TierSet && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedProcs.burnout">
                <SpellLink spell={TALENTS_EVOKER.BURNOUT_TALENT} /> procs allow you to cast{' '}
                <SpellLink spell={SPELLS.LIVING_FLAME_CAST} /> instantly.
                <div>
                  <strong>
                    Ideally none should go to waste, but some may drop during an intense{' '}
                    <SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} /> window.
                  </strong>
                </div>
              </Trans>
            </p>
          }
          data={
            <PassFail
              value={modules.burnout.consumedProcs}
              total={Math.max(modules.burnout.procs, modules.burnout.consumedProcs)}
              passed={
                modules.burnout.consumedProcs ===
                Math.max(modules.burnout.procs, modules.burnout.consumedProcs)
              }
            />
          }
        />
      )}
    </SubSection>
  );
}

function NoWastedBuffsSubsection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  const hasImminentDestruction = info.combatant.hasTalent(
    TALENTS_EVOKER.IMMINENT_DESTRUCTION_DEVASTATION_TALENT,
  );
  const hasStrafingRun = info.combatant.hasTalent(TALENTS_EVOKER.STRAFING_RUN_TALENT);
  const hasMassDisintegrate = info.combatant.hasTalent(TALENTS_EVOKER.MASS_DISINTEGRATE_TALENT);
  const hasAzureSweep = info.combatant.hasTalent(TALENTS_EVOKER.AZURE_SWEEP_TALENT);

  if (!hasImminentDestruction && !hasStrafingRun && !hasMassDisintegrate && !hasAzureSweep) {
    return null;
  }

  console.log(modules.azureSweep.buffRatio);

  return (
    <SubSection
      title={t({
        id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.title',
        message: 'No Wasted Buffs',
      })}
    >
      <p>
        <InformationIcon />{' '}
        {t({
          id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.note',
          message:
            "Note that buffs that weren't used by the time the fight ended are counted as wasted.",
        })}
      </p>
      {hasMassDisintegrate && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <strong>
                <SpellLink spell={SPELLS.MASS_DISINTEGRATE_BUFF} />
              </strong>{' '}
              {t({
                id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.massDisintegrate',
                message:
                  'is a powerful buff gained by casting Empowers which increases the damage of Disintegrate and allows it to strike multiple targets.',
              })}
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.massDisintegrate.consumedBuffs}
              total={modules.massDisintegrate.totalBuffs}
              passed={modules.massDisintegrate.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasImminentDestruction && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.imminentDestruction">
                <strong>
                  <SpellLink
                    spell={TALENTS_EVOKER.IMMINENT_DESTRUCTION_DEVASTATION_TALENT}
                  />
                </strong>{' '}
                reduces the <ResourceLink id={RESOURCE_TYPES.ESSENCE.id} /> cost of your next{' '}
                <strong>{IMMINENT_DESTRUCTION_INITIAL_STACKS_DEVA}</strong>{' '}
                <SpellLink spell={SPELLS.DISINTEGRATE} /> and <SpellLink spell={SPELLS.PYRE} />.
              </Trans>
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.imminentDestruction.consumedBuffs}
              total={modules.imminentDestruction.totalBuffs}
              passed={modules.imminentDestruction.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasStrafingRun && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun">
                <strong>
                  <SpellLink spell={TALENTS_EVOKER.STRAFING_RUN_TALENT} />
                </strong>{' '}
                allows <SpellLink spell={SPELLS.DEEP_BREATH} /> to be cast again within{' '}
                {formatDurationMillisMinSec(STRAFING_RUN_DURATION, 0)} of being used.
              </Trans>
              {hasMassDisintegrate && (
                <div>
                  <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.strafingRun.scalecommander">
                    When playing as Scalecommander, you should wait with re-casting{' '}
                    <SpellLink spell={SPELLS.DEEP_BREATH} /> until{' '}
                    <SpellLink spell={TALENTS_EVOKER.MELT_ARMOR_TALENT} /> runs out.
                  </Trans>
                </div>
              )}
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.noneToWaste',
                    message: 'None should go to waste.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.strafingRun.consumedBuffs}
              total={modules.strafingRun.totalBuffs}
              passed={modules.strafingRun.wastedBuffs === 0}
            />
          }
        />
      )}
      {hasAzureSweep && (
        <ExplanationAndDataSubSection
          explanationPercent={EXPLANATION_PERCENTAGE}
          explanation={
            <p>
              <Trans id="guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep">
                <strong>
                  <SpellLink spell={TALENTS_EVOKER.AZURE_SWEEP_TALENT} />
                </strong>{' '}
                is an upgraded version of <SpellLink spell={SPELLS.AZURE_STRIKE} /> that is gained
                after casting <SpellLink spell={SPELLS.ETERNITY_SURGE} />.
              </Trans>
              <div>
                <strong>
                  {t({
                    id: 'guide.evoker.devastation.sections.damageEfficiency.noWastedBuffs.azureSweep.note',
                    message:
                      'Ideally none should go to waste, but some may be wasted due to having to cast higher priority spells.',
                  })}
                </strong>
              </div>
            </p>
          }
          data={
            <PassFail
              value={modules.azureSweep.consumedBuffs}
              total={modules.azureSweep.totalBuffs}
              passed={modules.azureSweep.buffRatio > 0.9}
            />
          }
        />
      )}
    </SubSection>
  );
}
