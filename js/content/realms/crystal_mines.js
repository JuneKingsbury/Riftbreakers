// Crystal Mines: tier 2 of Crystal Caverns.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'crystal_mines', name: 'Crystal Mines',
    blurb: 'Long-abandoned mine tunnels, livelier than the caves. Crystal-infused beasts and forgotten mining golems still roam the shafts.',
    look: { sky: '#1c1a24', mapBg: '#211f2c', blocks: { grass: [['stone', 3], ['gravel_path', 1]], dirt: 'planks', wall: [['stone_wall', 2], ['crystal', 1]], rubble: 'rubble' } },
    maps: ['crystal_grotto', 'mountain_pass', 'ruined_temple', 'crossroads'],
};

export const encounters = {
    normal: [
        fight('mining_golems', 'Mining Golems', 2, [
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('kingdom_guard', 'Miner Golem', 'miner_golem', { statMods: { def: -3, atk: 2 } }),
            e('shard_spider', 'Shard Spider'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('shard_spider', 'Shard Spider'),
            e('kingdom_guard', 'Miner Golem', 'miner_golem', { statMods: { def: -3, atk: 2 } }),
        ]),
        fight('shaft_crawlers', 'Shaft Crawlers', 2, [
            e('shard_spider', 'Shard Spider'),
            e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
            e('shard_spider', 'Shard Spider'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
            e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
        ]),
        fight('runite_surge', 'Runite Surge', 3, [
            e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('evoker', 'Runite Spark', 'arcane_wisp'),
            e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
            e('wolf', 'Crystal Bat', 'crystal_bat'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
        ]),
    ],
    elite: [
        fight('golem_foreman', 'Golem Foreman', 4, [
            e('orc_captain', 'Combat Golem', 'combat_golem', { statMods: { maxHp: 10 } }),
            e('earthshaker', 'Runite Elemental', 'runite_elemental'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('kingdom_guard', 'Miner Golem', 'miner_golem'),
            e('runebow', 'Rail Turret', 'construct'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
        ]),
        fight('claim_jumpers', 'Claim Jumpers', 3, [
            e('battlemage', 'Claim Boss', 'raider_brute'),
            e('runebow', 'Claim Sniper', 'raider_archer'),
            e('spellblade', 'Claim Cutter', 'raider'),
            e('warden', 'Claim Medic', 'npc_mercenary'),
            e('runebow', 'Claim Sniper', 'raider_archer'),
            e('spellblade', 'Claim Cutter', 'raider'),
        ]),
    ],
    boss: [
        fight('boss_runite_sentinel', 'The Runite Sentinel', 4, [
            e('paladin', 'Runite Sentinel', 'crystal_sentinel', { level: 5, statMods: { maxHp: 55, atk: 3, def: 4, mdf: 3 } }),
            e('stoneshaper', 'Runite Elemental', 'runite_elemental'),
            e('kingdom_guard', 'Crystal Golem', 'crystal_golem'),
            e('canopy_stalker', 'Crystal Beast', 'crystal_beast'),
            e('kingdom_guard', 'Miner Golem', 'miner_golem'),
            e('shard_spider', 'Shard Spider'),
        ], {
            scouting: 'The Runite Sentinel guards the deepest seam, shielded and slow. Magic does better than blades against its crystal skin.',
            phases: [
                { at: 0.5, name: 'Runite Shell', say: 'Runes flare across the Sentinel\'s body as its crystal skin thickens!', status: { status: 'protect', duration: 3 }, summon: [e('kingdom_guard', 'Miner Golem', 'miner_golem')] },
            ],
        }),
    ],
};

export const events = [
    {
        id: 'cm_trapped_miner',
        title: 'Trapped Miner',
        text: 'A voice calls from behind a collapsed tunnel. A miner, alive, pinned under a cart.',
        choices: [
            { label: 'Dig them out', effect: { healPct: -0.1, gold: 60 }, resultText: 'It takes hours. The grateful miner hands over a pouch of 60 gold.' },
            { label: 'Shape the stone aside', requires: { classes: ['stoneshaper'] }, effect: { gold: 60, xp: 20 }, resultText: '{name} lifts the rubble like a curtain. The miner pays 60 gold, and everyone gains 20 XP.' },
            { label: 'Leave them', resultText: 'Their calls fade behind you.' },
        ],
    },

    {
        id: 'cm_golem_battery', realms: ['crystal_mines', 'crystal_depths'],
        title: 'Golem Battery',
        text: 'A battery the size of a strongbox still hums with power, wired into the back of a sleeping mining golem.',
        choices: [
            { label: 'Pull the battery', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'It comes free with a spark. You now carry {relic}.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The golem\'s eyes light up.' },
            ] },
            { label: 'Disconnect it carefully', requires: { classes: ['stoneshaper', 'alchemist'] }, effect: { relic: 'uncommon' }, resultText: '{name} unhooks it wire by wire. The golem never stirs, and you carry {relic}.' },
            { label: 'Leave it sleeping', resultText: 'Some things are best left switched off.' },
        ],
    },
];
