/**
 * RLP 技能参考层(外部游戏数据快照,只读)。
 *
 * 技能名/图标与每个 NPC 的完整技能清单来自 threechest 的 grimorie-wow 与
 * rlp_mdt 快照(agent_flow/threechest)。它不属于攻略审校合同:中文处理策略
 * 仍在 AbilityKnowledge,这里只负责把 Spell ID 变成可查看的图标与名字。
 * 头像资源先热链 threechest(生产/后续迁移到自有 OSS 时只改 DUNGEON_REFERENCE_ASSET_ORIGIN)。
 */

export interface SpellFact {
  /** 官方英文技能名(grimoire 快照) */
  name: string;
  /** 暴雪图标名,例 spell_frost_iceshard;直接喂给 interface/Icon 的 iconUrl */
  icon: string;
}

/**
 * 参考资源的来源起点。当前为 threechest;后期切换到自建 OSS 时只改这一处。
 */
export const DUNGEON_REFERENCE_ASSET_ORIGIN = 'https://threechest.io';

/** Spell ID -> 技能事实(来自 grimorie-wow 12.1.0 快照) */
export const RLP_SPELL_FACTS: Record<number, SpellFact> = {
  181089: { name: "Encounter Event", icon: "inv_misc_questionmark" },
  371471: { name: "Shape Earth", icon: "ability_earthen_pillar" },
  371489: { name: "Numbing Cold", icon: "spell_frost_arcticwinds" },
  371984: { name: "Frostbolt", icon: "spell_frost_frostbolt02" },
  372047: { name: "Steel Barrage", icon: "inv_axe_1h_deathwingraiddw_d_01" },
  372087: { name: "Blazing Rush", icon: "spell_deathknight_butcher2" },
  372107: { name: "Molten Boulder", icon: "spell_mage_flameorb" },
  372730: { name: "Crushing Smash", icon: "spell_shaman_earthquake" },
  372743: { name: "Ice Shield", icon: "ability_mage_coldasice" },
  372749: { name: "Ice Shield", icon: "ability_mage_coldasice" },
  372793: { name: "Excavate", icon: "ability_gift_of_earth" },
  372794: { name: "Steel Barrage", icon: "inv_axe_1h_deathwingraiddw_d_01" },
  372808: { name: "Frigid Shard", icon: "spell_frost_iceshard" },
  372811: { name: "Molten Boulder", icon: "spell_mage_flameorb" },
  372819: { name: "Molten Boulder", icon: "spell_mage_flameorb" },
  372820: { name: "Scorched Earth", icon: "spell_shaman_stormearthfire" },
  372851: { name: "Chillstorm", icon: "spell_shadow_soulleech_2" },
  372858: { name: "Searing Blows", icon: "ability_shaman_lavalash" },
  372859: { name: "Searing Blows", icon: "ability_shaman_lavalash" },
  372860: { name: "Searing Wounds", icon: "spell_fire_moltenblood" },
  372863: { name: "Ritual of Blazebinding", icon: "spell_fire_totemofwrath" },
  372988: { name: "Ice Bulwark", icon: "ability_mage_coldasice" },
  373017: { name: "Blaze Volley", icon: "spell_fire_flamebolt" },
  373046: { name: "Awaken Whelps", icon: "inv_dragonwhelp3_gemmed_red" },
  373087: { name: "Burnout", icon: "spell_fire_selfdestruct" },
  373614: { name: "Burnout", icon: "spell_fire_selfdestruct" },
  373680: { name: "Frost Overload", icon: "spell_fire_blueflamering" },
  373688: { name: "Frost Overload", icon: "spell_fire_blueflamering" },
  373692: { name: "Inferno", icon: "ability_warlock_inferno" },
  373693: { name: "Living Bomb", icon: "inv_summerfest_firespirit" },
  373727: { name: "Frost Infusion", icon: "spell_frost_manarecharge" },
  373972: { name: "Blaze of Glory", icon: "inv_ember" },
  373973: { name: "Blaze of Glory", icon: "inv_ember" },
  373977: { name: "Blaze of Glory", icon: "inv_ember" },
  381512: { name: "Stormslam", icon: "ability_shaman_stormstrike" },
  381513: { name: "Stormslam", icon: "ability_shaman_stormstrike" },
  381514: { name: "Stormslam", icon: "ability_shaman_stormstrike" },
  381515: { name: "Stormslam", icon: "ability_shaman_stormstrike" },
  381516: { name: "Interrupting Cloudburst", icon: "spell_nature_cyclone" },
  381517: { name: "Winds of Change", icon: "spell_nature_purge" },
  381518: { name: "Winds of Change", icon: "spell_nature_purge" },
  381525: { name: "Roaring Firebreath", icon: "ability_warlock_inferno" },
  381526: { name: "Roaring Firebreath", icon: "ability_warlock_inferno" },
  381602: { name: "Inferno Spit", icon: "spell_fire_firebolt" },
  381605: { name: "Inferno Spit", icon: "spell_fire_firebolt" },
  381862: { name: "Inferno Spit", icon: "spell_fire_firebolt" },
  381864: { name: "Inferno Spit", icon: "spell_fire_firebolt" },
  383925: { name: "Chillstorm", icon: "spell_shadow_soulleech_2" },
  384024: { name: "Hailbombs", icon: "inv_10_specialreagentfoozles_primalistrune_frost" },
  384139: { name: "Summon Scorchlings", icon: "spell_fire_elemental_totem" },
  384194: { name: "Cinderbolt", icon: "spell_fire_firebolt" },
  384773: { name: "Flaming Embers", icon: "spell_fire_felflamering_red" },
  384823: { name: "Inferno", icon: "ability_warlock_inferno" },
  384933: { name: "Ice Shield", icon: "ability_mage_coldasice" },
  385310: { name: "Storm Bolt", icon: "spell_lightning_lightningbolt01" },
  385311: { name: "Thunderstorm", icon: "spell_shaman_thunderstorm" },
  385312: { name: "Gathering Storm", icon: "spell_shaman_thunderstorm" },
  385313: { name: "Lightning Rod", icon: "spell_nature_unrelentingstorm" },
  385314: { name: "Lightning Rod", icon: "spell_nature_unrelentingstorm" },
  385316: { name: "Lightning Rod", icon: "spell_nature_unrelentingstorm" },
  385536: { name: "Flaming Barrage", icon: "ability_warlock_burningembers" },
  385567: { name: "Flaming Barrage", icon: "ability_warlock_burningembers" },
  391031: { name: "Stormcloud Barrier", icon: "spell_mage_temporalshield" },
  391723: { name: "Flame Breath", icon: "ability_mage_firestarter" },
  391726: { name: "Storm Breath", icon: "inv_misc_stormlordsfavor" },
  391727: { name: "Storm Breath", icon: "inv_misc_stormlordsfavor" },
  392394: { name: "Fire Maw", icon: "ability_warrior_dragonroar" },
  392395: { name: "Thunder Jaw", icon: "inv_misc_stormdragonpale" },
  392399: { name: "Stormcloud Detonation", icon: "spell_nature_unrelentingstorm" },
  392406: { name: "Thunderous Stomp", icon: "ability_thunderclap" },
  392569: { name: "Molten Blood", icon: "spell_nzinsanity_floorislava" },
  392570: { name: "Molten Blood", icon: "spell_nzinsanity_floorislava" },
  392576: { name: "Thunder Blast", icon: "inv_misc_stormlordsfavor" },
  392640: { name: "Rolling Thunder", icon: "spell_nature_lightningoverload" },
  392641: { name: "Rolling Thunder", icon: "spell_nature_lightningoverload" },
  395292: { name: "Fire Maw", icon: "ability_warrior_dragonroar" },
  395303: { name: "Thunder Jaw", icon: "inv_misc_stormdragonpale" },
  396044: { name: "Hailburst", icon: "spell_frost_frostshock" },
  397077: { name: "Chillstorm", icon: "spell_shadow_soulleech_2" },
  1305201: { name: "Excavating Blast", icon: "spell_nature_earthquake" },
  1305213: { name: "Crushing Smash", icon: "spell_shaman_earthquake" },
  1305225: { name: "Tectonic Strike", icon: "inv_axe_2h_earthendungeon_c_01" },
  1305234: { name: "Cold Claws", icon: "ability_mage_wintersgrasp" },
  1305865: { name: "Flaming Barrage", icon: "ability_warlock_burningembers" },
  1305955: { name: "Fiery Blast", icon: "ability_mage_greaterpyroblast" },
  1306272: { name: "Molten Boulder", icon: "spell_mage_flameorb" },
  1306366: { name: "Lightning Torrent", icon: "spell_shaman_thunderstorm" },
  1307205: { name: "Earthbound's Imprint", icon: "inv_ore_blackrock_ore" },
  1307372: { name: "Fiery Demise", icon: "spell_shaman_lavasurge" },
  1307488: { name: "Lightning Torrent", icon: "spell_shaman_thunderstorm" },
  1307502: { name: "Summon Primal Thunderclouds", icon: "ability_vehicle_electrocharge" },
  1307511: { name: "Summon Primal Thunderclouds", icon: "ability_vehicle_electrocharge" },
  1309540: { name: "Ritual of Blazebinding", icon: "spell_fire_totemofwrath" },
  1309705: { name: "Steel Barrage", icon: "inv_axe_1h_deathwingraiddw_d_01" },
  1310355: { name: "Tempest Stormshield", icon: "inv_10_worlddroplevelingoptionalreagent_misc_orb_air" },
  1310361: { name: "Tempest Stormshield", icon: "inv_10_worlddroplevelingoptionalreagent_misc_orb_air" },
  1310363: { name: "Tempest Stormshield", icon: "inv_10_worlddroplevelingoptionalreagent_misc_orb_air" },
  1310489: { name: "Blast Chunks", icon: "inv_10_elementalcombinedfoozles_earth" },
  1310599: { name: "Electrical Discharge", icon: "inv_misc_stormlordsfavor" },
  1312669: { name: "Flaming Embers", icon: "spell_fire_felflamering_red" },
  1312684: { name: "Roaring Firebreath", icon: "ability_warlock_inferno" },
};

/** NPC ID -> 完整技能清单(来自 threechest rlp_mdt,保持 MDT 顺序并去重) */
export const RLP_ENEMY_SPELL_IDS: Record<number, number[]> = {
  187894: [1305234],
  187897: [372047, 372087, 372794, 1309705],
  187969: [371471, 1305225],
  188011: [384933, 1307205],
  188067: [371489, 371984, 372743, 372749, 384933],
  188244: [372730, 372793, 1305201, 1305213, 1310489],
  188252: [372808, 372851, 372988, 373046, 373680, 373688, 373727, 383925, 384024, 396044, 397077],
  189232: [372107, 372811, 372819, 372820, 372858, 372859, 372860, 372863, 1306272, 1309540],
  189886: [373017, 373087, 384823],
  189893: [1305234],
  190034: [373614, 373692, 384139, 1305955],
  190205: [1307372],
  190206: [373972, 373973, 373977, 385536, 385567, 1305865],
  190207: [373693, 384194],
  190484: [381525, 381526, 381602, 381605, 381862, 381864, 384773, 1312669, 1312684],
  190485: [181089, 381512, 381513, 381514, 381515, 381516, 381517, 381518],
  194622: [1307372],
  195119: [385310, 385311, 385312, 385313, 385314, 385316],
  197509: [391031, 392399],
  197535: [1306366, 1307488, 1307511, 1310355, 1310361, 1310363],
  197697: [391723, 392394, 392569, 392570, 395292],
  197698: [391726, 391727, 392395, 392640, 392641, 395303, 1310599],
  197982: [392406],
  198047: [392576, 1306366, 1307488, 1307502],
};

/** NPC 头像地址(热链 threechest,切换 OSS 时改 DUNGEON_REFERENCE_ASSET_ORIGIN)。 */
export function npcPortraitUrl(npcId: number): string {
  return `${DUNGEON_REFERENCE_ASSET_ORIGIN}/npc_portraits/${npcId}.png`;
}

/** 返回某个 NPC 的完整技能 ID 清单;npcId 缺失或未收录时返回空数组。 */
export function getEnemySpellIds(npcId: number | undefined): number[] {
  if (npcId === undefined) return [];
  return RLP_ENEMY_SPELL_IDS[npcId] ?? [];
}
