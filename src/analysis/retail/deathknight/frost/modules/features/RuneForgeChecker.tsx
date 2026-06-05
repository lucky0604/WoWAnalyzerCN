import { Trans } from '@lingui/react/macro';
import { RuneForgeChecker } from 'analysis/retail/deathknight/shared';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Options } from 'parser/core/Analyzer';
import SUGGESTION_IMPORTANCE from 'parser/core/ISSUE_IMPORTANCE';

class FrostRuneForgeChecker extends RuneForgeChecker {
  constructor(options: Options) {
    super(options);

    this.runeForges = [
      {
        forge: SPELLS.RUNE_OF_SANGUINATION,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <Trans id="deathknight.frost.runeForgeChecker.sanguination">
            Don't use <SpellLink spell={SPELLS.RUNE_OF_SANGUINATION} /> as Frost Death Knight, use{' '}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} /> and/or{' '}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} /> instead.
          </Trans>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_APOCALYPSE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <Trans id="deathknight.frost.runeForgeChecker.apocalypse">
            Don't use <SpellLink spell={SPELLS.RUNE_OF_APOCALYPSE} /> as Frost Death Knight, use{' '}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} /> and/or{' '}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} /> instead.
          </Trans>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_UNENDING_THIRST,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <Trans id="deathknight.frost.runeForgeChecker.unendingThirst">
            Don't use <SpellLink spell={SPELLS.RUNE_OF_UNENDING_THIRST} /> as Frost Death Knight,
            use <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} /> and/or{' '}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} /> instead.
          </Trans>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_SPELLWARDING,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <Trans id="deathknight.frost.runeForgeChecker.spellwarding">
            Don't use <SpellLink spell={SPELLS.RUNE_OF_SPELLWARDING} /> as Frost Death Knight, use{' '}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} /> and/or{' '}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} /> instead.
          </Trans>
        ),
      },
    ];
  }
}

export default FrostRuneForgeChecker;
