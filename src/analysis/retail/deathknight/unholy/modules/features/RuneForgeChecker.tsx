import { RuneForgeChecker } from 'analysis/retail/deathknight/shared';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { Options } from 'parser/core/Analyzer';
import SUGGESTION_IMPORTANCE from 'parser/core/ISSUE_IMPORTANCE';
import { t } from '@lingui/core/macro';

class UnholyRuneForgeChecker extends RuneForgeChecker {
  constructor(options: Options) {
    super(options);

    // Hysteria & FC need no suggestions for blood
    this.runeForges = [
      {
        forge: SPELLS.RUNE_OF_THE_STONESKIN_GARGOYLE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            <SpellLink spell={SPELLS.RUNE_OF_THE_STONESKIN_GARGOYLE} />
            {t({
              id: 'deathknight.unholy.runeForge.stoneskinGargoyle',
              message: ' is a survivability runeforge at the cost of damage and healing. Use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.unholy.runeForge.stoneskinGargoyle.end',
              message: ' instead',
            })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_RAZORICE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.unholy.runeForge.razorice',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.unholy.runeForge.razorice.use',
              message: ' as Unholy Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({ id: 'deathknight.unholy.runeForge.razorice.instead', message: ' instead.' })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_SANGUINATION,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.unholy.runeForge.sanguination',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SANGUINATION} />
            {t({
              id: 'deathknight.unholy.runeForge.sanguination.use',
              message: ' as Unholy Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({ id: 'deathknight.unholy.runeForge.sanguination.instead', message: ' instead.' })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_APOCALYPSE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.unholy.runeForge.apocalypse',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_APOCALYPSE} />
            {t({
              id: 'deathknight.unholy.runeForge.apocalypse.use',
              message: ' as Unholy Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({ id: 'deathknight.unholy.runeForge.apocalypse.instead', message: ' instead.' })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_UNENDING_THIRST,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.unholy.runeForge.unendingThirst',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_UNENDING_THIRST} />
            {t({
              id: 'deathknight.unholy.runeForge.unendingThirst.use',
              message: ' as Unholy Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({ id: 'deathknight.unholy.runeForge.unendingThirst.instead', message: ' instead.' })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_SPELLWARDING,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.unholy.runeForge.spellwarding',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SPELLWARDING} />
            {t({
              id: 'deathknight.unholy.runeForge.spellwarding.use',
              message: ' as Unholy Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({ id: 'deathknight.unholy.runeForge.spellwarding.instead', message: ' instead.' })}
          </>
        ),
      },
    ];
  }
}

export default UnholyRuneForgeChecker;
