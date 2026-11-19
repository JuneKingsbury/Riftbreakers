// Verdant Depths: tier 1 of Verdant Wilds.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'verdant_depths', name: 'Verdant Depths',
    blurb: 'A vast jungle no one has ever settled, its plants and animals missing from even the most complete bestiaries. The trees grow taller the further in you travel.',
    look: { sky: '#163024', mapBg: '#1b3324', blocks: { grass: [['moss', 3], ['grass', 1]], dirt: [['dirt', 2], ['verdant_tile', 1]], wall: 'hedge', rubble: 'rubble' } },
    maps: ['jungle_ruins', 'river_ford', 'crossroads', 'mountain_pass'],
    bosses: ['boss_thorn_warden', 'boss_ancient_treant'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['fungal_hollows', 'primeval_canopy'],
};

export const encounters = {
    normal: [
        fight('creeping_vines', 'Creeping Vines', 1, [
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('spore_walker', 'Spore Walker'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('spore_walker', 'Spore Walker'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
        ], { easy: true }),
        fight('thorn_thicket', 'Thorn Thicket', 1, [
            e('thorn_beast', 'Thorn Beast'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('wolf', 'Jungle Hound', 'chaos_hound', { statMods: { atk: -1 } }),
            e('thorn_beast', 'Thorn Beast'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('spore_walker', 'Spore Walker'),
        ]),
        fight('startled_herd', 'Startled Herd', 1, [
            e('boar', 'Wild Tapir', 'tapir'),
            e('boar', 'Striped Okapi', 'okapi', { statMods: { maxHp: -8, spd: 2 } }),
            e('thorn_beast', 'Thorn Beast'),
            e('boar', 'Wild Tapir', 'tapir'),
            e('wolf', 'Jungle Hound', 'chaos_hound'),
            e('boar', 'Striped Okapi', 'okapi', { statMods: { maxHp: -8, spd: 2 } }),
        ]),
        fight('spore_nursery', 'Spore Nursery', 1, [
            e('spore_mother', 'Spore Mother', 'vine_creeper', { tint: '#c8f0a0' }),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('spore_walker', 'Spore Walker'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
        ]),
    ],
    elite: [
        fight('blighted_grove', 'Blighted Grove', 2, [
            e('spore_walker', 'Blight Bloom', 'blight_bloom', { statMods: { maxHp: 10, mat: 2 } }),
            e('thorn_beast', 'Thorn Beast'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('spore_walker', 'Blight Bloom', 'blight_bloom'),
            e('thorn_beast', 'Thorn Beast'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
        ]),
        fight('jungle_poachers', 'Jungle Poachers', 2, [
            e('orc_captain', 'Head Poacher', 'raider_brute', { statMods: { maxHp: -10 } }),
            e('raider_archer', 'Poacher'),
            e('raider_hexer', 'Snare Witch', 'raider_poisoner'),
            e('raider', 'Trapper'),
            e('raider_archer', 'Poacher'),
            e('boar', 'Hunting Boar'),
        ]),
    ],
    boss: [
        fight('boss_thorn_warden', 'The Thorn Warden', 2, [
            e('canopy_stalker', 'Thorn Warden', 'thorn_warden', { extraAbilities: ['bramble_lash'], statMods: { maxHp: 45, atk: 2, def: 3, mdf: 2 } }),
            e('kingdom_guard', 'Briar Sentinel', 'briar_sentinel', { statMods: { maxHp: -4 } }),
            e('spore_walker', 'Spore Walker'),
            e('goblin', 'Vine Creeper', 'vine_creeper'),
            e('kingdom_guard', 'Briar Sentinel', 'briar_sentinel', { statMods: { maxHp: -4 } }),
        ], { scouting: 'The Thorn Warden guards the deep green. Briar Sentinels hold the line while spores drift in from behind them.',
          phases: [
            { at: 0.5, name: 'Bramble Wall', say: 'Thorns burst from the Thorn Warden\'s hide, and the vines answer!',
              buffs: [{ stat: 'def', value: 3, duration: 4 }],
              summon: [e('goblin', 'Vine Creeper', 'vine_creeper')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'vd_pitcher_plant', realms: ['verdant_depths', 'fungal_hollows'],
        title: 'Pitcher Plant',
        text: 'A pitcher plant the size of a wagon blocks the path. Something shiny rests at the bottom of its acid pool.',
        choices: [
            { label: 'Reach in', outcomes: [
                { weight: 2, effect: { item: 'uncommon', healPct: -0.1 }, resultText: 'The acid burns, but you come up holding {item}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'The plant snaps shut. You pull free empty-handed and badly burned.' },
            ] },
            { label: 'Cut a path around it', effect: { healPct: -0.05 }, resultText: 'Thorny vines tear at everyone on the long way round.' },
        ],
    },

    {
        id: 'vd_fruit_grove',
        title: 'Bursting Grove',
        text: 'A grove heavy with ripe fruit that no bestiary has a name for. Bioluminescent flowers line the path.',
        choices: [
            { label: 'Eat your fill', effect: { healPct: 1 }, resultText: 'Sweet and strange. Everyone feels whole again.' },
            { label: 'Gather some to sell', effect: { gold: 45 }, resultText: 'Undocumented fruit fetches 45 gold from the right buyer.' },
        ],
    },
];
