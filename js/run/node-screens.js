// The screen for whatever the run has pending at the current node: the battle
// briefing, rewards, shop, event, rest site, treasure, recruits, and the end of
// the run. Every action goes through RunState; `hooks` tell the scene what to do next.
import { RELICS } from './data/relics.js';
import { REALMS } from './data/realms.js';
import { Sound } from '../audio/sound.js';
import { SCORE_TIP, scoreLine } from './score.js';
import { canSpendPoints } from '../tactical/loadout.js';
import { JOB_DATA } from '../content/jobs.js';
import { MAX_PARTY } from './run-state.js';
import { EQUIPMENT, EQUIP_FIELDS, EQUIP_STAT_KEYS, canEnchant, enchantedKey, enchantLevel, MAX_ENCHANT } from '../tactical/data/equipment.js';
import {
    BTN, BTN_DISABLED, BTN_GOOD, BTN_GOLD, BTN_DANGER, GLOW, RARITY_COLOR, esc, jobLabel, jobDesc,
    abilityName, itemTitle, itemSummary, itemIconHtml, portraitHtml, drawSprites,
} from './ui-kit.js';

const H1 = (t, color = '#ffcc44') => `<div style="color:${color};font-weight:bold;font-size:16px;margin-bottom:6px;">${t}</div>`;
const SUB = (t) => `<div style="color:#999;font-size:11px;line-height:1.6;margin-bottom:12px;">${t}</div>`;
const SECTION = (t) => `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:12px 0 5px;">${t}</div>`;

// What enchanting an item changes: "ATK 8 → 10, HP 20 → 24".
function enchantPreview(key) {
    const a = EQUIPMENT[key], b = EQUIPMENT[enchantedKey(key, enchantLevel(key) + 1)];
    const label = { maxHp: 'HP', maxMp: 'MP' };
    return EQUIP_STAT_KEYS.filter(s => (b[s] || 0) !== (a[s] || 0))
        .map(s => `${(label[s] || s).toUpperCase()} ${a[s] || 0} → ${b[s]}`).join(', ');
}

function relicHtml(key) {
    const r = RELICS[key];
    return `<span style="color:${RARITY_COLOR[r.rarity]};font-weight:bold;">${esc(r.name)}</span>
        <div style="color:#889;font-size:10px;">${esc(r.desc)}</div>`;
}

export class NodeScreens {
    // hooks: { fight(), leave(), openParty(onClose), openGear(onClose), changed(), proceed(), finish() }
    //   proceed: save and show whatever comes next (an act's opening card, or the pending screen)
    constructor(modal, run, skinManager, hooks) {
        this._chimed = new WeakSet();   // reward screens whose level-up chime has played
        this.modal = modal;
        this.run = run;
        this.skin = skinManager;
        this.hooks = hooks;
    }

    // Shows the screen for run.pending (or the end of the run). Returns false when nothing is pending.
    show() {
        const run = this.run;
        if (run.status !== 'active') { this.runOver(); return true; }
        const p = run.pending;
        if (!p) return false;
        const fn = {
            battle: this.battle, reward: this.reward, shop: this.shop, event: this.event,
            rest: this.rest, treasure: this.treasure, recruit: this.recruit, relicChoice: this.relicChoice,
        }[p.kind];
        fn.call(this, p);
        return true;
    }

    _show(html, wire, width = 480) {
        const view = `node:${this.run.act}:${this.run.currentNodeId}:${this.run.pending?.kind ?? 'end'}`;
        const body = this.modal.show(html, { dismissible: false, width, view });
        drawSprites(body, this.run.party, this.skin);
        const on = (sel, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el)));
        wire?.(on, body);
        return body;
    }

    // After a player action: save and redraw, with `sfx` (sound-manifest.js) when it worked.
    _act(ok, sfx = null) {
        if (ok) {
            this.hooks.changed();
            if (sfx) Sound.playSfx(sfx);
        }
        this.show();
    }

    _partyButton() {
        const spend = this.run.party.some(canSpendPoints);
        return `<div style="display:flex;gap:6px;">
            <button data-party style="${BTN}flex:1;color:#adf;border-color:#448;${spend ? GLOW : ''}">☰ Party · skills${spend ? ' <span style="color:#afa;">● points to spend</span>' : ''}</button>
            <button data-gear style="${BTN}flex:1;color:#fda;border-color:#664;">⚔ Equipment</button>
        </div>`;
    }

    _wireParty(on) {
        on('[data-party]', () => this.hooks.openParty(() => this.show()));
        on('[data-gear]', () => this.hooks.openGear(() => this.show()));
    }

    // ---- Battle briefing ----

    battle(p) {
        const enc = p.encounter;
        const titles = { normal: ['Battle', '#f88'], elite: ['Elite Battle', '#f80'], boss: ['Boss Battle', '#f44'] };
        const [title, color] = titles[enc.kind];
        const counts = {};
        for (const r of enc.roster) counts[r.name] = (counts[r.name] || 0) + 1;
        let html = H1(`⚔ ${title}: ${esc(enc.name)}`, color);
        html += SUB(enc.kind === 'boss'
            ? `The guardian of ${esc(REALMS[enc.realm]?.name ?? `Act ${enc.act}`)} bars the way.`
            : 'Your party fights on its own, following each member\'s tactics. Win and everyone heals. Lose and the run ends.');
        html += SECTION('Enemy forces');
        for (const [name, n] of Object.entries(counts)) html += `<div style="color:#f99;margin-bottom:2px;">${esc(name)}${n > 1 ? ` ×${n}` : ''}</div>`;
        html += SECTION('Your party');
        for (const m of this.run.party) {
            const hp = this.run.hp(m), max = this.run.maxHp(m);
            html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;">${portraitHtml(m, 20)}
                <span style="flex:1;color:${m.appearance?.nameColor};">${esc(m.name)} <span style="color:#777;font-size:10px;">${jobLabel(m.job)}</span></span>
                <span style="color:${hp / max < 0.35 ? '#f88' : '#aaa'};">${hp}/${max} HP</span></div>`;
        }
        html += `<div style="height:10px;"></div>${this._partyButton()}
            <button data-fight style="${BTN}${BTN_DANGER}text-align:center;font-weight:bold;font-size:13px;padding:9px;">⚔ To Battle</button>`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-fight]', () => { this.modal.close(); this.hooks.fight(); });
        });
    }

    // ---- Battle rewards ----

    reward(p) {
        // The level-up chime plays once per reward, not on every redraw of the screen.
        if (!this._chimed.has(p) && Object.values(p.levelUps ?? {}).some(n => n > 0)) Sound.playSfx('level_up');
        this._chimed.add(p);
        const run = this.run;
        let html = H1(p.boss ? '♛ Boss Defeated!' : '✦ Victory!');
        if (!run.noGold) html += `<div style="color:#fd8;margin-bottom:4px;">+${p.gold} gold</div>`;
        if (p.score) {
            html += `<div data-tip="${esc(SCORE_TIP)}" style="color:#9cf;margin-bottom:4px;">+${p.score.points} score
                <span style="color:#778;font-size:10px;">${esc(scoreLine(p.score))}</span></div>`;
        }
        html += `<div style="color:#8c8;font-size:11px;margin-bottom:6px;">${run.party.map(m => `${esc(m.name)} +${p.xp[m.name] ?? 0} XP${p.levelUps?.[m.name] ? ` <span style="color:#fd4;">→ Lv ${m.level}!</span>` : ''}`).join(' · ')}</div>`;

        if (p.items.length) {
            html += SECTION(p.itemClaimed ? 'Item taken' : 'Choose one item');
            for (const k of p.items) {
                const users = run.party.filter(m => run.canEquip(m, k)).map(m => m.name);
                html += `<button data-item="${k}" style="${BTN}display:flex;gap:8px;align-items:center;${p.itemClaimed ? BTN_DISABLED : ''}" ${p.itemClaimed ? 'disabled' : ''}>
                    ${itemIconHtml(k, 24)}
                    <span style="flex:1;">${itemTitle(k)}<br><span style="color:#889;font-size:10px;">${esc(itemSummary(k))}</span>
                    <br><span style="color:#667;font-size:10px;">${users.length ? `Usable by ${esc(users.join(', '))}` : 'No one in the party can use this'}</span></span>
                </button>`;
            }
        }
        if (p.relics.length) {
            if (p.relicPick) {
                html += SECTION(p.relicClaimed ? 'Relic taken' : 'Choose a relic');
                for (const k of p.relics) {
                    html += `<button data-relic="${k}" style="${BTN}${p.relicClaimed && !run.relics.includes(k) ? BTN_DISABLED : ''}" ${p.relicClaimed ? 'disabled' : ''}>${relicHtml(k)}</button>`;
                }
            } else {
                html += SECTION('Relic found');
                html += `<div style="padding:6px 8px;border:1px solid #335;border-radius:4px;">${relicHtml(p.relics[0])}</div>`;
            }
        }
        const ready = run.party.filter(m => run.canPromote(m));
        if (ready.length) {
            html += SECTION('Promotion');
            html += `<div style="color:#fc6;font-size:11px;margin-bottom:6px;">${esc(ready.map(m => m.name).join(', '))} can promote now from the Party menu.</div>`;
        }
        html += `<div style="height:8px;"></div>${this._partyButton()}
            <button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-item]', (el) => this._act(run.claimRewardItem(el.dataset.item), 'loot'));
            on('[data-relic]', (el) => this._act(run.claimRewardRelic(el.dataset.relic), 'loot'));
            on('[data-continue]', () => {
                const unclaimed = (!p.itemClaimed && p.items.length) || (p.relicPick && !p.relicClaimed && p.relics.length);
                if (unclaimed && !window.confirm('Leave without taking your reward?')) return;
                this.hooks.leave();
            });
        });
    }

    // ---- Shop ----

    shop(p) {
        const run = this.run;
        let html = H1('$ Traveling Merchant', '#fc6');
        html += `<div style="color:#fd8;margin-bottom:8px;">You have ${run.gold} gold</div>`;
        html += SECTION('Equipment');
        p.stock.forEach((e, i) => {
            const afford = run.gold >= e.price && !e.sold;
            const users = run.party.filter(m => run.canEquip(m, e.key)).map(m => m.name);
            html += `<button data-buy="${i}" style="${BTN}display:flex;gap:8px;align-items:center;${afford ? '' : BTN_DISABLED}" ${afford ? '' : 'disabled'}>
                ${itemIconHtml(e.key, 24)}
                <span style="flex:1;">${itemTitle(e.key)}<br><span style="color:#889;font-size:10px;">${esc(itemSummary(e.key))}</span>
                <br><span style="color:#667;font-size:10px;">${users.length ? esc(users.join(', ')) : 'No one can use this'}</span></span>
                <span style="color:#fd8;">${e.sold ? 'SOLD' : `${e.price}g`}</span>
            </button>`;
        });
        if (p.relic) {
            html += SECTION('Relic');
            const afford = run.gold >= p.relic.price && !p.relic.sold;
            html += `<button data-relic style="${BTN}display:flex;gap:8px;${afford ? '' : BTN_DISABLED}" ${afford ? '' : 'disabled'}>
                <span style="flex:1;">${relicHtml(p.relic.key)}</span><span style="color:#fd8;">${p.relic.sold ? 'SOLD' : `${p.relic.price}g`}</span></button>`;
        }
        const bag = Object.entries(run.inventory);
        if (bag.length) {
            html += SECTION('Sell from your bag');
            for (const [k, n] of bag) {
                html += `<button data-sell="${k}" style="${BTN}display:flex;gap:8px;align-items:center;">${itemIconHtml(k)}
                    <span style="flex:1;">${itemTitle(k)} <span style="color:#888;">×${n}</span></span><span style="color:#fd8;">+${run.sellPrice(k)}g</span></button>`;
            }
        }
        if (run.canRestock()) {
            html += `<button data-restock style="${BTN}${BTN_GOLD}text-align:center;margin-top:6px;">↻ Haggle for fresh stock (free, once)</button>`;
        }
        html += `<div style="height:8px;"></div>${this._partyButton()}
            <button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Leave shop ›</button>`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-buy]', (el) => this._act(run.buy(Number(el.dataset.buy)), 'loot'));
            on('[data-relic]', () => this._act(run.buyRelic(), 'loot'));
            on('[data-sell]', (el) => this._act(run.sell(el.dataset.sell), 'loot'));
            on('[data-restock]', () => this._act(run.restockShop(), 'loot'));
            on('[data-continue]', () => this.hooks.leave());
        }, 520);
    }

    // ---- Event ----

    event(p) {
        const run = this.run;
        const ev = run.currentEvent;
        let html = H1(`? ${esc(ev.title)}`, '#9cf');
        html += `<div style="color:#ccc;line-height:1.7;margin-bottom:12px;padding:10px 12px;background:#0a0a1a;border-left:2px solid #447;">${esc(ev.text)}</div>`;
        if (p.resolved) {
            html += `<div style="color:#dda;line-height:1.7;margin-bottom:12px;">${esc(p.result)}</div>`;
            if (run.party.some(m => m.hp != null)) {
                html += `<div style="color:#f99;font-size:11px;margin-bottom:10px;">Your wounds last until your next victory or rest.</div>`;
            }
            html += `<button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
        } else {
            ev.choices.forEach((c, i) => {
                const ok = run.choiceAvailable(c);
                html += `<button data-choice="${i}" style="${BTN}${ok ? '' : BTN_DISABLED}" ${ok ? '' : 'disabled'}>› ${esc(c.label)}</button>`;
            });
        }
        this._show(html, (on) => {
            on('[data-choice]', (el) => {
                const res = run.chooseEvent(Number(el.dataset.choice));
                if (res) Sound.playSfx('event');
                if (!res) return;
                this.hooks.changed();
                if (res.next) this._eventFollowUp(ev, res);
                else this.show();
            });
            on('[data-continue]', () => this.hooks.leave());
        });
    }

    // The event's outcome text, then the battle it leads to.
    _eventFollowUp(ev, res) {
        const html = H1(`? ${esc(ev.title)}`, '#9cf')
            + `<div style="color:#dda;line-height:1.7;margin-bottom:12px;">${esc(res.text)}</div>
               <button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
        this._show(html, (on) => on('[data-continue]', () => this.show()));
    }

    // ---- Rest site ----

    rest(p) {
        const run = this.run;
        let html = H1('♨ Rest Site', '#8d8');
        if (p.used) {
            html += SUB('The fire burns low. Time to move on.')
                + `${this._partyButton()}<button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
            this._show(html, (on) => { this._wireParty(on); on('[data-continue]', () => this.hooks.leave()); });
            return;
        }
        const wounded = run.party.some(m => m.hp != null);
        html += SUB(`Train the party or enchant one item.${wounded ? ' Either choice also tends your wounds.' : ''}`);
        html += `<button data-rest style="${BTN}${BTN_GOOD}">♨ Train: everyone gains ${run.options.drillXp} XP</button>`;
        const xp = run.options.enchantXp ?? (run.options.trainXp ? 25 : 0);
        html += SECTION(`Enchant: one item gains a level, up to +${MAX_ENCHANT}${xp ? `. Everyone gains ${xp} XP` : ''}`);
        const choices = [];
        const itemRow = (key, where, owner) => {
            const i = choices.push(where) - 1;
            const ok = canEnchant(key);
            return `<button data-enchant="${i}" ${ok ? '' : 'disabled'} style="${BTN}display:flex;gap:8px;align-items:center;${ok ? '' : BTN_DISABLED}">${itemIconHtml(key)}
                <span style="flex:1;">${itemTitle(key)}${owner ? ` <span style="color:#777;font-size:10px;">· ${esc(owner)}</span>` : ''}<br>
                <span style="color:${ok ? '#d9a6ff' : '#666'};font-size:10px;">${ok ? esc(enchantPreview(key)) : `+${MAX_ENCHANT} (max)`}</span></span></button>`;
        };
        let rows = '';
        for (const m of run.party) {
            for (const field of EQUIP_FIELDS) {
                const key = m.appearance?.[field];
                if (key && EQUIPMENT[key]) rows += itemRow(key, { member: m.name, field }, m.name);
            }
        }
        for (const key of Object.keys(run.inventory)) if (EQUIPMENT[key]) rows += itemRow(key, { item: key }, 'in the bag');
        html += rows || `<div style="color:#777;font-size:11px;margin-bottom:6px;">Nothing to enchant yet.</div>`;
        const ready = run.party.filter(m => run.canPromote(m));
        if (ready.length) {
            html += `<div style="color:#fc6;font-size:11px;margin:6px 0;">★ ${esc(ready.map(m => m.name).join(', '))} can promote from the Party menu at any time. It won't use up your rest.</div>`;
        }
        html += `<div style="height:6px;"></div>${this._partyButton()}`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-rest]', () => this._act(run.train(), 'rest'));
            on('[data-enchant]', (el) => this._act(run.enchant(choices[+el.dataset.enchant]), 'rest'));
        });
    }

    // ---- Treasure ----

    treasure(p) {
        const run = this.run;
        let html = H1('✦ Treasure', '#ec4');
        html += SUB('An old strongbox, half-buried by the road.');
        html += run.noGold ? `<div style="color:#889;margin-bottom:6px;">Empty, of gold at least.</div>`
            : `<div style="color:#fd8;margin-bottom:6px;">${p.gold} gold</div>`;
        if (p.relic) html += `<div style="padding:6px 8px;border:1px solid #335;border-radius:4px;margin-bottom:8px;">${relicHtml(p.relic)}</div>`;
        html += p.claimed
            ? `<button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`
            : `<button data-claim style="${BTN}${BTN_GOLD}text-align:center;">Open it</button>`;
        this._show(html, (on) => {
            on('[data-claim]', () => this._act(run.claimTreasure(), 'loot'));
            on('[data-continue]', () => this.hooks.leave());
        });
    }

    // ---- Recruits ----

    recruit(p) {
        const run = this.run;
        let html = H1('+ Recruits', '#c9f');
        if (p.done) {
            html += SUB('Your company sets off together.')
                + `<button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
            this._show(html, (on) => on('[data-continue]', () => this.hooks.leave()));
            return;
        }
        if (p.full) {
            html += SUB(`Your party is full at ${MAX_PARTY}. The would-be recruits share what they know instead.`)
                + `<button data-decline style="${BTN}${BTN_GOOD}">Train together: everyone gains 40 XP</button>`;
        } else {
            html += SUB('Fighters looking for a company. One may join you.');
            p.candidates.forEach((c, i) => {
                const kit = Object.keys(JOB_DATA[c.job].learnable);
                html += `<div style="padding:8px;margin-bottom:6px;border:1px solid #335;border-radius:5px;background:#0d0d20;">
                    <div style="display:flex;gap:10px;align-items:center;">${portraitHtml(c, 36)}
                        <div style="flex:1;"><div style="font-weight:bold;color:${c.appearance.nameColor};">${esc(c.name)}</div>
                        <div style="font-size:10px;color:#888;text-transform:uppercase;">Level ${c.level} ${jobLabel(c.job)} · knows ${esc(abilityName(c.learned[0]))} · ${c.sp} SP to spend</div></div>
                        <button data-recruit="${i}" style="padding:4px 12px;font-family:inherit;font-size:11px;background:#1a1028;border:1px solid #a8f;color:#daf;border-radius:3px;cursor:pointer;">Recruit</button>
                    </div>
                    <div style="color:#889;font-size:10px;line-height:1.4;margin-top:5px;">${esc(jobDesc(c.job))}</div>
                    <div style="color:#99a;font-size:10px;margin-top:3px;">Skills: ${esc(kit.map(abilityName).join(', '))}</div>
                </div>`;
            });
            html += `<button data-decline style="${BTN}">Turn them away${run.noGold ? '' : ' (+40 gold)'}</button>`;
        }
        // Candidates aren't party members yet, so draw their portraits from the pending list.
        const body = this._show(html, (on) => {
            on('[data-recruit]', (el) => this._act(run.recruit(Number(el.dataset.recruit)), 'event'));
            on('[data-decline]', () => this._act(run.declineRecruit()));
            on('[data-continue]', () => this.hooks.leave());
        }, 520);
        drawSprites(body, p.candidates, this.skin);
    }

    // ---- Starting relic (Heirloom unlock) ----

    relicChoice(p) {
        let html = H1('Heirloom') + SUB('Before you set out, choose one keepsake to carry.');
        for (const k of p.relics) html += `<button data-relic="${k}" style="${BTN}">${relicHtml(k)}</button>`;
        this._show(html, (on) => on('[data-relic]', (el) => {
            // Then on to whatever comes next (the act's opening card), not just a closed window.
            if (this.run.chooseStartingRelic(el.dataset.relic)) { this.modal.close(); this.hooks.proceed(); }
        }));
    }

    // ---- End of run ----

    runOver() {
        const run = this.run;
        const won = run.status === 'won';
        const s = run.stats;
        let html = H1(won ? '♛ The Rift is Sealed' : '✝ The Company Falls', won ? '#fc6' : '#f66');
        html += SUB(won
            ? 'Against all odds, your company closed the final rift.'
            : `Your party fell in ${esc(run.realm.name)}, act ${run.act}.`);
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;margin-bottom:10px;">
            <div>Floors climbed</div><div style="color:#ddd;">${s.floors}</div>
            <div>Battles won</div><div style="color:#ddd;">${s.battles}</div>
            <div>Elites slain</div><div style="color:#ddd;">${s.elites}</div>
            <div>Bosses slain</div><div style="color:#ddd;">${s.bosses}</div>
            <div>Relics</div><div style="color:#ddd;">${run.relics.map(k => esc(RELICS[k].name)).join(', ') || 'none'}</div>
            <div data-tip="${esc(SCORE_TIP)}">Score</div><div style="color:#9cf;font-weight:bold;">${run.score || 0}</div>
        </div>`;
        html += SECTION('Final party');
        for (const m of run.party) {
            html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;">${portraitHtml(m, 20)}
                <span style="color:${m.appearance?.nameColor};">${esc(m.name)}</span> <span style="color:#777;font-size:10px;">${esc(m.origin ? `${jobLabel(m.origin)} → ${jobLabel(m.job)}` : jobLabel(m.job))}</span></div>`;
        }
        if (run.renownEarned != null) {
            html += `<div style="margin-top:12px;color:#fc6;font-size:13px;">+${run.renownEarned} renown</div>
                <div style="color:#888;font-size:10px;">Spend renown on unlocks from the title screen.</div>`;
        }
        if (run.options?.daily) {
            html += `<div style="margin-top:8px;color:#9cf;font-size:11px;">Daily run score: <b>${run.score || 0}</b></div>
                <div style="color:#888;font-size:10px;">Submit it from the daily leaderboard on the title screen.</div>`;
        } else if (won) {
            html += `<div style="margin-top:8px;color:#9cf;font-size:11px;">Final score: <b>${run.score || 0}</b></div>
                <div style="color:#888;font-size:10px;">Your best wins are kept in Feats &gt; Victories, where you can submit them to the online leaderboard.</div>`;
        }
        html += `<div style="height:10px;"></div><button data-finish style="${BTN}${BTN_GOOD}text-align:center;">Return to title</button>`;
        this._show(html, (on) => on('[data-finish]', () => this.hooks.finish()));
    }
}

