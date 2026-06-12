import { RuneForgeChecker } from 'analysis/retail/deathknight/shared';
import SPELLS from 'common/SPELLS';
import { isMythicPlus } from 'common/isMythicPlus';
import SpellLink from 'interface/SpellLink';
import { Options } from 'parser/core/Analyzer';
import SUGGESTION_IMPORTANCE from 'parser/core/ISSUE_IMPORTANCE';
import { t } from '@lingui/core/macro';

class BloodRuneForgeChecker extends RuneForgeChecker {
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
              id: 'deathknight.blood.runeforgeSuggestion.stoneskinGargoyle',
              message:
                ' is a survivability runeforge at the cost of damage and healing. Use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.stoneskinGargoyle.end',
              message:
                ' as there is no need for SSGs EHP increase right now.',
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
              id: 'deathknight.blood.runeforgeSuggestion.razorice',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_RAZORICE} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.razorice.use',
              message: ' as Blood Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.razorice.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
      {
        forge: SPELLS.RUNE_OF_SANGUINATION,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: isMythicPlus(options.owner.fight) ? (
          <>
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.sanguination',
              message: 'Only use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SANGUINATION} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.sanguination.use',
              message: ' as Blood Death Knight in raids, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.sanguination.instead',
              message: ' instead.',
            })}
          </>
        ) : undefined,
      },
      {
        forge: SPELLS.RUNE_OF_APOCALYPSE,
        importance: SUGGESTION_IMPORTANCE.MAJOR,
        suggestion: (
          <>
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.apocalypse',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_APOCALYPSE} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.apocalypse.use',
              message: ' as Blood Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.apocalypse.instead',
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
              id: 'deathknight.blood.runeforgeSuggestion.unendingThirst',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_UNENDING_THIRST} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.unendingThirst.use',
              message: ' as Blood Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.unendingThirst.instead',
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
              id: 'deathknight.blood.runeforgeSuggestion.spellwarding',
              message: "Don't use ",
            })}
            <SpellLink spell={SPELLS.RUNE_OF_SPELLWARDING} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.spellwarding.use',
              message: ' as Blood Death Knight, use ',
            })}
            <SpellLink spell={SPELLS.RUNE_OF_THE_FALLEN_CRUSADER} />
            {t({
              id: 'deathknight.blood.runeforgeSuggestion.spellwarding.instead',
              message: ' instead.',
            })}
          </>
        ),
      },
    ];
  }
}

export default BloodRuneForgeChecker;
