// Generated party members: the starting party and recruits met during a run.
import { JOB_DATA } from '../../tactical/data/jobs.js';
import { jobsOfTier } from '../../tactical/data-registry.js';

export const NAMES = [
    'Aldric', 'Lyria', 'Ryn', 'Fenn', 'Maren', 'Torv', 'Isolde', 'Corin', 'Wren', 'Brannoc',
    'Sela', 'Odo', 'Mira', 'Halvard', 'Tamsin', 'Edrik', 'Nessa', 'Garrow', 'Ilse', 'Pell',
    'Rowena', 'Bastian', 'Kestrel', 'Yorin', 'Avela', 'Dunstan', 'Lisbet', 'Orrin', 'Quill', 'Saoirse',
    'Thane', 'Vesna', 'Calder', 'Elowen', 'Hask', 'Juniper', 'Marrok', 'Tilda', 'Ulric', 'Zara',
];

const RACES = ['human', 'human', 'nymph', 'ferin', 'kobalos', 'bufos'];
const COLORS = ['#4488ff', '#cc44ff', '#44cc66', '#ffcc44', '#44ccdd', '#cc8844', '#ff6688', '#88dd44', '#dd6633', '#66aaff', '#bb88ff', '#ffaa33'];

// What each starting role carries when it joins: { armorKey, helmetKey, weaponKey, toolKey }.
export const STARTING_GEAR = {
    warden:      { armorKey: 'wool_tunic',     helmetKey: 'wool_cap',    weaponKey: 'wooden_wand', toolKey: 'iron_shield' },
    evoker:      { armorKey: 'wool_tunic',     helmetKey: 'wool_cap',    weaponKey: 'wooden_wand', toolKey: null },
    runebow:     { armorKey: 'leather_jacket', helmetKey: 'leather_cap', weaponKey: 'short_bow',   toolKey: 'hunters_quiver' },
    spellblade:  { armorKey: 'leather_vest',   helmetKey: 'leather_cap', weaponKey: 'iron_sword',  toolKey: null },
    stoneshaper: { armorKey: 'leather_jacket', helmetKey: 'leather_cap', weaponKey: 'wooden_club', toolKey: 'stone_axe' },
    seer:        { armorKey: 'cotton_shirt',   helmetKey: 'wool_cap',    weaponKey: 'wooden_wand', toolKey: 'lantern' },
    illusionist: { armorKey: 'cotton_tunic',   helmetKey: 'cotton_cap',  weaponKey: 'wooden_wand', toolKey: null },
    gravecaller: { armorKey: 'wool_tunic',     helmetKey: 'wool_cap',    weaponKey: 'wooden_wand', toolKey: 'lantern' },
    alchemist:   { armorKey: 'leather_jacket', helmetKey: 'leather_cap', weaponKey: 'wooden_wand', toolKey: null },
    warlord:     { armorKey: 'leather_vest',   helmetKey: 'leather_cap', weaponKey: 'iron_sword',  toolKey: 'iron_shield' },
};

// The root of a job's skill tree: every member joins knowing it.
export function starterAbility(job) {
    return Object.keys(JOB_DATA[job].learnable)[0];
}

// A new party member on a Tier 1 job. `takenNames` keeps names unique in the party,
// since battle scripts are keyed by name.
//   opts.level  The level they join at. They arrive with a skill point per level to spend.
export function createMember(rng, job, takenNames = [], { level = 1 } = {}) {
    const free = NAMES.filter(n => !takenNames.includes(n));
    const name = free.length ? rng.pick(free) : `${rng.pick(NAMES)} ${takenNames.length + 1}`;
    return {
        name,
        job,
        origin: null,
        team: 'player',
        x: 0, y: 0,
        ct: rng.range(0, 50),
        level,
        xp: 0,
        sp: level,
        learned: [starterAbility(job)],
        ranks: {},
        loadout: { reaction: null, support: null, movement: null },
        hp: null,
        appearance: {
            race: rng.pick(RACES),
            bodyVariant: rng.range(1, 5),
            hairVariant: rng.range(1, 18),
            shirtVariant: rng.range(1, 5),
            nameColor: rng.pick(COLORS),
            ...STARTING_GEAR[job],
        },
    };
}

// Recruit candidates for a recruit node: distinct Tier 1 roles, preferring ones the party
// lacks, joining a level below the party's average.
export function recruitCandidates(rng, party, jobs = jobsOfTier(1), count = 3) {
    const avg = party.reduce((s, m) => s + (m.level || 1), 0) / Math.max(1, party.length);
    const level = Math.max(1, Math.round(avg) - 1);
    const have = new Set(party.map(m => m.origin ?? m.job));
    const missing = rng.shuffle(jobs.filter(j => !have.has(j)));
    const rest = rng.shuffle(jobs.filter(j => have.has(j)));
    const taken = party.map(m => m.name);
    const out = [];
    for (const job of [...missing, ...rest].slice(0, count)) {
        const m = createMember(rng, job, [...taken, ...out.map(c => c.name)], { level });
        out.push(m);
    }
    return out;
}
