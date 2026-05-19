import { i18n } from '@lingui/core';
import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import { getLanguage } from 'interface/selectors/language';
import { useWaSelector } from 'interface/utils/useWaSelector';
import { ReactNode, useEffect, useState } from 'react';
import { useHead } from '@unhead/react';

// Per-spec Chinese translations. Structure mirrors src/analysis/retail/{class}/{spec}/
const SPEC_TRANSLATIONS: Record<string, () => Promise<Record<string, string>>> = {
  zh: async () => {
    const [
      guardian,
      balance,
      feral,
      restoration,
      paladinHoly,
      paladinProtection,
      paladinRetribution,
      shamanElemental,
      shamanEnhancement,
      shamanRestoration,
      priestDiscipline,
      priestHoly,
      priestShadow,
      monkBrewmaster,
      monkMistweaver,
      monkWindwalker,
      warriorArms,
      warriorFury,
      mageArcane,
      mageFire,
      mageFrost,
      warlockAffliction,
      warlockDemonology,
      warlockDestruction,
      rogueAssassination,
      rogueOutlaw,
      rogueSubtlety,
      deathknightFrost,
      deathknightBlood,
      deathknightUnholy,
      demonhunterHavoc,
      demonhunterVengeance,
      demonhunterDevourer,
      evokerAugmentation,
      evokerDevastation,
      evokerPreservation,
      hunterBeastmastery,
      hunterSurvival,
    ] = await Promise.all([
      import('./zh/druid/guardian/content.json'),
      import('./zh/druid/balance/content.json'),
      import('./zh/druid/feral/content.json'),
      import('./zh/druid/restoration/content.json'),
      import('./zh/paladin/holy/content.json'),
      import('./zh/paladin/protection/content.json'),
      import('./zh/paladin/retribution/content.json'),
      import('./zh/shaman/elemental/content.json'),
      import('./zh/shaman/enhancement/content.json'),
      import('./zh/shaman/restoration/content.json'),
      import('./zh/priest/discipline/content.json'),
      import('./zh/priest/holy/content.json'),
      import('./zh/priest/shadow/content.json'),
      import('./zh/monk/brewmaster/content.json'),
      import('./zh/monk/mistweaver/content.json'),
      import('./zh/monk/windwalker/content.json'),
      import('./zh/warrior/arms/content.json'),
      import('./zh/warrior/fury/content.json'),
      import('./zh/mage/arcane/content.json'),
      import('./zh/mage/fire/content.json'),
      import('./zh/mage/frost/content.json'),
      import('./zh/warlock/affliction/content.json'),
      import('./zh/warlock/demonology/content.json'),
      import('./zh/warlock/destruction/content.json'),
      import('./zh/rogue/assassination/content.json'),
      import('./zh/rogue/outlaw/content.json'),
      import('./zh/rogue/subtlety/content.json'),
      import('./zh/deathknight/frost/content.json'),
      import('./zh/deathknight/blood/content.json'),
      import('./zh/deathknight/unholy/content.json'),
      import('./zh/demonhunter/havoc/content.json'),
      import('./zh/demonhunter/vengeance/content.json'),
      import('./zh/demonhunter/devourer/content.json'),
      import('./zh/evoker/augmentation/content.json'),
      import('./zh/evoker/devastation/content.json'),
      import('./zh/evoker/preservation/content.json'),
      import('./zh/hunter/beastmastery/content.json'),
      import('./zh/hunter/survival/content.json'),
    ]);
    return {
      ...guardian.default,
      ...balance.default,
      ...feral.default,
      ...restoration.default,
      ...paladinHoly.default,
      ...paladinProtection.default,
      ...paladinRetribution.default,
      ...shamanElemental.default,
      ...shamanEnhancement.default,
      ...shamanRestoration.default,
      ...priestDiscipline.default,
      ...priestHoly.default,
      ...priestShadow.default,
      ...monkBrewmaster.default,
      ...monkMistweaver.default,
      ...monkWindwalker.default,
      ...warriorArms.default,
      ...warriorFury.default,
      ...mageArcane.default,
      ...mageFire.default,
      ...mageFrost.default,
      ...warlockAffliction.default,
      ...warlockDemonology.default,
      ...warlockDestruction.default,
      ...rogueAssassination.default,
      ...rogueOutlaw.default,
      ...rogueSubtlety.default,
      ...deathknightFrost.default,
      ...deathknightBlood.default,
      ...deathknightUnholy.default,
      ...demonhunterHavoc.default,
      ...demonhunterVengeance.default,
      ...demonhunterDevourer.default,
      ...evokerAugmentation.default,
      ...evokerDevastation.default,
      ...evokerPreservation.default,
      ...hunterBeastmastery.default,
      ...hunterSurvival.default,
    };
  },
};

const loadCatalog = async (locale: string) => {
  const { messages } = await import(`./${locale}/messages.json?lingui`);

  i18n.load(locale, messages);

  const loadSpec = SPEC_TRANSLATIONS[locale];
  if (loadSpec) {
    try {
      const specMessages = await loadSpec();
      i18n.load(locale, specMessages);
    } catch {
      // spec translations not available — skip
    }
  }

  i18n.activate(locale);
};

interface Props {
  children: ReactNode;
}

const I18nProvider = ({ children }: Props) => {
  const locale = useWaSelector((state) => getLanguage(state));
  const [activeLocale, setActiveLocale] = useState<string | undefined>(undefined);

  // Specify the correct language to disable translation plugins, and try to disable translation
  // plugins. This is needed because they modify the DOM, which can cause React to crash.
  useHead({
    htmlAttrs: {
      lang: activeLocale,
      translate: 'no',
    },
  });

  useEffect(() => {
    if (activeLocale === locale) {
      return;
    }

    loadCatalog(locale)
      .then(() => {
        setActiveLocale(locale);
      })
      .catch((error) => {
        console.error('Unable to set locale', error);
      });
  }, [locale, activeLocale, setActiveLocale]);

  if (!activeLocale && import.meta.env.MODE !== 'test') {
    // Wait with rendering the app until we have the locale loaded. This reduces
    // the amount of significant screen updates, providing a better user
    // experience.
    return null;
  }

  return <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>;
};

export default I18nProvider;
