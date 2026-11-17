// Realms: the places a run's acts are set in, after the realms of Rifthold.
//
// Realms come in chains (CHAINS) of one realm per tier, getting deeper and more dangerous:
// the Crystal Caverns run Crystal Caves (tier 1), Crystal Mines (2), Crystal Depths (3).
// ACT_REALMS lists the realms each act can be set in, and each run picks one per act at
// random (rollRealms), never two from the same chain. A realm's fights are tuned for the act
// it appears in (actOf). A realm in no act's list is folded into the listed realm of its
// chain (realmSources): its fights, retuned for that act, and its events join the listed
// realm's, and its fights keep their own look and maps.
//
// The realm decides the act's name, its enemies (data/encounters.js), the events met on '?'
// nodes (data/events.js) and how battle maps look.
//
// realm: { id, chain, tier, name, blurb, look, maps, bosses? }
//   blurb  One or two sentences shown when the act starts and in the map sidebar
//   look   { blocks, sky, mapBg }
//            blocks  Material swaps for battle maps (see lookType in tactical/tile-render.js).
//                    Only appearance changes: the map plays exactly as authored, and each
//                    swap is to a material with the same rules (tests/run/realms.test.mjs).
//            sky     Battle view background color
//            mapBg   Act map background color
//   maps   Battle map ids (tactical/data/maps) fights in this realm pick from
//   bosses Boss encounter ids the act ends with, from the realm or the realms folded into it.
//          An act ends at the heart of its realm, so these are the ones that belong there.
//          Unset: every boss of the realm and those folded into it.
import { MAP_DATA } from '../../tactical/data/maps/index.js';

export const CHAINS = {
    wild_frontiers:  { name: 'The Wild Frontiers', realms: ['wild_frontiers'] },
    verdant_wilds:   { name: 'Verdant Wilds',      realms: ['verdant_depths', 'fungal_hollows', 'primeval_canopy'] },
    crystal_caverns: { name: 'Crystal Caverns',    realms: ['crystal_caves', 'crystal_mines', 'crystal_depths'] },
    university_ruins:{ name: 'University Ruins',   realms: ['arcane_library', 'ancient_university', 'abandoned_laboratory'] },
    the_abyss:       { name: 'The Abyss',          realms: ['shadow_realm', 'void_abyss', 'oblivion_rift'] },
    the_void_pact:   { name: 'The Void Pact',      realms: ['void_hollow', 'void_sanctum', 'void_heart'] },
    the_kingdom:     { name: 'The Kingdom',        realms: ['kingdom_outskirts', 'crusader_barracks', 'palace_fortress'] },
    the_unraveling:  { name: 'The Unraveling',     realms: ['fracture_gate', 'shifting_labyrinth', 'unraveling_core'] },
};

const OUTDOOR = ['crossroads', 'mountain_pass', 'river_ford', 'volcano_plateau', 'ruined_temple'];

const REALM_LIST = [
    // ---- The Wild Frontiers ----
    {
        id: 'wild_frontiers', name: 'The Wild Frontiers',
        blurb: 'Untouched wilderness, much like the lands the settlement was founded on. Beasts roam freely, and bandit camps have spread as the Crusade pushes more people from their homes.',
        look: { sky: '#1a2a3a', mapBg: '#1d2a33', blocks: { grass: [['grass', 5], ['moss', 1]] } },
        maps: OUTDOOR,
        bosses: ['boss_bandit_king', 'boss_dire_wolf'],
    },

    // ---- Verdant Wilds ----
    {
        id: 'verdant_depths', name: 'Verdant Depths',
        blurb: 'A vast jungle no one has ever settled, its plants and animals missing from even the most complete bestiaries. The trees grow taller the further in you travel.',
        look: { sky: '#163024', mapBg: '#1b3324', blocks: { grass: [['moss', 3], ['grass', 1]], dirt: [['dirt', 2], ['verdant_tile', 1]], wall: 'hedge', rubble: 'rubble' } },
        maps: ['jungle_ruins', 'river_ford', 'crossroads', 'mountain_pass'],
        bosses: ['boss_thorn_warden', 'boss_ancient_treant'],
    },
    {
        id: 'fungal_hollows', name: 'Fungal Hollows',
        blurb: 'Jungle overrun by fungal growth. The trees rot away into clearings of gigantic mushrooms under a foggy purple haze, and fungal horrors poison any who linger.',
        look: { sky: '#26182e', mapBg: '#2a1d33', blocks: { grass: [['fungal', 3], ['swamp', 2]], moss: [['fungal', 3], ['swamp', 2]], dirt: 'swamp', wall: 'hedge', water: 'bog' } },
        maps: ['jungle_ruins', 'river_ford', 'volcano_plateau', 'crossroads'],
    },
    {
        id: 'primeval_canopy', name: 'Primeval Canopy',
        blurb: 'The deepest jungle, where the canopy blocks nearly all light and the snarls of beasts echo through the foliage. At its center, the withered Heartwood spreads spores through its roots.',
        look: { sky: '#102418', mapBg: '#16291c', blocks: { grass: [['moss', 3], ['swamp', 1], ['fungal', 1]], moss: [['moss', 3], ['swamp', 1], ['fungal', 1]], dirt: [['dirt', 1], ['verdant_tile', 1]], wall: 'hedge', water: 'bog' } },
        maps: ['jungle_ruins', 'river_ford', 'mountain_pass', 'ruined_temple'],
    },

    // ---- Crystal Caverns ----
    {
        id: 'crystal_caves', name: 'Crystal Caves',
        blurb: 'A maze of tunnels full of great crystal deposits and little else, if you can stomach a tight squeeze. There is no sign of an entrance, only a way down.',
        look: { sky: '#161c2c', mapBg: '#1b2235', blocks: { grass: [['stone', 4], ['crystal_floor', 1]], dirt: 'gravel_path', wall: 'crystal', water: 'water' } },
        maps: ['crystal_grotto', 'mountain_pass', 'volcano_plateau', 'crossroads'],
        bosses: ['boss_crystal_warden', 'boss_crystal_colossus'],
    },
    {
        id: 'crystal_mines', name: 'Crystal Mines',
        blurb: 'Long-abandoned mine tunnels, livelier than the caves. Crystal-infused beasts and forgotten mining golems still roam the shafts.',
        look: { sky: '#1c1a24', mapBg: '#211f2c', blocks: { grass: [['stone', 3], ['gravel_path', 1]], dirt: 'planks', wall: [['stone_wall', 2], ['crystal', 1]], rubble: 'rubble' } },
        maps: ['crystal_grotto', 'mountain_pass', 'ruined_temple', 'crossroads'],
    },
    {
        id: 'crystal_depths', name: 'Crystal Depths',
        blurb: 'Vast chambers coated in crystal that glows and pulses with life, the brightest part of the caverns. Its source lies at the heart of the depths.',
        look: { sky: '#18264a', mapBg: '#1d2b4c', blocks: { grass: [['crystal_floor', 3], ['stone', 1]], dirt: 'crystal_floor', wall: 'crystal' } },
        maps: ['crystal_grotto', 'volcano_plateau', 'mountain_pass', 'ruined_temple'],
    },

    // ---- University Ruins ----
    {
        id: 'arcane_library', name: 'Arcane Library',
        blurb: 'An abandoned library of arcane knowledge, swept by brooms that move on their own. Its magical keepers treat every visitor as an intruder.',
        look: { sky: '#241c18', mapBg: '#2b221d', blocks: { grass: [['marble', 3], ['carpet', 1]], dirt: 'planks', wall: 'bookshelf', stone_wall: 'bookshelf' } },
        maps: ['grand_hall', 'ruined_temple', 'crossroads'],
        bosses: ['boss_arcane_sentinel', 'boss_arcane_construct'],
    },
    {
        id: 'ancient_university', name: 'Ancient University',
        blurb: 'Once the cutting edge of magical research, now ruins garrisoned by Crusaders. A few halls stand sealed, holding secrets even the Crusaders won\'t touch.',
        look: { sky: '#1e2230', mapBg: '#232838', blocks: { grass: [['grass', 2], ['marble', 1]], dirt: 'cobble', wall: [['brick_wall', 2], ['bookshelf', 1]] } },
        maps: ['grand_hall', 'ruined_temple', 'crossroads', 'river_ford'],
    },
    {
        id: 'abandoned_laboratory', name: 'Abandoned Laboratory',
        blurb: 'A laboratory trapped in time, its halls twisting in ways the building\'s outside can\'t explain. Forms of pure chaos guard the research within.',
        look: { sky: '#1e1830', mapBg: '#251d38', blocks: { grass: [['marble', 3], ['cobble', 1]], dirt: 'glyph', carpet: 'glyph', wall: [['warded_wall', 1], ['brick_wall', 1]], stone_wall: 'warded_wall', water: 'bog', lava: 'bog' } },
        maps: ['grand_hall', 'ruined_temple', 'crystal_grotto'],
    },

    // ---- The Abyss ----
    {
        id: 'shadow_realm', name: 'Abyss Gate',
        blurb: 'A chasm into the world\'s abyssal depths. Shadowy monsters and plant-like eyes stalk the narrow ledges, harmless only at a distance.',
        look: { sky: '#140f1e', mapBg: '#1c1528', blocks: { grass: [['stone', 2], ['abyss_tile', 1]], dirt: 'redrock', wall: 'abyss_wall', water: 'void_water' } },
        maps: ['mountain_pass', 'sunken_isles', 'volcano_plateau', 'crossroads'],
    },
    {
        id: 'void_abyss', name: 'Sunken Abyss',
        blurb: 'An underground ocean dotted with rocky islands, lit by spectral shades. Bug-like creatures thrive in the ramshackle homes of the isles.',
        look: { sky: '#101a2a', mapBg: '#16213a', blocks: { grass: [['sand', 1], ['stone', 2]], dirt: 'planks', wall: 'abyss_wall', water: 'void_water' } },
        maps: ['sunken_isles', 'river_ford', 'volcano_plateau'],
        bosses: ['boss_gloom_sentinel', 'boss_oblivion_sovereign'],
    },
    {
        id: 'oblivion_rift', name: 'Oblivion Rift',
        blurb: 'Where the abyssal ocean plunges over a vast waterfall into blackness. Beyond the rift gate stands a castle of black stone, home to the master of the abyss.',
        look: { sky: '#0e0a18', mapBg: '#191226', blocks: { grass: 'abyss_tile', marble: 'abyss_tile', sand: 'stone', dirt: 'stone', wall: 'void_wall', stone_wall: 'void_wall', bookshelf: 'void_wall', water: 'void_water' } },
        maps: ['sunken_isles', 'ruined_temple', 'grand_hall'],
    },

    // ---- The Void Pact ----
    {
        id: 'void_hollow', name: 'Void Hollow',
        blurb: 'A place darker than the pits of the abyss, where the air swallows lantern light within a few paces. The only way forward is to find a wall and follow it.',
        look: { sky: '#0c0c14', mapBg: '#16162a', blocks: { grass: [['stone', 2], ['abyss_tile', 1]], dirt: 'abyss_tile', wall: 'void_wall', water: 'void_water' } },
        maps: ['crossroads', 'mountain_pass', 'ruined_temple'],
    },
    {
        id: 'void_sanctum', name: 'Void Sanctum',
        blurb: 'A structure of smooth black stone, like a solid block of the void. Its prisoners guard it viciously, paying off their debts for the rest of time.',
        look: { sky: '#120e1c', mapBg: '#1b1528', blocks: { grass: 'abyss_tile', marble: 'abyss_tile', carpet: 'cobble', dirt: 'cobble', wall: 'void_wall', stone_wall: 'void_wall', bookshelf: 'void_wall', water: 'void_water' } },
        maps: ['grand_hall', 'ruined_temple', 'crossroads'],
        bosses: ['boss_hollow_abbot', 'boss_void_arbiter'],
    },
    {
        id: 'void_heart', name: 'Void Heart',
        blurb: 'The heart of the Void. Its penitents are nothing but skin and bone now, remade into better tools for their creditor.',
        look: { sky: '#160c22', mapBg: '#20142e', blocks: { grass: [['abyss_tile', 3], ['glyph', 1]], marble: 'abyss_tile', sand: 'abyss_tile', carpet: 'glyph', dirt: 'glyph', wall: 'warded_wall', stone_wall: 'warded_wall', bookshelf: 'void_wall', water: 'void_water' } },
        maps: ['grand_hall', 'sunken_isles', 'ruined_temple'],
    },

    // ---- The Kingdom ----
    {
        id: 'kingdom_outskirts', name: 'Kingdom Outskirts',
        blurb: 'Cleared forests and farmland at the edge of the human kingdoms. Soldiers patrol the roads, making a peaceful journey to the castle gates nearly impossible.',
        look: { sky: '#1c2a3c', mapBg: '#203043', blocks: { grass: [['grass', 3], ['autumn', 1]], dirt: 'gravel_path', wall: 'stone_wall' } },
        maps: ['crossroads', 'river_ford', 'mountain_pass', 'volcano_plateau'],
    },
    {
        id: 'crusader_barracks', name: 'Crusader Barracks',
        blurb: 'The training grounds of the Crusader forces, stocked with weapons and armor. Only a small reserve stands guard, and the barracks are the only way into the castle.',
        look: { sky: '#22222c', mapBg: '#292a36', blocks: { grass: [['cobble', 2], ['dirt', 1]], marble: 'cobble', dirt: 'planks', wall: [['kingdom_wall', 2], ['wood_wall', 1]], bookshelf: 'wood_wall', stone_wall: 'kingdom_wall' } },
        maps: ['crossroads', 'grand_hall', 'ruined_temple'],
    },
    {
        id: 'palace_fortress', name: 'Palace Fortress',
        blurb: 'A grand fortress within the castle walls, filled with wards and traps disguised as miracles. White-robed priests and the king\'s own guard patrol its halls.',
        look: { sky: '#2a2420', mapBg: '#302922', blocks: { grass: [['marble', 3], ['carpet', 1]], dirt: 'brick', wall: 'kingdom_wall', stone_wall: 'kingdom_wall' } },
        maps: ['grand_hall', 'ruined_temple', 'crossroads'],
        bosses: ['boss_high_king', 'boss_high_priest'],
    },

    // ---- The Unraveling ----
    {
        id: 'fracture_gate', name: 'Fracture Gate',
        blurb: 'A gate to a fractured realm where every step shifts the walls and floors. Its creatures contort with no true form, sometimes wearing faces you almost recognize.',
        look: { sky: '#241634', mapBg: '#2b1c3c', blocks: { grass: [['grass', 3], ['glyph', 1]], dirt: 'redrock', wall: [['warded_wall', 1], ['wall', 2]] } },
        maps: [...OUTDOOR],
    },
    {
        id: 'shifting_labyrinth', name: 'Shifting Labyrinth',
        blurb: 'The chaos grows stronger and the shifting walls become a labyrinth. One moment a creature looks like a person, the next an animal, the next something else entirely.',
        look: {
            sky: '#20183a', mapBg: '#281e40',
            blocks: {
                grass: [['cobble', 2], ['moss', 2], ['marble', 1], ['abyss_tile', 1]],
                moss: [['moss', 2], ['cobble', 1], ['abyss_tile', 1]],
                marble: [['marble', 2], ['moss', 1], ['cobble', 1]],
                dirt: [['planks', 1], ['brick', 1]],
                wall: [['stone_wall', 2], ['hedge', 1], ['bookshelf', 1], ['warded_wall', 1]],
                stone_wall: [['stone_wall', 2], ['hedge', 1], ['bookshelf', 1]],
            },
        },
        maps: [...OUTDOOR, 'grand_hall', 'jungle_ruins'],
        bosses: ['boss_shifting_horror', 'boss_unraveler'],
    },
    {
        id: 'unraveling_core', name: 'Unraveling Core',
        blurb: 'A core of pure chaos where the world changes at a moment\'s notice. A gargantuan eye floats at its center, harvesting the core\'s energy.',
        look: {
            sky: '#2a1238', mapBg: '#301a40',
            blocks: {
                grass: [['glyph', 2], ['abyss_tile', 2], ['crystal_floor', 1]],
                stone: [['abyss_tile', 2], ['glyph', 1], ['stone', 1]],
                sand: [['abyss_tile', 1], ['glyph', 1]],
                marble: [['glyph', 1], ['abyss_tile', 1]],
                dirt: 'crystal_floor',
                wall: [['warded_wall', 2], ['void_wall', 1], ['crystal', 1]],
                stone_wall: [['warded_wall', 1], ['void_wall', 1]],
                water: 'void_water',
                lava: 'void_water',
            },
        },
        maps: ['crystal_grotto', 'sunken_isles', 'grand_hall', 'volcano_plateau'],
    },
];

for (const [chain, def] of Object.entries(CHAINS)) {
    def.realms.forEach((id, i) => {
        const r = REALM_LIST.find(x => x.id === id);
        r.chain = chain;
        r.tier = i + 1;
    });
}

export const REALMS = Object.fromEntries(REALM_LIST.map(r => [r.id, r]));

// The realms each act can be set in.
export const ACT_REALMS = {
    1: ['wild_frontiers', 'verdant_depths', 'crystal_caves'],
    2: ['arcane_library', 'void_abyss', 'void_sanctum'],
    3: ['palace_fortress', 'shifting_labyrinth'],
};

/** The act a realm's fights are tuned for: the act that uses it, else its tier. */
export function actOf(realmId) {
    for (const [act, ids] of Object.entries(ACT_REALMS)) if (ids.includes(realmId)) return Number(act);
    return REALMS[realmId]?.tier ?? 1;
}

/**
 * The realms whose fights and events an act realm draws on: itself first, then the realms
 * of its chain that no act lists. An unlisted realm is folded into the listed realm of its
 * chain, so Crystal Caves also brings in Crystal Mines and Crystal Depths, retuned for act 1
 * (see retuneEncounter in data/encounters.js). A realm that isn't listed draws only on itself.
 */
export function realmSources(realmId) {
    const realm = REALMS[realmId];
    if (!realm) return [];
    const listed = new Set(Object.values(ACT_REALMS).flat());
    if (!listed.has(realmId)) return [realmId];
    return [realmId, ...CHAINS[realm.chain].realms.filter(id => id !== realmId && !listed.has(id))];
}

/**
 * The realm for each act of a run: one of ACT_REALMS[act] per act, each from a different
 * chain. `acts` is the number of acts.
 */
export function rollRealms(rng, acts) {
    const used = new Set();
    const out = [];
    for (let act = 1; act <= acts; act++) {
        const options = ACT_REALMS[act].filter(id => !used.has(REALMS[id].chain));
        const id = rng.pick(options.length ? options : ACT_REALMS[act]);
        used.add(REALMS[id].chain);
        out.push(id);
    }
    return out;
}

/** The realm's look for battle maps (map.look), or null. */
export function realmLook(realmId) {
    return REALMS[realmId]?.look ?? null;
}

/**
 * A battle map definition for a fight in `realmId`: one of the realm's maps at random,
 * or any map when the realm has none that exist. `random` returns [0, 1).
 */
export function pickRealmMap(realmId, random = Math.random) {
    const ids = REALMS[realmId]?.maps ?? [];
    const pool = MAP_DATA.filter(m => ids.includes(m.id));
    const list = pool.length ? pool : MAP_DATA;
    return list[Math.floor(random() * list.length)];
}
