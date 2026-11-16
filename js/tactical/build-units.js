import { createUnitFromCharData, faceToward } from './units.js';
import { inflictStatus } from './abilities.js';
import { getScriptFor } from './ai/script-store.js';
import { CHARACTER_DATA } from './data/characters.js';
import { equipmentStatBonuses } from './data/equipment.js';
import { RELICS, relicStatMods } from '../run/data/relics.js';

// Enemy character entries for an encounter (see run/data/encounters.js buildEncounter).
export function encounterEnemies(encounter) {
    if (!encounter?.roster) return CHARACTER_DATA.filter(c => c.team === 'enemy');
    return encounter.roster.map(r => ({
        name:           r.name,
        job:            r.job,
        team:           'enemy',
        x:              20, y: 8,   // overwritten by spawn positions
        ct:             r.ct ?? 0,
        level:          r.level ?? encounter.enemyLevel ?? 1,
        statMods:       r.statMods ?? {},
        extraAbilities: r.extraAbilities ?? [],
        appearance:     r.appearance ?? null,
    }));
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
        if (isPlayer) {
            if (charData.hp != null) unit.hp = Math.max(1, Math.min(unit.maxHp, charData.hp));
            // Player characters fight by their battle script. Enemies keep the scoring AI.
            unit.script = getScriptFor(charData);
            for (const key of relics) {
                const fx = RELICS[key]?.battleStart;
                if (fx) inflictStatus(unit, fx.status, fx.duration);
            }
        }
        return unit;
    });
    const players = units.filter(u => u.team === 'player');
    const enemies = units.filter(u => u.team === 'enemy');
    const centre = (arr) => arr.length
        ? { x: arr.reduce((s, u) => s + u.x, 0) / arr.length, y: arr.reduce((s, u) => s + u.y, 0) / arr.length }
        : null;
    const enemyC = centre(enemies), playerC = centre(players);
    if (enemyC) players.forEach(u => faceToward(u, enemyC.x, enemyC.y));
    if (playerC) enemies.forEach(u => faceToward(u, playerC.x, playerC.y));
    return units;
}
