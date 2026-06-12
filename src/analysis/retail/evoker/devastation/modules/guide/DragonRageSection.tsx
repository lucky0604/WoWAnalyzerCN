import { SpellLink, TooltipElement } from 'interface';
import { TALENTS_EVOKER } from 'common/TALENTS';
import SPELLS from 'common/SPELLS/evoker';
import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from '../../CombatLogParser';

import { DragonRageWindowSection } from './DragonRageWindows';
import { TIERS } from 'game/TIERS';
import { EVOKER_MID1_ID } from 'common/ITEMS';
import ItemSetLink from 'interface/ItemSetLink';
import { t } from '@lingui/core/macro';

export function DragonRageSection({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const rageWindows = Object.values(modules.dragonRage.rageWindowCounters);

  if (rageWindows.length === 0) return null;

  const hasIridescence = info.combatant.hasTalent(TALENTS_EVOKER.IRIDESCENCE_TALENT);
  const hasMID1TierSet = info.combatant.has2PieceByTier(TIERS.MID1);

  return (
    <Section
      title={t({
        id: 'guide.evoker.devastation.sections.dragonrage.title',
        message: 'Dragonrage',
      })}
    >
      <p>
        <><SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p1',message:' is your primary cooldown and contributes to a large portion of your DPS. Because this window gives us our mastery '})}<SpellLink spell={SPELLS.GIANT_SLAYER_MASTERY} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p2',message:' with '})}<SpellLink spell={TALENTS_EVOKER.TYRANNY_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p3',message:' and guaranteed '})}<SpellLink spell={SPELLS.ESSENCE_BURST_DEV_BUFF} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p4',message:' procs, we need to utilize the talent '})}<SpellLink spell={TALENTS_EVOKER.ANIMOSITY_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p5',message:' to extend the buff duration as long as possible. We do this by casting '})}<strong>{t({id:'guide.evoker.devastation.sections.dragonrage.summary.bold',message:'at least'})}</strong>{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p6',message:' 4 '})}
          <TooltipElement
            content={
              <>
                <SpellLink spell={TALENTS_EVOKER.ETERNITY_SURGE_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.tooltip',message:' and '})}<SpellLink spell={SPELLS.FIRE_BREATH} />
              </>
            }
          >
            {t({id:'guide.evoker.devastation.sections.dragonrage.summary.empowers',message:'Empowers'})}
          </TooltipElement>
          {t({id:'guide.evoker.devastation.sections.dragonrage.summary.p7',message:', by making the most of the talents: '})}<SpellLink spell={TALENTS_EVOKER.CAUSALITY_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p8',message:' and '})}<SpellLink spell={TALENTS_EVOKER.TIP_THE_SCALES_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary.p9',message:'.'})}</>
      </p>
      <p>
        <>{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p1',message:'To generate '})}<SpellLink spell={SPELLS.ESSENCE_BURST_DEV_BUFF} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p2',message:' procs inside of '})}<SpellLink spell={TALENTS_EVOKER.DRAGONRAGE_TALENT} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p3',message:' you should be casting '})}<SpellLink spell={SPELLS.LIVING_FLAME_CAST} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p4',message:' with '})}<SpellLink spell={SPELLS.BURNOUT_BUFF} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p5',message:' or '})}<SpellLink spell={SPELLS.LEAPING_FLAMES_BUFF} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p6',message:' active. Use '})}<SpellLink spell={SPELLS.AZURE_STRIKE} />{t({id:'guide.evoker.devastation.sections.dragonrage.summary2.p7',message:' as a fallback filler.'})}</>
      </p>
      {hasMID1TierSet && (
        <p>
          <>{t({id:'guide.evoker.devastation.sections.dragonrage.tierSet.p1',message:'When playing with the '})}<strong>
              <ItemSetLink id={EVOKER_MID1_ID}>{t({id:'guide.evoker.devastation.sections.dragonrage.tierSet.bold',message:'MID Season 1 Tier Set'})}</ItemSetLink>
            </strong>{t({id:'guide.evoker.devastation.sections.dragonrage.tierSet.p2',message:' '})}<SpellLink spell={SPELLS.AZURE_SWEEP} />{t({id:'guide.evoker.devastation.sections.dragonrage.tierSet.p3',message:' should be prioritized over '})}<SpellLink spell={SPELLS.LIVING_FLAME_CAST} />{t({id:'guide.evoker.devastation.sections.dragonrage.tierSet.p4',message:'.'})}</>
        </p>
      )}
      {hasIridescence && (
        <p>
          <>{t({id:'guide.evoker.devastation.sections.dragonrage.iridescence.p1',message:'When playing with '})}<strong>
              <SpellLink spell={TALENTS_EVOKER.IRIDESCENCE_TALENT} />
            </strong>{t({id:'guide.evoker.devastation.sections.dragonrage.iridescence.p2',message:' you should avoid using '})}<SpellLink spell={SPELLS.AZURE_STRIKE} />{t({id:'guide.evoker.devastation.sections.dragonrage.iridescence.p3',message:' with '})}<SpellLink spell={SPELLS.IRIDESCENCE_BLUE} />{t({id:'guide.evoker.devastation.sections.dragonrage.iridescence.p4',message:' active.'})}</>
        </p>
      )}

      <DragonRageWindowSection rageWindows={rageWindows} events={events} info={info} />
    </Section>
  );
}
