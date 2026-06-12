import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import SPELLS from 'common/SPELLS/demonhunter';
import { SpellLink } from 'interface';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide';
import VoidReaver from './index';
import ExplanationRow from 'interface/guide/components/ExplanationRow';
import Explanation from 'interface/guide/components/Explanation';
import { HitBasedOverview } from 'analysis/retail/demonhunter/vengeance/guide/HitTimeline';
import { t } from '@lingui/core/macro';

export default function VoidReaverSubSection() {
  const info = useInfo();
  const voidReaver = useAnalyzer(VoidReaver);
  if (!info || !voidReaver || !info.combatant.hasTalent(TALENTS_DEMON_HUNTER.VOID_REAVER_TALENT)) {
    return null;
  }

  return (
    <SubSection
      title={t({
        id: 'demonhunter.vengeance.voidReaver.guideSection.title',
        message: 'Frailty',
      })}
    >
      <ExplanationRow>
        <Explanation>
          <p>
            <SpellLink spell={TALENTS_DEMON_HUNTER.FRAILTY_TALENT} />
            {t({ id: 'demonhunter.vengeance.voidReaver.guideSection.description.p1', message: ' is a stacking 4% DR (Damage Reduction). You should aim to have it applied to any target that you are actively tanking. It is applied automatically by doing your core rotation effectively.' })}
          </p>
          <p>
            {t({ id: 'demonhunter.vengeance.voidReaver.guideSection.chart.p1', message: 'This chart shows your ' })}
            <SpellLink spell={SPELLS.FRAILTY} />
            {t({ id: 'demonhunter.vengeance.voidReaver.guideSection.chart.p2', message: ' uptime along with the damage that you took.' })}
          </p>
        </Explanation>
        <HitBasedOverview
          info={info}
          hitBasedAnalyzer={voidReaver}
          spell={SPELLS.FRAILTY}
          unmitigatedContent={
            <>
              <SpellLink spell={SPELLS.FRAILTY} />
              {t({ id: 'demonhunter.vengeance.voidReaver.guideSection.unmitigated.p1', message: ' would have reduced this by at least ' })}
              <strong>{t({ id: 'demonhunter.vengeance.voidReaver.guideSection.unmitigated.bold', message: '4%' })}</strong>
              {t({ id: 'demonhunter.vengeance.voidReaver.guideSection.unmitigated.p2', message: '.' })}
            </>
          }
        />
      </ExplanationRow>
    </SubSection>
  );
}
