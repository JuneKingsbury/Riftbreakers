// Ancient University: tier 2 of University Ruins.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'ancient_university', name: 'Ancient University',
    blurb: 'Once the cutting edge of magical research, now ruins garrisoned by Crusaders. A few halls stand sealed, holding secrets even the Crusaders won\'t touch.',
    look: { sky: '#1e2230', mapBg: '#232838', blocks: { grass: [['grass', 2], ['marble', 1]], dirt: 'cobble', wall: [['brick_wall', 2], ['bookshelf', 1]] } },
    maps: ['grand_hall', 'ruined_temple', 'crossroads', 'river_ford'],
};

export const encounters = {
    normal: [
        fight('rogue_mages', 'Rogue Mages', 3, [
            e('evoker', 'Rogue Evoker', 'royal_mage'),
            e('spellblade', 'Rogue Spellblade'),
            e('warden', 'Rogue Warden'),
            e('runebow', 'Rogue Runebow'),
            e('stoneshaper', 'Rogue Stoneshaper'),
            e('seer', 'Rogue Seer'),
        ]),
        fight('crusader_occupiers', 'Crusader Occupiers', 2, [
            e('kingdom_guard', 'Crusader', 'crusader'),
            e('raider_archer', 'Crusader Archer', 'crusader_archer'),
            e('kingdom_guard', 'Crusader', 'crusader'),
            e('raider_hexer', 'Witch Finder', 'high_priest'),
            e('raider_archer', 'Crusader Archer', 'crusader_archer'),
            e('raider', 'Camp Guard', 'kingdom_guard'),
        ]),
        fight('runaway_constructs', 'Runaway Constructs', 2, [
            e('kingdom_guard', 'Arcane Construct', 'construct'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Scholar Golem', 'scholar_golem', { statMods: { def: -3 } }),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('kingdom_guard', 'Arcane Construct', 'construct'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ]),
    ],
    elite: [
        fight('mage_hunters', 'Mage Hunters', 4, [
            e('battlemage', 'Hunter Captain', 'crusader'),
            e('runebow', 'Hunter Archer', 'crusader_archer'),
            e('spellblade', 'Hunter Blade', 'knight'),
            e('warden', 'Hunter Medic', 'high_priest'),
            e('runebow', 'Hunter Archer', 'crusader_archer'),
            e('spellblade', 'Hunter Blade', 'knight'),
        ]),
        fight('sealed_archive', 'The Sealed Archive', 3, [
            e('orc_captain', 'Archive Construct', 'construct'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
            e('fatebinder', 'Bound Archivist', 'npc_spectral_professor'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('kingdom_guard', 'Tome Guardian', 'tome_guardian'),
        ]),
    ],
    boss: [
        fight('boss_rune_automaton', 'The Rune Automaton', 4, [
            e('battlemage', 'Rune Automaton', 'rune_automaton', { level: 5, statMods: { maxHp: 55, atk: 3, mat: 3, def: 4, mdf: 3 } }),
            e('kingdom_guard', 'Arcane Construct', 'construct'),
            e('shadow_mage', 'Spell Wraith', 'spell_wraith'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
            e('kingdom_guard', 'Arcane Construct', 'construct'),
            e('spectral_wisp', 'Arcane Wisp', 'arcane_wisp'),
        ], {
            scouting: 'The Rune Automaton was built to guard the lecture halls, and still does. Its spell wraiths and wisps keep it going, so thin them out first.',
            phases: [
                { at: 0.5, name: 'Overclock', say: 'The Rune Automaton\'s gears whine as its runes burn hot!', status: { status: 'haste', duration: 2 }, buffs: [{ stat: 'mat', value: 3, duration: 3 }] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'au_exam_vault',
        title: 'Examination Vault',
        text: 'A sealed vault still holds graded manuscripts. A student\'s old ward guards the door.',
        choices: [
            { label: 'Break the ward', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'Among the top marks: {relic}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'Lightning arcs through the party.' },
            ] },
            { label: 'Study the ward instead', effect: { xp: 40 }, resultText: 'A clever bit of work. Everyone gains 40 XP.' },
        ],
    },

    {
        id: 'au_crusader_camp',
        title: 'Crusader Encampment',
        text: 'Crusaders have turned a lecture hall into a barracks. Their supply tent is lightly watched.',
        choices: [
            { label: 'Raid the supplies', outcomes: [
                { weight: 1, effect: { gold: 50, item: 'common' }, resultText: 'You slip away with 50 gold and {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'A sentry spots you.' },
            ] },
            { label: 'Walk in wearing their colors', requires: { classes: ['illusionist'] }, effect: { gold: 50, item: 'uncommon' }, resultText: '{name} makes the party look like a relief squad. You leave with 50 gold and {item}.' },
            { label: 'Go around', resultText: 'You take the long way through the ruined gardens.' },
        ],
    },
];
