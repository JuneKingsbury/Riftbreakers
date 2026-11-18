// Every enemy has a sprite slot of its own, entities/enemy_<name>.png, so each one can be
// drawn differently in the skin editor. The enemies are read from the encounters
// (run/data/encounters.js) and the default enemies (data/characters.js), so the list stays
// current as enemies are added. Enemies built from layers (an `appearance`: body, hair and
// gear, like party members) are composited instead, so they have no slot.
//
// An enemy whose own sprite isn't in the skin yet is drawn the old way: the encounter's
// sprite override or the job's sprite, multiplied by its tint. Once it has its own sprite,
// that sprite is drawn as is, without the tint (tints only told shared sprites apart).
import { ENCOUNTERS } from '../run/data/encounters.js';
import { CHARACTER_DATA } from './data/characters.js';
import { JOB_STATS } from './data-registry.js';

// Cached: the battle view looks a unit's sprite up every frame.
const keyCache = new Map();

/** "King's Guard" -> "enemy_kings_guard": the enemy's own sprite key (category 'entities'). */
export function enemySpriteKey(name) {
    let key = keyCache.get(name);
    if (key) return key;
    const slug = String(name)
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // drop accents: é -> e
        .toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    key = 'enemy_' + slug;
    keyCache.set(name, key);
    return key;
}

/**
 * Every enemy by name, sorted by name:
 *   { key, name, jobs, sprite, tint, looks, fights }
 *   key     its own sprite key (enemySpriteKey)
 *   sprite  the sprite it is drawn with until it has its own: the look it uses most often
 *   tint    the tint that look uses, or null
 *   looks   [{ sprite, tint, count }] every look it has across fights, most used first
 *   jobs    the jobs it fights as
 *   fights  how many encounter roster entries use it
 */
export function listEnemies() {
    const byName = new Map();
    const add = (name, job, sprite, tint) => {
        const e = byName.get(name) ?? { name, jobs: new Set(), looks: new Map(), fights: 0 };
        e.jobs.add(job);
        const look = `${sprite}|${tint ?? ''}`;
        const l = e.looks.get(look) ?? { sprite, tint: tint ?? null, count: 0, order: e.looks.size };
        l.count++;
        e.looks.set(look, l);
        e.fights++;
        byName.set(name, e);
    };
    for (const kinds of Object.values(ENCOUNTERS)) {
        for (const list of Object.values(kinds)) {
            for (const def of list) {
                for (const r of def.roster ?? []) if (!r.appearance) add(r.name, r.job, r.sprite ?? JOB_STATS[r.job]?.spriteKey ?? null, r.tint);
            }
        }
    }
    for (const c of CHARACTER_DATA) {
        if (c.team === 'enemy' && !c.appearance) add(c.name, c.job, c.spriteKey ?? JOB_STATS[c.job]?.spriteKey ?? null, c.tint);
    }
    return [...byName.values()]
        .map(e => {
            // Most used first; ties keep the order the looks were first met in.
            const looks = [...e.looks.values()].sort((a, b) => b.count - a.count || a.order - b.order)
                .map(({ sprite, tint, count }) => ({ sprite, tint, count }));
            return { key: enemySpriteKey(e.name), name: e.name, jobs: [...e.jobs], sprite: looks[0].sprite,
                tint: looks[0].tint, looks, fights: e.fights };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}
