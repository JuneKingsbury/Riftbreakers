// Meta progression between runs: renown earned at the end of each run buys
// permanent unlocks. Stored in localStorage, separate from the run save. A saved profile is
// cleaned up on load (sanitizeProfile), so damaged or hand-edited data can't break the game.
// Settings can export it, with the run in progress, to a file or code (save-transfer.js).

import { EQUIPMENT, EQUIP_FIELDS, baseItemKey, enchantLevel } from '../tactical/data/equipment.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { REALMS } from './data/realms.js';
import { BACKDROPS } from './data/backdrops.js';
import { notifySaved } from './save-events.js';

export const PROFILE_KEY = 'riftbreak.profile.v1';

// Feats: how many finished runs the profile remembers, won or lost: the best by score
// (score.js), highest first. These are the player's high scores.
export const BEST_RUNS = 10;

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
    travelers_pack:  { name: "Traveler's Pack", cost: 35, desc: 'Start each run with a common pair of boots and a common trinket in the bag.' },
    masterwork:      { name: 'Masterwork', cost: 45, desc: 'Items you find come already enchanted twice as often.' },
    haggler:         { name: 'Haggler', cost: 40, desc: 'Each shop restocks its wares once for free.' },
    relic_codex:     { name: 'Relic Codex', cost: 70, requires: 'heirloom', desc: 'Your starting relic choice also offers an uncommon relic.' },
    scouts_report:   { name: "Scout's Report", cost: 30, desc: 'Each act opens with word of the boss waiting at its end.' },
    tacticians_codex: { name: "Tactician's Codex", cost: 35, desc: 'Tactics hold 8 more rules, and you can save a template to load onto any character.' },
    // Title screen backdrops (data/backdrops.js). The free ones need no unlock.
    ...Object.fromEntries(Object.entries(BACKDROPS).filter(([, b]) => b.cost > 0)
        .map(([id, b]) => [`backdrop_${id}`, { name: `Backdrop: ${b.name}`, cost: b.cost, backdrop: id, desc: 'A new tile for the title screen. Pick it in Settings > Graphics.' }])),
};

export function defaultStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function newProfile() {
    // stats.riftTier: the highest Rift Tier the profile may choose (see RIFT_TIERS).
    return {
        renown: 0, unlocked: [], stats: { runs: 0, wins: 0, bestAct: 0, bestFloor: 0, riftTier: 0 },
        items: [],        // every item ever obtained, by base key (an enchanted find counts as its item)
        bestRuns: [],     // summaries of the best finished runs, won or lost, highest score first (see runSummary)
        bossKills: {},    // boss fight id → times defeated, across all runs
        rewards: [],      // collection rewards earned (COLLECTION_REWARDS ids)
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
    p.stats.riftTier = Math.min(MAX_RIFT_TIER, p.stats.riftTier);
    // Profiles from before Rift Tiers: a past win opens the first tier.
    if (p.stats.wins > 0 && p.stats.riftTier === 0) p.stats.riftTier = 1;
    if (Array.isArray(data.rewards)) p.rewards = [...new Set(data.rewards.filter(r => Object.hasOwn(COLLECTION_REWARDS, r)))];
    if (Array.isArray(data.items)) p.items = [...new Set(data.items.filter(isBaseItem))];
    // Profiles from before high scores kept only their wins (bestWins), and profiles from before
    // scoring their latest wins (recentWins, which count with score 0). Both come in as wins.
    const asWins = (list) => list.map(w => (w && typeof w === 'object' ? { ...w, won: true } : w));
    const runs = Array.isArray(data.bestRuns) ? data.bestRuns
        : Array.isArray(data.bestWins) ? asWins(data.bestWins)
            : Array.isArray(data.recentWins) ? asWins(data.recentWins) : [];
    p.bestRuns = rankRuns(runs.map(sanitizeRun).filter(Boolean));
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
function sanitizeRunMember(m) {
    if (!m || typeof m !== 'object' || !isJob(m.job)) return null;
    const a = m.appearance && typeof m.appearance === 'object' ? m.appearance : {};
    const appearance = {};
    for (const k of ['race', 'nameColor']) if (typeof a[k] === 'string') appearance[k] = text(a[k], 20);
    for (const k of ['bodyVariant', 'hairVariant', 'shirtVariant']) if (Number.isInteger(a[k])) appearance[k] = a[k];
    for (const f of EQUIP_FIELDS) appearance[f] = typeof a[f] === 'string' && EQUIPMENT[a[f]] ? a[f] : null;
    return { name: text(m.name, 24) || 'Unknown', job: m.job, origin: isJob(m.origin) ? m.origin : null, level: count(m.level, 1) || 1, appearance };
}

// The most realms a remembered run lists (one per act; leaderboard entries allow 5 too).
const MAX_RUN_REALMS = 5;

function sanitizeRun(w) {
    if (!w || typeof w !== 'object') return null;
    const party = (Array.isArray(w.party) ? w.party : []).map(sanitizeRunMember).filter(Boolean).slice(0, 6);
    if (!party.length) return null;
    const realms = (Array.isArray(w.realms) ? w.realms : []).filter(r => typeof r === 'string' && Object.hasOwn(REALMS, r)).slice(0, MAX_RUN_REALMS);
    return {
        date: text(w.date, 40),
        party,
        // The realms the run reached, in act order.
        realms,
        won: w.won === true,
        // The act the run ended in (for a win, its last act).
        act: Math.min(MAX_RUN_REALMS, count(w.act)) || Math.max(1, realms.length),
        floors: count(w.floors), battles: count(w.battles), elites: count(w.elites), bosses: count(w.bosses),
        relics: count(w.relics), renown: count(w.renown),
        score: count(w.score),
        startPartySize: Math.min(3, count(w.startPartySize, 3)) || 3,
        tier: Math.min(MAX_RIFT_TIER, count(w.tier)),
        // A per-run id, so the leaderboard takes each run once (see leaderboard.js).
        id: typeof w.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(w.id) ? w.id : '',
        submitted: w.submitted === true,
    };
}

/** Runs ordered best first: highest score, then newest. At most BEST_RUNS. */
export function rankRuns(runs) {
    return [...runs].sort((a, b) => (b.score - a.score) || String(b.date).localeCompare(String(a.date))).slice(0, BEST_RUNS);
}

/** What a finished run, won or lost, is remembered by in Feats. */
export function runSummary(run, renown, now = new Date()) {
    return sanitizeRun({
        date: now.toISOString(),
        party: run.party.map(m => ({ name: m.name, job: m.job, origin: m.origin, level: m.level, appearance: m.appearance })),
        // Only the acts it reached: a lost run doesn't name the realms it never saw.
        realms: run.realms.slice(0, run.act),
        won: run.status === 'won',
        act: run.act,
        ...run.stats,
        relics: run.relics.length,
        renown,
        score: run.score || 0,
        startPartySize: run.startPartySize ?? 3,
        tier: run.options?.tier ?? 0,
        id: `${(run.seed >>> 0).toString(36)}-${now.getTime().toString(36)}`,
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
    try {
        storage?.setItem(PROFILE_KEY, JSON.stringify(sanitizeProfile(profile)));
        if (storage) notifySaved();
        return !!storage;
    } catch { return false; }
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

// ---- Rift Tiers ----
// Optional difficulty for a run, chosen on the New Run screen. Each tier keeps the ones below
// it and adds one more twist, for more renown. Winning at a tier opens the next one; the first
// tier opens with the first win.
export const RIFT_TIERS = [
    { name: 'No tier', desc: 'The rifts as you know them.', renown: 0 },
    { name: 'Tier I: Hardened', desc: 'Elites and bosses are tougher: +10 HP, +2 ATK and +2 MAT each.', renown: 0.25 },
    { name: 'Tier II: Rift Tax', desc: 'Shop prices are 25% higher.', renown: 0.5 },
    { name: 'Tier III: Slim Pickings', desc: 'Battles pay 30% less gold, and their rewards offer one fewer item to choose from.', renown: 0.75 },
    { name: 'Tier IV: Gathering Storm', desc: 'Every enemy gains +8 HP and +1 to ATK, DEF, MAT and MDF, and bosses bring one more ally.', renown: 1 },
    { name: 'Tier V: Riftstorm', desc: 'Every enemy gains another +8 HP and +1 to ATK and MAT, and elites bring one more ally.', renown: 1.5 },
];
export const MAX_RIFT_TIER = RIFT_TIERS.length - 1;

// Challenge runs: starting with fewer than three members earns extra renown.
export const SMALL_PARTY_RENOWN = { 1: 0.5, 2: 0.25 };

/** The renown multiplier for a run: its Rift Tier and its starting party size, added up. */
export function renownMultiplier(tier = 0, startPartySize = 3) {
    return 1 + (RIFT_TIERS[tier]?.renown ?? 0) + (SMALL_PARTY_RENOWN[startPartySize] ?? 0);
}

// ---- Collection rewards (Feats) ----
// Finding a share of every item earns a reward, once: renown at 33%, and at 66% the Collector's
// Loupe, a trinket that can only be found once it is earned.
export const COLLECTION_REWARDS = {
    collect_33: { at: 33, renown: 50, label: '+50 renown' },
    collect_66: { at: 66, item: 'jewelers_loupe', label: "Collector's Loupe" },
};

/** The share of all items found, as a whole percent (rounded down). */
export function collectionPercent(profile) {
    const total = Object.keys(EQUIPMENT).length;
    return total ? Math.floor((profile.items.length / total) * 100) : 0;
}

/**
 * Grants any collection reward the profile has newly reached. Returns those rewards
 * ([{ id, label }]) so the game can announce them.
 */
export function claimCollectionRewards(profile) {
    const pct = collectionPercent(profile);
    const out = [];
    for (const [id, r] of Object.entries(COLLECTION_REWARDS)) {
        if (pct < r.at || profile.rewards.includes(id)) continue;
        profile.rewards.push(id);
        if (r.renown) profile.renown += r.renown;
        out.push({ id, label: r.label });
    }
    return out;
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
        travelersPack: has('travelers_pack'),
        masterwork:    has('masterwork'),
        haggler:       has('haggler'),
        relicCodex:    has('relic_codex'),
        scoutsReport:  has('scouts_report'),
        tacticsCodex:  has('tacticians_codex'),
        // Items that can only be found once a collection reward has been earned.
        featItems:     Object.entries(COLLECTION_REWARDS).filter(([id, r]) => r.item && profile?.rewards?.includes(id)).map(([, r]) => r.item),
        tier:          0,   // set on the New Run screen (RIFT_TIERS)
    };
}

// Renown a finished run earns: floors climbed, elites and bosses beaten, and a victory bonus.
export function renownFor(stats, won) {
    return (stats.floors || 0) + 3 * (stats.elites || 0) + 10 * (stats.bosses || 0) + (won ? 25 : 0);
}

// Records a finished run in the profile. Returns the renown earned.
export function recordRun(profile, run, now = new Date()) {
    const won = run.status === 'won';
    const tier = run.options?.tier ?? 0;
    const earned = Math.round(renownFor(run.stats, won) * renownMultiplier(tier, run.startPartySize ?? 3));
    profile.renown += earned;
    profile.stats.runs += 1;
    if (won) profile.stats.wins += 1;
    // A win opens the next Rift Tier.
    if (won) profile.stats.riftTier = Math.max(profile.stats.riftTier ?? 0, Math.min(MAX_RIFT_TIER, tier + 1));
    profile.stats.bestAct = Math.max(profile.stats.bestAct, run.act);
    profile.stats.bestFloor = Math.max(profile.stats.bestFloor, run.stats.floors || 0);
    noteItems(profile, run);
    noteBosses(profile, run);
    // Every run that won a battle is a candidate high score, whether it was won, lost or abandoned.
    // (Abandoning can't raise a score: points only come from winning battles.)
    if ((run.stats.battles || 0) > 0) {
        profile.bestRuns = rankRuns([runSummary(run, earned, now), ...(profile.bestRuns || [])].filter(Boolean));
    }
    return earned;
}
