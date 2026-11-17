// Which effect goes with which ability or event: colors, projectile and impact sprites, and
// how hard the camera shakes. Pure lookups, so the choices are testable without WebGL; the
// battle view (battle-view3d.js) plays them through BattleFx (battle-fx.js).
import { ABILITIES } from './abilities.js';

// Particle colors per element: bright core first, then the darker edges.
const PALETTES = {
    fire:    ['#ffe27a', '#ff9a2e', '#ff4a1e'],
    ice:     ['#ffffff', '#a8e8ff', '#4aa8ff'],
    thunder: ['#ffffcc', '#fff06a', '#9ad8ff'],
    shadow:  ['#c08cff', '#7a3ae0', '#3a1466'],
    void:    ['#d090ff', '#7a44ff', '#2a0a55'],
    arcane:  ['#f0d0ff', '#c8a0ff', '#88ccff'],
    holy:    ['#ffffff', '#fff2a8', '#ffd84a'],
    spirit:  ['#ecffff', '#a8eaff', '#70c8ff'],
    nature:  ['#e6ff9a', '#9ae85a', '#4aa83a'],
    earth:   ['#d8b888', '#a07a4a', '#6a5236'],
};
export const PHYSICAL_SPARKS = ['#ffffff', '#fff2c0', '#ffd27a'];
export const HEAL_COLORS = ['#c8ffc8', '#66ff88', '#2ee06a'];
export const BUFF_COLORS = ['#fff6c0', '#ffd84a', '#ffaa33'];
export const DEATH_COLORS = ['#d8d8e0', '#9a9aa8', '#5a5a68'];
export const POISON_COLORS = ['#c8ff7a', '#8ae04a', '#5aa83a'];

/** Particle colors for an ability: its element's palette, else its projectile color. */
export function abilityColors(abilityKey) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return PHYSICAL_SPARKS;
    if (PALETTES[ab.element]) return PALETTES[ab.element];
    if (ab.isHeal) return HEAL_COLORS;
    if (ab.type === 'magic' || ab.animType === 'cast') return [ab.projectileColor ?? '#ccddff', '#ffffff'];
    return PHYSICAL_SPARKS;
}

/** True for thrown rocks and stones, which tumble instead of flying point-first. */
function isThrown(key) {
    return /stone|rock|boulder/.test(key);
}

/** The skin sprite a projectile flies as, or null for a plain glowing orb. */
export function projectileSprite(abilityKey) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return null;
    const key = String(abilityKey).split('@')[0];
    if (ab.animType === 'shot') return isThrown(key) ? null : 'projectile_arrow';
    switch (ab.element) {
        case 'fire': case 'thunder': case 'nature': return 'projectile_spell';
        case 'shadow': case 'void': case 'spirit': return 'projectile_void';
        case 'arcane': case 'holy': case 'ice':    return 'projectile_arcane';
        default: return null;
    }
}

/** The skin sprite that flashes where an ability hits, by element. */
export function impactSprite(abilityKey) {
    const ab = ABILITIES[abilityKey];
    switch (ab?.element) {
        case 'fire':  return 'fire';
        case 'ice':   return 'freezing';
        case 'holy':  return 'smite';
        case 'shadow': case 'void': case 'spirit': case 'arcane': return 'spell_attack';
        default:      return ab?.animType === 'cast' ? 'spell_attack' : 'hit';
    }
}

/** The swoosh drawn in front of a melee attacker: a stab for thrusts, else a swing. */
export function meleeSprite(abilityKey) {
    const key = String(abilityKey).split('@')[0];
    return /spear|pierc|stab|thrust|lance|venom|bite|pounce|charge|rush/.test(key) ? 'attack_stab' : 'attack_swing';
}

/** Whether a hit is big for its target: a quarter of its max HP or more. */
export function isHeavyHit(damage, target) {
    return damage >= Math.max(1, target?.maxHp ?? 1) * 0.25;
}

/** Camera shake for a hit, in tiles: hits on the party shake, heavy ones more. */
export function hitShake(damage, target) {
    if (target?.team !== 'player') return isHeavyHit(damage, target) ? 0.03 : 0;
    return isHeavyHit(damage, target) ? 0.07 : 0.035;
}

// Statuses with their own sprite when they land.
const STATUS_SPRITES = {
    protect: 'spell_shield', shell: 'spell_shield', reflect: 'spell_shield', slipped: 'spell_shield',
    haste: 'speed_trail', regen: 'health_regen', reraise: 'spell_divination',
    slow: 'freezing', stun: 'mental_break', sleep: 'mental_break', charm: 'mental_break',
    berserk: 'mental_break', doom: 'death', frog: 'spell_teleport',
};

/** The sprite shown when a status lands on a unit, or null. */
export function statusSprite(status) {
    return STATUS_SPRITES[status] ?? null;
}
