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
    hidden: 'spell_teleport', taunted: 'danger',
};

/** The sprite shown when a status lands on a unit, or null. */
export function statusSprite(status) {
    return STATUS_SPRITES[status] ?? null;
}

// ---- Area effects ----------------------------------------------------------------------
// How an ability that covers an area plays out on each tile it hits (battle-view3d.fxArea):
//   kind     particle style per tile (see AREA_KINDS in battle-view3d.js)
//   colors   particle colors          flash  color of the brief glow on every tile hit
//   quake    how hard the ground shakes, in world units (0: it doesn't)
// Tiles further from the center play a little later, so the effect ripples outward.

const AREA_BY_ELEMENT = {
    earth:    'quake',
    fire:     'flames',
    ice:      'frost',
    thunder:  'storm',
    holy:     'light',
    nature:   'spores',
    alchemy:  'splash',
    command:  'rally',
    void:     'arcane', shadow: 'arcane', spirit: 'arcane', arcane: 'arcane', illusion: 'arcane', necrotic: 'arcane',
};

/** The area style for an ability (any ability with an area; see AREA_BY_ELEMENT). */
export function areaStyle(abilityKey) {
    const ab = ABILITIES[abilityKey] ?? {};
    let kind = AREA_BY_ELEMENT[ab.element];
    if (ab.terrainEffect) kind = 'quake';                    // the ground itself is reshaped
    if (!kind) kind = ab.isHeal || ab.isCure || ab.targetType === 'ally' ? 'blessing' : 'impact';
    const colors = kind === 'quake' ? PALETTES.earth
        : kind === 'blessing' ? (ab.isHeal ? HEAL_COLORS : BUFF_COLORS)
        : kind === 'impact' ? PHYSICAL_SPARKS
        : kind === 'rally' ? BUFF_COLORS
        : abilityColors(abilityKey);
    // Big earth spells shake hardest; thunder and volleys rattle the ground a little.
    const radius = ab.aoe ?? 1;
    const quake = kind === 'quake' ? 0.06 + 0.035 * radius : kind === 'storm' ? 0.025 : (kind === 'impact' && ab.animType === 'shot') ? 0.02 : 0;
    return { kind, colors, flash: kind === 'splash' ? colors[0] : (colors[1] ?? colors[0]), quake };
}
