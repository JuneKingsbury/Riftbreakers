// Deterministic outcome estimate for scripted-AI decisions ("best damage
// ability", kill checks). It mirrors the core of abilities.js:resolveAbility
// without randomness or side effects. It deliberately ignores the long tail
// (passives like divine_ward, reflect, reraise), so treat it as a ranking
// heuristic and never as a promise of the exact damage dealt.
import { ABILITIES } from '../data-registry.js';
import { getEffectiveStat, dodgeChance, critChance, CRIT_MULT } from '../abilities.js';

// Expected { damage, healing } of `source` using `abilityKey` on `target`.
// Physical damage is weighted by hit chance. Variance is taken as 1.0.
export function estimateAbilityEffect(source, target, abilityKey, map) {
    const ab = ABILITIES[abilityKey];
    if (!ab || ab.passive || ab.isCure || ab.isSummon || !ab.basePower) return { damage: 0, healing: 0 };

    if (ab.isHeal) {
        return { damage: 0, healing: Math.round((getEffectiveStat(source, 'mat') * 2 + 8) * ab.basePower) };
    }
    if (ab.targetType === 'self') return { damage: 0, healing: 0 };

    const highGround = (source.z ?? 0) > (target.z ?? 0) ? 1.25 : 1.0;
    const defMult = target.status.includes('defend') ? 1.5 : 1.0;

    let raw;
    let hitChance = 1.0;
    if (ab.type === 'physical') {
        raw = Math.max(1, getEffectiveStat(source, 'atk') * 2 - getEffectiveStat(target, 'def') * defMult) * ab.basePower * highGround;
        if (target.status.includes('protect')) raw *= 0.75;
        hitChance = 1 - dodgeChance(source, target, ab);
    } else {
        raw = Math.max(1, getEffectiveStat(source, 'mat') * 2 - getEffectiveStat(target, 'mdf') * defMult) * ab.basePower * highGround;
        if (target.status.includes('shell')) raw *= 0.75;
    }
    // Nightmare, Catalyst: extra damage against a target with the named status.
    for (const [status, mult] of Object.entries(ab.bonusVsStatus ?? {})) if (target.status.includes(status)) raw *= mult;
    // Expected damage: critical hits add CRIT_MULT - 1 extra, as often as they happen.
    const critBonus = 1 + critChance(source, ab) * (CRIT_MULT - 1);
    return { damage: Math.round(raw * hitChance * critBonus), healing: 0 };
}
