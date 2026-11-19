// Battle encounters for each realm (data/realms.js). An act is set in one realm, so a
// realm's fights are tuned for the act it appears in (actOf in data/realms.js).
//
// ENCOUNTERS[realmId] = { normal: [...], elite: [...], boss: [...] }, gathered from the realm
// files (js/content/realms/<realm>.js, `encounters`; every field in content/vocab.js,
// SCHEMAS.encounter). A fight takes the first N roster entries, where N grows with the party
// (enemyCount), so a boss roster lists the boss first.
//
// ACT_STAT_MODS scale every enemy of an act on top of their job stats; elites (and bosses from
// act 2) add ELITE_STAT_MODS.
//
// A realm's own fights were written for one act (WRITTEN_FOR). When the realm is now fought in
// a later act, its fights move to that act's levels (see shiftLevels); the act's stat mods do
// the rest.
//
// An act realm also fights the encounters of the unlisted realms of its chain (realmSources
// in data/realms.js). Those were written for another act, so retuneEncounter fits them to the
// act they are fought in.
import { JOB_STATS } from '../../tactical/data-registry.js';
import { REALMS, actOf, realmSources } from './realms.js';
import { CHAINS as CHAIN_FILES } from '../../content/realms/index.js';

const REALM_ENCOUNTERS = Object.fromEntries(Object.values(CHAIN_FILES).flatMap(c => c.realms).map(mod => [mod.realm.id, mod.encounters]));

// Realm id → { normal, elite, boss } encounter lists, from the realm files.
export const ENCOUNTERS = Object.fromEntries(Object.keys(REALMS).map(id => [id, REALM_ENCOUNTERS[id]]));

// What the Scout's Report (an unlock) says about each boss fight on the act's opening card,
// from the boss encounters' `scouting`.
export const SCOUTING = Object.fromEntries(Object.values(ENCOUNTERS).flatMap(z => z.boss ?? [])
    .filter(d => d.scouting).map(d => [d.id, d.scouting]));

export const ACT_COUNT = 4;

// Enemy stats added per act. The curve climbs evenly: Act 2 sits about halfway between Act 1
// and Act 3 (a steeper Act 2 used to end most runs there; see the balance study notes), and
// Act 4 continues it.
export const ACT_STAT_MODS = {
    1: { maxHp: -4, atk: -1 },
    2: { maxHp: 17, atk: 4, def: 2, mat: 4, mdf: 2 },
    3: { maxHp: 36, atk: 8, def: 4, mat: 8, mdf: 4, spd: 1 },
    4: { maxHp: 55, atk: 12, def: 6, mat: 12, mdf: 6, spd: 1 },
};

// The act a realm's own fights were written for, where that isn't the act it is now fought in
// (realms that moved when Act 4 was added): each realm's `writtenFor`. See shiftLevels.
export const WRITTEN_FOR = Object.fromEntries(Object.values(REALMS).filter(r => r.writtenFor).map(r => [r.id, r.writtenFor]));

export const ELITE_STAT_MODS = { maxHp: 8, atk: 1, mat: 1 };

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
//   kind   'normal' | 'elite' | 'boss'
//   realm  The act's realm; zone  the realm the fight comes from (its look and maps)
export function buildEncounter(def, kind, act, partySize, easy = false, realm = null, zone = realm) {
    const roster = def.roster.slice(0, enemyCount(kind, partySize, easy, act));
    const scale = actScale(kind, act);
    return {
        id: def.id,
        name: def.name,
        kind,
        act,
        realm,
        zone,
        enemyLevel: def.enemyLevel,
        map: def.map ?? null,
        roster: roster.map(r => ({ ...r, statMods: addMods(scale, r.statMods) })),
        // Boss phases: reinforcements are scaled like the roster.
        ...(def.phases ? { phases: def.phases.map(p => ({
            ...p, summon: p.summon?.map(r => ({ ...r, statMods: addMods(scale, r.statMods) })),
        })) } : {}),
    };
}

// Act scaling for every enemy of a fight. Elite fights, and boss fights after the first act,
// add ELITE_STAT_MODS.
function actScale(kind, act) {
    const tough = kind === 'elite' || (kind === 'boss' && act > 1);
    return addMods(ACT_STAT_MODS[act], tough ? ELITE_STAT_MODS : null);
}

// ---- Retuning fights for another act -------------------------------------------------

// Typical encounter level by kind and act, and the level of a boss on a player job.
const ACT_LEVEL = { normal: { 1: 1, 2: 2, 3: 4, 4: 6 }, elite: { 1: 2, 2: 3, 3: 6, 4: 8 }, boss: { 1: 2, 2: 4, 3: 6, 4: 8 } };
const BOSS_LEVEL = { 1: 2, 2: 5, 3: 8, 4: 11 };
// A retuned fight may be scaled down to half or up to double its power, no further.
const SCALE_LIMITS = [0.5, 2.5];
// Power is only a rough guide: kits matter too (a tier 3 boss scaled down keeps tricks its
// stats don't show). These factors on the target power were set by playing the retuned fights
// against the realm's own in simulated battles (a leveled party, several maps and seeds), so
// each lands near the home realm's win rate. > 1 makes the folded-in fights harder.
// Each realm sets its own in `retuneBias` ({ normal?, elite?, boss? }).
const RETUNE_BIAS = Object.fromEntries(Object.values(REALMS).filter(r => r.retuneBias).map(r => [r.id, r.retuneBias]));

/**
 * Rough strength of a whole roster as fought in `act`: the sum over its units of HP times
 * their best attack stat. Used only to compare fights with each other.
 */
export function rosterPower(def, kind, act) {
    const scale = actScale(kind, act);
    let total = 0;
    for (const r of def.roster) {
        const base = JOB_STATS[r.job];
        const m = addMods(scale, r.statMods);
        const hp = base.maxHp + (m.maxHp ?? 0);
        const offense = Math.max(base.atk + (m.atk ?? 0), base.mat + (m.mat ?? 0));
        total += Math.max(1, hp) * Math.max(1, offense);
    }
    return total;
}

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const _targets = new Map();
// Median roster power of the realm's own fights of `kind`, fought in its own act.
function targetPower(realm, kind) {
    const key = `${realm}:${kind}`;
    if (!_targets.has(key)) {
        const act = actOf(realm);
        _targets.set(key, median(ENCOUNTERS[realm][kind].map(d => rosterPower(d, kind, act))));
    }
    return _targets.get(key);
}

/**
 * A fight written for `fromAct`, refitted for `realm`'s act: encounter and boss levels move
 * to that act's, and every unit's HP, attack and defense stats are scaled together so the
 * roster's power matches the median of the realm's own fights of the same kind. That holds even
 * for a fight already written for this act, since realms of the same tier weren't tuned evenly.
 * `zone` (the realm the fight comes from) picks its RETUNE_BIAS. The roster, names and sprites
 * stay as written.
 */
export function retuneEncounter(def, kind, fromAct, realm, zone = null) {
    const toAct = actOf(realm);
    const out = { ...shiftLevels(def, kind, fromAct, toAct), easy: false };
    const leveled = out.roster;

    const target = targetPower(realm, kind) * (RETUNE_BIAS[zone]?.[kind] ?? 1);
    const k = Math.min(SCALE_LIMITS[1], Math.max(SCALE_LIMITS[0], target / rosterPower(out, kind, toAct)));
    // HP and offense each take the square root, so their product (the power) scales by k.
    const f = Math.sqrt(k);
    const scale = actScale(kind, toAct);
    out.roster = leveled.map(r => {
        const base = JOB_STATS[r.job];
        const m = addMods(scale, r.statMods);
        const delta = (stat) => Math.round((base[stat] + (m[stat] ?? 0)) * (f - 1));
        return { ...r, statMods: addMods(r.statMods, {
            maxHp: delta('maxHp'), atk: delta('atk'), mat: delta('mat'), def: delta('def'), mdf: delta('mdf'),
        }) };
    });
    return out;
}

/**
 * A fight written for `fromAct` at `toAct`'s levels: the encounter level moves by the act's
 * typical level for its kind, and roster entries with their own level (bosses on player jobs)
 * by BOSS_LEVEL. Stats are left alone: buildEncounter adds the act's stat mods.
 */
export function shiftLevels(def, kind, fromAct, toAct) {
    if (fromAct === toAct) return def;
    const shift = ACT_LEVEL[kind][toAct] - ACT_LEVEL[kind][fromAct];
    const bossShift = BOSS_LEVEL[toAct] - BOSS_LEVEL[fromAct];
    const roster = def.roster.map(r => (r.level == null ? r : { ...r, level: Math.max(1, r.level + bossShift) }));
    return { ...def, enemyLevel: Math.max(1, def.enemyLevel + shift), roster };
}

// Every encounter of `kind` the realm can field: [{ def, zone }], its own first (at its act's
// levels, see WRITTEN_FOR), then those of the realms folded into it, retuned for its act.
// Bosses are limited to the realm's `bosses` list when it has one.
export function realmEncounters(realm, kind) {
    const bosses = kind === 'boss' ? REALMS[realm]?.bosses : null;
    const act = actOf(realm);
    return realmSources(realm).flatMap(zone => (ENCOUNTERS[zone]?.[kind] ?? [])
        .filter(def => !bosses || bosses.includes(def.id))
        .map(def => ({
            zone,
            def: zone === realm ? shiftLevels(def, kind, WRITTEN_FOR[realm] ?? act, act) : retuneEncounter(def, kind, actOf(zone), realm, zone),
        })));
}

// Picks an encounter of `kind` from the realm's fights (its own and those folded into it),
// avoiding ids in `seen` while others remain. `act` sets the scaling.
export function rollEncounter(rng, realm, act, kind, partySize, seen = [], easy = false) {
    const all = realmEncounters(realm, kind);
    const gentle = all.filter(e => e.def.easy);
    const pool = easy && gentle.length ? gentle : all;
    const fresh = pool.filter(e => !seen.includes(e.def.id));
    const { def, zone } = rng.pick(fresh.length ? fresh : pool);
    return buildEncounter(def, kind, act, partySize, easy, realm, zone);
}
