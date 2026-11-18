// The world: every realm, grouped into chains, and which realms each act can be set in.
// Each realm has its own file (look, maps, fights, bosses and events); see js/content/README.md.
//
// To add a realm: write its file, import it here and add it to a chain. Then either make it an
// act realm (add it to ACT_REALMS, and give it `draws`), or add it to an act realm's `draws`
// so that realm fields its fights and events. The tests fail for a realm that does neither.

import * as wild_frontiers from './wild_frontiers.js';
import * as verdant_depths from './verdant_depths.js';
import * as fungal_hollows from './fungal_hollows.js';
import * as primeval_canopy from './primeval_canopy.js';
import * as crystal_caves from './crystal_caves.js';
import * as crystal_mines from './crystal_mines.js';
import * as crystal_depths from './crystal_depths.js';
import * as arcane_library from './arcane_library.js';
import * as ancient_university from './ancient_university.js';
import * as abandoned_laboratory from './abandoned_laboratory.js';
import * as shadow_realm from './shadow_realm.js';
import * as void_abyss from './void_abyss.js';
import * as oblivion_rift from './oblivion_rift.js';
import * as void_hollow from './void_hollow.js';
import * as void_sanctum from './void_sanctum.js';
import * as void_heart from './void_heart.js';
import * as kingdom_outskirts from './kingdom_outskirts.js';
import * as crusader_barracks from './crusader_barracks.js';
import * as palace_fortress from './palace_fortress.js';
import * as fracture_gate from './fracture_gate.js';
import * as shifting_labyrinth from './shifting_labyrinth.js';
import * as unraveling_core from './unraveling_core.js';

// Realm chains, one realm per tier from shallowest to deepest. A run never sets two acts in
// the same chain.
export const CHAINS = {
    wild_frontiers:   { name: 'The Wild Frontiers', realms: [wild_frontiers] },
    verdant_wilds:    { name: 'Verdant Wilds', realms: [verdant_depths, fungal_hollows, primeval_canopy] },
    crystal_caverns:  { name: 'Crystal Caverns', realms: [crystal_caves, crystal_mines, crystal_depths] },
    university_ruins: { name: 'University Ruins', realms: [arcane_library, ancient_university, abandoned_laboratory] },
    the_abyss:        { name: 'The Abyss', realms: [shadow_realm, void_abyss, oblivion_rift] },
    the_void_pact:    { name: 'The Void Pact', realms: [void_hollow, void_sanctum, void_heart] },
    the_kingdom:      { name: 'The Kingdom', realms: [kingdom_outskirts, crusader_barracks, palace_fortress] },
    the_unraveling:   { name: 'The Unraveling', realms: [fracture_gate, shifting_labyrinth, unraveling_core] },
};

// The realms each act can be set in. Each run picks one per act at random (never two from
// the same chain), so the order of a list only matters to which realm a given seed picks.
export const ACT_REALMS = {
    1: ['wild_frontiers', 'verdant_depths', 'crystal_caves'],
    2: ['arcane_library', 'void_abyss'],
    3: ['palace_fortress', 'void_sanctum'],
    4: ['shifting_labyrinth'],
};
