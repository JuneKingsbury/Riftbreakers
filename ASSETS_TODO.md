# Art and audio still to make

Everything here already works in the game with a stand-in. Replace a file and it shows up. After adding or renaming any skin PNG, run `npm run skin-manifest`. Skin paths are under `skins/16x16_tiny_world/`.

Counts were taken on 2026-11-23: 295 named enemies drawn from 88 distinct images.

## 1. Bosses that share art with ordinary enemies

The boss is fought at the end of an act (or as a champion elite), so these matter most. Each is its own file already (`entities/enemy_<name>.png`), but byte-identical to the enemies listed after it.

| Boss | File | Currently the same image as |
|---|---|---|
| Bandit King | `enemy_bandit_king.png` | Claim Boss, Echo of a Bandit King, Head Poacher |
| Dire Wolf | `enemy_dire_wolf.png` | Echo of the Dire Wolf |
| Thorn Warden | `enemy_thorn_warden.png` | Mire Beast, Rotting Thorn Beast, Thorn Beast |
| Bog Witch | `enemy_bog_witch.png` | Echo of a Witch, Grove Keeper, Rotting Druid |
| Runite Sentinel | `enemy_runite_sentinel.png` | Crystal Choir |
| Arcane Sentinel | `enemy_arcane_sentinel.png` | Lab Abomination |
| Rune Automaton | `enemy_rune_automaton.png` | Rune Golem |
| Shade Warden | `enemy_shade_warden.png` | Darkling, Ink Shade, Ledge Lurker, Shadow Archer |
| Gloom Sentinel / Oblivion Sovereign | `enemy_gloom_sentinel.png`, `enemy_oblivion_sovereign.png` | each other, Oblivion Mite, Oblivion Spawn |
| Hollow Abbot | `enemy_hollow_abbot.png` | Penitent Guardian |
| Road Captain / Drillmaster | `enemy_road_captain.png`, `enemy_drillmaster.png` | each other, Knight, Black Knight, Deserter (11 in all) |
| The High Priest | `enemy_the_high_priest.png` | 16 mages and priests (Royal Mage, Court Seer, Field Medic…) |
| Shifting Horror | `enemy_shifting_horror.png` | Chaos Form, Fracture Horror, Rift Warden |
| **Rift Regent** (new, Act 4) | `enemy_rift_regent.png` | copy of Void Herald |
| **Crowned Echo** (new, Act 4) | `enemy_crowned_echo.png` | copy of The High King |

## 2. The biggest groups of look-alike enemies

| Shared by | Count | Examples |
|---|---|---|
| Mage / priest | 17 | Royal Mage, Court Seer, Inquisitor, Witch Hunter, Battle Mage |
| Void cultist | 13 | Void Acolyte, Cultist, Sea Witch, Void Martyr, Scribe of Debts |
| Crossbow / royal archer | 12 | Arbalest, Palace Archer, Royal Marksman, Patrol Archer |
| Bandit archer | 11 | Bandit Archer, Goblin Slinger, Harpooner, Poacher (new) |
| Knight | 11 | Knight, Black Knight, Deserter, Woodcutter, Reeve |
| Mirror shade | 8 | Mirror Mage, Shifting Archer, Memory of an Archer |
| Wolf | 7 | Gray Wolf, Pack Wolf, Fen Wolf, Alpha Wolf (new) |
| Bandit | 7 | Bandit, Cutthroat, Cutthroat Boss (new), Sellsword, Trapper |

**New stand-ins made this session** (copies of a base sprite):
- `enemy_poacher`
- `enemy_goblin_chief`
- `enemy_cutthroat_boss`
- `enemy_alpha_wolf`
- `enemy_rift_regent`
- `enemy_crowned_echo`

## 3. Realm pictures (act card)

The act card shows `portraits/realm_<id>.png` when it exists and isn't a single flat color.

- **Blank (white) today:** `realm_fracture_gate`, `realm_oblivion_rift`, `realm_shadow_realm`, `realm_void_abyss`, `realm_void_sanctum`, `realm_wild_frontiers`.
- **Shared images:**
  - `realm_arcane_library`, `realm_ancient_university` and `realm_abandoned_laboratory` are one image.
  - `realm_verdant_depths`, `realm_fungal_hollows` and `realm_primeval_canopy` are one image.
  - `realm_crystal_caves` and `realm_crystal_depths` are one image.
- **Missing:** `realm_void_hollow`, `realm_void_heart`, `realm_kingdom_outskirts`, `realm_crusader_barracks`, `realm_palace_fortress`, `realm_shifting_labyrinth`, `realm_unraveling_core`, `realm_rift_throne` (new).

## 4. Relic icons

Relics show `items/relic_<key>.png` when it exists, otherwise a ◆ in the relic's rarity color. There are 34, none drawn yet:

- iron_ration, whetstone, focus_crystal, stone_heart, mana_font, merchants_seal
- lucky_coin, scholars_tome, featherweight, bulwark_sigil, silver_veil, verdant_charm, trophy_belt
- swift_boots, war_banner, phoenix_feather, crown_of_insight, titans_belt
- soul_lantern, martyrs_locket, bloodied_banner, executioners_mark, beast_whistle, hunters_perch
- leech_fang, last_stand_idol, glass_sigil, gamblers_crown
- New: riftheart_shard, oath_of_the_fallen, hunting_horn, tome_of_ages, heavy_crown, bramble_crown

## 5. Item icons made as stand-ins

- **Boots** (recolors of existing boot icons, in `items/`): travelers_boots, soft_slippers, stoneshod_boots, windrunner_boots, thornstep_boots, frostbound_greaves, riftwalker_boots.
- **Trinkets:** the 12 new trinkets use previously unused icons that were already in the skin, so they need nothing.
- **Item types still thin** (they also need `equipment_worn` sprites, which is why they weren't added):
  - crossbows: 2, with no uncommon or legendary
  - heavy armor: no common
  - heavy helmets: 2, with no common or legendary

## 6. Music

- **Shared tracks:** the 23 realm tracks are 6 recordings.
  - Wild Frontiers and Verdant Depths, two of the three Act 1 options, sound the same.
  - Void Abyss (Act 2) and Void Sanctum (Act 3) sound the same.
- **New realm:** `audio/music/expedition_rift_throne.ogg` is a copy of the Void Heart track.
- **Hooks ready, no files yet:**
  - Boss battle track: add `battle_boss: 'audio/music/battle_boss.ogg'` to `music` in `js/audio/sound-manifest.js`. Boss fights then play it, and other fights keep the act's track.
  - Victory and defeat stings: add `battle_won` and `battle_lost` to `sfx` in the same file. They play the moment a battle ends.

## 7. Sound effects

- `hit_enemy` (a strike landing on an enemy) uses `audio/sfx/work/chop_hit.ogg`, a woodcutting sound. A combat impact would suit it better.
- Now wired up: `critical_hit.ogg` (critical hits) and `enchant_complete.ogg` (enchanting at a rest site).
- Still unused in `audio/sfx/`: `bolt_fire`, `golem_activate`, `spell_growth`, `turret_fire`.
