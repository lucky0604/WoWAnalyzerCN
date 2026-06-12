import { RuneForgeChecker } from 'analysis/retail/deathknight/shared';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Options } from 'parser/core/Analyzer';
import SUGGESTION_IMPORTANCE from 'parser/core/ISSUE_IMPORTANCE';
import { t } from '@lingui/core/macro';

class FrostRuneForgeChecker extends RuneForgeChecker {
  constructor(options: Options) {
    super(options);

    this.runeForges = [
      {
        forge: SPELLS.RUNE_OF_SANGUINATION,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.frost.runeForgeChecker.sanguination',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SANGUINATION} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.sanguination.use',
              message: ' as Frost Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.sanguination.andOr',
              message: ' and/or ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.sanguination.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_APOCALYPSE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.frost.runeForgeChecker.apocalypse',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_APOCALYPSE} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.apocalypse.use',
              message: ' as Frost Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.apocalypse.andOr',
              message: ' and/or ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.apocalypse.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_UNENDING_THIRST,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.frost.runeForgeChecker.unendingThirst',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_UNENDING_THIRST} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.unendingThirst.use',
              message: ' as Frost Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.unendingThirst.andOr',
              message: ' and/or ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.unendingThirst.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_SPELLWARDING,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.frost.runeForgeChecker.spellwarding',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SPELLWARDING} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.spellwarding.use',
              message: ' as Frost Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.spellwarding.andOr',
              message: ' and/or ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.frost.runeForgeChecker.spellwarding.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
    ];
  }
}

export default FrostRuneForgeChecker;
