import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import DocumentTitle from 'interface/DocumentTitle';
import GitHubButton from 'interface/GitHubButton';
import DiscordIcon from 'interface/icons/DiscordTiny';
import PremiumIcon from 'interface/icons/Premium';
import ViralContentIcon from 'interface/icons/ViralContent';
import WebBannerIcon from 'interface/icons/WebBanner';
import PatreonButton from 'interface/PatreonButton';
import { getUser } from 'interface/selectors/user';
import { TooltipElement } from 'interface/Tooltip';
import { useWaSelector } from 'interface/utils/useWaSelector';
import { usePageView } from 'interface/useGoogleAnalytics';

import './premium.scss';

import LoginPanel from '../PremiumLoginPanel';
import Panel from 'interface/Panel';

export function Component() {
  usePageView('Premium');
  const user = useWaSelector((state) => getUser(state));
  const { i18n } = useLingui();

  return (
    <>
      <DocumentTitle title="Premium" />
      <div className="premium row">
        <div className="col-md-4 col-sm-5">
          <LoginPanel />
        </div>
        <div className="col-md-8 col-sm-7">
          <Panel title={t({ id: 'interface.premiumPage.premium', message: 'WoWAnalyzer Premium' })}>
            <PremiumIcon
              style={{ fontSize: '6em', float: 'right', color: '#fab700', marginTop: 0 }}
            />
            <div style={{ fontSize: '1.4em', fontWeight: 400 }}>
              <>{t({ id: 'interface.premiumPage.premium.helpout.p1', message: 'Help out development and unlock' })}
                {' '}
                <span style={{ color: '#fab700', fontWeight: 700 }}>{t({ id: 'interface.premiumPage.premium.helpout.span', message: 'WoWAnalyzer Premium' })}</span>
                {t({ id: 'interface.premiumPage.premium.helpout.p2', message: '!' })}
              </>
            </div>

            <div className="row" style={{ marginBottom: 5, marginTop: 60 }}>
              <div className="col-md-12 text-center text-muted">
                <Trans id="interface.premiumPage.howToUnlock">
                  How to unlock WoWAnalyzer Premium:
                </Trans>
              </div>
            </div>
            <div className="row flex">
              <div className="col-md-6" style={{ borderRight: '1px solid #aaa' }}>
                <><h2>Patreon</h2>
                  {t({ id: 'interface.premiumPage.helpPatreon.p1', message: 'Help fund further development by becoming a patron on Patreon.' })}
                </>
                {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                <br />
                {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                <br />

                <PatreonButton />
              </div>
              <div className="col-md-6">
                <><h2>GitHub</h2>
                  {t({ id: 'interface.premiumPage.helpGitHub.p1', message: 'Improve the analysis of a spec or build a new feature to get 1 month of Premium free ' })}
                  <TooltipElement
                    content={i18n.t({
                      id: 'interface.premiumPage.githubTooltip',
                      message: `Only commits that are merged to the main branch are eligible. Your work will have to pass a pull request review before it can be merged.`,
                    })}
                  >
                    *
                  </TooltipElement>
                  {t({ id: 'interface.premiumPage.helpGitHub.p2', message: '.' })}
                </>
                {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                <br />
                {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
                <br />

                <GitHubButton />
              </div>
            </div>

            <div className="row" style={{ marginTop: 15 }}>
              <div className="col-md-12 text-center text-muted">
                <Trans id="interface.premiumPage.loginInstructions">
                  After unlocking Premium, log in using the buttons to the left.
                </Trans>
              </div>
            </div>

            <div className="row" style={{ marginBottom: 5, marginTop: 60 }}>
              <div className="col-md-12 text-center text-muted">
                <Trans id="interface.premiumPage.unlocks">
                  WoWAnalyzer Premium unlocks the following things:
                </Trans>
              </div>
            </div>
            <div>
              <div className="premium-feature flex">
                <div className="content-middle flex-sub">
                  <ViralContentIcon />
                </div>
                <div className="flex-main">
                  <><h2>New things</h2>
                    <strong>{t({ id: 'interface.premiumPage.unlocks.new.strong', message: 'Nothing develops itself.' })}</strong>
                    {t({ id: 'interface.premiumPage.unlocks.new.p1', message: 'Your contributions will help fund new things and improvements for the site, making it even better. You will also unlock additional features to help with your analysis.' })}
                  </>
                </div>
              </div>
              <div className="premium-feature flex">
                <div className="content-middle flex-sub">
                  <ViralContentIcon />
                </div>
                <div className="flex-main">
                  <><h2>Updates for patches</h2>
                    <strong>{t({ id: 'interface.premiumPage.unlocks.updates.strong', message: 'Updating for patches is a lot of work.' })}</strong>
                    {t({ id: 'interface.premiumPage.unlocks.updates.p1', message: 'We need to apply all spell changes, add new traits, add support for the new fights, make screenshots, add fight phases, buffs and debuffs, etc. Your contributions make it possible for us to keep specs updated as they\'re changed in patches.' })}
                  </>
                </div>
              </div>
              <div className="premium-feature flex">
                <div className="content-middle flex-sub">
                  <WebBannerIcon />
                </div>
                <div className="flex-main">
                  <><h2>No ads</h2>
                    <strong>{t({ id: 'interface.premiumPage.unlocks.noAds.strong', message: 'Nobody likes them, but we need them.' })}</strong>
                    {t({ id: 'interface.premiumPage.unlocks.noAds.p1', message: 'Any contribution is worth more than the ads, so we\'ll remove ads from the platform for you so you can consume our content with less distractions and less clutter.' })}
                  </>
                </div>
              </div>
              <div className="premium-feature flex">
                <div className="content-middle flex-sub">
                  <DiscordIcon style={{ color: '#ff8000' }} />
                </div>
                <div className="flex-main">
                  <><h2>Discord name color</h2>
                    <strong>{t({ id: 'interface.premiumPage.unlocks.discord.strong', message: 'We\'ll help anyone, but sometimes we can\'t avoid favoritism.' })}</strong>
                    {t({ id: 'interface.premiumPage.unlocks.discord.p1', message: 'Get a distinct Discord name color befitting your contribution. See Patreon for Patron specific name colors. Serious GitHub contributors get the yellow contributor name color.' })}
                  </>
                </div>
              </div>
              <div className="premium-feature flex">
                <div className="content-middle flex-sub">
                  <DiscordIcon />
                </div>
                <div className="flex-main">
                  <><h2>Access to secret channels on Discord</h2>
                    <strong>{t({ id: 'interface.premiumPage.unlocks.discordChannels.strong', message: 'You don\'t know what you\'re missing out on.' })}</strong>
                    {t({ id: 'interface.premiumPage.unlocks.discordChannels.p1', message: 'Get access to special Discord channels to discuss things privately in the sub-community.' })}
                  </>
                </div>
              </div>
            </div>
          </Panel>
          {user && (
            <Panel title={t({ id: 'interface.premiumPage.you', message: 'You' })}>
              <Trans id="interface.premiumPage.status">
                Hello {user.name}. Your Premium is currently{' '}
                {user.premium ? (
                  <span className="text-success">
                    {i18n.t({
                      id: 'interface.premiumPage.status.active',
                      message: `Active`,
                    })}
                  </span>
                ) : (
                  <span className="text-danger">
                    {i18n.t({
                      id: 'interface.premiumPage.status.inactive',
                      message: `Inactive`,
                    })}
                  </span>
                )}{' '}
                {user.patreon && user.patreon.premium
                  ? ` ${i18n.t({
                      id: 'interface.premiumPage.status.patreon',
                      message: `because of your Patreonage`,
                    })}`
                  : null}{' '}
                {user.github && user.github.premium && user.github.expires
                  ? ` ${i18n.t({
                      id: 'interface.premiumPage.status.gitHub',
                      message: `because of a recent GitHub contribution (active until ${new Date(user.github.expires).toLocaleDateString(import.meta.env.LOCALE)})`,
                    })}`
                  : null}
                .{' '}
                {user.premium
                  ? i18n.t({
                      id: 'interface.premiumPage.status.userHasPremium',
                      message: `Awesome!`,
                    })
                  : i18n.t({
                      id: 'interface.premiumPage.status.getPremium',
                      message: `You can get Premium by becoming a Patron on Patreon or by making a contribution to application on GitHub. Try logging in again if you wish to refresh your status.`,
                    })}
              </Trans>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

export default Component;
