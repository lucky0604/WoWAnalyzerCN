import { GuideProps, Section } from 'interface/guide';
import CombatLogParser from '../CombatLogParser';
import { TALENTS_DEMON_HUNTER } from 'common/TALENTS';
import { t } from '@lingui/core/macro';

function ProcsAndBuffsSection({ modules, info }: GuideProps<typeof CombatLogParser>) {
  return info.combatant.hasTalent(TALENTS_DEMON_HUNTER.HUNGERING_SLASH_TALENT) ? (
    <Section
      title={t({
        id: 'guide.demonhunter.devourer.sections.procs.title',
        message: 'Procs',
      })}
    >
      {modules.voidstep.guideSubsection()}
    </Section>
  ) : (
    <></>
  );
}

export default ProcsAndBuffsSection;
