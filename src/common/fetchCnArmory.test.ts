import { afterEach, describe, expect, test, vi } from 'vitest';

import fetchCnCharacterProfile, {
  buildCharacterProfile,
  cnRealmSlug,
  encrypto,
  fetchCharacterSummary,
} from './fetchCnArmory';

const GOOD_INDEX = {
  code: 0,
  message: 'ok',
  data: {
    character_summary: {
      name: '雍和',
      gender: { type: 'FEMALE', name: '女' },
      faction: { type: 'HORDE', name: '部落' },
      race: { name: '血精灵' },
      character_class: { id: 9, name: '术士' },
      active_spec: { name: '毁灭' },
      realm: { id: 741, name: '死亡之翼', slug: 'deathwing' },
      level: 80,
      achievement_points: 26100,
      average_item_level: 97,
      equipped_item_level: 97,
    },
    character_media: {
      assets: [{ key: 'avatar', value: 'https://img.cn.example/avatar.jpg' }],
    },
    token: 'abc123',
  },
};

const armoryResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('encrypto (wcl-mp 同款签名)', () => {
  test('produces a signed string, deterministic for same input', () => {
    expect(typeof encrypto('1234567890')).toBe('string');
    expect(encrypto('abc', 471)).toBe(encrypto('abc', 471));
  });
});

describe('cnRealmSlug', () => {
  test('maps a known CN realm to its romanized slug', () => {
    expect(cnRealmSlug('死亡之翼')).toBe('deathwing');
    expect(cnRealmSlug('世界之树')).toBe('world-tree');
  });
  test('falls back to input for unknown realm', () => {
    expect(cnRealmSlug('不存在的服')).toBe('不存在的服');
  });
});

describe('fetchCharacterSummary', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('returns data on code=0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(armoryResponse(GOOD_INDEX)));
    const data = await fetchCharacterSummary({ realm: '死亡之翼', name: '雍和' });
    expect(data?.character_summary?.name).toBe('雍和');
    expect(data?.token).toBe('abc123');
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/cn-armory/wow-armory-server/api/index'); // 同源代理路径
    expect(url).toContain('realm_slug');
    expect(url).toContain('role_name');
  });

  test('returns null when gateway responds code!=0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(armoryResponse({ code: 30004, message: '查询失败' })),
    );
    const data = await fetchCharacterSummary({ realm: '死亡之翼', name: '不存在' });
    expect(data).toBeNull();
  });

  test('returns null on network error / non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    expect(await fetchCharacterSummary({ realm: '死亡之翼', name: 'x' })).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(armoryResponse({}, 500)));
    expect(await fetchCharacterSummary({ realm: '死亡之翼', name: 'x' })).toBeNull();
  });
});

describe('buildCharacterProfile', () => {
  test('maps CN armory summary+media to CharacterProfile', () => {
    const profile = buildCharacterProfile(110619060, GOOD_INDEX.data);
    expect(profile).toMatchObject({
      id: 110619060, // 统一用传入 guid 作为 id / redux key
      region: 'CN',
      realm: '死亡之翼',
      name: '雍和',
      faction: 0, // HORDE → 0 (1=Alliance)
      class: 9,
      gender: 0, // FEMALE → 0
      race: 10, // 血精灵
      achievementPoints: 26100,
      thumbnail: 'https://img.cn.example/avatar.jpg',
      spec: '毁灭',
    });
    expect(profile.blizzardUpdatedAt).toBeTruthy();
    expect(profile.createdAt).toBeTruthy();
  });

  test('falls back gracefully on empty summary', () => {
    const profile = buildCharacterProfile(1, null);
    expect(profile.id).toBe(1);
    expect(profile.realm).toBe('Unknown');
    expect(profile.name).toBe('Unknown');
    expect(profile.role).toBe('');
  });
});

describe('fetchCharacterSummaryDeduped', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // 清理模块级缓存,避免测试间污染
    vi.resetModules();
  });

  test('并发相同 服+角色 只发一次网关请求', async () => {
    const fetchMock = vi.fn().mockResolvedValue(armoryResponse(GOOD_INDEX));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([
      fetchCnCharacterProfile({ guid: 1, realm: '死亡之翼', name: '雍和' }),
      fetchCnCharacterProfile({ guid: 2, realm: '死亡之翼', name: '雍和' }),
      fetchCnCharacterProfile({ guid: 3, realm: '死亡之翼', name: '雍和' }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('fetchCnCharacterProfile (default export)', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('happy path returns assembled profile with guid as id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(armoryResponse(GOOD_INDEX)));
    const profile = await fetchCnCharacterProfile({ guid: 9, realm: '死亡之翼', name: '雍和' });
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(9);
    expect(profile!.region).toBe('CN');
  });

  test('gateway miss → null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(armoryResponse({ code: 30004, message: '失败' })),
    );
    expect(await fetchCnCharacterProfile({ guid: 9, realm: '死亡之翼', name: 'x' })).toBeNull();
  });
});
