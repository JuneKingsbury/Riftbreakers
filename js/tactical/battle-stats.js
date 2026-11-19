// What each unit did in a battle, for the breakdown on the result screen: damage dealt,
// damage taken, healing done and knockouts, in total and per ability.
//
// Only real HP changes count: a 90-damage hit on a unit with 12 HP left is 12 damage, and
// healing a unit already at full HP is no healing. A summoned creature's numbers go to the
// unit that summoned it (an Illusionist's copies soaking hits is the Illusionist's work).
// Damage over time (poison, doom) goes to whoever inflicted it.
//
// The battle records into this as things happen (TacticalBattle.stats). It never affects
// the rules: nothing reads it during a fight.

/** One unit's totals, plus the same numbers per ability key. */
function emptyLine() {
    return { dealt: 0, taken: 0, healed: 0, kos: 0, fromSummons: false, abilities: {} };
}

function emptyAbility() {
    return { dealt: 0, healed: 0, kos: 0, uses: 0 };
}

export class BattleStats {
    constructor() {
        /** Totals by the id of the unit they're credited to (a summoner for its summons). */
        this.byUnit = new Map();
        /** Every unit seen, by id, so summons can be traced to their summoner. */
        this._units = new Map();
    }

    /** Registers units so their ids resolve, and their summoners. Safe to call repeatedly. */
    track(units) {
        for (const u of units) this._units.set(u.id, u);
    }

    // The unit a summon's numbers belong to: its summoner, or its summoner's summoner.
    _owner(unit) {
        if (!unit) return null;
        let u = unit;
        for (let i = 0; i < 8 && u.summonerId != null; i++) {
            const up = this._units.get(u.summonerId);
            if (!up) break;
            u = up;
        }
        return u;
    }

    _line(unit) {
        const owner = this._owner(unit);
        if (!owner) return null;
        this._units.set(owner.id, owner);
        let line = this.byUnit.get(owner.id);
        if (!line) { line = emptyLine(); this.byUnit.set(owner.id, line); }
        if (owner !== unit) line.fromSummons = true;
        return line;
    }

    _ability(line, key) {
        if (!key) return null;
        return (line.abilities[key] ??= emptyAbility());
    }

    /**
     * Damage `source` did to `target` with ability `key`. `amount` must be HP actually lost.
     * A null `source` (no one to credit) still counts as damage taken.
     */
    damage(source, target, amount, key) {
        if (!(amount > 0)) return;
        const victim = this._line(target);
        if (victim) victim.taken += amount;
        // Hitting your own side (a flask's splash) is damage taken, not damage dealt.
        if (!source || this._owner(source).team === this._owner(target).team) return;
        const line = this._line(source);
        if (!line) return;
        line.dealt += amount;
        const ab = this._ability(line, key);
        if (ab) ab.dealt += amount;
    }

    /** Healing `source` gave `target` with `key`. `amount` must be HP actually restored. */
    heal(source, target, amount, key) {
        if (!(amount > 0)) return;
        // Healing the other side (a flask's splash) isn't counted.
        if (source && this._owner(source).team !== this._owner(target).team) return;
        const line = this._line(source ?? target);
        if (!line) return;
        line.healed += amount;
        const ab = this._ability(line, key);
        if (ab) ab.healed += amount;
    }

    /**
     * A knockout: `source` dropped `target` to 0 HP with `key`. Copies (inert units such as
     * Mirror Images) don't count, since breaking one is what they're for.
     */
    knockout(source, target, key, { inert = false } = {}) {
        if (inert || !source || this._owner(source).team === this._owner(target).team) return;
        const line = this._line(source);
        if (!line) return;
        line.kos += 1;
        const ab = this._ability(line, key);
        if (ab) ab.kos += 1;
    }

    /** One use of ability `key` by `source` (each cast counts once, however many it hits). */
    use(source, key) {
        const line = this._line(source);
        const ab = line && this._ability(line, key);
        if (ab) ab.uses += 1;
    }

    /**
     * Moves damage taken from one unit to another (a reaction that takes part of a blow
     * meant for an ally). The attacker's damage dealt is unchanged.
     */
    shiftTaken(from, to, amount) {
        if (!(amount > 0)) return;
        const a = this._line(from), b = this._line(to);
        if (a) a.taken = Math.max(0, a.taken - amount);
        if (b) b.taken += amount;
    }

    /**
     * The breakdown for the result screen: one row per unit that started the fight on the
     * team (summons are folded into their summoner), in id order.
     * Each row: { id, name, job, team, dealt, taken, healed, kos, fromSummons,
     * abilities: [{ key, dealt, healed, kos, uses }] sorted by damage then healing }.
     */
    rows(team) {
        const out = [];
        for (const u of this._units.values()) {
            if (u.team !== team || u.summonerId != null) continue;
            const line = this.byUnit.get(u.id) ?? emptyLine();
            const abilities = Object.entries(line.abilities)
                .map(([key, a]) => ({ key, ...a }))
                .filter(a => a.dealt > 0 || a.healed > 0 || a.kos > 0)
                .sort((a, b) => b.dealt - a.dealt || b.healed - a.healed || b.kos - a.kos);
            out.push({
                id: u.id, name: u.name, job: u.job, team: u.team,
                dealt: line.dealt, taken: line.taken, healed: line.healed, kos: line.kos,
                fromSummons: line.fromSummons, abilities,
            });
        }
        return out.sort((a, b) => a.id - b.id);
    }
}
