import Icon from 'interface/Icon';
import type { CSSProperties } from 'react';
import { memo } from 'react';

import { getSpellFact, npcPortraitUrl } from '../../dungeon/data/spellReference';

/**
 * 怪物技能图标。spellId 有对应快照事实时渲染正式图标,否则渲染 ID 占位,
 * 保证 dungeon 模块不依赖运行时接口、也不需要 WCL。
 */
export const DungeonSpellIcon = memo(
  ({ spellId, className }: { spellId: number | undefined; className?: string }) => {
    if (spellId === undefined) return null;
    const fact = getSpellFact(spellId);
    if (!fact) {
      return <span className="dungeon-spell-id">#{spellId}</span>;
    }
    return (
      <Icon
        alt={fact.name}
        className={className}
        icon={fact.icon}
        title={`${fact.name} (${spellId})`}
      />
    );
  },
);

/** NPC 头像。与地图瓦片同源自建 OSS，换源时只改 DUNGEON_REFERENCE_ASSET_ORIGIN。 */
export const NpcPortrait = memo(
  ({
    npcId,
    name,
    size = 36,
    className,
    style,
  }: {
    npcId: number | undefined;
    name?: string;
    size?: number;
    className?: string;
    style?: CSSProperties;
  }) => {
    if (npcId === undefined) return null;
    return (
      <img
        alt={name ?? `NPC ${npcId}`}
        className={`dungeon-npc-portrait ${className ?? ''}`.trim()}
        height={size}
        src={npcPortraitUrl(npcId)}
        style={style}
        title={name ?? `NPC ${npcId}`}
        width={size}
      />
    );
  },
);