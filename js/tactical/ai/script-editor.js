// "Party Tactics" editor: a full-screen overlay for authoring each character's
// battle script as an ordered rule list. All options come from blocks.js, so a
// new condition or action added there shows up here without UI changes.
//
// Rules are edited on a draft copy. Inputs carry data-bind="<path>" and every
// change re-renders the whole panel (cheap at <= 16 rules), driven by one
// delegated listener on the root.
import { JOB_STATS, ABILITIES } from '../data-registry.js';
import {
    CONDITIONS, COMPARATORS, STATUS_OPTIONS, TILE_TYPES, ABILITY_CATEGORIES,
    SIDES, PICKS, FILTER_KINDS, MOVE_MODES, ACTION_KINDS, FACINGS, sideForAbility, scriptUsable,
} from './blocks.js';
import { MAX_RULES } from './script-runtime.js';
import { validateScript, hasErrors } from './script-validate.js';
import { getScriptFor, saveScript, resetScript, hasCustomScript } from './script-store.js';
import { defaultScriptFor } from './default-scripts.js';
import { abilitiesForMember } from './party.js';

const FONT = "'Courier New',monospace";
const BTN = `padding:4px 10px;background:#151528;border:1px solid #447;color:#ccc;font-family:${FONT};font-size:11px;cursor:pointer;border-radius:3px;`;
const FIELD = `background:#0b0b18;border:1px solid #447;color:#ddd;font-family:${FONT};font-size:11px;padding:2px 4px;border-radius:3px;`;

function esc(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const clone = (v) => JSON.parse(JSON.stringify(v));

const isLeaf = (c) => !!c && !c.op && !!c.test;
const isSimple = (c) => isLeaf(c) || (c?.op === 'not' && c.args?.length === 1 && isLeaf(c.args[0]));

// Rewrites a rule's `when` into { op: 'and'|'or', args: [leaf | not(leaf)] } so
// binding paths are stable. Returns false for shapes the editor cannot edit.
function normalizeWhen(rule) {
    const w = rule.when;
    if (!w) { rule.when = { op: 'and', args: [] }; return true; }
    if ((w.op === 'and' || w.op === 'or') && Array.isArray(w.args) && w.args.every(isSimple)) return true;
    if (isSimple(w)) { rule.when = { op: 'and', args: isLeaf(w) && w.test === 'always' ? [] : [w] }; return true; }
    return false;
}

// Inverse of normalizeWhen, applied to a copy when saving.
function collapseWhen(rule) {
    const w = rule.when;
    if (!w || !Array.isArray(w.args)) return;
    if (w.args.length === 0) rule.when = { test: 'always', params: {} };
    else if (w.args.length === 1) rule.when = w.args[0];
}

function defaultAction(kind) {
    const target = { side: 'enemy', pick: 'nearest' };
    switch (kind) {
        case 'ability': return { do: 'ability', ability: 'best_damage', target, approach: true };
        case 'move':    return { do: 'move', mode: 'toward', target };
        case 'pivot':   return { do: 'pivot', facing: 'toward_target', target };
        default:        return { do: kind };
    }
}

function defaultParams(def) {
    return Object.fromEntries(def.params.map(p => [p.name, p.default]));
}

function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o[k], obj);
    parent[last] = value;
}

export class ScriptEditor {
    // characters: the live party (worldMap.party): { name, job, xp, extraAbilities, supportSkill, supportPassive }.
    constructor(characters, { onSaved } = {}) {
        this._chars = characters;
        this._onSaved = onSaved || null;
        this._drafts = {};
        this._saved = {};
        this._selected = characters[0]?.name ?? null;
        this._message = '';

        this._root = document.createElement('div');
        this._root.style.cssText = `
            position:fixed; inset:0; z-index:350; background:rgba(0,0,0,0.78);
            display:flex; align-items:center; justify-content:center;
            font-family:${FONT}; font-size:12px; color:#ccc; pointer-events:auto;
        `;
        document.body.appendChild(this._root);
        this._root.addEventListener('click', (e) => this._onClick(e));
        this._root.addEventListener('change', (e) => this._onChange(e));
        this._render();
    }

    close() {
        const dirty = this._chars.filter(c => this._isDirty(c.name));
        if (dirty.length && !window.confirm(`Discard unsaved changes for ${dirty.map(c => c.name).join(', ')}?`)) return;
        this._root.remove();
    }

    // ---------- state ----------
    _char(name = this._selected) {
        return this._chars.find(c => c.name === name);
    }

    // Live from the party member, so a class or support-skill change is reflected.
    _abilitiesOf(cd) {
        return abilitiesForMember(cd);
    }

    _draft(name = this._selected) {
        if (!this._drafts[name]) {
            const script = getScriptFor(this._char(name));
            this._prepare(script);
            this._drafts[name] = script;
            this._saved[name] = JSON.stringify(this._finalized(name));
        }
        return this._drafts[name];
    }

    // Puts a script into the shape the editor binds against (see normalizeWhen).
    _prepare(script) {
        script.rules.forEach(r => {
            if (r.enabled === undefined) r.enabled = true;
            normalizeWhen(r);
        });
    }

    _finalized(name) {
        const copy = clone(this._draft(name));
        copy.rules.forEach(collapseWhen);
        return copy;
    }

    _isDirty(name) {
        return !!this._drafts[name] && JSON.stringify(this._finalized(name)) !== this._saved[name];
    }

    // ---------- rendering ----------
    _select(options, current, bind, labelOf = (o) => o) {
        const opts = options.includes(current) ? options : [current, ...options];
        return `<select data-bind="${bind}" style="${FIELD}">${opts.map(o =>
            `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${esc(labelOf(o))}</option>`).join('')}</select>`;
    }

    _paramInput(spec, value, bind, ctx) {
        const v = value ?? spec.default;
        switch (spec.type) {
            case 'cmp':    return this._select(COMPARATORS, v, bind);
            case 'status': return this._select(STATUS_OPTIONS, v, bind);
            case 'tile':   return this._select(TILE_TYPES, v, bind);
            case 'job':    return this._select(Object.keys(JOB_STATS), v, bind);
            case 'ability': {
                const known = ctx.abilities.filter(k => ABILITIES[k] && !ABILITIES[k].passive);
                return this._select(known, v, bind, k => (ABILITIES[k]?.name ?? `${k} (unknown)`));
            }
            case 'bool':
                return `<select data-bind="${bind}" data-kind="bool" style="${FIELD}">
                    <option value="true"${v !== false ? ' selected' : ''}>has</option>
                    <option value="false"${v === false ? ' selected' : ''}>lacks</option></select>`;
            default:
                return `<input type="number" data-bind="${bind}" data-kind="number" value="${esc(v)}" style="${FIELD}width:52px;">`;
        }
    }

    _condLeaf(leaf, base, ctx) {
        const def = CONDITIONS[leaf.test];
        const groups = {};
        for (const [id, d] of Object.entries(CONDITIONS)) (groups[d.group] ||= []).push(id);
        const picker = `<select data-bind="${base}.test" data-kind="test" style="${FIELD}">${Object.entries(groups).map(([g, ids]) =>
            `<optgroup label="${esc(g)}">${ids.map(id =>
                `<option value="${id}"${id === leaf.test ? ' selected' : ''}>${esc(CONDITIONS[id].label.replace(/\{(\w+)\}/g, '[$1]'))}</option>`).join('')}</optgroup>`).join('')}</select>`;
        if (!def) return `${picker} <span style="color:#f66;">unknown test</span>`;
        const inputs = def.params.map(p => `${esc(p.name)} ${this._paramInput(p, leaf.params?.[p.name], `${base}.params.${p.name}`, ctx)}`).join(' ');
        return `${picker} ${inputs}`;
    }

    _conditions(rule, i, ctx) {
        const w = rule.when;
        if (!w) return '';
        const joiner = `<button data-act="toggle-join" data-rule="${i}" style="${BTN}">${w.op === 'or' ? 'OR' : 'AND'}</button>`;
        if (w.args.length === 0) {
            return `<span style="color:#888;">Always</span> <button data-act="add-cond" data-rule="${i}" style="${BTN}">+ condition</button>`;
        }
        const rows = w.args.map((c, j) => {
            const negated = c.op === 'not';
            const leaf = negated ? c.args[0] : c;
            const base = `rules.${i}.when.args.${j}${negated ? '.args.0' : ''}`;
            return `<div style="margin:2px 0;">${j > 0 ? `<span style="color:#88a;">${w.op === 'or' ? 'or' : 'and'}</span> ` : ''}
                <label title="Negate"><input type="checkbox" data-act="toggle-not" data-rule="${i}" data-cond="${j}"${negated ? ' checked' : ''}> not</label>
                ${this._condLeaf(leaf, base, ctx)}
                <button data-act="del-cond" data-rule="${i}" data-cond="${j}" style="${BTN}">&times;</button></div>`;
        }).join('');
        return `${rows}<div style="margin-top:3px;">${w.args.length > 1 ? `${joiner} ` : ''}<button data-act="add-cond" data-rule="${i}" style="${BTN}">+ condition</button></div>`;
    }

    _targetEditor(rule, i, ctx) {
        const t = rule.then.target;
        if (!t) return `<button data-act="add-target" data-rule="${i}" style="${BTN}">choose target</button>`;
        const base = `rules.${i}.then.target`;
        const filters = (t.filters || []).map((f, j) => {
            const spec = FILTER_KINDS[f.kind];
            const kind = this._select(Object.keys(FILTER_KINDS), f.kind, `${base}.filters.${j}.kind`, k => FILTER_KINDS[k].label);
            const params = (spec?.params || []).map(p => this._paramInput(p, f[p.name], `${base}.filters.${j}.${p.name}`, ctx)).join(' ');
            return `<span style="margin-left:6px;">where ${kind} ${params}<button data-act="del-filter" data-rule="${i}" data-filter="${j}" style="${BTN}">&times;</button></span>`;
        }).join('');
        return `target ${this._select(SIDES, t.side, `${base}.side`)}
            ${t.side === 'self' ? '' : this._select(Object.keys(PICKS), t.pick ?? 'nearest', `${base}.pick`, k => PICKS[k])}
            ${filters} <button data-act="add-filter" data-rule="${i}" style="${BTN}">+ filter</button>`;
    }

    _action(rule, i, ctx) {
        const a = rule.then;
        const base = `rules.${i}.then`;
        let html = this._select(Object.keys(ACTION_KINDS), a.do, `${base}.do`, k => ACTION_KINDS[k]).replace('data-bind', 'data-kind="do" data-bind');
        if (a.do === 'ability') {
            html += ' ' + this._abilityPicker(a.ability, `${base}.ability`, ctx);
            html += ` <label title="Walk into range first if needed"><input type="checkbox" data-bind="${base}.approach" data-kind="check"${a.approach !== false ? ' checked' : ''}> approach</label>`;
        } else if (a.do === 'move') {
            html += ' ' + this._select(Object.keys(MOVE_MODES), a.mode, `${base}.mode`, k => MOVE_MODES[k]);
            if (a.mode === 'keep_range') html += ` distance <input type="number" data-bind="${base}.range" data-kind="number" value="${esc(a.range ?? 3)}" style="${FIELD}width:44px;">`;
        } else if (a.do === 'pivot') {
            html += ' ' + this._select(FACINGS, a.facing ?? 'toward_target', `${base}.facing`, k => k.replace('_', ' '));
        }
        // Summons choose their own tile, so they have no target to edit.
        const picksOwnTile = a.do === 'ability' && sideForAbility(a.ability) === null && (a.ability === 'best_summon' || ABILITIES[a.ability]?.isSummon);
        if ((a.do === 'ability' || a.do === 'move' || a.do === 'pivot') && !picksOwnTile) {
            html += `<div style="margin-top:3px;">${this._targetEditor(rule, i, ctx)}</div>`;
        }
        return html;
    }

    // Ability dropdown: "best of a kind" choices that adapt to the character, then each
    // specific ability the character knows right now (with MP cost and range).
    _abilityPicker(current, bind, ctx) {
        const known = ctx.abilities.filter(scriptUsable);
        const kinds = Object.keys(ABILITY_CATEGORIES);
        const option = (value, label) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
        const label = (k) => {
            const ab = ABILITIES[k];
            const bits = [];
            if (ab.mpCost > 0) bits.push(`${ab.mpCost} MP`);
            if (ab.range > 0) bits.push(`range ${ab.range}`);
            return bits.length ? `${ab.name} (${bits.join(', ')})` : ab.name;
        };
        const stale = current && !kinds.includes(current) && !known.includes(current)
            ? `<optgroup label="Not known by this character">${option(current, ABILITIES[current]?.name ?? `${current} (unknown)`)}</optgroup>`
            : '';
        return `<select data-bind="${bind}" data-kind="ability" style="${FIELD}">
            <optgroup label="Best of a kind">${kinds.map(k => option(k, ABILITY_CATEGORIES[k])).join('')}</optgroup>
            <optgroup label="Known abilities">${known.map(k => option(k, label(k))).join('')}</optgroup>
            ${stale}</select>`;
    }

    _rule(rule, i, problems, ctx) {
        const mine = problems.filter(p => p.rule === i);
        const complex = !(rule.when && Array.isArray(rule.when.args) && rule.when.args.every(isSimple));
        return `<div style="border:1px solid ${mine.some(p => p.severity !== 'warning') ? '#a44' : '#335'};border-radius:5px;padding:7px 9px;margin-bottom:7px;background:rgba(20,20,40,0.6);${rule.enabled === false ? 'opacity:0.55;' : ''}">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">
                <span style="color:#88a;">${i + 1}.</span>
                <label><input type="checkbox" data-bind="rules.${i}.enabled" data-kind="check"${rule.enabled !== false ? ' checked' : ''}> on</label>
                <input type="text" data-bind="rules.${i}.label" data-kind="text" value="${esc(rule.label ?? '')}" placeholder="name (optional)" maxlength="60" style="${FIELD}flex:1;">
                <button data-act="up" data-rule="${i}" style="${BTN}"${i === 0 ? ' disabled' : ''}>&uarr;</button>
                <button data-act="down" data-rule="${i}" style="${BTN}"${i === ctx.count - 1 ? ' disabled' : ''}>&darr;</button>
                <button data-act="del-rule" data-rule="${i}" style="${BTN}color:#f88;">&times;</button>
            </div>
            <div><b style="color:#fc8;">IF</b> ${complex
                ? `<span style="color:#f88;">Nested condition the editor cannot show.</span> <button data-act="clear-when" data-rule="${i}" style="${BTN}">Clear conditions</button>`
                : this._conditions(rule, i, ctx)}</div>
            <div style="margin-top:4px;"><b style="color:#8cf;">THEN</b> ${rule.then ? this._action(rule, i, ctx) : ''}</div>
            ${mine.map(p => `<div style="color:${p.severity === 'warning' ? '#fc6' : '#f66'};font-size:11px;margin-top:3px;">${p.severity === 'warning' ? 'Warning' : 'Problem'}: ${esc(p.message)}</div>`).join('')}
        </div>`;
    }

    _render() {
        const cd = this._char();
        const keepScroll = this._root.querySelector('[data-scroll]')?.scrollTop ?? 0;
        if (!cd) {
            this._root.innerHTML = `<div style="background:#0d0d1e;padding:20px;border:1px solid #447;">No party members.<br><button data-act="close" style="${BTN}margin-top:10px;">Close</button></div>`;
            return;
        }
        const draft = this._draft();
        const abilities = this._abilitiesOf(cd);
        const problems = validateScript(this._finalized(this._selected), { name: cd.name, abilities });
        const ctx = { abilities, count: draft.rules.length };
        const blocked = hasErrors(problems);
        const dirty = this._isDirty(this._selected);

        const list = this._chars.map(c => {
            const active = c.name === this._selected;
            const marks = `${this._isDirty(c.name) ? '<span style="color:#fc6;"> *</span>' : ''}${hasCustomScript(c.name) ? '<span style="color:#8c8;"> custom</span>' : ''}`;
            return `<button data-act="select-char" data-name="${esc(c.name)}" style="${BTN}display:block;width:100%;margin-bottom:4px;text-align:left;${active ? 'border-color:#99f;background:#22224a;' : ''}">${esc(c.name)} <span style="color:#778;font-size:10px;">${esc(c.job)}</span>${marks}</button>`;
        }).join('');

        this._root.innerHTML = `
            <div style="background:#0d0d1e;border:1px solid #447;border-radius:8px;width:min(980px,96vw);height:min(720px,92vh);display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #335;">
                    <span style="color:#ffcc44;font-weight:bold;font-size:15px;">Party Tactics</span>
                    <span style="color:#778;font-size:11px;">Rules run top to bottom. The first rule whose conditions hold and whose action is possible fires. Moving and turning are free, and an attack, defend or wait ends the turn.</span>
                    <button data-act="close" style="${BTN}">Close</button>
                </div>
                <div style="display:flex;flex:1;min-height:0;">
                    <div style="width:170px;padding:10px;border-right:1px solid #335;overflow-y:auto;">${list}</div>
                    <div data-scroll style="flex:1;padding:12px 14px;overflow-y:auto;">
                        <div style="color:#aab;margin-bottom:8px;"><b>${esc(cd.name)}</b> knows: ${abilities.filter(k => ABILITIES[k] && !ABILITIES[k].passive).map(k => esc(ABILITIES[k].name)).join(', ')}</div>
                        ${draft.rules.map((r, i) => this._rule(r, i, problems, ctx)).join('') || '<div style="color:#888;">No rules. This character will just wait each turn.</div>'}
                        ${problems.filter(p => p.rule === -1).map(p => `<div style="color:#f66;">${esc(p.message)}</div>`).join('')}
                        <button data-act="add-rule" style="${BTN}"${draft.rules.length >= MAX_RULES ? ' disabled' : ''}>+ Add rule (${draft.rules.length}/${MAX_RULES})</button>
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid #335;">
                    <button data-act="save" style="${BTN}color:#8f8;border-color:#464;"${blocked || !dirty ? ' disabled' : ''}>Save ${esc(cd.name)}</button>
                    <button data-act="revert" style="${BTN}"${dirty ? '' : ' disabled'}>Revert changes</button>
                    <button data-act="reset" style="${BTN}">Reset to job default</button>
                    <span style="color:#8c8;">${esc(this._message)}</span>
                    <span style="margin-left:auto;color:#778;font-size:11px;">${blocked ? 'Fix the problems above to save.' : ''}</span>
                </div>
            </div>`;
        const scroller = this._root.querySelector('[data-scroll]');
        if (scroller) scroller.scrollTop = keepScroll;
    }

    // ---------- events ----------
    _onChange(e) {
        const el = e.target;
        const bind = el.dataset.bind;
        if (!bind) return;
        const draft = this._draft();
        const kind = el.dataset.kind;
        this._message = '';

        if (kind === 'test') {
            const parent = getPath(draft, bind.replace(/\.test$/, ''));
            parent.test = el.value;
            parent.params = defaultParams(CONDITIONS[el.value]);
        } else if (kind === 'do') {
            const i = Number(bind.split('.')[1]);
            draft.rules[i].then = defaultAction(el.value);
        } else if (kind === 'ability') {
            // Choosing an ability points the rule at the target side it needs.
            const rule = draft.rules[Number(bind.split('.')[1])];
            rule.then.ability = el.value;
            const side = sideForAbility(el.value);
            if (side) {
                const prev = rule.then.target || {};
                // Filters written for the old side (e.g. "unconscious" on an ally) don't carry over.
                rule.then.target = { side, pick: prev.pick ?? 'nearest', ...(prev.side === side && prev.filters ? { filters: prev.filters } : {}) };
            }
        } else if (kind === 'bool') {
            setPath(draft, bind, el.value === 'true');
        } else if (kind === 'check') {
            setPath(draft, bind, el.checked);
        } else if (kind === 'number') {
            const n = Number(el.value);
            setPath(draft, bind, Number.isFinite(n) ? n : 0);
        } else if (bind.endsWith('.kind') && bind.includes('.filters.')) {
            // Switching a filter's kind resets its parameters to that kind's defaults.
            const f = getPath(draft, bind.replace(/\.kind$/, ''));
            for (const k of Object.keys(f)) delete f[k];
            f.kind = el.value;
            for (const p of FILTER_KINDS[el.value].params) f[p.name] = p.default;
        } else {
            setPath(draft, bind, el.value);
        }
        this._render();
    }

    _onClick(e) {
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const act = el.dataset.act;
        const draft = this._draft();
        const i = Number(el.dataset.rule);
        const rules = draft?.rules;
        this._message = '';

        switch (act) {
            case 'close': this.close(); return;
            case 'select-char': this._selected = el.dataset.name; break;
            case 'add-rule': {
                const n = rules.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/\D/g, '')) || 0), 0) + 1;
                rules.push({ id: `r${n}`, enabled: true, when: { op: 'and', args: [] }, then: defaultAction('ability') });
                break;
            }
            case 'del-rule': rules.splice(i, 1); break;
            case 'up':   if (i > 0) [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; break;
            case 'down': if (i < rules.length - 1) [rules[i + 1], rules[i]] = [rules[i], rules[i + 1]]; break;
            case 'add-cond': rules[i].when.args.push({ test: 'enemy_exists', params: {} }); break;
            case 'del-cond': rules[i].when.args.splice(Number(el.dataset.cond), 1); break;
            case 'clear-when': rules[i].when = { op: 'and', args: [] }; break;
            case 'toggle-join': rules[i].when.op = rules[i].when.op === 'or' ? 'and' : 'or'; break;
            case 'toggle-not': {
                const j = Number(el.dataset.cond);
                const c = rules[i].when.args[j];
                rules[i].when.args[j] = c.op === 'not' ? c.args[0] : { op: 'not', args: [c] };
                break;
            }
            case 'add-target': rules[i].then.target = { side: 'enemy', pick: 'nearest' }; break;
            case 'add-filter': {
                const t = rules[i].then.target;
                t.filters = [...(t.filters || []), { kind: 'status', status: 'slow', has: true }];
                break;
            }
            case 'del-filter': rules[i].then.target.filters.splice(Number(el.dataset.filter), 1); break;
            case 'revert':
                delete this._drafts[this._selected];
                break;
            case 'reset':
                resetScript(this._selected);
                this._drafts[this._selected] = defaultScriptFor(this._char().job);
                this._prepare(this._drafts[this._selected]);
                this._saved[this._selected] = JSON.stringify(this._finalized(this._selected));
                this._message = 'Reset to the job default.';
                break;
            case 'save': {
                const script = this._finalized(this._selected);
                if (saveScript(this._selected, script)) {
                    this._saved[this._selected] = JSON.stringify(script);
                    this._message = 'Saved.';
                    if (this._onSaved) this._onSaved(this._selected);
                } else {
                    this._message = 'Could not save (invalid script or storage unavailable).';
                }
                break;
            }
            default: return;
        }
        this._render();
    }
}

export function openScriptEditor(characters, opts) {
    return new ScriptEditor(characters, opts);
}
