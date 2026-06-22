import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import Config from 'parser/Config';
import { WCLFight } from 'parser/core/Fight';
import { PlayerDetails } from 'parser/core/Player';
import Report from 'parser/core/Report';

import SupportCheckerIssue from './SupportCheckerIssue';
import { useLingui } from '@lingui/react';

interface Props {
  report: Report;
  fight: WCLFight;
  config: Config;
  player: PlayerDetails;
  onContinueAnyway: () => void;
}

const SupportCheckerSpecPartialSupport = ({ config, ...others }: Props) => {
  const { i18n } = useLingui();

  return (
    <SupportCheckerIssue
      title={t({
        id: 'interface.report.supportChecker.specPartialSupport',
        message: 'Partial support',
      })}
      config={config}
      {...others}
    >
      <>{t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p1', message: 'This spec has received updates for the latest patch but it is still missing important elements needed to provide you with good and reliable feedback. ' })}
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p2', message: 'We recommend reading the Wowhead and' })}
        {' '}
        <a href="https://www.icy-veins.com/wow/class-guides">{t({ id: 'interface.report.supportChecker.specPartialSupportDetails.a', message: 'Icy Veins' })}</a>
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p3', message: 'guides to gain more knowledge about your spec and use this when analyzing yourself. You can also try asking for help in a ' })}
        <a href="https://www.reddit.com/r/wow/wiki/discord">{t({ id: 'interface.report.supportChecker.specPartialSupportDetails.a2', message: 'class Discord' })}</a>
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p4', message: '. ' })}
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p5', message: 'We do not know when ' })}
        {config.spec.specName ? i18n._(config.spec.specName) : null}
        {' '}
        {i18n._(config.spec.className)}
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p6', message: 'will have full support. It may take a while to fully support a spec, so please be patient. If you are interested or know someone who might be interested helping people help themselves, check out' })}
        {' '}
        <a href="https://github.com/WoWAnalyzer/WoWAnalyzer">{t({ id: 'interface.report.supportChecker.specPartialSupportDetails.a3', message: 'GitHub' })}</a>
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p7', message: 'or' })}
        {' '}
        <a href="https://wowanalyzer.com/discord">{t({ id: 'interface.report.supportChecker.specPartialSupportDetails.a4', message: 'Discord' })}</a>
        {t({ id: 'interface.report.supportChecker.specPartialSupportDetails.p8', message: 'for more information.' })}
      </>
    </SupportCheckerIssue>
  );
};

export default SupportCheckerSpecPartialSupport;
