// Arcane Library: tier 1 of University Ruins.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'arcane_library', name: 'Arcane Library',
    blurb: 'An abandoned library of arcane knowledge, swept by brooms that move on their own. Its magical keepers treat every visitor as an intruder.',
    look: { sky: '#241c18', mapBg: '#2b221d', blocks: { grass: [['marble', 3], ['carpet', 1]], dirt: 'planks', wall: 'bookshelf', stone_wall: 'bookshelf' } },
    maps: ['grand_hall', 'ruined_temple', 'crossroads'],
    bosses: ['boss_arcane_sentinel', 'boss_arcane_construct'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['ancient_university', 'abandoned_laboratory'],
};

export const encounters = {
    // Written for act 2 (see WRITTEN_FOR).
    normal: [
        fight('stray_wisps', 'Wisp Swarm', 2, [
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ]),
        fight('tome_keepers', 'Tome Keepers', 2, [
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('raider_hexer', 'Ink Shade', 'shade_wraith'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ]),
        fight('restless_readers', 'Restless Readers', 3, [
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('evoker', 'Lost Scholar', 'npc_lost_scholar'),
            e('seer', 'Mad Librarian', 'npc_lost_scholar'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
        ]),
        fight('restless_tomes', 'Restless Tomes', 2, [
            e('living_tome', 'Living Tome', 'tome_guardian', { tint: '#f0e0b0' }),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('living_tome', 'Living Tome', 'tome_guardian', { tint: '#f0e0b0' }),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
        ]),
    ],
    elite: [
        fight('forbidden_stacks', 'Forbidden Stacks', 3, [
            e('orc_captain', 'Grand Tome Guardian', 'tome_guardian'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ]),
        fight('spectral_faculty', 'Spectral Faculty', 4, [
            e('lifeseer', 'Spectral Professor', 'npc_spectral_professor'),
            e('riftcaller', 'Spectral Lecturer', 'npc_spectral_professor'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('evoker', 'Spectral Lecturer', 'npc_spectral_professor'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
        ]),
    ],
    boss: [
        fight('boss_arcane_sentinel', 'The Arcane Sentinel', 4, [
            e('fatebinder', 'Arcane Sentinel', 'arcane_sentinel', { level: 5, statMods: { maxHp: 40, mat: 2, def: 2, mdf: 2 } }),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ], { scouting: 'The Arcane Sentinel reads your fate and writes a short one. Tome Guardians shield it, and wisps hover just out of reach.',
          phases: [
            { at: 0.5, name: 'Warding Glyphs', say: 'The Arcane Sentinel\'s glyphs flare: spells will turn back on their casters!',
              status: { status: 'reflect', duration: 3 }, allies: { status: { status: 'shell', duration: 3 } },
              summon: [e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'al_secret_shelf', realms: ['arcane_library', 'ancient_university'],
        title: 'Secret Shelf',
        text: 'A shelf clicks open behind two heavy tomes. Inside, a glowing codex rests on a lectern.',
        choices: [
            { label: 'Read it together', effect: { xp: 55 }, resultText: 'The pages turn themselves, and everyone who reads along gains 55 XP.' },
            { label: 'Take it', outcomes: [
                { weight: 1, effect: { item: 'uncommon' }, resultText: 'Tucked in its back cover: {item}.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'The book is warded. It shocks everyone in reach.' },
            ] },
        ],
    },

    {
        id: 'al_brooms',
        title: 'Tireless Brooms',
        text: 'Brooms sweep the halls by themselves, herding dust toward a door marked "Staff Only".',
        choices: [
            { label: 'Follow them', effect: { gold: 55, item: 'common' }, resultText: 'The staff room has a forgotten lockbox: 55 gold and {item}.' },
            { label: 'Help them sweep', effect: { healPct: 1 }, resultText: 'A quiet hour of chores. The library seems to approve. Everyone feels rested.' },
        ],
    },
];
