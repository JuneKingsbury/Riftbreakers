// Shorthands for writing realm files.

// Battle maps out in the open, shared by the realms set outdoors.
export const OUTDOOR_MAPS = ['crossroads', 'mountain_pass', 'river_ford', 'volcano_plateau', 'ruined_temple'];

// Opening gauge (ct) for roster entries that don't set one, by position, so a fight's
// enemies don't all move at once.
const OPENING_CT = [30, 10, 40, 20, 55, 5];

/**
 * @brief A roster entry: job, display name, optional sprite and extra fields.
 * @param {string} job     How the unit fights (an enemy job or a player class).
 * @param {string} name    Display name.
 * @param {string|null} sprite  Entity sprite in place of the job's.
 * @param {object} extra   Other roster fields (level, statMods, ct, tint, extraAbilities).
 */
export function e(job, name, sprite = null, extra = {}) {
    return sprite ? { job, name, sprite, ...extra } : { job, name, ...extra };
}

/**
 * @brief An encounter whose roster entries without a ct get one from OPENING_CT.
 * @param {string} id, name   Unique id and display name.
 * @param {number} enemyLevel Level for roster entries on player classes.
 * @param {object[]} roster   Entries from e(), in priority order (a boss first).
 * @param {object} extra      Other encounter fields (easy, map, scouting).
 */
export function fight(id, name, enemyLevel, roster, extra = {}) {
    return { id, name, enemyLevel, ...extra, roster: roster.map((r, i) => ({ ct: OPENING_CT[i % OPENING_CT.length], ...r })) };
}
