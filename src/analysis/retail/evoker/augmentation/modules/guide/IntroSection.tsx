import { Section } from 'interface/guide';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

export function IntroSection() {
  return (
    <Section
      title={t({
        id: 'guide.evoker.augmentation.sections.preface.title',
        message: 'Preface',
      })}
    >
      <p>
        <>{t({ id: 'guide.evoker.augmentation.sections.preface.1.p1', message: 'Hello and welcome to the analyzer for the Augmentation Evoker spec! All the theorycrafting comes hot and fresh from the official' })}
          {' '}
          <a href="https://discord.com/invite/evoker">{t({ id: 'guide.evoker.augmentation.sections.preface.1.a', message: 'Evoker Discord' })}</a>
          {t({ id: 'guide.evoker.augmentation.sections.preface.1.p2', message: '.' })}
        </>
      </p>
      <p>
        <>{t({ id: 'guide.evoker.augmentation.sections.preface.2.p1', message: 'For more in-depth information about the spec, you should check out these guides:' })}
          {' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/augmentation/dragonflight-season-2">{t({ id: 'guide.evoker.augmentation.sections.preface.2.a', message: 'Wowhead' })}</a>
          {t({ id: 'guide.evoker.augmentation.sections.preface.2.p2', message: ',' })}
          <a href="https://www.icy-veins.com/wow/augmentation-evoker-buffs">{t({ id: 'guide.evoker.augmentation.sections.preface.2.a2', message: 'Icy-Veins' })}</a>
        </>
      </p>
      <p>
        <>{t({ id: 'guide.evoker.augmentation.sections.preface.3.p1', message: 'If you have any suggestions, corrections, complaints, or want to help, we\'re happy to talk over at ' })}
          <code>{t({ id: 'guide.evoker.augmentation.sections.preface.3.code', message: '#augmentation' })}</code>
          {t({ id: 'guide.evoker.augmentation.sections.preface.3.p2', message: 'in the' })}
          {' '}
          <a href="https://discord.com/invite/evoker">{t({ id: 'guide.evoker.augmentation.sections.preface.3.a', message: 'Evoker Discord' })}</a>
          {t({ id: 'guide.evoker.augmentation.sections.preface.3.p3', message: '.' })}
        </>
      </p>
    </Section>
  );
}
