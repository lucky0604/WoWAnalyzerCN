import { captureException } from '@sentry/react';
import makeApiUrl from 'common/makeApiUrl';
import SPELLS from 'common/SPELLS';
import { useEffect } from 'react';
import useSWR from 'swr';
import Spell from 'common/SPELLS/Spell';
import { useExpansionContext } from 'interface/report/ExpansionContext';
import { getSpellId } from 'common/getSpellId';
import { maybeGetTalentOrSpell } from 'common/maybeGetTalentOrSpell';
import { i18n } from '@lingui/core';
import { getSpellCnName, getSpellCnNameByEnglish } from 'common/CN_MAPPING';

const fetcher = (...args: Parameters<typeof fetch>) => fetch(...args).then((res) => res.json());

const useSpellInfo = (spell: number | Spell | undefined) => {
  const { expansion } = useExpansionContext();
  const spellId = spell ? getSpellId(spell) : null;
  const argumentAsSpell =
    typeof spell === 'number' ? maybeGetTalentOrSpell(spell, expansion) : spell;

  // CN fork: `/i/spell/{id}` 依赖 wowanalyzer.com 后端，禁用社交/上游功能时不发请求，
  // 回退到本地 SPELLS 表与 WCL translate 数据。
  const spellInfoDisabled = import.meta.env.VITE_DISABLE_SOCIAL_FEATURES === 'true';
  const { data, error } = useSWR<Spell>(
    spellId && !spellInfoDisabled ? makeApiUrl(`spell/${spellId}`) : null,
    {
      fetcher,
      isPaused: () => argumentAsSpell !== undefined,
    },
  );

  useEffect(() => {
    // Only cache SWR API data when the spell isn't already in the table.
    // SpellInfo populates Chinese names from WCL translate=true during parsing;
    // an unconditional write here would overwrite those with English API data.
    if (spellId && data && !argumentAsSpell) {
      SPELLS[spellId] = data;
    }
  }, [data, spellId, argumentAsSpell]);

  if (error) {
    captureException(error);
    console.error(error);
    return argumentAsSpell;
  }

  const result = argumentAsSpell ?? data;
  if (result && i18n.locale === 'zh') {
    // 查询 CN_MAPPING/spellNames.ts 的中文映射
    // 优先使用 spell ID 精确匹配，失败时回退到英文名模糊匹配
    const cnName = (spellId && getSpellCnName(spellId)) ?? getSpellCnNameByEnglish(result.name);
    if (cnName) {
      return { ...result, name: cnName };
    }
  }

  return result;
};

export default useSpellInfo;
