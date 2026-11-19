import { createUnitFromCharData, faceToward } from './units.js';
import { inflictStatus, supportOf } from './abilities.js';
import { getScriptFor } from './ai/script-store.js';
import { CHARACTER_DATA } from './data/characters.js';
import { equipmentStatBonuses } from './data/equipment.js';
import { RELICS, relicStatMods } from '../run/data/relics.js';
import { AFFIXES, knownAffixes, affixedName } from '../run/data/affixes.js';

// Enemy character entries for an encounter (see run/data/encounters.js buildEncounter).
export function encounterEnemies(encounter) {
    if (!encounter?.roster) return CHARACTER_DATA.filter(c => c.team === 'enemy');
    return encounter.roster.map(r => {
        // Elite affixes (run/data/affixes.js) on the fight's leader.
        const affixes = knownAffixes(r.affixes).map(k => AFFIXES[k]);
        return {
            name:           affixedName(r.name, r.affixes),
            baseName:       r.name,   // its sprite is found by this name (enemy-sprites.js)
            affixes:        knownAffixes(r.affixes),
            job:            r.job,
            team:           'enemy',
            x:              20, y: 8,   // overwritten by spawn positions
            ct:             r.ct ?? 0,
            level:          r.level ?? encounter.enemyLevel ?? 1,
            statMods:       addMods(r.statMods, ...affixes.map(a => a.statMods)),
            extraAbilities: [...(r.extraAbilities ?? []), ...affixes.flatMap(a => a.extraAbilities ?? [])],
            appearance:     r.appearance ?? null,
            spriteKey:      r.sprite ?? null,
            tint:           r.tint ?? null,
        };
    });
}

// A boss's phases (encounter.phases) as hpBelow triggers (tactical/triggers.js), with its
// reinforcements made ready to place as characters.
function phaseTriggers(encounter, boss) {
    return encounter.phases.map((p, i) => ({
        ...p, on: 'hpBelow', pct: p.at, id: `phase:${i}`, label: p.name ?? boss.name, text: p.name ?? '!',
        summon: (p.summon ?? []).map(r => encounterEnemies({ ...encounter, roster: [r] })[0]),
    }));
}

// What a leader's affixes do once it's a unit: more max HP, passives, opening statuses.
function applyAffixes(unit, keys) {
    if (!keys?.length) return;
    unit.affixes = [...keys];
    for (const a of keys.map(k => AFFIXES[k])) {
        if (a.maxHpPct) {
            unit.maxHp = Math.round(unit.maxHp * (1 + a.maxHpPct));
            unit.hp = unit.maxHp;
        }
        if (a.passives?.length) unit.bonusPassives = [...(unit.bonusPassives ?? []), ...a.passives];
        for (const fx of a.battleStart ?? []) inflictStatus(unit, fx.status, fx.duration ?? 3);
    }
}

function addMods(...mods) {
    const out = {};
    for (const m of mods) for (const [k, v] of Object.entries(m || {})) out[k] = (out[k] || 0) + v;
    return out;
}

/**
 * Builds the player and enemy units for a battle. Pure game setup with no
 * rendering or DOM dependency, so headless tests and any renderer can share it.
 *
 * setup.party      Party member records (default: the CHARACTER_DATA players). A member's
 *                  `hp`, when set, carries their wounds into the battle.
 * setup.encounter  { roster, enemyLevel } (default: the CHARACTER_DATA enemies)
 * setup.relics     Relic keys whose stat bonuses and battle-start statuses apply to the party
 */
export function buildUnits(setup, playerSpawns, enemySpawns) {
    const partyData = setup?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');
    const enemyData = encounterEnemies(setup?.encounter);
    const relics    = setup?.relics ?? [];
    const relicMods = relicStatMods(relics);

    const spawnFor = (charData) => {
        const list = charData.team === 'player' ? playerSpawns : enemySpawns;
        const idx  = (charData.team === 'player' ? partyData : enemyData).indexOf(charData);
        return list?.[idx] ?? null;
    };

    const units = [...partyData, ...enemyData].map((charData) => {
        const isPlayer = charData.team === 'player';
        const statMods = addMods(charData.statMods, equipmentStatBonuses(charData.appearance), isPlayer ? relicMods : null);
        // Fall back to the charData position if there are fewer spawn tiles than units.
        const spawn = spawnFor(charData);
        const unit = createUnitFromCharData({
            ...charData, statMods,
            x: spawn ? spawn.x : charData.x,
            y: spawn ? spawn.y : charData.y,
        });
        unit.z = spawn?.z ?? null;   // null: the battle settles it from the map
        if (!isPlayer) {
            if (charData.baseName) unit.spriteName = charData.baseName;
            applyAffixes(unit, charData.affixes);
            // Boss phases go on the boss: the encounter's first roster entry.
            if (charData === enemyData[0] && setup?.encounter?.phases) unit.triggers = phaseTriggers(setup.encounter, unit);
            // The boss is the boss encounter's first roster entry (Doom only wounds it: battle.js).
            if (charData === enemyData[0] && setup?.encounter?.kind === 'boss') unit.isBoss = true;
        }
        if (isPlayer) {
            if (charData.hp != null) unit.hp = Math.max(1, Math.min(unit.maxHp, charData.hp));
            // Player characters fight by their battle script. Enemies keep the scoring AI.
            unit.script = getScriptFor(charData);
            for (const key of relics) {
                const r = RELICS[key];
                const fx = r?.battleStart;
                if (fx) inflictStatus(unit, fx.status, fx.duration);
                // Passives and battle triggers (tactical/triggers.js) every member has.
                if (r?.passives?.length) unit.bonusPassives = [...(unit.bonusPassives ?? []), ...r.passives];
                for (const [i, t] of (r?.triggers ?? []).entries()) {
                    (unit.triggers ??= []).push({ ...t, id: `relic:${key}:${i}`, label: r.name });
                }
            }
        }
        return unit;
    });
    const players = units.filter(u => u.team === 'player');
    const enemies = units.filter(u => u.team === 'enemy');
    // Field Command / Initiative: the best head start any member gives goes to the whole party.
    const headStart = Math.max(0, ...players.map(u => supportOf(u)?.partyStartCt ?? 0));
    if (headStart) for (const u of players) u.ct += headStart;
    const centre = (arr) => arr.length
        ? { x: arr.reduce((s, u) => s + u.x, 0) / arr.length, y: arr.reduce((s, u) => s + u.y, 0) / arr.length }
        : null;
    const enemyC = centre(enemies), playerC = centre(players);
    if (enemyC) players.forEach(u => faceToward(u, enemyC.x, enemyC.y));
    if (playerC) enemies.forEach(u => faceToward(u, playerC.x, playerC.y));
    return units;
}
