import { Sref, Rex } from 'CONTRIBUTORS';
import { Trans } from '@lingui/react/macro'
import GameBranch from 'game/GameBranch';
import SPECS from 'game/SPECS';
import Config, { SupportLevel } from 'parser/Config';

import CHANGELOG from './CHANGELOG';

const config: Config = {
  // The people that have contributed to this spec recently. People don't have to sign up to be long-time maintainers to be included in this list. If someone built a large part of the spec or contributed something recently to that spec, they can be added to the contributors list. If someone goes MIA, they may be removed after major changes or during a new expansion.
  contributors: [Sref, Rex],
  branch: GameBranch.Retail,
  // The WoW client patch this spec was last updated.
  patchCompatibility: '12.0.1',
  supportLevel: SupportLevel.Foundation,
  // Explain the status of this spec's analysis here. Try to mention how complete it is, and perhaps show links to places users can learn more.
  // If this spec's analysis does not show a complete picture please mention this in the `<Warning>` component.
  description: (
    <>
      <p>
        <Trans id="druid.guardian.config.welcome">
          Welcome to the Guardian Druid analyzer! We hope you find the guide and statistics useful.
        </Trans>
      </p>
      <p>
        <Trans id="druid.guardian.config.apex_talents_warning">
          Please note that Apex talents are not yet implemented.
        </Trans>
      </p>
      <p>
        <><Trans id="druid.guardian.config.feedback.p1">If you questions, comments, or suggestions about this analyzer, you can reach the WoWAnalyzer team on</Trans>
          {' '}
          <a href="https://github.com/WoWAnalyzer/WoWAnalyzer/issues/new"><Trans id="druid.guardian.config.feedback.a">GitHub</Trans></a>
          <Trans id="druid.guardian.config.feedback.p2">, on</Trans>
          {' '}
          <a href="https://discord.gg/AxphPxU"><Trans id="druid.guardian.config.feedback.a2">Discord</Trans></a>
          <Trans id="druid.guardian.config.feedback.p3">, or message me ( </Trans>
          <a href="/contributor/Sref"><Trans id="druid.guardian.config.feedback.a3">Sref</Trans></a>
          <Trans id="druid.guardian.config.feedback.p4">) directly on Discord. We're always interested in improving the analyzer, whether it's in-depth theorycraft or rewording some text to be easier to understand. The whole project is open source and welcomes contributions so you can directly improve it too!</Trans>
        </>
      </p>
      <p>
        <Trans id="druid.guardian.config.gameplay_questions">
          If you have gameplay questions, check out:
        </Trans>
      </p>
      <div>
        <ul>
          <li>
            <a href="https://www.wowhead.com/guardian-druid-guide">
              <Trans id="druid.guardian.config.wowhead_guide">Guardian guide</Trans>
            </a>{' '}
            <Trans id="druid.guardian.config.on_wowhead">on Wowhead</Trans>
          </li>
          <li>
            <a href="https://www.dreamgrove.gg/blog/guardian/compendium">
              <Trans id="druid.guardian.config.dreamgrove_compendium">Guardian compendium</Trans>
            </a>{' '}
            <Trans id="druid.guardian.config.on_dreamgrove">on Dreamgrove.gg</Trans>
          </li>
          <li>
            <a href="https://discord.gg/dreamgrove" target="_blank" rel="noopener noreferrer">
              <Trans id="druid.guardian.config.dreamgrove_discord">Dreamgrove</Trans>
            </a>{' '}
            <Trans id="druid.guardian.config.dreamgrove_description">
              - the Druid community Discord
            </Trans>
          </li>
        </ul>
      </div>
    </>
  ),
  // A recent example report to see interesting parts of the spec. Will be shown on the homepage.
  exampleReport: '/report/34V2WhNLp9jzd1fX/60-Mythic+One-Armed+Bandit+-+Kill+(6:48)/Pumps/standard',

  // Don't change anything below this line;
  // The current spec identifier. This is the only place (in code) that specifies which spec this parser is about.
  spec: SPECS.GUARDIAN_DRUID,
  // The contents of your changelog.
  changelog: CHANGELOG, // CHANGELOG,
  // The CombatLogParser class for your spec.
  parser: () =>
    import('./CombatLogParser' /* webpackChunkName: "GuardianDruid" */).then(
      (exports) => exports.default,
    ),
  // The path to the current directory (relative form project root). This is used for generating a GitHub link directly to your spec's code.
  path: import.meta.url,
};

export default config;
