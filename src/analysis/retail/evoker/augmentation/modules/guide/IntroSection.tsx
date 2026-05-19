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
        <Trans id="guide.evoker.augmentation.sections.preface.1">
          Hello and welcome to the analyzer for the Augmentation Evoker spec! All the theorycrafting
          comes hot and fresh from the official{' '}
          <a href="https://discord.com/invite/evoker">Evoker Discord</a>.
        </Trans>
      </p>
      <p>
        <Trans id="guide.evoker.augmentation.sections.preface.2">
          For more in-depth information about the spec, you should check out these guides:{' '}
          <a href="https://www.wowhead.com/guide/classes/evoker/augmentation/dragonflight-season-2">
            Wowhead
          </a>
          , <a href="https://www.icy-veins.com/wow/augmentation-evoker-buffs">Icy-Veins</a>
        </Trans>
      </p>
      <p>
        <Trans id="guide.evoker.augmentation.sections.preface.3">
          If you have any suggestions, corrections, complaints, or want to help, we're happy to talk
          over at <code>#augmentation</code> in the{' '}
          <a href="https://discord.com/invite/evoker">Evoker Discord</a>.
        </Trans>
      </p>
    </Section>
  );
}
