#!/usr/bin/env python3
"""Merge the 16x16 sprites from Riftbreak and Rifthold into categorized sprite sheets.

Usage (from the Riftbreak repo root):
    python3 -I spritesheets/build_spritesheets.py

Reads   skins/16x16_tiny_world/<category>/*.png                 (Riftbreak sprites)
        ../Rifthold/skins/16x16_tiny_world.skin.zip              (Rifthold sprites)
        js/content/items/*.js                                    (Riftbreak item slots)
        ../Rifthold/js/core/config/equipment.js                  (Rifthold item kinds)
Writes  spritesheets/<category>_<group>.png and spritesheets/sprites.csv

Merging:
  * Only 16x16 sprites are kept (portraits are 32x32/64x64 and are skipped).
  * A sprite with the same category+name and identical pixels in both games
    is stored once (source = both).
  * If the pixels differ, both are kept: the Riftbreak one under its name, the
    Rifthold one as <name>__rifthold. Magenta/black missing-texture
    placeholders are kept but flagged in the notes column.

Grouping (one sheet per category+group, see group_for()):
  * items / equipment_worn: by the item's slot in the game data (Riftbreak
    first, then Rifthold), then a few name rules for tomes and stragglers.
  * entities, buildings, effects: by name rules in the tables below.
  * Small categories (terrain, floors, ...) stay as one sheet.
  * A sprite no rule matches goes to <category>_other and is listed on stderr,
    so a new sprite never silently lands in the wrong sheet.

Layout: sprites sorted by name, left-to-right, COLS per row. Positions shift
when sprites are added, so always look them up in sprites.csv.
"""
import csv
import glob
import io
import os
import re
import sys
import zipfile

from PIL import Image

TILE = 16
COLS = 16

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
RIFTHOLD = os.path.join(REPO, '..', 'Rifthold')
RIFTBREAK_DIR = os.path.join(REPO, 'skins', '16x16_tiny_world')
RIFTHOLD_ZIP = os.path.join(RIFTHOLD, 'skins', '16x16_tiny_world.skin.zip')
RIFTBREAK_ITEMS = os.path.join(REPO, 'js', 'content', 'items')
RIFTHOLD_EQUIPMENT = os.path.join(RIFTHOLD, 'js', 'core', 'config', 'equipment.js')

# ---------------------------------------------------------------------------
# Item grouping (items and equipment_worn share it)
# ---------------------------------------------------------------------------

TOOL_WORDS = {'pickaxe', 'axe', 'sickle', 'hammer', 'mattock', 'hatchet'}

# Rifthold export block -> group
RIFTHOLD_BLOCKS = {
    'WEAPONS': 'weapons', 'ARMORS': 'armor', 'CLOTHES': 'armor', 'HELMETS': 'helmets',
    'BOOTS': 'boots', 'TOOLS': 'tools', 'TRINKETS': 'trinkets',
    'POTIONS': 'consumables', 'CONSUMABLES': 'consumables',
}

# Sprites with no item definition in either game.
ITEM_OVERRIDES = {'hatchet': 'tools', 'iron_mace': 'weapons'}


def load_riftbreak_items():
    """{item_key: (file, slot, type)} from Riftbreak's one-line item definitions."""
    pat = re.compile(r"^\s*(\w+):\s*\{.*?\bslot:\s*'(\w+)'.*?\btype:\s*'(\w+)'")
    out = {}
    for path in glob.glob(os.path.join(RIFTBREAK_ITEMS, '*.js')):
        stem = os.path.basename(path)[:-3]
        with open(path) as f:
            for line in f:
                m = pat.match(line)
                if m:
                    out[m[1]] = (stem, m[2], m[3])
    return out


def load_rifthold_items():
    """{item_key: group} from the top-level export blocks of Rifthold's equipment.js."""
    out = {}
    if not os.path.exists(RIFTHOLD_EQUIPMENT):
        return out
    block = None
    with open(RIFTHOLD_EQUIPMENT) as f:
        for line in f:
            m = re.match(r'^export const (\w+) = \{', line)
            if m:
                block = RIFTHOLD_BLOCKS.get(m[1])
                continue
            if line.startswith('}'):
                block = None
                continue
            m = re.match(r'^ {4}(\w+):', line)
            if block and m:
                out[m[1]] = block
    return out


def item_group(base, rb_items, rh_items):
    if base in ITEM_OVERRIDES:
        return ITEM_OVERRIDES[base]
    if base.startswith('tome_of_'):
        return 'tomes'
    if base in rb_items:
        stem, slot, typ = rb_items[base]
        if stem == 'tools':
            if typ == 'shield':
                return 'shields'
            if typ == 'implement':
                return 'offhand'
            return 'tools' if TOOL_WORDS & set(base.split('_')) else 'weapons'
        return {'weapons': 'weapons', 'armor': 'armor', 'helmets': 'helmets',
                'boots': 'boots', 'trinkets': 'trinkets'}.get(stem)
    return rh_items.get(base)


# ---------------------------------------------------------------------------
# Entity grouping
# ---------------------------------------------------------------------------

ANIMAL_WORDS = {'wolf', 'boar', 'thornboar', 'deer', 'rabbit', 'chicken', 'cow', 'sheep',
                'goose', 'okapi', 'tapir', 'hound', 'cat', 'spider', 'tusk'}
# An animal word with one of these is a fantasy creature, not an animal.
FANTASY_WORDS = {'chaos', 'crystal', 'glitch', 'echo', 'void', 'shifting', 'rift', 'oblivion',
                 'fracture', 'shard', 'imbued', 'rotting', 'spectral', 'memory', 'mirror'}
CONSTRUCT_WORDS = {'golem', 'automaton', 'construct', 'turret', 'totem'}
MONSTER_WORDS = {
    'wraith', 'shade', 'ghost', 'spirit', 'soul', 'wisp', 'horror', 'imp', 'beast', 'bloom',
    'creeper', 'spore', 'fungal', 'abomination', 'specimen', 'husk', 'mite', 'spawn', 'shred',
    'eye', 'reflection', 'twin', 'form', 'tome', 'crawler', 'leech', 'lurker', 'darkling',
    'revenant', 'treant', 'elemental', 'spark', 'choir', 'howler', 'wurm', 'bat', 'monster',
    'familiar', 'decoy', 'echo', 'sentinel', 'warden', 'stalker', 'sovereign', 'unraveler',
    'mother', 'walker', 'goblin', 'gloom', 'hollow',
}

# Checked before the word rules: sprites whose name misleads. Many enemy_* sprites
# still reuse another creature's look, so they are grouped by what they show
# (as of 2026-11-24). Move a name here when it is redrawn as something else.
ENTITY_OVERRIDE_GROUPS = {
    'humanoids': '''enemy_echo_mimic enemy_mirror_twin mirror_twin enemy_your_reflection
        enemy_rogue_warden enemy_echo_of_a_champion enemy_crowned_echo
        enemy_echo_of_a_bandit_king enemy_echo_of_a_knight enemy_echo_of_a_witch
        enemy_goblin_slinger enemy_chaos_form enemy_fracture_horror fracture_horror
        enemy_rift_warden enemy_shifting_horror shifting_horror enemy_palace_husk palace_husk
        revenant_knight''',
    'monsters': '''enemy_blind_archer enemy_debtor_archer enemy_desperate_debtor enemy_prisoner
        enemy_prisoner_archer enemy_void_penitent void_penitent enemy_zealot
        enemy_bound_archivist enemy_canopy_shaman enemy_chaos_caller enemy_rift_geomancer
        enemy_collector enemy_ledger_keeper enemy_rift_hexer void_broker enemy_crystal_colossus
        enemy_crystal_shaper enemy_lab_caretaker enemy_egg_tender enemy_enforcer
        enemy_rogue_stoneshaper void_brute wave_enemy enemy_isle_hunter enemy_void_champion
        enemy_mirror_mage enemy_memory_of_a_herald enemy_memory_of_an_archer enemy_rift_oracle
        enemy_shifting_archer enemy_shifting_mage enemy_penitent_guardian penitent_guardian
        enemy_tithe_knight enemy_void_herald void_herald enemy_rogue_spellblade
        enemy_shadow_archer enemy_shadow_chancellor enemy_spectral_lecturer
        enemy_spectral_professor enemy_spectral_researcher npc_spectral_professor
        enemy_void_arbiter''',
    'animals': 'canopy_stalker enemy_canopy_stalker enemy_echo_of_the_dire_wolf',
    'constructs': 'arcane_sentinel enemy_arcane_sentinel',
}
ENTITY_OVERRIDES = {n: g for g, names in ENTITY_OVERRIDE_GROUPS.items() for n in names.split()}


def entity_group(name):
    if name in ENTITY_OVERRIDES:
        return ENTITY_OVERRIDES[name]
    if name.startswith('boss_'):
        return 'bosses'
    if name.startswith('colonist_'):
        if '_body_' in name:
            return 'colonist_bodies'
        if name.startswith('colonist_hair_'):
            return 'colonist_hair'
        if name.startswith('colonist_shirt_'):
            return 'colonist_shirts'
        return 'humanoids'           # drafted / sleeping poses
    base = re.sub(r'^(enemy|npc)_', '', name)
    words = set(base.split('_'))
    if words & CONSTRUCT_WORDS:
        return 'constructs'
    if words & ANIMAL_WORDS:
        return 'monsters' if words & FANTASY_WORDS else 'animals'
    if words & MONSTER_WORDS:
        return 'monsters'
    return 'humanoids'


# ---------------------------------------------------------------------------
# Building and effect grouping (explicit tables; seasonal suffixes stripped)
# ---------------------------------------------------------------------------

SEASONS = ('_spring', '_summer', '_autumn', '_winter')

BUILDING_GROUPS = {
    'plants': '''arctic_moss bluebells bog_mushrooms bramble cattails clover_patch desert_marigold
        dry_shrub edelweiss fern frost_shrub juniper_scrub lichen_patch marsh_fern meadow_shrub
        mushroom_cluster prickly_pear reeds saguaro snowbell tall_grass thistle wildflowers''',
    'walls_doors': '''abyss_wall brick_wall crystal_wall kingdom_wall scouting_wall stone_wall
        university_wall verdant_wall void_wall warded_wall wood_wall door door_open fence
        fence_gate fence_gate_open reinforced_door reinforced_door_open void_door void_door_open''',
    'furniture': '''armchair bed bench bookcase candle chair crate desk food_chest ice_box
        material_shelf nightstand personal_chest podium potted_plant rug shelf statue stool table
        tool_rack torch wardrobe weapon_rack ancient_chest ancient_chest_open town_hall_banner''',
    'workstations': '''alchemy_table anvil campfire cauldron cooking_pot enchanting_table
        ember_heater golem_forge grindstone loom research_desk scriptorium war_table workbench''',
    'magic': '''arcane_core arcane_sentinel artifact_pedestal beacon beast_circle ember_ward
        forge_core gathering_circle glowstone hearth_shrine inferno_ward mana_crystal mana_relay
        rift_anchor rift_anchor_active rift_gate ritual_chalk ritual_core trade_rift void_nexus
        void_turret''',
}

EFFECT_GROUPS = {
    'combat': '''attack_stab attack_swing damage_flash death hit shield_block slash smite
        projectile_arcane projectile_arrow projectile_bolt projectile_spell projectile_void
        turret_shot''',
    'spells': '''spell_attack spell_buff spell_cast spell_divination spell_growth spell_heal
        spell_shield spell_summon spell_teleport summon_arrive summon_sparkle portal heal_tick
        rally''',
    'status': '''danger freezing harvest health_regen loot loot_drop mana_regen mental_break
        need_critical speed_trail xp_gain''',
    'ambient': '''fire forest_grass_tuft grass_tuft swamp_grass_tuft shadow shallow_water_waves
        snow water_waves''',
}


def _invert(groups):
    return {n: g for g, names in groups.items() for n in names.split()}


BUILDING_LOOKUP = _invert(BUILDING_GROUPS)
EFFECT_LOOKUP = _invert(EFFECT_GROUPS)


def table_group(name, lookup):
    if name in lookup:
        return lookup[name]
    for s in SEASONS:
        if name.endswith(s) and name[:-len(s)] in lookup:
            return lookup[name[:-len(s)]]
    if name.endswith(' copy') or re.search(r' copy\d*$', name):   # stray Finder duplicates
        return table_group(re.sub(r' copy\d*$', '', name), lookup)
    return None


def group_for(cat, name, rb_items, rh_items):
    """The sheet group for a sprite, or None when no rule covers it (-> _other)."""
    base = name.split('__')[0]
    if cat in ('items', 'equipment_worn'):
        return item_group(base, rb_items, rh_items)
    if cat == 'entities':
        return entity_group(base)
    if cat == 'buildings':
        return table_group(base, BUILDING_LOOKUP)
    if cat == 'effects':
        return table_group(base, EFFECT_LOOKUP)
    return ''   # unsplit category: one sheet named after the category


# ---------------------------------------------------------------------------
# Loading and merging
# ---------------------------------------------------------------------------

def load_riftbreak():
    out = {}
    for cat in sorted(os.listdir(RIFTBREAK_DIR)):
        d = os.path.join(RIFTBREAK_DIR, cat)
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.endswith('.png'):
                out[(cat, f[:-4])] = Image.open(os.path.join(d, f)).convert('RGBA')
    return out


def load_rifthold():
    out = {}
    with zipfile.ZipFile(RIFTHOLD_ZIP) as z:
        for info in z.infolist():
            parts = info.filename.split('/')
            if len(parts) != 2 or not parts[1].endswith('.png'):
                continue
            img = Image.open(io.BytesIO(z.read(info))).convert('RGBA')
            out[(parts[0], parts[1][:-4])] = img
    return out


def is_placeholder(img):
    """True for the opaque magenta/black checkerboard missing-texture tile."""
    raw = img.tobytes()
    pixels = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    if any(p[3] != 255 for p in pixels):
        return False
    magenta = sum(1 for p in pixels if p[0] > 200 and p[1] < 60 and p[2] > 200)
    black = sum(1 for p in pixels if p[:3] == (0, 0, 0))
    return magenta > 0 and black > 0 and magenta + black == len(pixels)


def merge(games):
    """[(category, name, img, source, notes)] plus the skipped non-16x16 list."""
    skipped, merged = [], []
    for key in sorted(set(games['riftbreak']) | set(games['rifthold'])):
        cat, name = key
        present = {}
        for g, sprites in games.items():
            img = sprites.get(key)
            if img is None:
                continue
            if img.size != (TILE, TILE):
                skipped.append((g, cat, name, img.size))
                continue
            present[g] = img
        if not present:
            continue
        if len(present) == 1:
            (g, img), = present.items()
            merged.append((cat, name, img, g, 'placeholder' if is_placeholder(img) else ''))
            continue
        a, b = present['riftbreak'], present['rifthold']
        if a.tobytes() == b.tobytes():
            merged.append((cat, name, a, 'both', 'placeholder' if is_placeholder(a) else ''))
            continue
        for nm, img, g, other in ((name, a, 'riftbreak', 'rifthold'),
                                  (name + '__rifthold', b, 'rifthold', 'riftbreak')):
            note = f'differs from {other} version'
            if is_placeholder(img):
                note += '; placeholder'
            merged.append((cat, nm, img, g, note))
    return merged, skipped


def main():
    games = {'riftbreak': load_riftbreak(), 'rifthold': load_rifthold()}
    rb_items, rh_items = load_riftbreak_items(), load_rifthold_items()
    merged, skipped = merge(games)

    sheets, unmatched = {}, []
    for cat, name, img, source, notes in merged:
        group = group_for(cat, name, rb_items, rh_items)
        if group is None:
            unmatched.append((cat, name))
            group = 'other'
        sheet = f'{cat}_{group}' if group else cat
        sheets.setdefault(sheet, []).append((name, cat, img, source, notes))

    # Remove sheets from earlier runs so renamed/merged groups don't linger.
    for old in glob.glob(os.path.join(HERE, '*.png')):
        os.remove(old)

    csv_rows = []
    for sheet, rows in sorted(sheets.items()):
        rows.sort(key=lambda r: r[0])
        n_rows = (len(rows) + COLS - 1) // COLS
        img_out = Image.new('RGBA', (min(len(rows), COLS) * TILE, n_rows * TILE), (0, 0, 0, 0))
        for i, (name, cat, img, source, notes) in enumerate(rows):
            col, row = i % COLS, i // COLS
            img_out.paste(img, (col * TILE, row * TILE))
            csv_rows.append([name, cat, sheet, f'{sheet}.png', i, col, row,
                             col * TILE, row * TILE, TILE, TILE, source, notes])
        img_out.save(os.path.join(HERE, f'{sheet}.png'), optimize=True)
        print(f'{sheet}.png: {len(rows)} sprites')

    with open(os.path.join(HERE, 'sprites.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['name', 'category', 'group', 'sheet', 'index', 'col', 'row',
                    'x', 'y', 'width', 'height', 'source', 'notes'])
        w.writerows(csv_rows)

    print(f'{len(csv_rows)} sprites in {len(sheets)} sheets written to sprites.csv')
    print(f'{len(skipped)} non-16x16 sprites skipped', file=sys.stderr)
    if unmatched:
        print(f'{len(unmatched)} sprites matched no group (put in <category>_other):',
              file=sys.stderr)
        for u in unmatched:
            print('  ', *u, file=sys.stderr)


if __name__ == '__main__':
    main()
