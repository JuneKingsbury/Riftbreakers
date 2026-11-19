// Sunken Abyss: tier 2 of The Abyss.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'void_abyss', name: 'Sunken Abyss',
    blurb: 'An underground ocean dotted with rocky islands, lit by spectral shades. Bug-like creatures thrive in the ramshackle homes of the isles.',
    look: { sky: '#101a2a', mapBg: '#16213a', blocks: { grass: [['sand', 1], ['stone', 2]], dirt: 'planks', wall: 'abyss_wall', water: 'void_water' } },
    maps: ['sunken_isles', 'river_ford', 'volcano_plateau'],
    bosses: ['boss_gloom_sentinel', 'boss_oblivion_sovereign'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['shadow_realm', 'oblivion_rift'],
};

export const encounters = {
    normal: [
        fight('island_dwellers', 'Island Dwellers', 2, [
            e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
            e('goblin', 'Shadow Imp', null, { statMods: { maxHp: 8 } }),
            e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
            e('raider_archer', 'Isle Hunter', 'void_stalker'),
            e('goblin', 'Shadow Imp', null, { statMods: { maxHp: 8 } }),
            e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
        ]),
        fight('spectral_shades', 'Spectral Shades', 2, [
            e('shadow_mage', 'Shade', 'shade'),
            e('spectral_wisp', 'Sea Spirit', 'ghost'),
            e('shadow_mage', 'Shade', 'shade'),
            e('spectral_wisp', 'Sea Spirit', 'ghost'),
            e('void_stalker', 'Void Stalker'),
            e('spectral_wisp', 'Sea Spirit', 'ghost'),
        ]),
        fight('oblivion_brood', 'Oblivion Brood', 3, [
            e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
            e('void_stalker', 'Void Stalker'),
            e('shard_spider', 'Abyssal Crawler', 'void_horror'),
            e('void_stalker', 'Void Stalker'),
            e('shard_spider', 'Abyssal Crawler', 'void_horror'),
            e('shadow_mage', 'Shade', 'shade'),
        ]),
        fight('leech_shallows', 'Leech Shallows', 2, [
            e('abyssal_leech', 'Abyssal Leech', 'void_horror', { tint: '#a0e0c0' }),
            e('shard_spider', 'Abyssal Crawler', 'void_horror', { statMods: { maxHp: 8 } }),
            e('abyssal_leech', 'Abyssal Leech', 'void_horror', { tint: '#a0e0c0' }),
            e('raider_archer', 'Isle Hunter', 'void_stalker'),
            e('goblin', 'Shadow Imp', null, { statMods: { maxHp: 8 } }),
        ]),
    ],
    elite: [
        fight('void_horrors', 'Void Horrors', 3, [
            e('orc_captain', 'Void Horror', 'void_horror', { extraAbilities: ['shadow_bolt'], statMods: { maxMp: 30 } }),
            e('void_stalker', 'Void Stalker'),
            e('orc_captain', 'Void Horror', 'void_horror', { extraAbilities: ['shadow_bolt'], statMods: { maxMp: 30 } }),
            e('shadow_mage', 'Shade', 'shade'),
            e('void_stalker', 'Void Stalker'),
            e('spectral_wisp', 'Sea Spirit', 'ghost'),
        ]),
        fight('raft_raiders', 'Raft Raiders', 4, [
            e('battlemage', 'Raft Captain', 'npc_shadow_merchant'),
            e('runebow', 'Harpooner', 'raider_archer'),
            e('spiritbinder', 'Sea Witch', 'void_acolyte'),
            e('spellblade', 'Boarder', 'raider'),
            e('runebow', 'Harpooner', 'raider_archer'),
            e('spellblade', 'Boarder', 'raider'),
        ]),
    ],
    boss: [
        fight('boss_gloom_sentinel', 'The Gloom Sentinel', 4, [
            e('fatebinder', 'Gloom Sentinel', 'gloom_sentinel', { level: 5, statMods: { maxHp: 55, mat: 3, def: 3, mdf: 3 } }),
            e('orc_captain', 'Oblivion Spawn', 'oblivion_spawn'),
            e('shadow_mage', 'Shade', 'shade'),
            e('void_stalker', 'Void Stalker'),
            e('shadow_mage', 'Shade', 'shade'),
            e('shard_spider', 'Abyssal Crawler', 'void_horror'),
        ], { scouting: 'The Gloom Sentinel waits in the dark with shades and void stalkers. Its curses pile on slowly, then all at once.',
          phases: [
            { at: 0.5, name: 'Deepening Gloom', say: 'The gloom thickens. Shapes move inside it.',
              allies: { buffs: [{ stat: 'eva', value: 15, duration: 3 }] },
              summon: [e('shadow_mage', 'Shade', 'shade'), e('shadow_mage', 'Shade', 'shade')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'sa_drifting_wreck',
        title: 'Drifting Wreck',
        text: 'The remains of another expedition drift past on a broken raft, their supplies still lashed down.',
        choices: [
            { label: 'Haul it in', effect: { gold: 40, item: 'common' }, resultText: 'Waterlogged but useful: 40 gold and {item}.' },
            { label: 'Give them a burial at sea', effect: { xp: 35 }, resultText: 'A quiet moment on the black water. Everyone gains 35 XP.' },
        ],
    },

    {
        id: 'sa_isle_market',
        title: 'Isle Market',
        text: 'Bug-like islanders trade from ramshackle stalls. One offers a raft ride and a curious charm.',
        choices: [
            { label: 'Buy the charm (70 gold)', requires: { gold: 70 }, effect: { gold: -70, relic: 'uncommon' }, resultText: '{relic}. It pulses with abyssal energy, barely contained.' },
            { label: 'Ride the raft', effect: { healPct: 1 }, resultText: 'Hours of gentle drifting. Everyone recovers.' },
        ],
    },
];
