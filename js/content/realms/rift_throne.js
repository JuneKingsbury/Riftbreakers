// The Rift Throne: tier 1 (and only tier) of The Rift Throne.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
//
// The place every rift leads back to. Its fights mix what the party met in every realm
// (the same creatures and soldiers, pulled here and bent), so its rosters borrow names and
// looks from the other realms.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'rift_throne', name: 'The Rift Throne',
    blurb: 'Every rift you sealed leads here. Shards of every realm drift in a sky with no stars: crystal, palace stone, forest and void, held together by whatever sits on the throne at the center.',
    look: {
        sky: '#140a1e', mapBg: '#1c1228',
        blocks: {
            grass: [['abyss_tile', 2], ['crystal_floor', 1], ['moss', 1], ['marble', 1]],
            moss: [['moss', 2], ['abyss_tile', 1]],
            marble: [['marble', 2], ['glyph', 1]],
            dirt: [['glyph', 1], ['crystal_floor', 1]],
            wall: [['warded_wall', 2], ['crystal', 1], ['stone_wall', 1]],
            stone_wall: [['stone_wall', 1], ['warded_wall', 1], ['crystal', 1]],
            water: 'void_water',
        },
    },
    maps: ['grand_hall', 'ruined_temple', 'crystal_grotto', 'sunken_isles', 'volcano_plateau', 'jungle_ruins'],
    bosses: ['boss_rift_regent', 'boss_crowned_echo'],
    // Realms whose fights and events this realm also fields (none: only its own).
    draws: [],
};

// The creatures here were pulled in from realms met earlier in a run, so each kind of fight
// adds this to every enemy to bring them up to the last act (set in simulated battles against
// the Shifting Labyrinth's fights). Reinforcements from boss phases get it too.
const RIFT_BOOST = {
    normal: { maxHp: 12, atk: 2, mat: 2, def: 1, mdf: 1 },
    elite:  { maxHp: 16, atk: 3, mat: 3, def: 2, mdf: 2 },
    boss:   { maxHp: 18, atk: 3, mat: 3, def: 2, mdf: 2 },
};
const boosted = (mods, kind) => {
    const out = { ...(mods ?? {}) };
    for (const [k, v] of Object.entries(RIFT_BOOST[kind])) out[k] = (out[k] ?? 0) + v;
    return out;
};
const boostAll = (fights, kind) => fights.map(f => ({
    ...f,
    roster: f.roster.map(r => ({ ...r, statMods: boosted(r.statMods, kind) })),
    ...(f.phases ? { phases: f.phases.map(ph => (ph.summon ? { ...ph, summon: ph.summon.map(r => ({ ...r, statMods: boosted(r.statMods, kind) })) } : ph)) } : {}),
}));

const fights = {
    normal: [
        fight('bleeding_borders', 'Bleeding Borders', 6, [
            e('void_stalker', 'Void Champion'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('wolf', 'Chaos Hound', 'chaos_hound'),
            e('shadow_mage', 'Shade', 'shade'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
        ]),
        fight('drowned_court', 'Drowned Court', 6, [
            e('kingdom_guard', 'Black Knight', 'revenant_knight'),
            e('riftcaller', 'Court Shade', 'shade'),
            e('runebow', 'Shadow Archer', 'shade_wraith'),
            e('kingdom_guard', 'Black Knight', 'revenant_knight'),
            e('spectral_wisp', 'Hush Wisp', 'ghost'),
            e('shadow_mage', 'Shade', 'shade'),
        ]),
        fight('crystal_tide', 'Crystal Tide', 6, [
            e('orc_captain', 'Crystal Wurm', 'crystal_wurm'),
            e('canopy_stalker', 'Imbued Beast', 'crystal_beast'),
            e('shard_spider', 'Shard Spider'),
            e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
            e('shard_spider', 'Shard Spider'),
        ]),
        fight('penitent_march', 'Penitent March', 6, [
            e('kingdom_guard', 'Penitent Guardian', 'penitent_guardian'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('riftcaller', 'Void Herald', 'void_herald'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('void_walker', 'Void Walker'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
        ]),
        fight('specimen_spill', 'Specimen Spill', 6, [
            e('orc_captain', 'Lab Abomination', 'lab_abomination'),
            e('void_stalker', 'Chaos Form', 'fracture_horror'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('kingdom_guard', 'Arcane Construct', 'construct'),
            e('spore_walker', 'Leaking Specimen', 'monster'),
            e('wolf', 'Chaos Hound', 'chaos_hound'),
        ]),
        fight('rift_overgrowth', 'Rift Overgrowth', 6, [
            e('orc_captain', 'Fungal Horror', 'fungal_horror'),
            e('canopy_stalker', 'Canopy Stalker'),
            e('thorn_beast', 'Thorn Beast'),
            e('spore_walker', 'Blight Bloom', 'blight_bloom'),
            e('canopy_stalker', 'Canopy Stalker'),
            e('wolf', 'Primeval Hound', 'chaos_hound'),
        ]),
        fight('royal_remnant', 'Royal Remnant', 6, [
            e('orc_captain', 'Palace Champion', 'palace_champion'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
            e('palace_shieldbearer', 'Shieldbearer', 'kingdom_guard'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('raider_archer', 'Royal Crossbow', 'crusader_archer'),
            e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
        ]),
        fight('fracture_tide', 'Fracture Tide', 6, [
            e('void_stalker', 'Fracture Horror', 'fracture_horror'),
            e('canopy_stalker', 'Echo Beast', 'echo_beast'),
            e('spectral_wisp', 'Reality Shred', 'reality_shred'),
            e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
            e('void_stalker', 'Glitch Beast', 'glitch_beast'),
            e('canopy_stalker', 'Echo Beast', 'echo_beast'),
        ]),
    ],
    elite: [
        fight('crystal_and_void', 'Crystal and Void', 8, [
            e('orc_captain', 'Crystal Warden', 'crystal_warden'),
            e('void_stalker', 'Void Champion'),
            e('earthshaker', 'Runite Elemental', 'runite_elemental'),
            e('riftcaller', 'Void Herald', 'void_herald'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
        ]),
        fight('oblivion_host', 'Oblivion Host', 8, [
            e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
            e('paladin', 'Black Knight', 'revenant_knight'),
            e('shadow_mage', 'Shade', 'shade'),
            e('void_stalker', 'Void Horror', 'void_horror'),
            e('runebow', 'Shadow Archer', 'shade_wraith'),
            e('shadow_mage', 'Shade', 'shade'),
        ]),
        fight('kingsguard_echo', 'Kingsguard Echo', 8, [
            e('paladin', 'Palace Champion', 'palace_champion'),
            e('sanctifier', 'High Priest', 'high_priest'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('runebow', 'Palace Runebow', 'crusader_archer'),
        ]),
        fight('grove_wrath', 'Grove Wrath', 8, [
            e('kingdom_guard', 'Thorn Warden', 'thorn_warden'),
            e('lifeseer', 'Grove Keeper', 'npc_wandering_druid'),
            e('earthshaker', 'Root Shaper', 'briar_sentinel'),
            e('canopy_stalker', 'Canopy Stalker'),
            e('orc_captain', 'Fungal Horror', 'fungal_horror'),
            e('spectral_wisp', 'Spore Wisp', 'arcane_wisp'),
        ]),
        fight('mirror_court', 'Mirror Court', 8, [
            e('void_stalker', 'Echo of a Champion', 'mirror_twin'),
            e('runebow', 'Memory of an Archer', 'mirror_shade'),
            e('orc_captain', 'Shifting Horror', 'shifting_horror'),
            e('shadow_mage', 'Fracture Wraith', 'fracture_wraith'),
            e('void_stalker', 'Memory of a Champion', 'mirror_twin'),
            e('spectral_wisp', 'Reality Shred', 'reality_shred'),
        ]),
    ],
    boss: [
        fight('boss_rift_regent', 'The Rift Regent', 8, [
            e('riftcaller', 'Rift Regent', 'void_herald', { level: 11, statMods: { maxHp: 60, mat: 3, def: 4, mdf: 4 } }),
            e('void_stalker', 'Void Champion'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('kingdom_guard', 'Black Knight', 'revenant_knight'),
            e('shadow_mage', 'Shade', 'shade'),
            e('riftcaller', 'Void Herald', 'void_herald'),
        ], {
            scouting: 'The Rift Regent holds the throne for something older. It tears open small rifts to call in guards from every realm, and its spells hit the whole line, so spread out and bring healing.',
            phases: [
                { at: 0.66, name: 'Open the Rifts', say: 'The Rift Regent rakes the air open, and a champion steps through!',
                  summon: [e('void_stalker', 'Void Champion')] },
                { at: 0.33, name: 'Throne\'s Will', say: 'The throne itself lends its strength. The Regent\'s servants surge!',
                  status: { status: 'haste', duration: 3 }, allies: { buffs: [{ stat: 'atk', value: 3, duration: 3 }, { stat: 'mat', value: 3, duration: 3 }] } },
            ],
        }),
        fight('boss_crowned_echo', 'The Crowned Echo', 8, [
            e('battlemage', 'Crowned Echo', 'boss_high_king', { level: 11, statMods: { maxHp: 100, atk: 5, def: 5, mat: 4, mdf: 4 } }),
            e('paladin', 'Palace Champion', 'palace_champion'),
            e('sanctifier', 'High Priest', 'high_priest'),
            e('kingdom_guard', 'Echo of a Knight', 'knight'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
            e('void_stalker', 'Echo of a Champion', 'mirror_twin'),
        ], {
            scouting: 'An echo of the High King, crowned by the rift itself. It heals when hard pressed, and near the end it turns spells back on whoever casts them. Finish it with steel.',
            phases: [
                { at: 0.5, name: 'Rally to the Crown', say: 'The Crowned Echo raises its blade, and a knight answers from the dark!',
                  healPct: 0.12, summon: [e('kingdom_guard', 'Echo of a Knight', 'knight')] },
                { at: 0.25, name: 'Mirror Crown', say: 'Light bends around the crown. Spells will turn back on whoever casts them!',
                  status: { status: 'reflect', duration: 3 }, cleanse: true },
            ],
        }),
    ],
};

export const encounters = {
    normal: boostAll(fights.normal, 'normal'),
    elite: boostAll(fights.elite, 'elite'),
    boss: boostAll(fights.boss, 'boss'),
};

export const events = [
    {
        id: 'rt_drifting_shard',
        title: 'Drifting Shard',
        text: 'A piece of some other realm floats past the path: a slice of forest, still with birdsong, hanging in the starless dark.',
        choices: [
            { label: 'Step onto it and rest', effect: { healPct: 1, xp: 40 }, resultText: 'For a while it feels like home. Everyone heals and gains 40 XP.' },
            { label: 'Search its roots', outcomes: [
                { weight: 2, effect: { item: 'rare' }, resultText: 'Tangled in the roots: {item}.' },
                { weight: 1, effect: { healPct: -0.15, item: 'uncommon' }, resultText: 'The shard tilts and spills you off its edge, but someone comes up holding {item}.' },
            ] },
        ],
    },
    {
        id: 'rt_throne_echo',
        title: 'Echo of the Throne',
        text: 'A voice from the center speaks in each of your heads at once. It offers power, and it is not subtle about the price.',
        choices: [
            { label: 'Accept the gift', effect: { relic: 'rare', healPct: -0.25 }, resultText: 'It hurts. Then it is done, and you carry {relic}.' },
            { label: 'Refuse it', effect: { xp: 60 }, resultText: 'The voice laughs and lets you go. Standing up to it was a lesson in itself. Everyone gains 60 XP.' },
        ],
    },
    {
        id: 'rt_lost_patrol',
        title: 'Lost Patrol',
        text: 'Soldiers from the Kingdom, pulled through a rift weeks ago, are dug in behind a wall of crystal. They don\'t know which way is out.',
        choices: [
            { label: 'Show them the way (they pay)', effect: { gold: 90 }, resultText: 'They empty their purses for the directions: 90 gold.' },
            { label: 'Trade for their spare kit', requires: { gold: 60 }, effect: { gold: -60, item: 'rare' }, resultText: 'For 60 gold, their quartermaster parts with {item}.' },
            { label: 'Leave them be', effect: {}, resultText: 'You have your own way to find.' },
        ],
    },
    {
        id: 'rt_cartographer',
        title: 'The Last Cartographer',
        text: 'An old woman sits on a drifting stair, inking maps of realms that no longer line up. She looks at your party with professional interest.',
        choices: [
            { label: 'Let her sketch your route', effect: { xp: 45 }, resultText: 'She marks what she knows of the way ahead. Everyone gains 45 XP.' },
            { label: 'Buy her best map (80 gold)', requires: { gold: 80 }, effect: { gold: -80, relic: 'uncommon' }, resultText: 'Folded inside the map is {relic}. She winks.' },
            { label: 'One of you sits for a portrait', effect: { memberStatMods: { maxHp: 6 } }, resultText: 'She draws {name} as they are meant to be. Somehow, {name} feels it: +6 max HP.' },
        ],
    },
    {
        id: 'rt_shattered_mirror',
        title: 'Shattered Mirror',
        text: 'A tall mirror floats upright in the void, cracked down the middle. Your reflections step out of it and wait.',
        choices: [
            { label: 'Fight your reflections (elite battle)', effect: { battle: 'elite' }, resultText: 'They move exactly as you do. Almost.' },
            { label: 'Walk around it', effect: { xp: 30 }, resultText: 'The reflections watch you go. Everyone gains 30 XP for the lesson in patience.' },
        ],
    },
];
