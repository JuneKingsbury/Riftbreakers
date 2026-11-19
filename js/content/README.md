# Game content

Everything the game is made of lives here as plain data: classes and their abilities, enemies,
items, relics, events, realms with their fights and bosses, and the glossary they're written
in. Game code reads it but never defines content of its own.

- **What can I write?** [`vocab.js`](vocab.js) lists every stat, status effect, element,
  equipment type and field, with what each does. [`CONTENT.md`](CONTENT.md) is the same as
  readable tables, plus an index of everything in the game (`npm run content-docs` refreshes it).
- **Did I get it right?** `npm test` checks all content against `vocab.js`
  (`tests/content/content.test.mjs`): an unknown field, a misspelled status, an ability or map
  that doesn't exist, an item granting the wrong kind of ability. Each problem is reported with
  the entry and field it's in.
- **Order matters** in lists marked so below. Runs roll from these lists with a seeded random
  generator, so reordering existing entries changes which content a given seed produces. Add
  new entries at the end.

| Folder / file | Holds |
|---|---|
| `classes/<class>.js` | One player class each: `job` (stats, skill tree, gear rules, unlock, AI hints) and `abilities` (its skill tree's abilities) |
| `enemies/*.js` | Enemy jobs (`jobs`) and the abilities only they use (`abilities`), by kind; `summons.js` holds creatures only player summons call; `bosses.js` the signature abilities of bosses on plain enemy jobs |
| `items/<slot>.js` | Items of one slot. `items/abilities.js`: abilities only items grant |
| `relics.js` | Relics, and the passives only relics give (`abilities`). Battle triggers: `tactical/triggers.js` |
| `affixes.js` | Elite affixes (a twist on an elite fight's leader) and the passives only they give |
| `events.js` | General `?` events. Realm-only events are in the realm's file |
| `realms/<realm>.js` | One realm each: `realm` (look, maps, bosses), `encounters` (normal, elite, boss fights) and `events` |
| `realms/index.js` | The world: chains of realms, and which realms each act can be set in |
| `abilities/` | `common.js` (Attack, Brace, Move +1), `templates.js` (field groups to `extends`), `unused.js` |
| `vocab.js`, `validate.js` | The glossary and the checker |

Each folder has an `index.js` importing its files (browsers can't list a folder). A file left
out of its index never loads, and a test catches that.

## Adding a class

1. Copy a class file in `classes/` (e.g. `evoker.js`) to `classes/<key>.js`. `key` is the
   class id; its display name is the key, title-cased (`field_surgeon` → Field Surgeon).
2. In `job`, set:
   - base stats (`maxHp` … `eva`), `spriteKey` (a skin entity), `char`/`color` (fallbacks),
     `schools`, `desc` and `skillsetName`.
   - `tier: 1` and `promotions` (two Tier 2 classes), or `tier: 2` and list the new class in its
     Tier 1 class's `promotions`.
   - `learnable`: the skill tree, `ability: { sp, requires? }`. The first entry is known from
     the start. A Tier 1 tree lists its actions, then one reaction, support and movement skill.
   - `allowedEquipment` (Tier 1) or `equipmentExpansions` (Tier 2, added to its Tier 1 list).
   - Tier 1 only: `role` (one line), `startingGear`, and `unlock: { type: 'base' | 'renown', order }`.
   - `ai`: how automatic battles play it (`script`, `ranged`, `keep`, `melee`, `healer`; see
     `SCHEMAS.job.ai` in `vocab.js`).
   - `builds`: two suggested builds, `{ key, name, desc, steps }`, that players can pick so skill
     points are spent for them (`run/builds.js`). `steps` is the spending order: `'skill'` learns
     it, `'skill+'` upgrades it one rank. A Tier 2 build may use its Tier 1 class's skills. Name at
     most one reaction, support and movement skill per build (each one takes its slot). Skills a
     build leaves out are bought after it. `key` is saved in runs, so don't rename it.
3. In `abilities`, define each ability its tree learns that isn't defined elsewhere. Abilities
   are shared by key, so a class can learn another file's ability, and enemies and items can use
   this class's.
4. Import the file in `classes/index.js` and add it to `CLASSES` (Tier 1 classes before Tier 2;
   the order is the order of class lists and recruit rolls).

## Adding an ability

Define it in the `abilities` of the file it belongs to: its class, the enemy file that uses it,
or `items/abilities.js` if only an item grants it. Fields are in `SCHEMAS.ability`.

- `extends: 'other_key'` copies another ability and overrides what you list (`null` drops an
  inherited field). For a plain support, `extends: 'support'` (`abilities/templates.js`)
  gives the passive basics without tying it to another class's skill.
- `slot` decides where it goes: absent (an action), `reaction`, `support` or `movement`.
- Actions and reactions get ranks II and III automatically (`data-registry.js`). A `desc` may
  use `{duration}`, `{turns}` and `{buff:stat}` so each rank shows its own numbers.

## Adding an enemy

Add a job to the `jobs` of a file in `enemies/` (stats, `abilities` list, `spriteKey`), and
define any new abilities in the same file. An enemy job can also have `passives` (reactions or
supports it always has, e.g. Interpose) and `battleStart` statuses (e.g. Reflect); `enemies/realm.js`
holds one such enemy per act realm. Put it in a fight's `roster` to field it. Its
sprite in battle comes from its roster name (see `tactical/enemy-sprites.js`), so a new
enemy name also needs a sprite in the skin.

A creature a summon calls (`summonJob`, or a reaction's `summon.job`) gets its own job in
`enemies/summons.js`, even when it looks like an enemy (`summoned_wolf` reuses the wolf's
sprite). Tuning the enemy then never changes the summon. The tests reject a summon whose job
is also fielded in a fight.

## Adding a realm, a fight or a boss

- **Fight:** add it to `encounters.normal`, `.elite` or `.boss` of a realm file, written with
  `fight(id, name, enemyLevel, [e(job, name, sprite?, extra?), ...], { easy?, map?, scouting? })`
  from `realms/helpers.js`, or as a plain object. List the roster strongest-first: a fight
  takes the first N entries, N growing with the party.
- **Boss:** a boss fight's first roster entry is the boss. List its id in the realm's
  `bosses` to make it a possible finale for the act, and give it `scouting` text.
  Give it `phases` too: `{ at: 0.5, name, say, status?, buffs?, healPct?, cleanse?, allies?,
  summon?: [e(...)] }` happens the first time the boss falls below half HP (fields in
  `SCHEMAS.encounter`). Reinforcements are roster entries, scaled like the roster; reuse a
  roster name so they keep its sprite.
- **Realm:** copy a realm file, import it in `realms/index.js` and add it to a chain (its place
  in the chain is its tier). Then either:
  - make it an act's setting: add it to that act in `ACT_REALMS` and give it `draws`, the
    realms whose fights and events it also fields (`[]` for none), or
  - add it to an act realm's `draws`, so that realm fields its fights (retuned for the act) and
    events. A drawn realm can come from any chain; each is drawn by one act realm only.

  A realm also needs a music track (`expedition_<id>` in `audio/sound-manifest.js`).

## Adding an item

Add it to `items/<slot>.js`: `name`, `slot`, `type` (decides who can wear it), `rarity`, stat
bonuses, and `grants` / `grantsPassive` for abilities. The item also needs an `items` icon in
the skin, and an `equipment_worn` sprite for armor, helmets, weapons and tools.
`CONTENT.md` lists which abilities can go in `grants` and `grantsPassive`.
`rarity` is `common` (the default), `uncommon`, `rare` or `legendary`. Legendary is the top tier: it
drops only from elite and boss rewards from act 2 on and is never sold, so keep it to a few items
that clearly beat the best rare of their type. Optional `acts` and
`realms` limit where it can drop or be sold (default: anywhere).

## Adding a relic or event

- **Relic:** add it to `relics.js`, with `rarity`, a `desc`, and its effect (`statMods`,
  `battleStart`, `xpMult`…). Optional `acts` / `realms`, as for items.
- **Event:** a general one goes in `events.js`, a realm one in the realm file's `events` (it
  appears in that realm; list `realms` to share it with others). Choices can require gold or
  items, roll weighted `outcomes`, and have `effect`s (see `SCHEMAS.event`).

## Battle maps

Maps are JSON in `js/tactical/data/maps/`, written by the map editor. A realm's `maps` lists
the ones its fights use, and a fight's `map` can fix one.
