// Structural validation and sanitizing for scripts. Used by the editor to show
// problems live and by the store so a corrupted save can never reach the interpreter.
import { ABILITIES } from '../data-registry.js';
import { CONDITIONS, ABILITY_CATEGORIES, ACTION_KINDS, MOVE_MODES, SIDES, PICKS, FILTER_KINDS, FACINGS, POSITIONING } from './blocks.js';
import { CODEX_RULES } from './script-runtime.js';

const MAX_COND_DEPTH = 6;

// How a target side reads in a message ("can't be aimed at an ally").
const SIDE_TEXT = { enemy: 'an enemy', ally: 'an ally', self: 'yourself' };

function checkCond(cond, path, problems, depth = 0) {
    if (!cond || typeof cond !== 'object') { problems.push({ path, message: 'Condition is missing.' }); return; }
    if (depth > MAX_COND_DEPTH) { problems.push({ path, message: 'Conditions are nested too deeply.' }); return; }
    if (cond.op) {
        if (!['and', 'or', 'not'].includes(cond.op) || !Array.isArray(cond.args)) {
            problems.push({ path, message: `Unknown condition group "${cond.op}".` });
            return;
        }
        cond.args.forEach((c, i) => checkCond(c, `${path}.args[${i}]`, problems, depth + 1));
        return;
    }
    if (!CONDITIONS[cond.test]) problems.push({ path, message: `Unknown condition "${cond.test}".` });
}

// Returns [{ rule: index, path, message, severity }]. With `unit`, also warns
// about abilities the character does not have (a warning, because a class
// change can legitimately leave a rule stale and the interpreter just skips it).
export function validateScript(script, unit = null) {
    const problems = [];
    const add = (rule, path, message, severity = 'error') => problems.push({ rule, path, message, severity });

    if (!script || typeof script !== 'object' || !Array.isArray(script.rules)) {
        add(-1, 'rules', 'Script has no rule list.');
        return problems;
    }
    // The editor holds most players to MAX_RULES; Tactician's Codex scripts may go up to CODEX_RULES.
    if (script.rules.length > CODEX_RULES) add(-1, 'rules', `Too many rules. The limit is ${CODEX_RULES}.`);

    script.rules.forEach((rule, i) => {
        const sub = [];
        checkCond(rule.when, 'when', sub);
        sub.forEach(p => add(i, p.path, p.message));

        const a = rule.then;
        if (!a || !ACTION_KINDS[a.do]) { add(i, 'then', `Unknown action "${a?.do}".`); return; }

        if (a.target) {
            if (!SIDES.includes(a.target.side)) add(i, 'then.target', `Unknown target side "${a.target.side}".`);
            if (a.target.pick && !PICKS[a.target.pick]) add(i, 'then.target', `Unknown target choice "${a.target.pick}".`);
            for (const f of a.target.filters || []) {
                if (!FILTER_KINDS[f.kind]) add(i, 'then.target', `Unknown target filter "${f.kind}".`);
            }
        }
        if (a.do === 'move' && !MOVE_MODES[a.mode]) add(i, 'then', `Unknown move mode "${a.mode}".`);
        if (a.position != null && !POSITIONING[a.position]) add(i, 'then', `Unknown positioning "${a.position}".`);
        if (a.do === 'pivot' && a.facing && !FACINGS.includes(a.facing)) add(i, 'then', `Unknown facing "${a.facing}".`);

        if (a.do === 'ability') {
            const known = ABILITY_CATEGORIES[a.ability] || ABILITIES[a.ability];
            if (!known) { add(i, 'then.ability', `Unknown skill "${a.ability}".`); return; }
            const ab = ABILITIES[a.ability];
            if (ab && ab.passive) add(i, 'then.ability', `${ab.name} is passive, so a rule can't use it.`);
            if (ab && ab.targetType === 'tile' && !ab.isSummon) {
                add(i, 'then.ability', `${ab.name} targets a tile, which tactics can't do yet.`);
            }
            const side = a.target?.side;
            // A splash ('all') may be aimed at anyone; corpse rites aim at a fallen enemy.
            const sideOk = !side || ab?.isSummon || ab?.targetType === side || ab?.targetType === 'all'
                || (side === 'self' && ab?.targetType === 'ally') || (side === 'enemy' && ab?.targetType === 'corpse');
            if (ab && !sideOk && ab.targetType !== 'tile') {
                add(i, 'then.target', `${ab.name} can't be aimed at ${SIDE_TEXT[side] ?? side}.`);
            }
            if (ab && unit && !unit.abilities.includes(a.ability)) {
                add(i, 'then.ability', `${unit.name} doesn't know ${ab.name}, so this rule will be skipped.`, 'warning');
            }
        }
    });
    return problems;
}

export function hasErrors(problems) {
    return problems.some(p => p.severity !== 'warning');
}

// Returns a deep, JSON-clean copy of the script, or null when it has structural errors.
export function sanitizeScript(raw) {
    let copy;
    try { copy = JSON.parse(JSON.stringify(raw)); } catch { return null; }
    if (!copy || !Array.isArray(copy.rules)) return null;
    if (hasErrors(validateScript(copy))) return null;
    copy.version = 1;
    copy.rules.forEach((r, i) => { if (!r.id) r.id = `r${i + 1}`; });
    return copy;
}
