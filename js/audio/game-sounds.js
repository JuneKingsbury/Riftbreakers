// What the game plays when. Pure functions from game state to sound names (sound-manifest.js),
// so the choices are testable without audio. Scenes and screens call these, then Sound.
//
// Music:
//   title screen       menu_theme
//   a whole act        the act realm's track (else the generic expedition track): on the map,
//                      while deploying and through every battle, so it never restarts mid-act
//   a battle outside a run (test harnesses)  combat
//   a won run          credits
import { ABILITIES } from '../tactical/data-registry.js';
import { POSITIVE_STATUSES } from '../tactical/abilities.js';

const realmTrack = (id) => (id ? `expedition_${id}` : null);

/** Music candidates for the act map: the act realm's track, then the generic one. */
export function mapMusic(run) {
    return [realmTrack(run?.realmId), 'expedition'].filter(Boolean);
}

/**
 * Music candidates for deploying and fighting `encounter`: the same as the act map, so the
 * realm's track carries straight on into the battle. A fight outside a run gets combat music.
 */
export function battleMusic(encounter, run) {
    const realm = run?.realmId ?? encounter?.realm;
    return realm ? [realmTrack(realm), 'expedition', 'combat'] : ['combat'];
}
export const TITLE_MUSIC = ['menu_theme'];
export const VICTORY_MUSIC = ['credits'];

// Statuses that protect rather than empower.
const WARDS = new Set(['protect', 'shell', 'reflect', 'slipped']);
// Afflictions that take a unit out of the fight or turn it against its side.
const CONTROL = new Set(['stun', 'sleep', 'charm', 'berserk', 'frog', 'doom']);

/** The sound for using an ability, as its animation starts, or null. */
export function abilitySound(abilityKey) {
    const ab = ABILITIES[abilityKey];
    if (!ab) return null;
    if (ab.isSummon) return null;           // the arrival has its own sound (summon event)
    if (ab.terrainEffect) return 'terraform';
    if (ab.animType === 'shot') return 'arrow_fire';
    if (ab.animType === 'cast' || ab.type === 'magic') return 'spell_cast';
    return null;                            // melee: the impact carries it
}

/**
 * The sound for a battle event (TacticalBattle.onEvent), or null.
 *   hit { target, damage }    miss { target }    heal { target, amount }    revive { target }
 *   status { target, status }  buff { target }   summon { unit }
 */
export function battleEventSound(type, data = {}) {
    switch (type) {
        case 'hit':    return data.target?.team === 'player' ? 'hit_party' : 'hit_enemy';
        case 'miss':   return 'miss';
        case 'heal':   return 'spell_heal';
        case 'revive': return 'spell_revive';
        case 'buff':   return 'spell_buff';
        case 'summon': return 'summon';
        case 'status':
            if (WARDS.has(data.status)) return 'spell_shield';
            if (POSITIVE_STATUSES.includes(data.status)) return 'spell_buff';
            return CONTROL.has(data.status) ? 'spell_affliction' : null;
        default:       return null;
    }
}

/** The sound for a unit going down, by side. */
export function downSound(unit) {
    return unit.team === 'player' ? 'party_down' : 'enemy_down';
}

const isDown = (u) => u.status.includes('dead') || u.status.includes('unconscious');

/**
 * Tracks who is down between frames. Returns { down, fresh }: the ids down now, and the units
 * that went down since `previous` (ids). A revived unit leaves `down`, so it sounds again if
 * it falls again.
 */
export function downChanges(units, previous = new Set()) {
    const down = new Set(units.filter(isDown).map(u => u.id));
    return { down, fresh: units.filter(u => down.has(u.id) && !previous.has(u.id)) };
}

/** Whether a fight is worth an alarm as it starts. */
export function battleOpensWithAlert(encounter) {
    return encounter?.kind === 'boss' || encounter?.kind === 'elite';
}
