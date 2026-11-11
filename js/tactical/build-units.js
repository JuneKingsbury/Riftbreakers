import { createUnitFromCharData, faceToward } from './units.js';
import { getScriptFor } from './ai/script-store.js';
import { CHARACTER_DATA } from './data/characters.js';
import { equipmentStatBonuses } from './data/equipment.js';
import { BATTLE_SCENARIOS } from './world-map-data.js';

/**
 * Builds the player and enemy units for a battle. Pure game setup with no
 * rendering or DOM dependency, so headless tests and any renderer can share it.
 */
export function buildUnits(worldMap, scenarioId, playerSpawns, enemySpawns) {
    const partyData = worldMap?.party ?? CHARACTER_DATA.filter(c => c.team === 'player');

    // Use scenario-specific roster if defined; fall back to CHARACTER_DATA enemies.
    const scenario   = BATTLE_SCENARIOS[scenarioId];
    const rosterDefs = scenario?.roster;
    const enemyData  = rosterDefs
        ? rosterDefs.map((r, i) => ({
            name:          r.name,
            job:           r.job,
            team:          'enemy',
            x:             20, y: 8,   // overwritten by spawn positions below
            ct:            r.ct ?? 0,
            level:         r.level ?? scenario.enemyLevel ?? 1,
            statMods:      r.statMods ?? {},
            extraAbilities: r.extraAbilities ?? [],
            appearance:    r.appearance ?? null,
        }))
        : CHARACTER_DATA.filter(c => c.team === 'enemy');

    const units = [...partyData, ...enemyData].map((charData) => {
        const equipBonuses = equipmentStatBonuses(charData.appearance);
        const mergedMods   = { ...(charData.statMods || {}), };
        for (const [k, v] of Object.entries(equipBonuses)) {
            mergedMods[k] = (mergedMods[k] || 0) + v;
        }
        // Determine spawn position from map data; fall back to charData position if
        // there are fewer spawn tiles than units.
        let spawnX = charData.x;
        let spawnY = charData.y;
        let spawnZ = null;
        if (charData.team === 'player') {
            const pIdx = partyData.indexOf(charData);
            const spawn = playerSpawns?.[pIdx];
            if (spawn) { spawnX = spawn.x; spawnY = spawn.y; spawnZ = spawn.z ?? null; }
        } else {
            const eIdx = enemyData.indexOf(charData);
            const spawn = enemySpawns?.[eIdx];
            if (spawn) { spawnX = spawn.x; spawnY = spawn.y; spawnZ = spawn.z ?? null; }
        }
        // Party members (entries with JP data) fight with their equipped loadout.
        const unit = createUnitFromCharData({ ...charData, statMods: mergedMods, x: spawnX, y: spawnY });
        unit.z = spawnZ;   // null: the battle settles it from the map
        // Player characters fight by their battle script. Enemies keep the scoring AI.
        if (charData.team === 'player') unit.script = getScriptFor(charData);
        return unit;
    });
    const players = units.filter(u => u.team === 'player');
    const enemies = units.filter(u => u.team === 'enemy');
    const avg = (arr, key) => arr.reduce((s, u) => s + u[key], 0) / arr.length;
    const enemyCx = avg(enemies, 'x'), enemyCy = avg(enemies, 'y');
    const playerCx = avg(players, 'x'), playerCy = avg(players, 'y');
    players.forEach(u => faceToward(u, enemyCx, enemyCy));
    enemies.forEach(u => faceToward(u, playerCx, playerCy));
    return units;
}
