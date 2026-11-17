// Meta progression between runs: renown earned at the end of each run buys
// permanent unlocks. Stored in localStorage, separate from the run save. A saved profile is
// cleaned up on load (sanitizeProfile), so damaged or hand-edited data can't break the game.
// Settings can export it, with the run in progress, to a file or code (save-transfer.js).

import { EQUIPMENT, EQUIP_FIELDS, baseItemKey, enchantLevel } from '../tactical/data/equipment.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { REALMS } from './data/realms.js';

export const PROFILE_KEY = 'riftbreak.profile.v1';

// Feats: how many winning runs the profile remembers (the most recent first).
export const RECENT_WINS = 5;

// Every boss fight in the game (each realm fields two), for the bestiary.
export const BOSS_IDS = [...new Set(Object.values(REALMS).flatMap(r => r.bosses || []))];

export const BASE_JOBS = ['warden', 'evoker', 'runebow'];

// requires: another unlock that must be bought first.
export const UNLOCKS = {
    job_spellblade:  { name: 'Spellblade', cost: 30, job: 'spellblade', desc: 'Unlocks the Spellblade as a starting class.' },
    job_stoneshaper: { name: 'Stoneshaper', cost: 40, job: 'stoneshaper', desc: 'Unlocks the Stoneshaper as a starting class.' },
    job_seer:        { name: 'Seer', cost: 50, job: 'seer', desc: 'Unlocks the Seer as a starting class.' },
    job_warlord:     { name: 'Warlord', cost: 35, job: 'warlord', desc: 'Unlocks the Warlord as a starting class.' },
    job_alchemist:   { name: 'Alchemist', cost: 40, job: 'alchemist', desc: 'Unlocks the Alchemist as a starting class.' },
    job_illusionist: { name: 'Illusionist', cost: 45, job: 'illusionist', desc: 'Unlocks the Illusionist as a starting class.' },
    job_gravecaller: { name: 'Gravecaller', cost: 50, job: 'gravecaller', desc: 'Unlocks the Gravecaller as a starting class.' },
    purse_1:         { name: 'Coin Purse', cost: 25, desc: 'Start each run with 50 more gold.' },
    purse_2:         { name: 'Heavy Purse', cost: 50, requires: 'purse_1', desc: 'Start each run with another 50 gold.' },
    veterans:        { name: 'Veterans', cost: 45, desc: 'Your starting party begins at level 2, with one more skill point to spend.' },
    heirloom:        { name: 'Heirloom', cost: 60, desc: 'Start each run by choosing one of three common relics.' },
    drillmaster:     { name: 'Master Trainer', cost: 40, desc: 'Training gives 50% more XP, and enchanting also gives everyone 25 XP.' },
    recruiter:       { name: 'Recruiter', cost: 35, desc: 'Recruit nodes offer four candidates instead of three.' },
    fine_wares:      { name: 'Fine Wares', cost: 40, desc: 'Shops stock one more item and carry uncommon gear more often.' },
    relic_lore:      { name: 'Relic Lore', cost: 60, desc: 'Elites can drop rare relics.' },
    second_wind:     { name: 'Second Wind', cost: 55, desc: 'Everyone in the party gains 50 XP when a new act begins.' },
};

export function defaultStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function newProfile() {
    return {
        renown: 0, unlocked: [], stats: { runs: 0, wins: 0, bestAct: 0, bestFloor: 0 },
        items: [],        // every item ever obtained, by base key (an enchanted find counts as its item)
        recentWins: [],   // summaries of the latest winning runs, newest first (see winSummary)
        bossKills: {},    // boss fight id → times defeated, across all runs
    };
}

// A whole number at least 0, or the fallback.
const count = (v, fallback = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

/**
 * A valid profile from anything (parsed save data, possibly damaged or edited): known
 * unlocks only, each once; renown and stats as whole numbers at least 0. Unknown fields are
 * dropped. Never throws.
 */
export function sanitizeProfile(data) {
    const p = newProfile();
    if (!data || typeof data !== 'object') return p;
    p.renown = count(data.renown);
    if (Array.isArray(data.unlocked)) {
        p.unlocked = [...new Set(data.unlocked.filter(k => typeof k === 'string' && Object.hasOwn(UNLOCKS, k)))];
    }
    const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};
    for (const key of Object.keys(p.stats)) p.stats[key] = count(stats[key]);
    p.stats.wins = Math.min(p.stats.wins, p.stats.runs);
    if (Array.isArray(data.items)) p.items = [...new Set(data.items.filter(isBaseItem))];
    if (Array.isArray(data.recentWins)) p.recentWins = data.recentWins.map(sanitizeWin).filter(Boolean).slice(0, RECENT_WINS);
    if (data.bossKills && typeof data.bossKills === 'object') {
        for (const id of BOSS_IDS) if (Object.hasOwn(data.bossKills, id) && count(data.bossKills[id]) > 0) p.bossKills[id] = count(data.bossKills[id]);
    }
    return p;
}

/**
 * Counts the bosses the run has beaten since it was last noted (run.bossesDefeated, with
 * run.bossesNoted marking how many are already counted). Returns true if any were new.
 */
export function noteBosses(profile, run) {
    const list = Array.isArray(run.bossesDefeated) ? run.bossesDefeated : [];
    const from = Math.min(run.bossesNoted ?? 0, list.length);
    for (const id of list.slice(from)) if (BOSS_IDS.includes(id)) profile.bossKills[id] = (profile.bossKills[id] || 0) + 1;
    run.bossesNoted = list.length;
    return list.length > from;
}

const isBaseItem = (k) => typeof k === 'string' && Object.hasOwn(EQUIPMENT, k) && enchantLevel(k) === 0;
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const isJob = (j) => typeof j === 'string' && Object.hasOwn(JOB_DATA, j);

// One remembered member: enough to show their name, class and portrait.
function sanitizeWinMember(m) {
    if (!m || typeof m !== 'object' || !isJob(m.job)) return null;
    const a = m.appearance && typeof m.appearance === 'object' ? m.appearance : {};
    const appearance = {};
    for (const k of ['race', 'nameColor']) if (typeof a[k] === 'string') appearance[k] = text(a[k], 20);
    for (const k of ['bodyVariant', 'hairVariant', 'shirtVariant']) if (Number.isInteger(a[k])) appearance[k] = a[k];
    for (const f of EQUIP_FIELDS) appearance[f] = typeof a[f] === 'string' && EQUIPMENT[a[f]] ? a[f] : null;
    return { name: text(m.name, 24) || 'Unknown', job: m.job, origin: isJob(m.origin) ? m.origin : null, level: count(m.level, 1) || 1, appearance };
}

function sanitizeWin(w) {
    if (!w || typeof w !== 'object') return null;
    const party = (Array.isArray(w.party) ? w.party : []).map(sanitizeWinMember).filter(Boolean).slice(0, 6);
    if (!party.length) return null;
    return {
        date: text(w.date, 40),
        party,
        realms: (Array.isArray(w.realms) ? w.realms : []).filter(r => typeof r === 'string' && Object.hasOwn(REALMS, r)).slice(0, 3),
        floors: count(w.floors), battles: count(w.battles), elites: count(w.elites), bosses: count(w.bosses),
        relics: count(w.relics), renown: count(w.renown),
    };
}

/** What a won run is remembered by in Feats. */
export function winSummary(run, renown, now = new Date()) {
    return sanitizeWin({
        date: now.toISOString(),
        party: run.party.map(m => ({ name: m.name, job: m.job, origin: m.origin, level: m.level, appearance: m.appearance })),
        realms: run.realms,
        ...run.stats,
        relics: run.relics.length,
        renown,
    });
}

/**
 * Adds every item the run's party has (in the bag or worn) to the profile's found items.
 * Returns true if anything was new.
 */
export function noteItems(profile, run) {
    const seen = new Set(profile.items);
    const before = seen.size;
    for (const k of Object.keys(run.inventory || {})) if (run.inventory[k] > 0) seen.add(baseItemKey(k));
    for (const m of run.party || []) for (const f of EQUIP_FIELDS) if (m.appearance?.[f]) seen.add(baseItemKey(m.appearance[f]));
    profile.items = [...seen].filter(isBaseItem);
    return profile.items.length > before;
}

export function loadProfile(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(PROFILE_KEY);
        return raw ? sanitizeProfile(JSON.parse(raw)) : newProfile();
    } catch {
        return newProfile();
    }
}

export function saveProfile(profile, storage = defaultStorage()) {
    try { storage?.setItem(PROFILE_KEY, JSON.stringify(sanitizeProfile(profile))); return !!storage; } catch { return false; }
}

export function hasUnlock(profile, key) {
    return !!profile?.unlocked?.includes(key);
}

export function canBuyUnlock(profile, key) {
    const u = UNLOCKS[key];
    if (!u || hasUnlock(profile, key)) return false;
    if (u.requires && !hasUnlock(profile, u.requires)) return false;
    return profile.renown >= u.cost;
}

export function buyUnlock(profile, key) {
    if (!canBuyUnlock(profile, key)) return false;
    profile.renown -= UNLOCKS[key].cost;
    profile.unlocked.push(key);
    return true;
}

// Starting roles the profile has unlocked. (Recruits met during a run can be any role.)
export function unlockedJobs(profile) {
    const jobs = [...BASE_JOBS];
    for (const key of profile?.unlocked || []) if (UNLOCKS[key]?.job) jobs.push(UNLOCKS[key].job);
    return jobs;
}

// Run options implied by a profile's unlocks (see RunState).
export function runOptions(profile) {
    const has = (k) => hasUnlock(profile, k);
    return {
        jobs:          unlockedJobs(profile),
        startGold:     100 + (has('purse_1') ? 50 : 0) + (has('purse_2') ? 50 : 0),
        startLevel:    has('veterans') ? 2 : 1,
        heirloom:      has('heirloom'),
        enchantXp:     has('drillmaster') ? 25 : 0,
        drillXp:       has('drillmaster') ? 60 : 40,   // Train at rest sites (saved runs keep this name)
        recruitChoices: has('recruiter') ? 4 : 3,
        fineWares:     has('fine_wares'),
        relicLore:     has('relic_lore'),
        secondWind:    has('second_wind'),
    };
}

// Renown a finished run earns: floors climbed, elites and bosses beaten, and a victory bonus.
export function renownFor(stats, won) {
    return (stats.floors || 0) + 3 * (stats.elites || 0) + 10 * (stats.bosses || 0) + (won ? 25 : 0);
}

// Records a finished run in the profile. Returns the renown earned.
export function recordRun(profile, run, now = new Date()) {
    const won = run.status === 'won';
    const earned = renownFor(run.stats, won);
    profile.renown += earned;
    profile.stats.runs += 1;
    if (won) profile.stats.wins += 1;
    profile.stats.bestAct = Math.max(profile.stats.bestAct, run.act);
    profile.stats.bestFloor = Math.max(profile.stats.bestFloor, run.stats.floors || 0);
    noteItems(profile, run);
    noteBosses(profile, run);
    if (won) profile.recentWins = [winSummary(run, earned, now), ...(profile.recentWins || [])].filter(Boolean).slice(0, RECENT_WINS);
    return earned;
}
