// The screen for whatever the run has pending at the current node: the battle
// briefing, rewards, shop, event, rest site, treasure, recruits, and the end of
// the run. Every action goes through RunState; `hooks` tell the scene what to do next.
import { RELICS } from './data/relics.js';
import { ENCOUNTERS } from './data/encounters.js';
import { canPromote, promotionOptions, canSpendPoints, PROMOTION_LEVEL } from '../tactical/loadout.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { MAX_PARTY } from './run-state.js';
import {
    BTN, BTN_DISABLED, BTN_GOOD, BTN_GOLD, BTN_DANGER, GLOW, RARITY_COLOR, esc, jobLabel, jobDesc,
    abilityName, itemTitle, itemSummary, itemIconHtml, portraitHtml, drawSprites,
} from './ui-kit.js';

const H1 = (t, color = '#ffcc44') => `<div style="color:${color};font-weight:bold;font-size:16px;margin-bottom:6px;">${t}</div>`;
const SUB = (t) => `<div style="color:#999;font-size:11px;line-height:1.6;margin-bottom:12px;">${t}</div>`;
const SECTION = (t) => `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:12px 0 5px;">${t}</div>`;

function relicHtml(key) {
    const r = RELICS[key];
    return `<span style="color:${RARITY_COLOR[r.rarity]};font-weight:bold;">${esc(r.name)}</span>
        <div style="color:#889;font-size:10px;">${esc(r.desc)}</div>`;
}

export class NodeScreens {
    // hooks: { fight(), leave(), openParty(onClose), changed(), finish() }
    constructor(modal, run, skinManager, hooks) {
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

    _act(ok) {
        if (ok) this.hooks.changed();
        this.show();
    }

    _partyButton() {
        const spend = this.run.party.some(canSpendPoints);
        return `<button data-party style="${BTN}color:#adf;border-color:#448;${spend ? GLOW : ''}">☰ Party (equipment &amp; skills)${spend ? ' <span style="color:#afa;">● skill points to spend</span>' : ''}</button>`;
    }

    _wireParty(on) {
        on('[data-party]', () => this.hooks.openParty(() => this.show()));
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
            ? `${esc(ENCOUNTERS[enc.act].name)}: the guardian of this act bars the way.`
            : 'Your party will fight on its own, following each member\'s tactics. Winning heals everyone; losing ends the run.');
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
        const run = this.run;
        let html = H1(p.boss ? '♛ Boss Defeated!' : '✦ Victory!');
        html += `<div style="color:#fd8;margin-bottom:4px;">+${p.gold} gold</div>`;
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
        if (p.boss) {
            const ready = run.party.filter(m => canPromote(m));
            html += SECTION('Promotion');
            html += `<div style="color:#999;font-size:11px;margin-bottom:6px;">${ready.length
                ? `${esc(ready.map(m => m.name).join(', '))} can promote now, from the Party menu.`
                : `Members who reach level ${PROMOTION_LEVEL} may promote here or at a rest site.`}</div>`;
        }
        html += `<div style="height:8px;"></div>${this._partyButton()}
            <button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-item]', (el) => this._act(run.claimRewardItem(el.dataset.item)));
            on('[data-relic]', (el) => this._act(run.claimRewardRelic(el.dataset.relic)));
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
        let html = H1('$ Travelling Merchant', '#fc6');
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
        html += `<div style="height:8px;"></div>${this._partyButton()}
            <button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Leave shop ›</button>`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-buy]', (el) => this._act(run.buy(Number(el.dataset.buy))));
            on('[data-relic]', () => this._act(run.buyRelic()));
            on('[data-sell]', (el) => this._act(run.sell(el.dataset.sell)));
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
                if (!res) return;
                this.hooks.changed();
                if (res.next) this._eventFollowUp(ev, res);
                else this.show();
            });
            on('[data-continue]', () => this.hooks.leave());
        });
    }

    // The event's outcome text, then the battle or recruit screen it leads to.
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
        html += SUB(`Choose one: drill the whole company, train one member, or promote one who is ready.${wounded ? ' Any of them also tends your wounds.' : ''}`);
        html += `<button data-rest style="${BTN}${BTN_GOOD}">♨ Drill: every member gains ${run.options.drillXp} XP</button>`;
        html += SECTION(`Train: one member gains a skill point${run.options.trainXp ? ` and ${run.options.trainXp} XP` : ''}`);
        for (const m of run.party) {
            html += `<button data-train="${esc(m.name)}" style="${BTN}display:flex;gap:8px;align-items:center;">${portraitHtml(m, 20)}
                <span style="flex:1;">${esc(m.name)} <span style="color:#777;font-size:10px;">${jobLabel(m.job)}</span></span>
                <span style="color:#8c8;">Lv ${m.level} · ${m.sp || 0} SP</span></button>`;
        }
        const ready = run.party.filter(m => canPromote(m));
        if (ready.length) {
            html += SECTION('Promote');
            for (const m of ready) {
                for (const job of promotionOptions(m)) {
                    html += `<button data-promote="${esc(m.name)}|${job}" style="${BTN}${BTN_GOLD}">★ ${esc(m.name)}: ${jobLabel(m.job)} → ${jobLabel(job)}
                        <div style="color:#889;font-size:10px;line-height:1.4;">${esc(jobDesc(job))}</div></button>`;
                }
            }
        }
        html += `<div style="height:6px;"></div>${this._partyButton()}`;
        this._show(html, (on) => {
            this._wireParty(on);
            on('[data-rest]', () => this._act(run.drill()));
            on('[data-train]', (el) => this._act(run.train(el.dataset.train)));
            on('[data-promote]', (el) => {
                const [name, job] = el.dataset.promote.split('|');
                this._act(run.promote(name, job));
            });
        });
    }

    // ---- Treasure ----

    treasure(p) {
        const run = this.run;
        let html = H1('✦ Treasure', '#ec4');
        html += SUB('An old strongbox, half-buried by the road.');
        html += `<div style="color:#fd8;margin-bottom:6px;">${p.gold} gold</div>`;
        if (p.relic) html += `<div style="padding:6px 8px;border:1px solid #335;border-radius:4px;margin-bottom:8px;">${relicHtml(p.relic)}</div>`;
        html += p.claimed
            ? `<button data-continue style="${BTN}${BTN_GOOD}text-align:center;">Continue ›</button>`
            : `<button data-claim style="${BTN}${BTN_GOLD}text-align:center;">Open it</button>`;
        this._show(html, (on) => {
            on('[data-claim]', () => this._act(run.claimTreasure()));
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
            html += SUB(`Your party is full (${MAX_PARTY}). The would-be recruits share what they know instead.`)
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
                    <div style="color:#99a;font-size:10px;margin-top:3px;">Kit: ${esc(kit.map(abilityName).join(', '))}</div>
                </div>`;
            });
            html += `<button data-decline style="${BTN}">Turn them away (+40 gold)</button>`;
        }
        // Candidates aren't party members yet, so draw their portraits from the pending list.
        const body = this._show(html, (on) => {
            on('[data-recruit]', (el) => this._act(run.recruit(Number(el.dataset.recruit))));
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
            if (this.run.chooseStartingRelic(el.dataset.relic)) { this.hooks.changed(); this.modal.close(); }
        }));
    }

    // ---- End of run ----

    runOver() {
        const run = this.run;
        const won = run.status === 'won';
        const s = run.stats;
        let html = H1(won ? '♛ The Rift is Sealed' : '✝ The Company Falls', won ? '#fc6' : '#f66');
        html += SUB(won
            ? 'Against every odd, your company reached the end of the road.'
            : `Your party was defeated in ${esc(ENCOUNTERS[run.act].name)} (act ${run.act}).`);
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;margin-bottom:10px;">
            <div>Floors climbed</div><div style="color:#ddd;">${s.floors}</div>
            <div>Battles won</div><div style="color:#ddd;">${s.battles}</div>
            <div>Elites slain</div><div style="color:#ddd;">${s.elites}</div>
            <div>Bosses slain</div><div style="color:#ddd;">${s.bosses}</div>
            <div>Relics</div><div style="color:#ddd;">${run.relics.map(k => esc(RELICS[k].name)).join(', ') || 'none'}</div>
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
        html += `<div style="height:10px;"></div><button data-finish style="${BTN}${BTN_GOOD}text-align:center;">Return to title</button>`;
        this._show(html, (on) => on('[data-finish]', () => this.hooks.finish()));
    }
}

