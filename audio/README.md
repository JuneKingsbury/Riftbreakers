# Audio

Music and sound effects play through `js/audio/sound.js`, which follows Rifthold's sound
system. Every file is listed by name in `js/audio/sound-manifest.js`. Which name plays at
which moment is decided in `js/audio/game-sounds.js`.

- **Volume:** the Music and SFX sliders in Settings (0 to 100) control the two volume buses.
  A change is heard at once, and the values are saved. The music files are mastered much louder
  than the effects, so music is turned down by `MUSIC_TRIM_DB` in `js/audio/sound.js` (−10 dB)
  to keep the two balanced at equal slider values.
- **Starting audio:** browsers only allow sound after the player interacts with the page, so
  audio starts on the first click or key press.
- **Missing files** are skipped quietly. You can list a name in the manifest before its file
  exists.

## Music

Every track loops, and changing track crossfades over 2 seconds.

| When | Track |
|------|-------|
| Title screen | `music/menu_theme.ogg` |
| A whole act | `music/expedition_<realm>.ogg` for the act's realm, e.g. `expedition_crystal_caves.ogg`. It plays on the map and keeps going through deploying and every battle, so it never restarts mid-act. |
| A boss fight | `music/battle_boss.ogg` once it's listed as `battle_boss` in the manifest (not made yet). Until then the act's track plays on. |
| A battle outside a run (test harnesses) | `music/combat.ogg` |
| A won run | `music/credits.ogg` |
| A lost run | Fades to silence |

If a realm's track is missing, the game falls back to `music/expedition.ogg`, which is optional
and isn't shipped. In battle it falls back further, to `music/combat.ogg`.

## Sound effects

Every effect file is normalized to −28 LUFS, measured as the loudest 400 ms (momentary)
loudness with the clip padded by silence, since most effects are too short for integrated LUFS.
The `gain` in the manifest is therefore purely a mix choice. When adding or replacing a file,
normalize it to −28 LUFS first, keeping its true peak below 0 dBTP.

Each play shifts the pitch randomly, by up to the sound's `pitch` setting in cents (300 by
default, as in Rifthold, so up to 3 semitones either way). This keeps sounds heard over and
over from repeating exactly. The same sound can't restart within 200 ms, and at most 8 play at
once, so busy fights stay clear.

| Name | File | When |
|------|------|------|
| `hit_party` | `sfx/combat/colonist_damaged.ogg` | A party member takes damage |
| `hit_enemy` | `sfx/work/chop_hit.ogg` | An enemy takes damage |
| `hit_crit` | `sfx/combat/critical_hit.ogg` | A critical hit, on either side |
| `miss` | `sfx/combat/shield_block.ogg` | An attack misses |
| `party_down` | `sfx/combat/colonist_death.ogg` | A party member is knocked out |
| `enemy_down` | `sfx/combat/enemy_death.ogg` | An enemy is knocked out |
| `arrow_fire` | `sfx/combat/arrow_fire.ogg` | A ranged shot |
| `spell_cast` | `sfx/spells/spell_cast.ogg` | A spell is cast |
| `spell_heal` | `sfx/spells/spell_heal.ogg` | A heal lands |
| `spell_revive` | `sfx/spells/magic_levelup.ogg` | A knocked-out ally is revived |
| `spell_buff` | `sfx/spells/spell_buff.ogg` | A stat buff (Rallying Beat), haste, regen |
| `spell_shield` | `sfx/spells/spell_shield.ogg` | Protect, Shell, Reflect |
| `spell_affliction` | `sfx/ui/mental_break.ogg` | Stun, sleep, charm, berserk, frog or doom lands |
| `summon` | `sfx/spells/summon_arrival.ogg` | A summoned creature appears |
| `terraform` | `sfx/spells/spell_terraform.ogg` | A terrain spell (Stone Wall, Root Field), and the ground heaving under an earth spell (Tremor, Landslide) |
| `thunder` | `sfx/environment/thunder_crack.ogg` | A thunder spell crackling across its area |
| `battle_alert` | `sfx/ui/wave_alert.ogg` | An elite or boss fight begins |
| `level_up` | `sfx/spells/magic_levelup.ogg` | Someone leveled up (reward screen) |
| `skill_learned` | `sfx/spells/magic_levelup.ogg` | A skill is learned or upgraded |
| `promote` | `sfx/spells/spell_divination.ogg` | A member promotes |
| `loot` | `sfx/combat/loot_drop.ogg` | Item, relic, treasure, buying and selling, a won battle |
| `equip` | `sfx/work/craft_complete.ogg` | Equipment changes |
| `rest` | `sfx/spells/spell_heal.ogg` | Train at a rest site |
| `enchant` | `sfx/work/enchant_complete.ogg` | Enchant an item at a rest site |
| `battle_won` / `battle_lost` | not made yet | A sting the moment a battle ends. Add the files and their manifest lines to hear them. |
| `travel` | `sfx/environment/footstep.ogg` | Moving to a node |
| `rift_travel` | `sfx/spells/spell_teleport.ogg` | Stepping through the portal into a new run or act (the file is currently a copy of `magic_levelup`; a whoosh would suit it better) |
| `event` | `sfx/ui/notification.ogg` | An event choice resolves, or a recruit joins |
| `click` | `sfx/ui/button_click.ogg` | Any button |
| `panel` | `sfx/ui/open_close_click.ogg` | A panel opens or closes |
| `notify` | `sfx/ui/notification.ogg` | A notice pops up |

Several files came from Rifthold as copies of each other. For example `chop_hit` and
`mine_hit` are the same file, and so are `magic_levelup` and `spell_teleport`. Replacing one
of them with a new recording only changes the names that point at it.
