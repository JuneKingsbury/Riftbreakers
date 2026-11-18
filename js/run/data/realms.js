// Realms: the places a run's acts are set in, after the realms of Rifthold.
//
// Realms come in chains (CHAINS) of one realm per tier, getting deeper and more dangerous:
// the Crystal Caverns run Crystal Caves (tier 1), Crystal Mines (2), Crystal Depths (3).
// ACT_REALMS lists the realms each act can be set in, and each run picks one per act at
// random (rollRealms), never two from the same chain. A realm's fights are tuned for the act
// it appears in (actOf). An act realm's `draws` lists the realms it also fields fights and
// events from (realmSources): their fights are retuned for its act and keep their own look
// and maps.
//
// The realm decides the act's name, its enemies (data/encounters.js), the events met on '?'
// nodes (data/events.js) and how battle maps look.
//
// The realms themselves (look, maps, bosses, fights and events) are in js/content/realms/, one
// file each; realms/index.js groups them into chains and lists each act's realms. Every realm
// field is described in content/vocab.js (SCHEMAS.realm).
import { MAP_DATA } from '../../tactical/data/maps/index.js';
import { CHAINS as CHAIN_FILES, ACT_REALMS } from '../../content/realms/index.js';

export { ACT_REALMS };

// Chain id → { name, realms: [realm ids] }, shallowest first.
export const CHAINS = Object.fromEntries(Object.entries(CHAIN_FILES)
    .map(([id, c]) => [id, { name: c.name, realms: c.realms.map(mod => mod.realm.id) }]));

// Realm id → realm. Each gets its `chain`, and its `tier` (1-3) from its place in the chain.
export const REALMS = {};
for (const [chain, c] of Object.entries(CHAIN_FILES)) {
    c.realms.forEach((mod, i) => {
        REALMS[mod.realm.id] = Object.assign(mod.realm, { chain, tier: i + 1 });
    });
}

/** The act a realm's fights are tuned for: the act that uses it, else its tier. */
export function actOf(realmId) {
    for (const [act, ids] of Object.entries(ACT_REALMS)) if (ids.includes(realmId)) return Number(act);
    return REALMS[realmId]?.tier ?? 1;
}

/**
 * @brief The realms whose fights and events an act realm fields: itself first, then its `draws`.
 *
 * Crystal Caves draws Crystal Mines and Crystal Depths, so their fights (retuned for act 1, see
 * retuneEncounter in data/encounters.js) and events join its own. A realm no act lists draws
 * only on itself.
 *
 * @param {string} realmId
 * @return {string[]} Realm ids, the realm first; [] for an unknown realm.
 */
export function realmSources(realmId) {
    const realm = REALMS[realmId];
    if (!realm) return [];
    const listed = Object.values(ACT_REALMS).some(ids => ids.includes(realmId));
    return listed ? [realmId, ...(realm.draws ?? [])] : [realmId];
}

/**
 * @brief Whether content with optional placement fields can turn up in `act`, set in `realmId`.
 *
 * Items and relics may limit where they are found with `acts` (act numbers) and `realms`
 * (realm ids). A realm matches when it is the act's realm or one folded into it, the same rule
 * realm events follow. Content without either field can turn up anywhere.
 *
 * @param {{acts?: number[], realms?: string[]}} def  The item or relic.
 * @param {number} act      The current act.
 * @param {string} realmId  The act's realm.
 * @return {boolean}
 */
export function appearsIn(def, act, realmId) {
    if (def?.acts && !def.acts.includes(act)) return false;
    if (def?.realms) {
        const sources = realmSources(realmId);
        if (!def.realms.some(r => sources.includes(r))) return false;
    }
    return true;
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
