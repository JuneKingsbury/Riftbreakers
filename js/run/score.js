// Run score: what orders the best wins in Feats and the online leaderboard.
//
// Every won battle adds points:
//   base (by fight kind) × survival × speed × small-party multiplier
// - survival: the share of the party's members (summons don't count) still standing at the end
// - speed: par turns for that kind of fight ÷ the turns the party took, between ×0.5 and ×2.
//   Turns are counted per member (rounds), so a bigger party isn't slower for having more of them.
// - small party: runs started with one or two heroes score more (as they earn more renown).
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
 * @returns {{ points: number, survival: number, speed: number, partyMult: number }}
 */
export function battleScore({ kind, survivors, partySize, rounds, startPartySize = 3 }) {
    const size = Math.max(1, Math.floor(partySize) || 1);
    const survival = Math.max(0, Math.min(1, (Math.floor(survivors) || 0) / size));
    const speed = speedMultiplier(kind, rounds);
    const partyMult = partySizeMultiplier(startPartySize);
    const base = SCORE_BASE[kind] ?? SCORE_BASE.normal;
    return { points: Math.round(base * survival * speed * partyMult), survival, speed, partyMult };
}

/** A player-facing explanation of the score, for tooltips. */
export const SCORE_TIP = 'Score\nEach battle won adds points: more for elites and bosses, '
    + 'scaled by how many of your party are still standing (summons don\'t count) and by how few turns it took. '
    + 'Runs started with 2 heroes score ×1.5, and with 1 hero ×2. Your best wins are ranked by score.';

/** One line explaining a battle's points, e.g. '3/3 standing · 5 turns (×1.2 speed)'. */
export function scoreLine(s) {
    const parts = [`${s.survivors}/${s.partySize} standing`, `${s.rounds} turn${s.rounds === 1 ? '' : 's'} (×${s.speed.toFixed(2).replace(/\.?0+$/, '')} speed)`];
    if (s.partyMult > 1) parts.push(`×${s.partyMult} small party`);
    return parts.join(' · ');
}
