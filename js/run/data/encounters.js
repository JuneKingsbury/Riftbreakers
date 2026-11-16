// Battle encounters for each act of a run.
//
// ENCOUNTERS[act] = { name, normal: [...], elite: [...], boss: [...] }
//   encounter: { id, name, enemyLevel, roster, map? }
//     enemyLevel  Level for roster entries on player jobs (see loadout.scaledLoadout)
//     roster      [{ job, name, ct?, level?, statMods?, extraAbilities?, appearance? }] in
//                 priority order. A fight takes the first N entries, where N grows with the
//                 party (enemyCount). A boss roster lists the boss first.
//     map         Optional map id (js/tactical/data/maps); otherwise one is picked at random.
//     easy        true: gentle enough for a run's opening fights (see EASY_FIGHTS)
//
// ACT_STAT_MODS scale every enemy of an act on top of their job stats; elites add ELITE_STAT_MODS.

export const ENCOUNTERS = {
    1: {
        name: 'The Wildwood Road',
        normal: [
            { id: 'bandit_ambush', name: 'Bandit Ambush', enemyLevel: 1, roster: [
                { job: 'raider', name: 'Bandit', ct: 20 },
                { job: 'raider', name: 'Bandit', ct: 50 },
                { job: 'raider_archer', name: 'Bandit Archer', ct: 5 },
                { job: 'raider_hexer', name: 'Bandit Hexer', ct: 35 },
                { job: 'raider_archer', name: 'Bandit Archer', ct: 25 },
                { job: 'raider', name: 'Bandit', ct: 65 },
            ] },
            { id: 'wolf_pack', name: 'Wolf Pack', enemyLevel: 1, roster: [
                { job: 'wolf', name: 'Grey Wolf', ct: 20 },
                { job: 'wolf', name: 'Grey Wolf', ct: 55 },
                { job: 'boar', name: 'Wild Boar', ct: 25 },
                { job: 'wolf', name: 'Grey Wolf', ct: 35 },
                { job: 'boar', name: 'Wild Boar', ct: 60 },
                { job: 'wolf', name: 'Grey Wolf', ct: 5 },
            ] },
            { id: 'goblin_raid', name: 'Goblin Raid', enemyLevel: 1, easy: true, roster: [
                { job: 'goblin', name: 'Goblin', ct: 10 },
                { job: 'goblin', name: 'Goblin', ct: 40 },
                { job: 'goblin', name: 'Goblin', ct: 60 },
                { job: 'raider_archer', name: 'Goblin Slinger', ct: 30 },
                { job: 'goblin', name: 'Goblin', ct: 20 },
                { job: 'goblin', name: 'Goblin', ct: 50 },
            ] },
            { id: 'spore_hollow', name: 'Spore Hollow', enemyLevel: 1, easy: true, roster: [
                { job: 'spore_walker', name: 'Spore Walker', ct: 10 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 40 },
                { job: 'wolf', name: 'Marsh Wolf', ct: 20 },
                { job: 'spore_walker', name: 'Spore Walker', ct: 60 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 30 },
                { job: 'wolf', name: 'Marsh Wolf', ct: 55 },
            ] },
            { id: 'deserters', name: 'Deserters', enemyLevel: 1, easy: true, roster: [
                { job: 'novice', name: 'Deserter', ct: 15 },
                { job: 'raider_archer', name: 'Deserter Archer', ct: 40 },
                { job: 'evoker', name: 'Hedge Mage', ct: 30 },
                { job: 'novice', name: 'Deserter', ct: 55 },
                { job: 'raider', name: 'Sellsword', ct: 25 },
                { job: 'novice', name: 'Deserter', ct: 5 },
            ] },
        ],
        elite: [
            { id: 'thornwood_stalkers', name: 'Thornwood Stalkers', enemyLevel: 2, roster: [
                { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 20, statMods: { atk: -3 } },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 45 },
                { job: 'boar', name: 'Thornboar', ct: 5 },
                { job: 'wolf', name: 'Thornwood Wolf', ct: 35 },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 10 },
                { job: 'canopy_stalker', name: 'Thornwood Cat', ct: 55 },
            ] },
            { id: 'raider_warband', name: 'Raider Warband', enemyLevel: 2, roster: [
                { job: 'orc_captain', name: 'Raid Leader', ct: 20 },
                { job: 'raider_hexer', name: 'Raider Hexer', ct: 35 },
                { job: 'raider_archer', name: 'Raider Archer', ct: 5 },
                { job: 'raider', name: 'Raider', ct: 50 },
                { job: 'raider_archer', name: 'Raider Archer', ct: 25 },
                { job: 'raider', name: 'Raider', ct: 65 },
            ] },
        ],
        boss: [
            { id: 'boss_bandit_king', name: 'The Bandit King', enemyLevel: 2, roster: [
                { job: 'orc_captain', name: 'Bandit King', ct: 30, statMods: { maxHp: 40, atk: 3, def: 2, spd: 1 } },
                { job: 'raider_archer', name: 'Royal Archer', ct: 10 },
                { job: 'raider_hexer', name: 'Court Hexer', ct: 40 },
                { job: 'raider', name: 'Bodyguard', ct: 20 },
                { job: 'raider', name: 'Bodyguard', ct: 50 },
            ] },
            { id: 'boss_alpha', name: 'The Alpha', enemyLevel: 2, roster: [
                { job: 'canopy_stalker', name: 'Alpha Stalker', ct: 30, statMods: { maxHp: 50, atk: 3, def: 3 } },
                { job: 'wolf', name: 'Pack Wolf', ct: 10 },
                { job: 'wolf', name: 'Pack Wolf', ct: 40 },
                { job: 'boar', name: 'Old Tusk', ct: 20 },
                { job: 'wolf', name: 'Pack Wolf', ct: 55 },
            ] },
        ],
    },
    2: {
        name: 'The Hollow Fens',
        normal: [
            { id: 'fen_spirits', name: 'Fen Spirits', enemyLevel: 2, roster: [
                { job: 'spectral_wisp', name: 'Marsh Spirit', ct: 5 },
                { job: 'spore_walker', name: 'Fen Walker', ct: 15 },
                { job: 'shard_spider', name: 'Fen Spider', ct: 30 },
                { job: 'spectral_wisp', name: 'Marsh Spirit', ct: 40 },
                { job: 'spore_walker', name: 'Fen Walker', ct: 50 },
                { job: 'shard_spider', name: 'Fen Spider', ct: 55 },
            ] },
            { id: 'hollow_cult', name: 'Hollow Cult', enemyLevel: 3, roster: [
                { job: 'shadow_mage', name: 'Cultist', ct: 30 },
                { job: 'void_walker', name: 'Void Wraith', ct: 20 },
                { job: 'raider', name: 'Zealot', ct: 10 },
                { job: 'spectral_wisp', name: 'Lost Soul', ct: 40 },
                { job: 'void_walker', name: 'Void Wraith', ct: 5 },
                { job: 'shadow_mage', name: 'Cultist', ct: 55 },
            ] },
            { id: 'rogue_mages', name: 'Rogue Mages', enemyLevel: 3, roster: [
                { job: 'evoker', name: 'Rogue Evoker', ct: 30 },
                { job: 'spellblade', name: 'Rogue Spellblade', ct: 10 },
                { job: 'warden', name: 'Rogue Warden', ct: 45 },
                { job: 'runebow', name: 'Rogue Runebow', ct: 20 },
                { job: 'stoneshaper', name: 'Rogue Stoneshaper', ct: 5 },
                { job: 'seer', name: 'Rogue Seer', ct: 55 },
            ] },
            { id: 'spider_nest', name: 'Spider Nest', enemyLevel: 2, roster: [
                { job: 'shard_spider', name: 'Shard Spider', ct: 10 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 35 },
                { job: 'canopy_stalker', name: 'Web Stalker', ct: 20 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 50 },
                { job: 'spore_walker', name: 'Egg Tender', ct: 60 },
                { job: 'shard_spider', name: 'Shard Spider', ct: 25 },
            ] },
            { id: 'bog_beasts', name: 'Bog Beasts', enemyLevel: 2, roster: [
                { job: 'boar', name: 'Bog Boar', ct: 20 },
                { job: 'thorn_beast', name: 'Mire Beast', ct: 40 },
                { job: 'wolf', name: 'Fen Wolf', ct: 10 },
                { job: 'boar', name: 'Bog Boar', ct: 55 },
                { job: 'thorn_beast', name: 'Mire Beast', ct: 5 },
                { job: 'wolf', name: 'Fen Wolf', ct: 30 },
            ] },
        ],
        elite: [
            { id: 'chapel_guardians', name: 'Chapel Guardians', enemyLevel: 3, roster: [
                { job: 'shadow_mage', name: 'Chapel Shade', ct: 40 },
                { job: 'void_walker', name: 'Void Wraith', ct: 25 },
                { job: 'kingdom_guard', name: 'Fallen Knight', ct: 15 },
                { job: 'spectral_wisp', name: 'Lost Soul', ct: 10 },
                { job: 'void_walker', name: 'Void Wraith', ct: 5 },
                { job: 'spectral_wisp', name: 'Lost Soul', ct: 60 },
            ] },
            { id: 'mage_hunters', name: 'Mage Hunters', enemyLevel: 4, roster: [
                { job: 'battlemage', name: 'Hunter Captain', ct: 20 },
                { job: 'runebow', name: 'Hunter Archer', ct: 10 },
                { job: 'spellblade', name: 'Hunter Blade', ct: 35 },
                { job: 'warden', name: 'Hunter Medic', ct: 50 },
                { job: 'runebow', name: 'Hunter Archer', ct: 45 },
                { job: 'spellblade', name: 'Hunter Blade', ct: 5 },
            ] },
        ],
        boss: [
            { id: 'boss_bog_witch', name: 'The Bog Witch', enemyLevel: 4, roster: [
                { job: 'worldsinger', name: 'Bog Witch', ct: 30, level: 5, statMods: { maxHp: 50, mat: 3, mdf: 3 } },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 10 },
                { job: 'spore_walker', name: 'Spore Walker', ct: 40 },
                { job: 'spectral_wisp', name: 'Bound Spirit', ct: 20 },
                { job: 'thorn_beast', name: 'Thorn Beast', ct: 50 },
                { job: 'spore_walker', name: 'Spore Walker', ct: 60 },
            ] },
            { id: 'boss_hollow_abbot', name: 'The Hollow Abbot', enemyLevel: 4, roster: [
                { job: 'fatebinder', name: 'Hollow Abbot', ct: 30, level: 5, statMods: { maxHp: 50, mat: 3, mdf: 3 } },
                { job: 'kingdom_guard', name: 'Fallen Knight', ct: 15 },
                { job: 'kingdom_guard', name: 'Fallen Knight', ct: 45 },
                { job: 'shadow_mage', name: 'Acolyte', ct: 25 },
                { job: 'spectral_wisp', name: 'Lost Soul', ct: 5 },
                { job: 'shadow_mage', name: 'Acolyte', ct: 55 },
            ] },
        ],
    },
    3: {
        name: 'The Riftscar',
        normal: [
            { id: 'rift_crawlers', name: 'Rift Crawlers', enemyLevel: 4, roster: [
                { job: 'void_stalker', name: 'Rift Crawler', ct: 10 },
                { job: 'void_walker', name: 'Void Walker', ct: 25 },
                { job: 'void_stalker', name: 'Rift Crawler', ct: 50 },
                { job: 'shadow_mage', name: 'Hollow Mage', ct: 40 },
                { job: 'void_stalker', name: 'Rift Crawler', ct: 35 },
                { job: 'void_walker', name: 'Void Walker', ct: 60 },
            ] },
            { id: 'citadel_patrol', name: 'Citadel Patrol', enemyLevel: 5, roster: [
                { job: 'kingdom_guard', name: 'Citadel Guard', ct: 20 },
                { job: 'raider_archer', name: 'Citadel Archer', ct: 10 },
                { job: 'paladin', name: 'Citadel Paladin', ct: 40 },
                { job: 'kingdom_guard', name: 'Citadel Guard', ct: 50 },
                { job: 'runebow', name: 'Citadel Runebow', ct: 30 },
                { job: 'evoker', name: 'Citadel Evoker', ct: 55 },
            ] },
            { id: 'void_touched', name: 'Void-Touched', enemyLevel: 5, roster: [
                { job: 'riftcaller', name: 'Void Caller', ct: 30 },
                { job: 'void_stalker', name: 'Void Champion', ct: 5 },
                { job: 'spiritbinder', name: 'Soul Binder', ct: 45 },
                { job: 'void_walker', name: 'Void Walker', ct: 20 },
                { job: 'void_stalker', name: 'Void Champion', ct: 55 },
                { job: 'spectral_wisp', name: 'Rift Wisp', ct: 35 },
            ] },
            { id: 'rift_beasts', name: 'Rift Beasts', enemyLevel: 4, roster: [
                { job: 'canopy_stalker', name: 'Riftcat', ct: 20 },
                { job: 'boar', name: 'Rift Boar', ct: 40 },
                { job: 'beastcaller', name: 'Beast Lord', ct: 30 },
                { job: 'canopy_stalker', name: 'Riftcat', ct: 55 },
                { job: 'wolf', name: 'Rift Wolf', ct: 10 },
                { job: 'boar', name: 'Rift Boar', ct: 5 },
            ] },
        ],
        elite: [
            { id: 'riftscar_wardens', name: 'Riftscar Wardens', enemyLevel: 6, roster: [
                { job: 'orc_captain', name: 'Rift Warden', ct: 20 },
                { job: 'earthshaker', name: 'Rift Geomancer', ct: 35 },
                { job: 'void_stalker', name: 'Rift Stalker', ct: 45 },
                { job: 'lifeseer', name: 'Rift Oracle', ct: 50 },
                { job: 'void_stalker', name: 'Rift Stalker', ct: 10 },
                { job: 'raider_hexer', name: 'Rift Hexer', ct: 60 },
            ] },
            { id: 'royal_inquisitors', name: 'Royal Inquisitors', enemyLevel: 6, roster: [
                { job: 'sanctifier', name: 'Inquisitor', ct: 30 },
                { job: 'paladin', name: 'Templar', ct: 15 },
                { job: 'battlemage', name: 'Witch Hunter', ct: 25 },
                { job: 'kingdom_guard', name: 'Royal Guard', ct: 45 },
                { job: 'fatebinder', name: 'Confessor', ct: 55 },
                { job: 'kingdom_guard', name: 'Royal Guard', ct: 5 },
            ] },
        ],
        boss: [
            { id: 'boss_void_herald', name: 'The Void Herald', enemyLevel: 6, roster: [
                { job: 'riftcaller', name: 'Void Herald', ct: 30, level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } },
                { job: 'void_stalker', name: 'Void Champion', ct: 10 },
                { job: 'void_stalker', name: 'Void Champion', ct: 45 },
                { job: 'void_walker', name: 'Void Walker', ct: 20 },
                { job: 'shadow_mage', name: 'Void Sorcerer', ct: 55 },
                { job: 'void_walker', name: 'Void Walker', ct: 35 },
            ] },
        ],
    },
};

export const ACT_COUNT = 3;

export const ACT_STAT_MODS = {
    1: { maxHp: -4, atk: -1 },
    2: { maxHp: 22, atk: 5, def: 3, mat: 5, mdf: 3 },
    3: { maxHp: 32, atk: 7, def: 4, mat: 7, mdf: 4, spd: 1 },
};

export const ELITE_STAT_MODS = { maxHp: 4 };

// Gold and the XP every member earns, by encounter kind.
export function battleRewards(kind, act) {
    switch (kind) {
        case 'boss':  return { gold: 100 + 30 * act, xp: 80 + 20 * act, itemChoices: 3, relic: true };
        case 'elite': return { gold: 55 + 15 * act, xp: 55 + 10 * act, itemChoices: 3, relic: true };
        default:      return { gold: 25 + 10 * act, xp: 35 + 5 * act,  itemChoices: 3, relic: false };
    }
}

// How many enemies a fight brings for a party of `partySize`: one more for elites (from
// act 2) and bosses. The first EASY_FIGHTS normal fights of a run bring one fewer.
export const EASY_FIGHTS = 2;
export function enemyCount(kind, partySize, easy = false, act = 1) {
    if (easy) return Math.max(2, partySize - 1);
    const delta = kind === 'boss' || (kind === 'elite' && act > 1) ? 1 : 0;
    return Math.max(3, Math.min(6, partySize + delta));
}

function addMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

// A concrete battle for the run: the encounter with its roster cut to size and
// act scaling folded into every entry's statMods.
//   kind: 'normal' | 'elite' | 'boss'
export function buildEncounter(def, kind, act, partySize, easy = false) {
    const roster = def.roster.slice(0, enemyCount(kind, partySize, easy, act));
    const scale = addMods(ACT_STAT_MODS[act], kind === 'elite' ? ELITE_STAT_MODS : null);
    return {
        id: def.id,
        name: def.name,
        kind,
        act,
        enemyLevel: def.enemyLevel,
        map: def.map ?? null,
        roster: roster.map(r => ({ ...r, statMods: addMods(scale, r.statMods) })),
    };
}

// Picks an encounter of `kind` for the act, avoiding ids in `seen` while others remain.
export function rollEncounter(rng, act, kind, partySize, seen = [], easy = false) {
    const all = ENCOUNTERS[act][kind];
    const gentle = all.filter(e => e.easy);
    const pool = easy && gentle.length ? gentle : all;
    const fresh = pool.filter(e => !seen.includes(e.id));
    return buildEncounter(rng.pick(fresh.length ? fresh : pool), kind, act, partySize, easy);
}
