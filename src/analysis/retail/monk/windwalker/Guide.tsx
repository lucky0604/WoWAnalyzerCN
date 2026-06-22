import SPELLS from 'common/SPELLS';
import { TALENTS_MONK } from 'common/TALENTS';
import { SpellLink } from 'interface';
import { GuideProps, Section, SubSection } from 'interface/guide';
import { AplSectionData } from 'interface/guide/components/Apl';
import { explanationAndDataSubsection } from 'interface/guide/components/ExplanationRow';
import { RoundedPanel } from 'interface/guide/components/GuideDivs';
import PreparationSection from 'interface/guide/components/Preparation/PreparationSection';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import CombatLogParser from './CombatLogParser';
import * as AplCheck from './modules/apl/AplCheck';
import windwalkerApl from './modules/apl/WindwalkerApl';
import RESOURCE_TYPES from 'game/RESOURCE_TYPES';

export default function Guide({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const hasStrikeOfTheWindlord = info.combatant.hasTalent(
    TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT,
  );
  const hasCelestialConduit = info.combatant.hasTalent(
    TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT,
  );

  return (
    <>
      <Section title={t({ id: 'monk.windwalker.section.preface', message: 'Preface & Disclaimers' })}>
        <>
          <p>
            <>{t({ id: 'monk.windwalker.preface.description1.p1', message: 'The analysis in this guide is provided in collaboration with the' })}
              {' '}
              <a href="https://discord.com/invite/peakofserenity">{t({ id: 'monk.windwalker.preface.description1.a', message: 'Peak of Serenity' })}</a>
              {t({ id: 'monk.windwalker.preface.description1.p2', message: 'Discord. Keep in mind that WoWAnalyzer is limited to what is present in your combat log, and we cannot always detect intentional deviations such as holding cooldowns for a specific strategy.' })}
            </>
          </p>
          <p>
            <>{t({ id: 'monk.windwalker.preface.description2.p1', message: 'If you notice any issues or errors in this analysis or have feature requests, please reach out to ' })}
              <code>{t({ id: 'monk.windwalker.preface.description2.code', message: '@durpn' })}</code>
              {t({ id: 'monk.windwalker.preface.description2.p2', message: 'in the' })}
              {' '}
              <a href="https://discord.com/invite/peakofserenity">{t({ id: 'monk.windwalker.preface.description2.a', message: 'Peak of Serenity' })}</a>
              {t({ id: 'monk.windwalker.preface.description2.p3', message: 'Discord.' })}
            </>
          </p>
        </>
      </Section>
      <Section title={t({ id: 'monk.windwalker.section.coreSpells', message: 'Core Spells and Buffs' })}>
        <>
        <p>
          <>
            {t({
              id: 'monk.windwalker.coreSpells.description1.p1',
              message: 'Windwalker is a two-resource spec. ',
            })}
            <SpellLink spell={RESOURCE_TYPES.ENERGY} />
            {t({
              id: 'monk.windwalker.coreSpells.description1.p2',
              message: ' is the fuel that lets you build ',
            })}
            <SpellLink spell={RESOURCE_TYPES.CHI} />
            {t({
              id: 'monk.windwalker.coreSpells.description1.p3',
              message:
                ', and the latter is what turns into your meaningful damage. Good play is mostly about managing both at the same time: do not overcap either resource, but do not spend so freely that you starve yourself right before an important button becomes available.',
            })}
          </>
        </p>
        <p>
          <>
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p1',
              message: ' and ',
            })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p2',
              message: ' are where this usually goes wrong. ',
            })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p3',
              message: ' builds the resources you need, while ',
            })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p4',
              message:
                ' helps keep the spec moving and can be excellent value, but neither is usually the payoff. Their job is to support spells like ',
            })}
            <SpellLink spell={TALENTS_MONK.RISING_SUN_KICK_TALENT} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p5',
              message: ', ',
            })}
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            {hasStrikeOfTheWindlord && (
              <>
                {t({
                  id: 'monk.windwalker.coreSpells.description2.p5a',
                  message: ', ',
                })}
                <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
              </>
            )}
            {t({
              id: 'monk.windwalker.coreSpells.description2.p6',
              message:
                ' and proc-driven casts, not to crowd them out. A common mistake is pressing ',
            })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p7',
              message: ' when you are low on ',
            })}
            <SpellLink spell={RESOURCE_TYPES.ENERGY} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p8',
              message: ', sitting at only enough ',
            })}
            <SpellLink spell={RESOURCE_TYPES.CHI} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p9',
              message: ' for a medium spender, and ',
            })}
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p10',
              message: ' is about to come up. That often forces extra ',
            })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.coreSpells.description2.p11',
              message: ' casts and delays your real damage window.',
            })}
          </>
        </p>
        <p>
          <>
            {t({
              id: 'monk.windwalker.coreSpells.description3.p1',
              message:
                'This is the downtime trap: sometimes the correct play is to do nothing for a moment. If ',
            })}
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            {hasStrikeOfTheWindlord && (
              <>
                {t({
                  id: 'monk.windwalker.coreSpells.description3.p1a',
                  message: ' or ',
                })}
                <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
              </>
            )}
            {t({
              id: 'monk.windwalker.coreSpells.description3.p2',
              message: ' is about to be ready, you are low on ',
            })}
            <SpellLink spell={RESOURCE_TYPES.ENERGY} />
            {t({
              id: 'monk.windwalker.coreSpells.description3.p3',
              message:
                ', and spending Blackout Kick would leave you unable to use the stronger button on time, waiting is better than filling the global. These panels are useful because they show whether you were feeding your priority spells correctly or spending resources in ways that made them late.',
            })}
          </>
          {hasCelestialConduit && (
            <>
              {' '}
              <>
                {t({
                  id: 'monk.windwalker.coreSpells.description4.p1',
                  message: 'When playing Conduit of the Celestials, ',
                })}
                <SpellLink spell={SPELLS.HEART_OF_THE_JADE_SERPENT_BUFF} />
                {t({
                  id: 'monk.windwalker.coreSpells.description4.p2',
                  message:
                    ' adds another layer to that planning because it changes the value and timing of several of the spells shown in this section.',
                })}
              </>
            </>
          )}
        </p>
        </>
        <MasteryGraph modules={modules} events={events} info={info} />
        {hasCelestialConduit &&
          modules.heartOfTheJadeSerpent.guideSubsection(modules.celestialConduit.clipAnalysis)}
        {modules.risingSunKick.guideSubsection}
        {modules.fistsofFury.guideSubsection}
        {hasStrikeOfTheWindlord && modules.strikeoftheWindlord.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.SLICING_WINDS_TALENT) &&
          modules.slicingWinds.guideSubsection}
      </Section>
      <Section title={t({ id: 'monk.windwalker.section.majorCooldowns', message: 'Major Cooldowns' })}>
      <p>
        <>
          {t({
            id: 'monk.windwalker.majorCooldowns.description1.p1',
            message:
              'In general, use cooldowns as close to cooldown as possible. If you can stack them without losing a cast, that is usually better than desyncing them for no reason. ',
          })}
          <SpellLink spell={TALENTS_MONK.ZENITH_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description1.p2',
            message: ' is always part of that plan, so go into each Zenith window with enough resources to spend strong globals immediately instead of fixing chi with multiple ',
          })}
          <SpellLink spell={SPELLS.TIGER_PALM} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description1.p3',
            message: ' casts.',
          })}
        </>
      </p>
      <p>
        <>
          {t({
            id: 'monk.windwalker.majorCooldowns.description2.p1',
            message:
              'When playing Conduit of the Celestials, your biggest burst window is still ',
          })}
          <SpellLink spell={TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description2.p2',
            message: ' into ',
          })}
          <SpellLink spell={TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description2.p3',
            message:
              '. Plan ahead so you are not spending a low-value global summoning Xuen when you want to be channeling Conduit, and keep one ',
          })}
          <SpellLink spell={TALENTS_MONK.ZENITH_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description2.p4',
            message:
              ' charge ready for that package. Peak of Serenity currently recommends delaying ',
          })}
          {hasStrikeOfTheWindlord ? (
            <>
              <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
              {t({
                id: 'monk.windwalker.majorCooldowns.description2.p5',
                message: ' or ',
              })}
              <SpellLink spell={TALENTS_MONK.WHIRLING_DRAGON_PUNCH_TALENT} />
            </>
          ) : (
            <SpellLink spell={TALENTS_MONK.WHIRLING_DRAGON_PUNCH_TALENT} />
          )}
          {t({
            id: 'monk.windwalker.majorCooldowns.description2.p6',
            message:
              ' if that burst starts within about 10 seconds, or delaying Xuen instead if those buttons will be ready in the next 10 seconds.',
          })}
        </>
      </p>
      <p>
        <>
          {t({
            id: 'monk.windwalker.majorCooldowns.description3.p1',
            message: 'Conduit-specific ',
          })}
          <SpellLink spell={TALENTS_MONK.CELESTIAL_CONDUIT_WINDWALKER_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description3.p2',
            message: ' usage is also about ',
          })}
          <SpellLink spell={SPELLS.HEART_OF_THE_JADE_SERPENT_BUFF} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description3.p3',
            message: ' timing. Since that buff can also come from ',
          })}
          {hasStrikeOfTheWindlord ? (
            <>
              <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
              {t({
                id: 'monk.windwalker.majorCooldowns.description3.p4',
                message: ' and ',
              })}
              <SpellLink spell={TALENTS_MONK.WHIRLING_DRAGON_PUNCH_TALENT} />
            </>
          ) : (
            <SpellLink spell={TALENTS_MONK.WHIRLING_DRAGON_PUNCH_TALENT} />
          )}
          {t({
            id: 'monk.windwalker.majorCooldowns.description3.p5',
            message:
              ', stagger those uses instead of overlapping them blindly so you get more total uptime and value.',
          })}
        </>
      </p>
      <p>
        <>
          <SpellLink spell={TALENTS_MONK.ZENITH_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description4.p1',
            message:
              ' itself is still not just a button to hit mindlessly. Use it where its reduced chi costs and extra ',
          })}
          <SpellLink spell={SPELLS.BLACKOUT_KICK} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description4.p2',
            message:
              ' cooldown reduction convert into real value, and avoid spending the window on low-impact setup globals. This matters even more with ',
          })}
          <SpellLink spell={TALENTS_MONK.OBSIDIAN_SPIRAL_TALENT} />
          {t({
            id: 'monk.windwalker.majorCooldowns.description4.p3',
            message:
              ', where reducing Tiger Palm usage inside Zenith is part of correct play.',
          })}
        </>
      </p>
        {info.combatant.hasTalent(TALENTS_MONK.INVOKE_XUEN_THE_WHITE_TIGER_TALENT) &&
          modules.invokeXuen.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.ZENITH_TALENT) && modules.zenith.guideSubsection}
      </Section>
      <Section title={t({ id: 'monk.windwalker.section.otherCooldowns', message: 'Other Cooldowns, Buffs and Procs' })}>
        {info.combatant.hasTalent(TALENTS_MONK.CHI_BURST_TALENT) &&
          modules.chiBurst.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.DANCE_OF_CHI_JI_WINDWALKER_TALENT) &&
          modules.danceOfChiJi.guideSubsection}
        {(info.combatant.hasTalent(TALENTS_MONK.COMBO_BREAKER_TALENT) ||
          info.combatant.hasTalent(TALENTS_MONK.SEQUENCED_STRIKES_TALENT)) &&
          modules.comboBreaker.guideSubsection}
        {info.combatant.hasTalent(TALENTS_MONK.RUSHING_WIND_KICK_WINDWALKER_TALENT) &&
          modules.rushingWindKick.guideSubsection}
        {modules.touchOfKarma.guideSubsection}
      </Section>
      <Section title={t({ id: 'monk.windwalker.section.coreRotation', message: 'Core Rotation' })}>
        <SubSection title={t({ id: 'monk.windwalker.subsection.overview', message: 'Overview' })}>
        <p>
          <>
            {t({
              id: 'monk.windwalker.overview.description1.p1',
              message:
                'Windwalker is not played by mindlessly following the next line of the APL. The core of the spec is maintaining ',
            })}
            <SpellLink spell={SPELLS.COMBO_STRIKES} />
            {t({
              id: 'monk.windwalker.overview.description1.p2',
              message: ', avoiding repeated casts, and weaving ',
            })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.overview.description1.p3',
              message: ' and ',
            })}
            <SpellLink spell={SPELLS.BLACKOUT_KICK} />
            {t({
              id: 'monk.windwalker.overview.description1.p4',
              message: ' so you do not over-cap ',
            })}
            <SpellLink spell={RESOURCE_TYPES.ENERGY} />
            {t({
              id: 'monk.windwalker.overview.description1.p5',
              message: ' or get stranded without enough ',
            })}
            <SpellLink spell={RESOURCE_TYPES.CHI} />
            {t({
              id: 'monk.windwalker.overview.description1.p6',
              message: ' for your important spenders.',
            })}
          </>
        </p>
        <p>
          <>
            {t({
              id: 'monk.windwalker.overview.description2.p1',
              message:
                'In practice, most of your rotational decisions are about feeding high-value buttons cleanly. ',
            })}
            <SpellLink spell={TALENTS_MONK.FISTS_OF_FURY_TALENT} />
            {t({
              id: 'monk.windwalker.overview.description2.p2',
              message: ', ',
            })}
            <SpellLink spell={TALENTS_MONK.RISING_SUN_KICK_TALENT} />
            {hasStrikeOfTheWindlord && (
              <>
                {t({
                  id: 'monk.windwalker.overview.description2.p2a',
                  message: ', ',
                })}
                <SpellLink spell={TALENTS_MONK.STRIKE_OF_THE_WINDLORD_TALENT} />
              </>
            )}
            {t({
              id: 'monk.windwalker.overview.description2.p3',
              message: ', ',
            })}
            <SpellLink spell={TALENTS_MONK.WHIRLING_DRAGON_PUNCH_TALENT} />
            {t({
              id: 'monk.windwalker.overview.description2.p4',
              message:
                ', and hero-specific payoffs should be given room in the next few globals. That means using ',
            })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.overview.description2.p5',
              message: ' proactively when you need chi for an upcoming spender, but minimizing extra ',
            })}
            <SpellLink spell={SPELLS.TIGER_PALM} />
            {t({
              id: 'monk.windwalker.overview.description2.p6',
              message: ' casts inside burst windows where stronger abilities are available.',
            })}
          </>
        </p>
        <p>
          <>
            {t({
              id: 'monk.windwalker.overview.description3.p1',
              message: 'Procs matter as much as cooldown order. Spend ',
            })}
            <SpellLink spell={SPELLS.DANCE_OF_CHI_JI_BUFF} />
            {t({
              id: 'monk.windwalker.overview.description3.p2',
              message: ' before it expires, use ',
            })}
            <SpellLink spell={SPELLS.COMBO_BREAKER_BUFF} />
            {t({
              id: 'monk.windwalker.overview.description3.p3',
              message:
                ' without overcapping it, and avoid sitting on high-impact cooldowns for filler globals. The APL should be read as your ordered tiebreaker once mastery, resource flow, and proc management are already being respected.',
            })}
          </>
        </p>
          <p>
            <>{t({ id: 'monk.windwalker.overview.description4.p1', message: 'More complete and up-to-date rotation guidance is available in the' })}
              {' '}
              <a href="https://www.peakofserenity.com/tww/windwalker/pve-guide/#Priority_Lists">{t({ id: 'monk.windwalker.overview.description4.a', message: 'Peak of Serenity Windwalker guide' })}</a>
              {t({ id: 'monk.windwalker.overview.description4.p2', message: '.' })}
            </>
          </p>
        </SubSection>
        <SubSection title={t({ id: 'monk.windwalker.subsection.aplAnalysis', message: 'APL Analysis' })}>
          <AplSectionData checker={AplCheck.check} apl={windwalkerApl(info)} />
        </SubSection>
      </Section>
      <PreparationSection />
    </>
  );
}

function MasteryGraph({ modules, events, info }: GuideProps<typeof CombatLogParser>) {
  const styleObj = {
    fontSize: 20,
  };
  const explanation = (
    <>
      <p>
        <>
          <strong>
            <SpellLink spell={SPELLS.COMBO_STRIKES} />
          </strong>{' '}
          {t({
            id: 'monk.windwalker.masteryGraph.description.p1',
            message:
              'is an extremely important part of playing Windwalker effectively. Dropping stacks of your mastery is particularly dangerous when also running ',
          })}
          <SpellLink spell={TALENTS_MONK.HIT_COMBO_TALENT} />
          {t({
            id: 'monk.windwalker.masteryGraph.description.p2',
            message:
              ' as it causes the mastery drop to double dip.',
          })}
        </>
        {info.combatant.hasTalent(TALENTS_MONK.HIT_COMBO_TALENT) && (
          <p>
            <Trans id="monk.windwalker.masteryGraph.hitCombo">
              The graph visualizes all drops, and the time it takes to get back to the full effect.
            </Trans>
          </p>
        )}
      </p>
    </>
  );

  const data = (
    <div>
      <div>
        <RoundedPanel>
          <strong>
            <SpellLink spell={SPELLS.COMBO_STRIKES} />{' '}
            {t({
              id: 'monk.windwalker.masteryGraph.maintenance',
              message: 'maintenance',
            })}
          </strong>
          <div style={styleObj}>{modules.comboStrikes.subStatistic}</div>
          {info.combatant.hasTalent(TALENTS_MONK.HIT_COMBO_TALENT) && (
            <>
              <strong>
                <SpellLink spell={SPELLS.HIT_COMBO_BUFF} />{' '}
                {t({
                  id: 'monk.windwalker.masteryGraph.hitComboMaintenance',
                  message: 'maintenance',
                })}
              </strong>
              {modules.hitComboGraph.plot}
            </>
          )}
        </RoundedPanel>
      </div>
    </div>
  );

  return <SubSection>{explanationAndDataSubsection(explanation, data)}</SubSection>;
}
