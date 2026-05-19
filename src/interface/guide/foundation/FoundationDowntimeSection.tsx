import type { JSX } from 'react';
import { t } from '@lingui/core/macro';
import { SubSection } from '../index';
import FoundationDowntimeSectionV2 from './FoundationDowntimeSectionV2';

export function FoundationDowntimeSection(): JSX.Element | null {
  return (
    <SubSection title={t({ id: 'guide.foundation.downtime', message: 'Always Be Casting' })}>
      <FoundationDowntimeSectionV2 />
    </SubSection>
  );
}
