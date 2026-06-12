import { TALENTS_DEMON_HUNTER } from 'common/TALENTS/demonhunter';
import { SpellLink } from 'interface';
import { SubSection, useAnalyzer, useInfo } from 'interface/guide';
import FieryBrand from './index';
import ExplanationRow from 'interface/guide/components/ExplanationRow';
import Explanation from 'interface/guide/components/Explanation';
import {
  Highlight,
  HitBasedOverview,
  red,
} from 'analysis/retail/demonhunter/vengeance/guide/HitTimeline';
import { t } from '@lingui/core/macro';

export default function FieryBrandSubSection() {
  const info = useInfo();
  const fieryBrand = useAnalyzer(FieryBrand);
  if (!info || !fieryBrand) {
    return null;
  }

  return (
    <SubSection
      title={t({
        id: 'demonhunter.vengeance.fieryBrand.guideSection.title',
        message: 'Fiery Brand',
      })}
    >
      <ExplanationRow>
        <Explanation>
          <p>
            <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.description.p1', message: ' reduces the damage dealt to you by targets with its debuff by ' })}
            <strong>{t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.description.bold', message: '40%' })}</strong>
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.description.p2', message: '.' })}
          </p>
          <p>
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.p1', message: 'This chart shows your ' })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.p2', message: ' uptime along with the damage that you took. ' })}
            <strong>{t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.bold', message: 'You do not need 100% uptime!' })}</strong>
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.p3', message: ' However, damage taken without ' })}
            <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} />
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.p4', message: ' active (shown in ' })}
            <Highlight color={red}>{t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.red', message: 'red' })}</Highlight>
            {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.chart.p5', message: ') is dangerous!' })}
          </p>
        </Explanation>
        <HitBasedOverview
          info={info}
          hitBasedAnalyzer={fieryBrand}
          spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT}
          unmitigatedContent={
            <>
              <SpellLink spell={TALENTS_DEMON_HUNTER.FIERY_BRAND_TALENT} />
              {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.unmitigated.p1', message: ' would have reduced this by ' })}
              <strong>{t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.unmitigated.bold', message: '40%' })}</strong>
              {t({ id: 'demonhunter.vengeance.fieryBrand.guideSection.unmitigated.p2', message: '.' })}
            </>
          }
        />
      </ExplanationRow>
    </SubSection>
  );
}
