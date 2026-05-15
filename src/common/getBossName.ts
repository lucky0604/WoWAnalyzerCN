import { getLabel } from 'game/DIFFICULTIES';
import { WCLFight } from 'parser/core/Fight';
import { i18n } from '@lingui/core';
import getBossDisplayName from './getBossDisplayName';

export default function getBossName(fight: WCLFight, withDifficulty = true): string {
  const displayName = getBossDisplayName(fight.boss, fight.name);
  return withDifficulty
    ? i18n._({
        id: 'common.getBossName',
        message: '{0} {1}',
        values: {
          0: getLabel(fight.difficulty, fight.hardModeLevel),
          1: displayName,
        },
      })
    : displayName;
}
