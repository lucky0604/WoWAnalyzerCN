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

const fetcher = (...args: Parameters<typeof fetch>) => fetch(...args).then((res) => res.json());

const useSpellInfo = (spell: number | Spell | undefined) => {
  const { expansion } = useExpansionContext();
  const spellId = spell ? getSpellId(spell) : null;
  const argumentAsSpell =
    typeof spell === 'number' ? maybeGetTalentOrSpell(spell, expansion) : spell;

  const { data, error } = useSWR<Spell>(spellId ? makeApiUrl(`spell/${spellId}`) : null, {
    fetcher,
    isPaused: () => argumentAsSpell !== undefined,
  });

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
    if (result.name === 'Melee') {
      return { ...result, name: '普通攻击' };
    }
  }

  return result;
};

export default useSpellInfo;
