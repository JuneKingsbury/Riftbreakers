// Deterministic outcome estimate for scripted-AI decisions ("best damage
// ability", kill checks). It mirrors the core of abilities.js:resolveAbility
// without randomness or side effects. It deliberately ignores the long tail
// (passives like divine_ward, reflect, reraise), so treat it as a ranking
// heuristic and never as a promise of the exact damage dealt.
import { getTile } from '../battle-map.js';
import { ABILITIES } from '../data-registry.js';
import { getEffectiveStat, directionEvasionMod } from '../abilities.js';

// Expected { damage, healing } of `source` using `abilityKey` on `target`.
// Physical damage is weighted by hit chance. Variance is taken as 1.0.
export function estimateAbilityEffect(source, target, abilityKey, map) {
    const ab = ABILITIES[abilityKey];
    if (!ab || ab.passive || ab.isCure || ab.isSummon || !ab.basePower) return { damage: 0, healing: 0 };

    if (ab.isHeal) {
        return { damage: 0, healing: Math.round((getEffectiveStat(source, 'mat') * 2 + 8) * ab.basePower) };
    }
    if (ab.targetType === 'self') return { damage: 0, healing: 0 };

    const srcTile = getTile(map, source.x, source.y);
    const tgtTile = getTile(map, target.x, target.y);
    const highGround = (srcTile && tgtTile && srcTile.elevation > tgtTile.elevation) ? 1.25 : 1.0;
    const defMult = target.status.includes('defend') ? 1.5 : 1.0;

    let raw;
    let hitChance = 1.0;
    if (ab.type === 'physical') {
        raw = Math.max(1, getEffectiveStat(source, 'atk') * 2 - getEffectiveStat(target, 'def') * defMult) * ab.basePower * highGround;
        if (target.status.includes('protect')) raw *= 0.75;
        const eva = ((getEffectiveStat(target, 'eva') || 0) / 100) * directionEvasionMod(source, target);
        const defendBonus = target.status.includes('defend') ? 0.2 : 0;
        hitChance = 1 - Math.min(0.9, eva + defendBonus);
    } else {
        raw = Math.max(1, getEffectiveStat(source, 'mat') * 2 - getEffectiveStat(target, 'mdf') * defMult) * ab.basePower * highGround;
        if (target.status.includes('shell')) raw *= 0.75;
    }
    return { damage: Math.round(raw * hitChance), healing: 0 };
}
