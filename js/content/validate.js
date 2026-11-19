// Checks every piece of content against the schemas in vocab.js, and the rules that tie
// content together (an item's ability fits its slot, a promotion is a Tier 2 class...).
// tests/content/content.test.mjs runs it, so a typo in a content file fails `npm test`
// with a message naming the entry and field.
import { SCHEMAS, STATUSES, EQUIP_TYPES, ITEM_GRANT_SLOTS } from './vocab.js';

/**
 * @brief Validates content tables against the vocabulary.
 *
 * @param {object} t  The content: { abilities, templates (ABILITY_TEMPLATES), jobs, items, relics, affixes?, events, encounters (realm →
 *                    { normal, elite, boss }), realms, chains, maps (map ids), materials,
 *                    actRealms (act → realm ids), sprites? (entity sprite keys; sprite refs
 *                    are skipped when absent) }.
 *                    abilities and jobs are the raw tables, before `extends` is resolved.
 * @returns {string[]} One line per problem, e.g. "item iron_sword: unknown field 'atkk'". Empty when valid.
 */
export function validateContent(t) {
    const errors = [];
    const encounterIds = new Set(Object.values(t.encounters).flatMap(z => Object.values(z).flat()).map(e => e.id));
    const known = {
        ability: (k) => Object.hasOwn(t.abilities, k),
        abilityOrTemplate: (k) => Object.hasOwn(t.abilities, k) || Object.hasOwn(t.templates ?? {}, k),
        job: (k) => Object.hasOwn(t.jobs, k),
        item: (k) => Object.hasOwn(t.items, k),
        relic: (k) => Object.hasOwn(t.relics, k),
        status: (k) => Object.hasOwn(STATUSES, k),
        realm: (k) => Object.hasOwn(t.realms, k),
        chain: (k) => Object.hasOwn(t.chains, k),
        map: (k) => t.maps.includes(k),
        encounter: (k) => encounterIds.has(k),
        material: (k) => Object.hasOwn(t.materials, k),
        sprite: (k) => !t.sprites || t.sprites.includes(k),
    };

    function check(where, value, spec) {
        if (value === null || value === undefined) return;   // null drops an inherited value
        switch (spec.type) {
            case 'any': return;
            case 'number': if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`${where}: expected a number, got ${JSON.stringify(value)}`); return;
            case 'string': if (typeof value !== 'string') errors.push(`${where}: expected text`); return;
            case 'bool': if (typeof value !== 'boolean') errors.push(`${where}: expected true or false`); return;
            case 'color': if (typeof value !== 'string' || !/^#[0-9a-fA-F]{3,8}$|^[a-z]+$/.test(value)) errors.push(`${where}: expected a CSS color, got ${JSON.stringify(value)}`); return;
            case 'enum': if (!spec.values.includes(value)) errors.push(`${where}: '${value}' is not one of ${spec.values.join(', ')}`); return;
            case 'ref': if (!known[spec.of](value)) errors.push(`${where}: unknown ${spec.of} '${value}'`); return;
            case 'list':
                if (!Array.isArray(value)) { errors.push(`${where}: expected a list`); return; }
                value.forEach((v, i) => check(`${where}[${i}]`, v, spec.of));
                return;
            case 'object': checkFields(where, value, spec.fields); return;
            case 'map':
                if (typeof value !== 'object' || Array.isArray(value)) { errors.push(`${where}: expected an object`); return; }
                for (const [k, v] of Object.entries(value)) {
                    if (spec.keys && !spec.keys.includes(k)) errors.push(`${where}: unknown key '${k}' (expected ${spec.keys.join(', ')})`);
                    check(`${where}.${k}`, v, spec.of);
                }
                return;
            default: throw new Error(`validate: unknown spec type ${spec.type}`);
        }
    }

    function checkFields(where, value, fields) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) { errors.push(`${where}: expected an object`); return; }
        for (const [k, v] of Object.entries(value)) {
            if (!Object.hasOwn(fields, k)) errors.push(`${where}: unknown field '${k}'`);
            else check(`${where}.${k}`, v, fields[k]);
        }
        for (const [k, spec] of Object.entries(fields)) if (spec.required && value[k] == null) errors.push(`${where}: missing '${k}'`);
    }

    // ---- Schemas ----
    for (const [k, v] of Object.entries(t.abilities)) checkFields(`ability ${k}`, v, SCHEMAS.ability);
    for (const [k, v] of Object.entries(t.jobs)) checkFields(`job ${k}`, v, SCHEMAS.job);
    for (const [k, v] of Object.entries(t.items)) checkFields(`item ${k}`, v, SCHEMAS.item);
    for (const [k, v] of Object.entries(t.relics)) checkFields(`relic ${k}`, v, SCHEMAS.relic);
    for (const [k, v] of Object.entries(t.affixes ?? {})) checkFields(`affix ${k}`, v, SCHEMAS.affix);
    for (const e of t.events) checkFields(`event ${e.id}`, e, SCHEMAS.event);
    for (const [k, v] of Object.entries(t.realms)) checkFields(`realm ${k}`, v, SCHEMAS.realm);
    for (const [realm, kinds] of Object.entries(t.encounters)) {
        for (const [kind, list] of Object.entries(kinds)) {
            if (!['normal', 'elite', 'boss'].includes(kind)) errors.push(`encounters of ${realm}: unknown kind '${kind}'`);
            for (const e of list) checkFields(`encounter ${e.id}`, e, SCHEMAS.encounter);
        }
    }

    // ---- Rules that tie content together ----
    const slotOf = (k) => resolvedSlot({ ...t.templates, ...t.abilities }, k);
    for (const [k, item] of Object.entries(t.items)) {
        if (item.type && EQUIP_TYPES[item.type] && !EQUIP_TYPES[item.type].slots.includes(item.slot)) {
            errors.push(`item ${k}: a ${item.type} item can't go in the ${item.slot} slot`);
        }
        for (const [field, slots] of Object.entries(ITEM_GRANT_SLOTS)) {
            for (const a of item[field] ?? []) {
                if (known.ability(a) && !slots.includes(slotOf(a))) errors.push(`item ${k}: ${field} takes ${slots.join('/')} abilities, but ${a} is ${slotOf(a)}`);
            }
        }
    }
    for (const [k, relic] of Object.entries(t.relics)) {
        for (const a of relic.passives ?? []) {
            if (known.ability(a) && slotOf(a) === 'action') errors.push(`relic ${k}: passives takes reaction/support/movement abilities, but ${a} is an action`);
        }
        for (const [i, tr] of (relic.triggers ?? []).entries()) {
            if (tr.on === 'hpBelow' && !(tr.pct > 0 && tr.pct < 1)) errors.push(`relic ${k}: triggers[${i}] (hpBelow) needs a pct between 0 and 1`);
        }
    }
    // An affix's passives are reactions, supports or movement skills; its extra abilities are actions.
    for (const [k, affix] of Object.entries(t.affixes ?? {})) {
        for (const a of affix.passives ?? []) {
            if (known.ability(a) && slotOf(a) === 'action') errors.push(`affix ${k}: passives takes reaction/support/movement abilities, but ${a} is an action`);
        }
        for (const a of affix.extraAbilities ?? []) {
            if (known.ability(a) && slotOf(a) !== 'action') errors.push(`affix ${k}: extraAbilities takes actions, but ${a} is ${slotOf(a)}`);
        }
    }
    for (const [k, job] of Object.entries(t.jobs)) {
        for (const a of job.passives ?? []) {
            if (known.ability(a) && slotOf(a) === 'action') errors.push(`job ${k}: passives takes reaction/support/movement abilities, but ${a} is an action`);
        }
        for (const s of job.battleStart ?? []) {
            if (['frog', 'enfeebled', 'taunted'].includes(s.status)) errors.push(`job ${k}: battleStart can't start with ${s.status} (it has side effects only inflictStatus applies)`);
        }
        for (const p of job.promotions ?? []) if (t.jobs[p] && t.jobs[p].tier !== 2) errors.push(`job ${k}: promotion ${p} is not a Tier 2 class`);
        for (const [a, def] of Object.entries(job.learnable ?? {})) {
            if (!known.ability(a)) errors.push(`job ${k}: learns unknown ability '${a}'`);
            if (def?.requires && !Object.hasOwn(job.learnable, def.requires)) errors.push(`job ${k}: ${a} requires ${def.requires}, which isn't in its skill tree`);
        }
        for (const [slot, key] of Object.entries(job.startingGear ?? {})) {
            if (key && t.items[key] && t.items[key].slot !== slot) errors.push(`job ${k}: starting ${slot} ${key} is a ${t.items[key].slot}`);
        }
        if (job.tier && !job.desc) errors.push(`job ${k}: a player class needs a desc`);
    }
    const seen = new Set();
    for (const id of [...Object.values(t.encounters).flatMap(z => Object.values(z).flat()).map(e => e.id)]) {
        if (seen.has(id)) errors.push(`encounter ${id}: duplicate id`);
        seen.add(id);
    }
    const eventIds = new Set();
    for (const e of t.events) {
        if (eventIds.has(e.id)) errors.push(`event ${e.id}: duplicate id`);
        eventIds.add(e.id);
    }
    const bossFights = Object.fromEntries(Object.values(t.encounters).flatMap(z => z.boss ?? []).map(e => [e.id, e]));
    for (const [k, realm] of Object.entries(t.realms)) {
        for (const b of realm.bosses ?? []) {
            if (encounterIds.has(b) && !bossFights[b]) errors.push(`realm ${k}: ${b} is not a boss fight`);
            else if (bossFights[b] && !bossFights[b].scouting) errors.push(`realm ${k}: boss ${b} needs scouting text (the Scout's Report shows it)`);
        }
    }
    // A summon calls a job of its own (enemies/summons.js), so tuning an enemy never changes a
    // summon and the other way round.
    const rosterJobs = new Set(Object.values(t.encounters).flatMap(z => Object.values(z).flat()).flatMap(e => e.roster.map(r => r.job)));
    const resolvedField = (k, f, depth = 0) => {
        const ab = t.abilities[k] ?? t.templates?.[k];
        if (!ab || depth > 10) return undefined;
        return Object.hasOwn(ab, f) ? ab[f] : ab.extends ? resolvedField(ab.extends, f, depth + 1) : undefined;
    };
    for (const k of Object.keys(t.abilities)) {
        const job = resolvedField(k, 'summonJob') ?? resolvedField(k, 'summon')?.job;
        if (job && rosterJobs.has(job)) errors.push(`ability ${k}: summons '${job}', which encounters also field as an enemy; give the summon its own job in enemies/summons.js`);
    }
    for (const [act, ids] of Object.entries(t.actRealms ?? {})) {
        if (!ids.length) errors.push(`act ${act}: lists no realms`);
        for (const id of ids) if (!known.realm(id)) errors.push(`act ${act}: unknown realm '${id}'`);
    }
    // draws: only act realms draw, never on an act realm, and every realm is fielded somewhere.
    if (t.actRealms) {
        const actRealms = new Set(Object.values(t.actRealms).flat());
        const drawnBy = {};
        for (const [k, realm] of Object.entries(t.realms)) {
            if (realm.draws && !actRealms.has(k)) errors.push(`realm ${k}: has draws but no act is set in it (add it to ACT_REALMS in realms/index.js, or remove draws)`);
            for (const d of realm.draws ?? []) {
                if (d === k) errors.push(`realm ${k}: draws on itself`);
                else if (actRealms.has(d)) errors.push(`realm ${k}: draws on ${d}, which is an act realm itself (its fights would appear in two acts)`);
                (drawnBy[d] ??= []).push(k);
            }
        }
        for (const k of Object.keys(t.realms)) {
            if (!actRealms.has(k) && !drawnBy[k]) errors.push(`realm ${k}: never appears: no act is set in it and no act realm draws it`);
            if (drawnBy[k]?.length > 1) errors.push(`realm ${k}: drawn by more than one act realm (${drawnBy[k].join(', ')})`);
        }
    }
    for (const [k, job] of Object.entries(t.jobs)) {
        if (job.tier === 1 && !job.unlock) errors.push(`job ${k}: a starting class needs an unlock ({ type: 'base' | 'renown', order })`);
        if (job.tier === 1 && !job.startingGear) errors.push(`job ${k}: a starting class needs startingGear`);
    }
    return errors;
}

// The slot of an ability that inherits it through `extends`.
function resolvedSlot(abilities, key, depth = 0) {
    const ab = abilities[key];
    if (!ab || depth > 10) return 'action';   // a template's slot is checked through the abilities using it
    if (ab.slot) return ab.slot;
    return ab.extends ? resolvedSlot(abilities, ab.extends, depth + 1) : 'action';
}
