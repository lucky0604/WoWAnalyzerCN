import { t } from '@lingui/core/macro';
import DocumentTitle from 'interface/DocumentTitle';
import TwitterIcon from 'interface/icons/Twitter';

import NewsList from '../NewsList';
import { usePageView } from '../useGoogleAnalytics';

export function Component() {
  usePageView('Home/News');
  return (
    <>
      <DocumentTitle title="News" /> {/* prettiest is if the Home page has no title at all */}
      <div className="flex flex-news">
        <div className="flex-main">
          <h1 id="news-top">{t({ id: 'interface.news.newStuff', message: 'New stuff' })}</h1>
        </div>
        <div className="flex-sub flex-sub-news">
          <small>{t({ id: 'interface.news.moreNews', message: 'More news?' })}</small>
          <span style={{ fontSize: 18, marginLeft: 10 }}>
            <TwitterIcon colored />{' '}
            <a href="https://twitter.com/WoWAnalyzer" style={{ fontSize: 16 }}>
              {t({ id: 'interface.news.follow', message: 'Follow @WoWAnalyzer' })}
            </a>
          </span>
        </div>
      </div>
      <NewsList topAnchor="news-top" />
    </>
  );
}
