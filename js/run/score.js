// Run score: what orders the best wins in Feats and the online leaderboard.
//
// Every won battle adds points:
//   base (by fight kind) × survival × speed × small-party multiplier × Rift Tier multiplier
// - survival: the share of the party's members (summons don't count) still standing at the end
// - speed: par turns for that kind of fight ÷ the turns the party took, between ×0.5 and ×2.
//   Turns are counted per member (rounds), so a bigger party isn't slower for having more of them.
// - small party: runs started with one or two heroes score more (as they earn more renown).
// - Rift Tier: harder runs score more, by the same steps as their renown bonus (profile.js).
// Losing a battle adds nothing, and ends the run.

export const SCORE_BASE = { normal: 100, elite: 250, boss: 500 };

// Party turns (rounds) a typical win takes, measured from simulated fights.
export const PAR_ROUNDS = { normal: 6, elite: 12, boss: 18 };

export const SPEED_MIN = 0.5;
export const SPEED_MAX = 2;

// Start with this many heroes for this score multiplier.
export const SMALL_PARTY_SCORE = { 1: 2, 2: 1.5 };

/** The score multiplier for a run started with `startPartySize` heroes. */
export function partySizeMultiplier(startPartySize = 3) {
    return SMALL_PARTY_SCORE[startPartySize] ?? 1;
}

// The score multiplier for a run at each Rift Tier (index = tier). Matches 1 + the tier's
// renown bonus in RIFT_TIERS (profile.js). Kept here so the leaderboard rules can import
// nothing: MAX_POINTS_PER_BATTLE there must allow the last entry.
export const RIFT_TIER_SCORE = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/** The score multiplier for a run at Rift Tier `tier` (0 = no tier). */
export function riftTierMultiplier(tier = 0) {
    const t = Math.max(0, Math.min(RIFT_TIER_SCORE.length - 1, Math.floor(tier) || 0));
    return RIFT_TIER_SCORE[t];
}

/** The speed multiplier for winning a `kind` fight in `rounds` party turns. */
export function speedMultiplier(kind, rounds) {
    const par = PAR_ROUNDS[kind] ?? PAR_ROUNDS.normal;
    const r = Math.max(1, Math.round(rounds) || 1);
    return Math.max(SPEED_MIN, Math.min(SPEED_MAX, par / r));
}

/**
 * Points for one won battle.
 * @param {object} p
 * @param {string} p.kind            'normal' | 'elite' | 'boss'
 * @param {number} p.survivors       Party members (not summons) standing at the end
 * @param {number} p.partySize       Party members who fought
 * @param {number} p.rounds          Turns the party took, per member
 * @param {number} [p.startPartySize=3]  Heroes the run started with
 * @param {number} [p.tier=0]        The run's Rift Tier
 * @returns {{ points: number, survival: number, speed: number, partyMult: number, tierMult: number }}
 */
export function battleScore({ kind, survivors, partySize, rounds, startPartySize = 3, tier = 0 }) {
    const size = Math.max(1, Math.floor(partySize) || 1);
    const survival = Math.max(0, Math.min(1, (Math.floor(survivors) || 0) / size));
    const speed = speedMultiplier(kind, rounds);
    const partyMult = partySizeMultiplier(startPartySize);
    const tierMult = riftTierMultiplier(tier);
    const base = SCORE_BASE[kind] ?? SCORE_BASE.normal;
    return { points: Math.round(base * survival * speed * partyMult * tierMult), survival, speed, partyMult, tierMult };
}

/** A player-facing explanation of the score, for tooltips. */
export const SCORE_TIP = 'Score\nEach battle won adds points: more for elites and bosses, '
    + 'scaled by how many of your party are still standing (summons don\'t count) and by how few turns it took. '
    + 'Runs started with 2 heroes score ×1.5, and with 1 hero ×2. '
    + 'Rift Tiers score more: ×1.25 at Tier I, ×1.5 at II, ×1.75 at III, ×2 at IV and ×2.5 at V. '
    + 'Your best wins are ranked by score.';

/** One line explaining a battle's points, e.g. '3/3 standing · 5 turns (×1.2 speed)'. */
export function scoreLine(s) {
    const parts = [`${s.survivors}/${s.partySize} standing`, `${s.rounds} turn${s.rounds === 1 ? '' : 's'} (×${s.speed.toFixed(2).replace(/\.?0+$/, '')} speed)`];
    if (s.partyMult > 1) parts.push(`×${s.partyMult} small party`);
    if (s.tierMult > 1) parts.push(`×${s.tierMult} Rift Tier`);
    return parts.join(' · ');
}
