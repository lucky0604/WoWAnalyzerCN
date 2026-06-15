import type { JSX } from 'react';
import cssComponent from 'interface/utils/css-component';
import styles from './FoundationSupportBadge.module.scss';
import { OkMark } from '../index';
import { TooltipElement } from 'interface/Tooltip';
import { defineMessage, t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const BadgeContainer = cssComponent('span', styles.BadgeContainer, [] as const);

export default function FoundationSupportBadge({
  withTooltip,
}: {
  withTooltip?: boolean;
}): JSX.Element {
  const badge = (
    <BadgeContainer>
      <OkMark />{' '}
      {t({
        id: 'interface.guide.foundation.foundational-support',
        message: 'Foundational Support',
      })}
    </BadgeContainer>
  );

  if (withTooltip) {
    return <TooltipElement content={i18n._(FOUNDATIONAL_SUPPORT_DESC)}>{badge}</TooltipElement>;
  } else {
    return badge;
  }
}

const FOUNDATIONAL_SUPPORT_DESC = defineMessage({
  id: 'interface.guide.foundation.foundational-support-desc',
  message:
    'Foundational support covers analysis of uptime, cancelled casts, cooldowns, and other core aspects of gameplay common across all specs.',
});
