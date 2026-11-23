// Which effect goes with which ability or event: colors, projectile and impact sprites, and
// how hard the camera shakes. Pure lookups, so the choices are testable without WebGL; the
// battle view (battle-view3d.js) plays them through BattleFx (battle-fx.js).
import { ABILITIES } from './abilities.js';
import { STATUSES, ENGINE_STATES, STATS } from '../content/vocab.js';

// Particle colors per element: bright core first, then the darker edges. Alchemy has none:
// each flask glows its own projectileColor.
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
    necrotic: ['#d8ffd0', '#7acc6a', '#2a4a2a'],
    illusion: ['#ffe8ff', '#e0a0ff', '#9a6add'],
    command:  ['#fff4d0', '#ffcc66', '#e08a2a'],
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
        case 'shadow': case 'void': case 'spirit': case 'necrotic': return 'projectile_void';
        case 'arcane': case 'holy': case 'ice': case 'illusion': return 'projectile_arcane';
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
        case 'shadow': case 'void': case 'spirit': case 'arcane': case 'necrotic': case 'illusion': return 'spell_attack';
        case 'command': return 'rally';
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
    silence: 'mental_break', enfeebled: 'damage_flash',
};

/** The sprite shown when a status lands on a unit, or null. */
export function statusSprite(status) {
    return STATUS_SPRITES[status] ?? null;
}

// ---- Lingering statuses ----------------------------------------------------------------
// While a status lasts, the unit wears a badge on its tag (glyph + color) and, for most,
// gives off a trickle of particles (aura). Glyphs carry U+FE0E so they draw as text, not emoji.
// aura: every  ms between puffs        y  height above the unit's feet, world units
//       the rest is passed to BattleFx.burst
const STATUS_LOOKS = {
    poison:    { glyph: '☣', color: '#9e4', aura: { every: 420, y: 0.5, layer: 'mote', count: 1, colors: POISON_COLORS,
        speed: [0, 0.1], up: [0.25, 0.45], gravity: -0.1, life: [0.7, 1], radius: 0.18, wobble: 0.04, alpha: 0.8 } },
    slow:      { glyph: '❄', color: '#8cf', aura: { every: 520, y: 0.9, layer: 'mote', count: 1, colors: ['#ffffff', '#c4e8ff', '#8cc8ff'],
        speed: [0, 0.05], up: [-0.3, -0.15], life: [0.9, 1.2], radius: 0.25, wobble: 0.06, alpha: 0.7 } },
    silence:   { glyph: '∅', color: '#bbb', aura: { every: 700, y: 0.95, layer: 'mote', count: 1, colors: ['#d0d0d8', '#9090a0'],
        speed: [0, 0.05], up: [0.1, 0.2], life: [0.6, 0.8], radius: 0.12, alpha: 0.6 } },
    sleep:     { glyph: 'z', color: '#b9f', aura: { every: 650, y: 0.95, layer: 'mote', count: 1, colors: ['#e8dcff', '#b49cff'],
        speed: [0.05, 0.12], up: [0.2, 0.3], gravity: -0.05, life: [1, 1.3], radius: 0.08, wobble: 0.08, alpha: 0.75 } },
    stun:      { glyph: '✦', color: '#fe5', aura: { every: 180, y: 1.0, layer: 'spark', count: 1, colors: ['#ffffff', '#fff06a', '#ffd84a'],
        speed: [0.3, 0.5], up: [0, 0.05], life: [0.25, 0.35], radius: 0.06 } },
    berserk:   { glyph: '‼', color: '#f54', aura: { every: 260, y: 0.4, layer: 'spark', count: 2, colors: ['#ffd0a0', '#ff6a3a', '#e02a1a'],
        speed: [0.1, 0.25], up: [0.4, 0.7], life: [0.3, 0.45], radius: 0.22 } },
    charm:     { glyph: '♥', color: '#f8c', aura: { every: 480, y: 0.8, layer: 'mote', count: 1, colors: ['#ffd8ee', '#ff8cc8', '#ff4aa0'],
        speed: [0, 0.08], up: [0.25, 0.4], gravity: -0.05, life: [0.8, 1.1], radius: 0.2, wobble: 0.05 } },
    frog:      { glyph: '≈', color: '#7d5', aura: { every: 700, y: 0.3, layer: 'mote', count: 1, colors: ['#d8ffb0', '#8ad84a', '#4a9a2a'],
        speed: [0.05, 0.12], up: [0.15, 0.3], gravity: 0.1, life: [0.5, 0.7], radius: 0.15, alpha: 0.7 } },
    enfeebled: { glyph: '⇣', color: '#e86', aura: { every: 600, y: 0.8, layer: 'mote', count: 1, colors: ['#ffc8a0', '#e8865a'],
        speed: [0, 0.05], up: [-0.3, -0.15], life: [0.6, 0.8], radius: 0.18, alpha: 0.6 } },
    doom:      { glyph: '☠', color: '#f6c', aura: { every: 380, y: 0.7, layer: 'mote', count: 1, colors: ['#c06', '#802', '#3a0a2a'],
        speed: [0.05, 0.15], up: [-0.25, -0.1], life: [0.7, 1], radius: 0.25, alpha: 0.8 } },
    taunted:   { glyph: '⚑', color: '#f64', aura: { every: 600, y: 1.05, layer: 'spark', count: 1, colors: ['#ff9a6a', '#ff4a2a'],
        speed: [0, 0.1], up: [0.15, 0.3], life: [0.3, 0.4], radius: 0.05 } },
    haste:     { glyph: '»', color: '#fd5', aura: { every: 300, y: 0.15, layer: 'spark', count: 2, colors: BUFF_COLORS,
        speed: [0.1, 0.3], up: [0.1, 0.3], life: [0.3, 0.45], radius: 0.2 } },
    protect:   { glyph: '◈', color: '#9cf', ward: true, aura: { every: 650, y: 0.5, layer: 'spark', count: 1, colors: ['#ffffff', '#c8e4ff', '#88bbff'],
        speed: [0, 0.05], up: [0, 0.1], life: [0.35, 0.5], radius: 0.32 } },
    shell:     { glyph: '◎', color: '#d9f', ward: true, aura: { every: 650, y: 0.5, layer: 'spark', count: 1, colors: ['#ffffff', '#ecd0ff', '#c08cff'],
        speed: [0, 0.05], up: [0, 0.1], life: [0.35, 0.5], radius: 0.32 } },
    regen:     { glyph: '✚', color: '#6f8', aura: { every: 450, y: 0.2, layer: 'mote', count: 1, colors: HEAL_COLORS,
        speed: [0, 0.08], up: [0.4, 0.6], gravity: -0.1, life: [0.7, 0.9], radius: 0.25, wobble: 0.03 } },
    reflect:   { glyph: '◇', color: '#eef', aura: { every: 500, y: 0.55, layer: 'spark', count: 1, colors: ['#ffffff', '#e0f4ff'],
        speed: [0, 0.05], up: [0, 0.05], life: [0.2, 0.3], radius: 0.35 } },
    reraise:   { glyph: '☥', color: '#fe8', aura: { every: 900, y: 0.3, layer: 'mote', count: 1, colors: ['#fffbe0', '#ffe68a'],
        speed: [0, 0.05], up: [0.3, 0.45], gravity: -0.05, life: [0.8, 1], radius: 0.2, alpha: 0.7 } },
    slipped:   { glyph: '~', color: '#9ef', aura: { every: 650, y: 0.1, layer: 'mote', count: 1, colors: ['#e0f8ff', '#9ee0ff'],
        speed: [0.15, 0.3], up: [0, 0.05], life: [0.4, 0.6], radius: 0.3, alpha: 0.5 } },
    hidden:    { glyph: '◌', color: '#99a', aura: { every: 500, y: 0.5, layer: 'mote', count: 1, colors: ['#c8c8d8', '#7a7a8a'],
        speed: [0, 0.05], up: [0.05, 0.15], life: [0.8, 1.1], radius: 0.35, wobble: 0.05, alpha: 0.35 } },
    defend:    { glyph: '▼', color: '#fd8', ward: true, aura: { every: 700, y: 0.5, layer: 'spark', count: 1, colors: ['#fff6d0', '#ffd88a'],
        speed: [0, 0.05], up: [0, 0.08], life: [0.3, 0.45], radius: 0.3 } },
};
const STAT_SHORT = { atk: 'ATK', def: 'DEF', mat: 'MAT', mdf: 'MDF', eva: 'EVA', crit: 'CRT', spd: 'SPD', move: 'MOV' };

/** The particle trickle a lingering status gives off, or null. */
export function statusAura(status) {
    return STATUS_LOOKS[status]?.aura ?? null;
}

/**
 * The badges on a unit's tag: one per status it has (in vocab order, harmful first), then
 * one per stat its buffs leave raised or lowered. Each is { key, glyph, color, name, turns,
 * harmful }; `turns` is null when the status has no countdown worth showing. Doom has its
 * own countdown on the tag, so it is left out unless `withDoom`.
 */
export function statusBadges(unit, { withDoom = false } = {}) {
    const has = new Set(unit?.status ?? []);
    const out = [];
    for (const key of [...Object.keys(STATUSES), 'defend']) {
        if (!has.has(key) || (key === 'doom' && !withDoom)) continue;
        const look = STATUS_LOOKS[key] ?? { glyph: '?', color: '#fc6' };
        const t = unit.statusTimers?.[key];
        out.push({ key, glyph: look.glyph + '︎', color: look.color,
            name: STATUSES[key]?.name ?? ENGINE_STATES[key]?.name ?? key,
            desc: STATUSES[key]?.desc ?? ENGINE_STATES[key]?.desc ?? '',
            turns: t > 0 && t < 99 ? t : null, harmful: !!STATUSES[key]?.harmful });
    }
    // Buffs from statuses (Frog, Enfeeble) already have their badge.
    const net = {};
    for (const b of unit?.buffs ?? []) {
        if (b.key === 'enfeebled' || String(b.key).startsWith('frog_')) continue;
        net[b.stat] = (net[b.stat] ?? 0) + b.value;
    }
    for (const [stat, v] of Object.entries(net)) {
        if (!v) continue;
        const label = STAT_SHORT[stat] ?? stat.toUpperCase();
        out.push({ key: `buff_${stat}`, glyph: `${label}${v > 0 ? '▲' : '▼'}`, color: v > 0 ? '#7e7' : '#f77',
            name: `${label} ${v > 0 ? '+' : ''}${v}`, desc: STATS[stat]?.desc ?? '', turns: null, harmful: v < 0 });
    }
    return out;
}

/** The colors of the protective statuses on a unit (Protect, Shell, Defend), for its HP bar. */
export function wardColors(unit) {
    return (unit?.status ?? []).filter(s => STATUS_LOOKS[s]?.ward).map(s => STATUS_LOOKS[s].color);
}

// HP bar fill per team, so friend and foe read apart at a glance.
export const HP_BAR_COLORS = { player: '#3c3', enemy: '#e33' };

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
