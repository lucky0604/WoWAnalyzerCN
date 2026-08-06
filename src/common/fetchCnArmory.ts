import { REALMS } from 'game/REALMS';
import CN_SERVER_SLUG from 'common/CN_SERVER_SLUG';
import CharacterProfile from 'parser/core/CharacterProfile';

/**
 * CN armory 网关客户端。
 *
 * 数据源:wcl-mp-client(微信小程序)同款的 CN 英雄榜网关:
 *   `https://webapi.rpglogs.cn/wow-armory-server/api`
 *
 * 注意:该网关 CORS 不允许自定义 `auth` 头,浏览器跨域直连会被 preflight 拦截。
 * 因此这里走**同源相对路径** `/cn-armory/...`,由 dev 的 Vite proxy(或生产的 nginx)
 * 转发到 webapi.rpglogs.cn。`auth` 头在同源请求下无 preflight。
 *
 * 流程:
 *   1. `GET /index?realm_slug=<CN 服>&role_name=<角色名>` 拿 `token` + `character_summary` + `character_media`
 *   2. (可选)`GET /do?token=...&api=specializations` 补全当前专精等
 *
 * 该网关仅用于国服(CN)角色;非 CN 角色仍走上游 wowanalyzer.com `/i/character/{id}`。
 */

const CN_ARMORY_BASE = import.meta.env.VITE_CN_ARMORY_BASE || '/cn-armory/wow-armory-server/api';

/**
 * wcl-mp 同款签名:xor + 变进制,网关用 auth 头校验时效。
 * 复制自 wcl-mp-client `src/utils/common.ts` 的 `encrypto`。
 */
export function encrypto(str: string, xor = 471, hex = 25): string | undefined {
  if (typeof str !== 'string' || typeof xor !== 'number' || typeof hex !== 'number') {
    return undefined;
  }
  const radix = hex <= 25 ? hex : hex % 25;
  const parts: string[] = [];
  for (let i = 0; i < str.length; i += 1) {
    const charCode = (str.charCodeAt(i) ^ xor).toString(radix);
    parts.push(charCode);
  }
  const split = String.fromCharCode(radix + 97);
  return parts.join(split);
}

function makeAuthHeader(): string | undefined {
  return encrypto(Date.now().toString(), 471);
}

/**
 * CN 服务器 slug:网关用英文罗马化 slug(如 死亡之翼 → deathwing)。
 * 优先用 wcl-mp 的 CN slug 表,兜底 REALMS 表,最后原样返回。
 */
export function cnRealmSlug(realm: string): string {
  return CN_SERVER_SLUG[realm] ?? REALMS.CN.find((r) => r.name === realm)?.slug ?? realm;
}

/* ---------------------------------- 类型 ---------------------------------- */

interface CharacterSummary {
  name?: string;
  gender?: { type?: string; name?: string };
  faction?: { type?: string; name?: string };
  race?: { name?: string };
  character_class?: { id?: number; name?: string };
  active_spec?: { name?: string };
  realm?: { id?: number; name?: string; slug?: string };
  guild?: {
    name?: string;
    realm?: { name?: string; slug?: string };
    faction?: { type?: string; name?: string };
  };
  level?: number;
  achievement_points?: number;
  average_item_level?: number;
  equipped_item_level?: number;
}

interface CharacterMedia {
  assets?: { key?: string; value?: string }[];
}

interface ArmoryIndexData {
  character_summary?: CharacterSummary;
  character_media?: CharacterMedia;
  token?: string;
}

interface ArmoryIndexResponse {
  code: number;
  message?: string;
  data?: ArmoryIndexData | null;
}

/* ------------------------------ 网关请求 ------------------------------ */

export async function fetchCharacterSummary(options: {
  realm: string;
  name: string;
}): Promise<ArmoryIndexData | null> {
  const { realm, name } = options;
  const params = new URLSearchParams({
    realm_slug: cnRealmSlug(realm),
    role_name: name,
  });
  const url = `${CN_ARMORY_BASE}/index?${params.toString()}`;
  try {
    const response = await fetch(url, {
      headers: { auth: makeAuthHeader() ?? '' },
    });
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as ArmoryIndexResponse;
    if (json.code !== 0 || !json.data) {
      return null;
    }
    return json.data;
  } catch (e) {
    // 网络/解析失败 → 静默降级,调用方按“无资料”处理
    console.warn('CN armory fetch failed', e);
    return null;
  }
}

export async function fetchCharacterDetail(
  token: string,
  apiType: string,
  options: Record<string, string> = {},
): Promise<unknown | null> {
  const params = new URLSearchParams({ token, api: apiType });
  Object.entries(options).forEach(([k, v]) => {
    if (v !== undefined) params.append(k, String(v));
  });
  const url = `${CN_ARMORY_BASE}/do?${params.toString()}`;
  try {
    const response = await fetch(url, {
      headers: { auth: makeAuthHeader() ?? '' },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { code: number; data?: unknown };
    return json.code === 0 ? json.data : null;
  } catch (e) {
    console.warn('CN armory detail fetch failed', e);
    return null;
  }
}

/* --------------- 种族中文名 → Blizzard race id --------------- */

/** CN armory `race.name`(中文)→ Blizzard race id(与 src/game/RACES 的 id 一致) */
const CN_RACE_TO_ID: Record<string, number> = {
  人类: 1,
  兽人: 2,
  矮人: 3,
  暗夜精灵: 4,
  亡灵: 5,
  牛头人: 6,
  侏儒: 7,
  巨魔: 8,
  地精: 9,
  血精灵: 10,
  德莱尼: 11,
  狼人: 22,
  熊猫人: 24,
  夜之子: 27,
  至高岭牛头人: 28,
  虚空精灵: 29,
  光铸德莱尼: 30,
  赞达拉巨魔: 31,
  库尔提拉斯人: 32,
  黑铁矮人: 34,
  狐人: 35,
  玛格汉兽人: 36,
  机械侏儒: 37,
  小龙人: 52,
  土灵: 84,
};

function raceIdFromCnName(cnName?: string): number {
  if (!cnName) return 0;
  return CN_RACE_TO_ID[cnName] ?? 0;
}

/* ---------------------- 组装 WoWAnalyzer CharacterProfile ---------------------- */

function toNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function buildCharacterProfile(
  guid: number,
  data: ArmoryIndexData | null | undefined,
): CharacterProfile {
  const cs = data?.character_summary ?? {};
  const avatarAsset = data?.character_media?.assets?.find((a) => a.key === 'avatar');
  const now = new Date().toISOString();

  return {
    id: guid, // Redux charactersById 以 player.guid 为 key,必须一致
    region: 'CN',
    realm: cs.realm?.name ?? 'Unknown',
    name: cs.name ?? 'Unknown',
    faction: cs.faction?.type === 'ALLIANCE' ? 1 : 0, // WCL 约定:1=Alliance,0=Horde;CN 网关给字符串
    class: toNumber(cs.character_class?.id) ?? 0,
    race: raceIdFromCnName(cs.race?.name),
    gender: cs.gender?.type === 'MALE' ? 1 : 0, // 上游为 int,CN 网关给 'MALE'/'FEMALE'
    achievementPoints: toNumber(cs.achievement_points) ?? 0,
    thumbnail: avatarAsset?.value,
    spec: cs.active_spec?.name ?? '',
    role: '',
    talents: '',
    heartOfAzeroth: undefined,
    blizzardUpdatedAt: now,
    createdAt: now,
    lastSeenAt: now,
  };
}

/** 一步入口:查 CN 角色 → CharacterProfile;查询失败/不存在返回 null */
export default async function fetchCnCharacterProfile(options: {
  guid?: number;
  realm: string;
  name: string;
}): Promise<CharacterProfile | null> {
  const data = await fetchCharacterSummaryDeduped({ realm: options.realm, name: options.name });
  if (!data) {
    return null;
  }
  return buildCharacterProfile(options.guid ?? 0, data);
}

/**
 * Promise 去重缓存:同一 服+角色 的并发请求只向网关发一次。
 * CN armory 网关对高频请求有限流(实测连刷会返回 3004),
 * 而报告页会同时为多个玩家发起请求(PlayerTile 列表 + header),需要节流合并。
 * 内存缓存仅存活于请求 in-flight 期间,完成后即清除,不做持久缓存。
 */
const characterSummaryCache = new Map<string, Promise<ArmoryIndexData | null>>();

export function fetchCharacterSummaryDeduped(options: {
  realm: string;
  name: string;
}): Promise<ArmoryIndexData | null> {
  const key = `${options.realm}|${options.name}`;
  const existing = characterSummaryCache.get(key);
  if (existing) {
    return existing;
  }
  const promise = fetchCharacterSummary(options).finally(() => {
    // 无论成败在请求结束后移除,下次重新请求
    characterSummaryCache.delete(key);
  });
  characterSummaryCache.set(key, promise);
  return promise;
}
