import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import DocumentTitle from 'interface/DocumentTitle';
import { constructURL } from 'interface/ReportSelecter';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export function Component() {
  const location = useLocation();
  const query =
    decodeURIComponent(location.pathname.replace('/search/', '')) +
    decodeURIComponent(location.hash);
  const [valid, setValid] = useState<boolean>(false);
  const navigate = useNavigate();
  useEffect(() => {
    const constructedURL = constructURL(query);
    if (constructedURL) {
      navigate(constructedURL, { replace: true }); //attempt redirect to report analysis if one was found
    } else {
      setValid(false);
    }
  }, [navigate, setValid, query]);

  return (
    <div className="container">
      <DocumentTitle title="Search" />
      <h1>{t({ id: 'interface.search.reportSearch', message: 'Report Search' })}</h1>
      {valid ? (
        <>{t({ id: 'interface.search.searchingFor', message: 'Searching for' })} </>
      ) : (
        <>
          {t({
            id: 'interface.search.invalidSearchParameter',
            message: 'Invalid search parameter:',
          })}{' '}
        </>
      )}
      <b>{query}</b>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      <br />
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      <br />
      <>{t({ id: 'interface.search.supportedTerms.p1', message: 'Supported search terms:' })}
        {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
        <br />
        <ul>
          <li>&lt;report code&gt;</li>
          <li>https://www.warcraftlogs.com/reports/&lt;report code&gt;</li>
          <li>https://www.warcraftlogs.com/character/&lt;region&gt;/&lt;realm&gt;/&lt;name&gt;</li>
          <li>
            https://worldofwarcraft.com/&lt;language-code&gt;/character/&lt;realm&gt;/&lt;name&gt;
          </li>
        </ul>
      </>
      {/* oxlint-disable-next-line wowanalyzer/no-br -- Baseline suppression */}
      <br />
      <Link to="/">{t({ id: 'interface.search.goBackHome', message: 'Go back home' })}</Link>
    </div>
  );
}
