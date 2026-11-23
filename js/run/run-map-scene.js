// The run's home scene: the act map, a HUD with the party, gold and relics, and the
// screen for whatever is pending at the current node. Battles are pushed on top
// (DeployScene → BattleScene) and come back here when they end.
//
// Landscape screens get a sidebar on the right. Portrait screens (phones held
// upright) get a top bar with the party and a bottom bar of buttons instead, with
// the realm's lore, relics, the legend and quitting moved into a Menu.
import { RunMapRenderer } from './run-map-renderer.js';
import { Sound } from '../audio/sound.js';
import { SCORE_TIP } from './score.js';
import { mapMusic, VICTORY_MUSIC } from '../audio/game-sounds.js';
import { NodeScreens } from './node-screens.js';
import { PartyMenu } from './party-menu.js';
import { RunState, MAX_PARTY } from './run-state.js';
import { RELICS } from './data/relics.js';
import { CHAINS } from './data/realms.js';
import { SCOUTING } from './data/encounters.js';
import { recordDailyResult } from './daily.js';
import { loadProfile, saveProfile, recordRun, noteItems, noteBosses, claimCollectionRewards, noteEndlessDepth, CHALLENGES } from './profile.js';
import { loadPlans } from './skill-plans.js';
import { ABILITIES } from '../tactical/data-registry.js';
import { Modal, Toast, BTN, BTN_GOOD, BTN_DANGER, GLOW, RARITY_COLOR, NODE_INFO, FONT, esc, jobLabel, hpBar, portraitHtml, drawSprites } from './ui-kit.js';
import { DeployScene } from '../tactical/deploy-scene.js';
import { BattleScene } from '../tactical/battle-scene.js';
import { openScriptEditor } from '../tactical/ai/script-editor.js';
import { setScriptBacking } from '../tactical/ai/script-store.js';
import { pointsToSpend } from './builds.js';
import { isPortrait } from '../ui/layout.js';
import { riftTransition } from '../ui/rift-transition.js';
import { showBuildSetup, showPromotionChoice } from '../ui/build-picker.js';

const SIDEBAR_W = 230;
const DRAG_THRESHOLD = 6;
// How long a "+ Skill" pop stays over a portrait (matches .skill-pop in style.css), and the
// gap before the same member's next one.
const SKILL_POP_MS = 2200;
const SKILL_POP_GAP_MS = 1500;
// How long to wait for the click a touch tap produces before giving up on swallowing it.
const GHOST_CLICK_MS = 500;

// A touch tap is followed by a browser-made click, aimed at whatever is under the finger by
// then. When the tap opened a node screen, that is one of the screen's buttons, so the tap
// would also press it (e.g. use up a rest site before the player sees it). Drops that click.
function swallowNextClick() {
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); done(); };
    const done = () => { window.removeEventListener('click', stop, true); clearTimeout(timer); };
    window.addEventListener('click', stop, true);
    const timer = setTimeout(done, GHOST_CLICK_MS);
}

const BAR = `position:absolute; left:0; right:0; box-sizing:border-box; z-index:10;
    background:rgba(8,8,20,0.95); font-family:${FONT}; font-size:12px; color:#ccc;`;

export class RunMapScene {
    constructor(run) {
        this.run = run;
    }

    enter(containerEl, skinManager, sceneManager) {
        this._container = containerEl;
        this._skin = skinManager;
        this._sm = sceneManager;
        this._pops = [];
        this._pendingPops = [];
        setScriptBacking(this.run.scripts);

        containerEl.innerHTML = '';
        containerEl.style.position = 'relative';
        this._canvas = document.createElement('canvas');
        this._canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
        containerEl.appendChild(this._canvas);
        this._renderer = new RunMapRenderer(this._canvas);

        this._sidebar = document.createElement('div');
        this._sidebar.style.cssText = `
            position:absolute; top:0; right:0; width:${SIDEBAR_W}px; height:100%; box-sizing:border-box;
            background:rgba(8,8,20,0.94); border-left:1px solid #335; padding:10px 9px; overflow-y:auto;
            font-family:${FONT}; font-size:12px; color:#ccc; z-index:10;
        `;
        containerEl.appendChild(this._sidebar);
        this._topbar = document.createElement('div');
        this._topbar.style.cssText = `${BAR} top:0; border-bottom:1px solid #335;
            padding:max(6px, env(safe-area-inset-top)) 8px 6px;`;
        this._bottombar = document.createElement('div');
        this._bottombar.style.cssText = `${BAR} bottom:0; border-top:1px solid #335; display:flex; gap:6px;
            padding:6px 8px max(6px, env(safe-area-inset-bottom));`;
        for (const el of [this._sidebar, this._topbar, this._bottombar]) {
            containerEl.appendChild(el);
            el.addEventListener('click', (e) => this._onSidebarClick(e));
        }

        this._modal = new Modal(300);
        this._toast = new Toast();
        this._party = new PartyMenu(this._modal, this.run, skinManager, { onChange: () => this._changed() });
        this._screens = new NodeScreens(this._modal, this.run, skinManager, {
            fight: () => this._startBattle(),
            leave: () => this._leaveNode(),
            openParty: (onClose) => this._openParty(onClose),
            openGear: (onClose) => this._openGear(onClose),
            changed: () => this._changed(),
            proceed: () => this._afterChange(),
            finish: () => this._finish(),
        });

        this._resize();
        window.addEventListener('resize', this._onResize = () => this._resize());
        // Pointer events cover mouse and touch: drag scrolls the map, a tap or click picks a node.
        this._canvas.style.touchAction = 'none';
        this._canvas.addEventListener('pointerdown', this._onDown = (e) => this._handleDown(e));
        this._canvas.addEventListener('pointermove', this._onMove = (e) => this._handleMove(e));
        this._canvas.addEventListener('pointerup', this._onUp = (e) => this._handleUp(e));
        this._canvas.addEventListener('pointercancel', this._onCancel = () => { this._drag = null; });
        this._canvas.addEventListener('wheel', this._onWheel = (e) => { e.preventDefault(); this._renderer.scrollBy(-e.deltaY); }, { passive: false });
        document.addEventListener('keydown', this._onKey = (e) => {
            if (this._modal.isOpen) return;
            if (e.key === 'p' || e.key === 'P') this._openParty();
            if (e.key === 't' || e.key === 'T') this._openTactics();
            if (e.key === 'g' || e.key === 'G') this._openGear(this.run.pending ? () => this._screens.show() : null);
        });

        this._sidebarKey = null;
        this._updateSidebar();
        this._renderer.focusFloor((this.run.currentNode?.floor ?? 0) + 1);
        this._afterChange();
    }

    resume(containerEl, skinManager, sceneManager) {
        this.enter(containerEl, skinManager, sceneManager);
    }

    exit() {
        window.removeEventListener('resize', this._onResize);
        document.removeEventListener('keydown', this._onKey);
        this._canvas?.removeEventListener('pointerdown', this._onDown);
        this._canvas?.removeEventListener('pointermove', this._onMove);
        this._canvas?.removeEventListener('pointerup', this._onUp);
        this._canvas?.removeEventListener('pointercancel', this._onCancel);
        this._canvas?.removeEventListener('wheel', this._onWheel);
        this._modal?.destroy();
        this._toast?.destroy();
        this._container.innerHTML = '';
    }

    render(now) {
        this._renderer.render(this.run, now);
        this._startSkillPops();
        this._updateSidebar();
    }

    // ---- Skill pops ----

    // New skills and promotions bought automatically float up over the member's portrait as
    // "+ Skill". Upgrades of known skills go unannounced. Pops wait while a modal covers the map.
    _queueSkillPops(bought) {
        for (const b of bought) {
            if (!b.promoted && b.rank > 1) continue;
            const text = b.promoted ? `★ ${jobLabel(b.promoted)}` : `+ ${ABILITIES[b.key]?.name ?? b.key}`;
            this._pendingPops.push({ name: b.name, text, promo: !!b.promoted });
        }
    }

    _startSkillPops() {
        const now = performance.now();
        this._pops = this._pops.filter(p => now - p.at < SKILL_POP_MS);
        if (!this._pendingPops.length || this._modal.isOpen) return;
        // Each member's pops queue behind the ones they're still showing.
        for (const p of this._pendingPops) {
            const last = Math.max(now - SKILL_POP_GAP_MS, ...this._pops.filter(q => q.name === p.name).map(q => q.at));
            this._pops.push({ ...p, at: last + SKILL_POP_GAP_MS });
        }
        this._pendingPops = [];
        this._sidebarKey = null;
    }

    _skillPopHtml(member) {
        const now = performance.now();
        return this._pops.filter(p => p.name === member.name)
            .map(p => `<span class="skill-pop${p.promo ? ' promo' : ''}" style="animation-delay:${Math.round(p.at - now)}ms;">${esc(p.text)}</span>`)
            .join('');
    }

    _portraitWithPops(member, size) {
        return `<div style="position:relative;flex-shrink:0;line-height:0;">${portraitHtml(member, size)}${this._skillPopHtml(member)}</div>`;
    }

    // ---- State ----

    // Every change passes through here: members with an auto skill plan spend their new
    // points first (see skill-plans.js), then the run is saved.
    _changed() {
        if (this.run.status === 'active') {
            const bought = this.run.autoAllocate(loadPlans());
            this._queueSkillPops(bought);
            if (bought.some(b => b.promoted)) Sound.playSfx('promote');
            // Feats: remember every item the party has ever held and every boss it beats.
            // (Bosses first: noting them marks the run, which is saved just after.)
            const profile = loadProfile();
            const newBosses = noteBosses(profile, this.run);
            const newItems = noteItems(profile, this.run);
            // Checked every time, not just on a new find: the share also moves when the game's
            // item count changes.
            const rewards = claimCollectionRewards(profile);
            for (const r of rewards) this._toast?.show(`Collection reward: ${r.label}! See Feats.`, 4200);
            if (newItems || newBosses || rewards.length) saveProfile(profile);
            this.run.save();
        }
        this._sidebarKey = null;
    }

    // Saves, then shows whatever is pending (or the end of the run).
    _afterChange() {
        this._changed();
        if (this.run.status !== 'active') return this._endRun();
        // The act realm's track, also on returning from a battle and when a new act begins.
        Sound.playMusic(mapMusic(this.run));
        if (this._showBuildPrompts()) return;
        if (this._needsActIntro()) return this._showActIntro();
        this._screens.show();
    }

    // Build focus (run/builds.js): members who just joined pick a build (the whole party at the
    // start of a run), and a member who can promote picks a class and its build. Each screen
    // comes back here, so the next prompt (or the pending screen) follows. Returns true when one
    // is shown.
    _showBuildPrompts() {
        const run = this.run;
        const onDone = () => { this._modal.close(); this._afterChange(); };
        const joining = run.membersNeedingBuild();
        if (joining.length) {
            showBuildSetup(this._modal, run, joining, { skin: this._skin, onDone });
            return true;
        }
        const ready = run.memberReadyToPromote();
        if (ready) {
            showPromotionChoice(this._modal, run, ready, { skin: this._skin, onDone });
            return true;
        }
        return false;
    }

    _leaveNode() {
        const act = this.run.act;
        this.run.leaveNode();
        const arrive = () => {
            this._modal.close();
            // Keep the next choices in view.
            this._renderer.focusFloor((this.run.currentNode?.floor ?? 0) + 1);
            this._afterChange();
        };
        // A new act: travel through the rift to its realm (the act card shows on arrival).
        if (this.run.act > act && this.run.status === 'active') riftTransition({ skinManager: this._skin, onMidpoint: arrive });
        else arrive();
    }

    // A card naming the act's realm, once per act, before its first step.
    _needsActIntro() {
        const run = this.run;
        return !run.pending && !run.currentNodeId && run.actIntro !== run.act;
    }

    _showActIntro() {
        const run = this.run, realm = run.realm;
        const body = this._modal.show(`
            <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:2px;">${run.endless ? `Endless rift · depth ${run.endless.depth}` : `Act ${run.act} of ${run.actCount}`} · ${esc(CHAINS[realm.chain].name)}</div>
            ${run.endless ? `<div style="color:#c9a;font-size:11px;margin-top:4px;">Every enemy here is stronger than the last realm's. The run ends when your party falls.</div>` : ''}
            <div style="color:#ffcc44;font-weight:bold;font-size:20px;margin:4px 0 10px;">${esc(realm.name)}</div>
            <div style="color:#bbc;line-height:1.5;margin-bottom:14px;">${esc(realm.blurb)}</div>
            ${run.options.scoutsReport && SCOUTING[run.actBoss] ? `<div style="border-left:2px solid #c84;padding:4px 10px;margin:-4px 0 14px;background:#140e08;">
                <div style="color:#c96;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Scout's report</div>
                <div style="color:#dcb;line-height:1.5;font-size:11px;">${esc(SCOUTING[run.actBoss])}</div></div>` : ''}
            <button data-begin style="${BTN}${BTN_GOOD}text-align:center;padding:10px;">Set out</button>`,
            { dismissible: false, width: 420 });
        body.querySelector('[data-begin]').addEventListener('click', () => {
            run.actIntro = run.act;
            this._modal.close();
            this._changed();
        });
    }

    _endRun() {
        // Sealing the final rift: stop here, or go on into the endless rift.
        if (this.run.canGoEndless) return this._offerEndless();
        if (this.run.renownEarned == null) {
            this._recordRun();
            RunState.clearSave();
        } else if (this.run.endless && !this.run.endless.ended) {
            // An endless run was recorded when it sealed the rift; now only its depth is kept.
            const profile = loadProfile();
            noteEndlessDepth(profile, this.run);
            saveProfile(profile);
            this.run.endless.ended = true;
            RunState.clearSave();
        }
        if (this.run.status === 'won') Sound.playMusic(VICTORY_MUSIC);
        else Sound.stopMusic(2000);
        this._screens.runOver();
    }

    // Records the run in the profile (renown, high score, the daily result).
    _recordRun() {
        const profile = loadProfile();
        const now = new Date();   // shared, so the daily result has the same id as the high score
        this.run.renownEarned = recordRun(profile, this.run, now);
        saveProfile(profile);
        if (this.run.options?.daily) recordDailyResult(this.run, this.run.renownEarned, now);
    }

    _offerEndless() {
        const body = this._modal.show(`
            <div style="color:#ffcc44;font-weight:bold;font-size:18px;margin-bottom:8px;">♛ The final rift is sealed</div>
            <div style="color:#bbc;line-height:1.5;margin-bottom:10px;">Your company can stop here and be remembered for it, or go deeper.
                Past the last rift, every realm's enemies are stronger than the one before.</div>
            <div style="color:#999;font-size:11px;line-height:1.5;margin-bottom:14px;">Either way, this win is recorded now, with its score and renown, and can go
                on the online leaderboard. Going deeper is just for fun: it lasts until your party falls, and nothing it scores is added.</div>
            <button data-endless style="${BTN}${BTN_DANGER}text-align:center;padding:10px;margin-bottom:6px;">Go deeper (endless)</button>
            <button data-seal style="${BTN}${BTN_GOOD}text-align:center;padding:10px;">Seal the rift and end the run</button>`,
            { dismissible: false, width: 440 });
        body.querySelector('[data-seal]').addEventListener('click', () => {
            this.run.endlessDeclined = true;
            this._modal.close();
            this._endRun();
        });
        body.querySelector('[data-endless]').addEventListener('click', () => {
            // The sealed run is what counts: record it before going on.
            this._recordRun();
            this.run.goEndless();
            this._modal.close();
            this._changed();
            riftTransition({ skinManager: this._skin, onMidpoint: () => this._afterChange() });
        });
    }

    _finish() {
        this._modal.close();
        this._sm.pop();
    }

    // ---- Battle ----

    _startBattle() {
        const run = this.run;
        const encounter = run.pending.encounter;
        const deploy = new DeployScene(encounter, run, this._skin, this._sm, (mapDef, spawns, camera) => {
            this._sm.replace(new BattleScene(encounter, run, () => this._afterChange(), { mapDef, customPlayerSpawns: spawns, camera }));
        });
        this._sm.push(deploy);
    }

    // ---- Menus ----

    _openParty(onClose = null) {
        this._party.onClose = onClose ? () => { this._party.onClose = null; onClose(); } : null;
        this._party.showList();
    }

    _openGear(onClose = null) {
        this._party.gear.show(null, { onClose });
    }

    _openTactics() {
        openScriptEditor(this.run.party, {
            codex: !!this.run.options.tacticsCodex,
            onSaved: (name) => { this._changed(); this._toast.show(`${name}'s tactics saved.`); },
        });
    }

    _onSidebarClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        switch (btn.dataset.action) {
            case 'party': this._openParty(this.run.pending ? () => this._screens.show() : null); break;
            case 'member':
                this._openParty(this.run.pending ? () => this._screens.show() : null);
                this._party.showMember(btn.dataset.member);
                break;
            case 'tactics': this._openTactics(); break;
            case 'gear': this._openGear(this.run.pending ? () => this._screens.show() : null); break;
            case 'menu': this._openMenu(); break;
            case 'resume': this._screens.show(); break;
            case 'abandon':
                if (window.confirm(this.run.endless ? 'End this endless run here? It still counts as a win.' : 'Abandon this run? It counts as a defeat.')) {
                    this.run.status = 'lost';
                    this._modal.close();
                    this._endRun();
                }
                break;
            case 'quit':
                this._modal.close();
                this._sm.pop();
                break;
        }
    }

    // The run menu on portrait screens: the realm's lore, relics, the map legend, and leaving the run.
    _openMenu() {
        const run = this.run;
        const back = run.pending ? () => this._screens.show() : null;
        const body = this._modal.show(`<div style="color:#ffcc44;font-weight:bold;font-size:15px;margin-bottom:8px;">Menu</div>
            ${this._challengeHtml()}${this._realmLoreHtml()}${this._relicsHtml()}${this._legendHtml()}
            <div style="margin-top:14px;border-top:1px solid #223;padding-top:8px;">
                <button data-action="quit" style="${BTN}color:#888;">Save &amp; quit to title</button>
                <button data-action="abandon" style="${BTN}${BTN_DANGER}">Abandon run</button>
            </div>`, { view: 'menu', onClose: back });
        body.addEventListener('click', (e) => this._onSidebarClick(e));
    }

    _relicsHtml() {
        let html = `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 5px;">Relics</div>`;
        if (!this.run.relics.length) html += `<div style="color:#555;font-size:10px;">None yet</div>`;
        for (const k of this.run.relics) {
            const r = RELICS[k];
            // The effect is spelled out, not left to a hover tooltip: hovering doesn't exist on
            // touch screens, and node screens cover the sidebar.
            html += `<div style="font-size:11px;color:${RARITY_COLOR[r.rarity]};margin-bottom:5px;">◆ ${esc(r.name)}
                <div style="color:#889;font-size:10px;line-height:1.35;">${esc(r.desc)}</div></div>`;
        }
        return html;
    }

    _legendHtml() {
        return `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:12px 0 5px;">Legend</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:10px;">
            ${Object.values(NODE_INFO).map(i => `<span><span style="color:${i.color};">${i.icon}</span> ${i.label}</span>`).join('')}</div>
            <div style="color:#666;font-size:10px;margin-top:6px;">${isPortrait() ? 'Tap' : 'Click'} a glowing node to travel. ${isPortrait() ? 'Drag' : 'Scroll'} to look ahead.</div>`;
    }

    // The run's challenge, if it took one (Feats > Challenges), so its rule stays in view.
    _challengeHtml() {
        const c = CHALLENGES[this.run.challenge];
        return c ? `<div style="color:#c9a;font-size:10px;line-height:1.4;margin-top:4px;">⚑ Challenge: ${esc(c.name)}. ${esc(c.desc)}</div>` : '';
    }

    // The current realm's lore. Landscape shows it at the top of the sidebar; the portrait top
    // bar has no room for it, so the Menu carries it instead.
    _realmLoreHtml() {
        const realm = this.run.realm;
        if (!realm?.blurb) return '';
        return `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 5px;">${esc(realm.name)}</div>
            <div style="color:#888;font-size:10px;margin-bottom:3px;">${esc(CHAINS[realm.chain]?.name ?? '')}</div>
            <div style="color:#99a;font-size:11px;line-height:1.45;">${esc(realm.blurb)}</div>`;
    }

    _updateSidebar() {
        const run = this.run;
        const portrait = isPortrait();
        const key = JSON.stringify([portrait, run.gold, run.act, run.currentNodeId, run.relics, run.status, !!run.pending,
            run.party.map(m => [m.name, m.job, m.hp, m.level, m.xp, m.sp, m.learned.length, JSON.stringify(m.ranks), m.loadout?.support, m.appearance?.armorKey, m.appearance?.weaponKey, m.appearance?.helmetKey, m.appearance?.toolKey, m.appearance?.bootsKey, m.appearance?.trinketKey])]);
        if (key === this._sidebarKey) return;
        this._sidebarKey = key;
        this._sidebar.style.display = portrait ? 'none' : '';
        this._topbar.style.display = portrait ? '' : 'none';
        this._bottombar.style.display = portrait ? 'flex' : 'none';
        if (portrait) this._updateBars();
        else this._updateSide();
        this._resize();
    }

    _updateBars() {
        const run = this.run;
        const floor = run.currentNode?.floor ?? 0;
        const spend = run.party.some(pointsToSpend);
        let top = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px;">
            <span style="color:#ffcc44;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${run.actLabel}: ${esc(run.realm.name)} · ${floor}/15</span>
            <span style="white-space:nowrap;"><span style="color:#fc8;">★ ${run.gold}</span>
            <span data-action="menu" style="color:#7bf;margin-left:8px;cursor:pointer;">◆ ${run.relics.length}</span></span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;">`;
        for (const m of run.party) {
            const hp = run.hp(m), max = run.maxHp(m);
            const can = pointsToSpend(m);
            top += `<div data-action="member" data-member="${esc(m.name)}" style="display:flex;gap:4px;align-items:center;padding:3px;min-width:0;
                    border:1px solid ${can ? '#6f6' : '#262640'};border-radius:4px;background:#0d0d20;cursor:pointer;${can ? GLOW : ''}">
                ${this._portraitWithPops(m, 24)}
                <div style="flex:1;min-width:0;font-size:10px;">
                    <div style="color:${m.appearance?.nameColor || '#ccc'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}</div>
                    <div style="color:#888;white-space:nowrap;">Lv${m.level}${run.canPromote(m) ? ' <span style="color:#fc6;">★</span>' : ''}${can ? ` <span style="color:#afa;font-weight:bold;">●${m.sp}</span>` : ''}</div>
                    ${hpBar(hp, max, 56)}
                </div>
            </div>`;
        }
        top += `</div>`;
        this._topbar.innerHTML = top;
        drawSprites(this._topbar, run.party, this._skin);

        const btn = (action, label, extra = '') => `<button data-action="${action}" style="${BTN}margin:0;flex:1;text-align:center;padding:10px 4px;${extra}">${label}</button>`;
        let bottom = btn('party', `☰ Party${spend ? ' <span style="color:#afa;">●</span>' : ''}`, `color:#adf;border-color:#448;${spend ? GLOW : ''}`)
            + btn('gear', '⚔ Gear', 'color:#fda;border-color:#664;')
            + btn('tactics', '⚙ Tactics', 'color:#cf9;border-color:#575;');
        if (run.pending && run.status === 'active') bottom += btn('resume', `› ${esc(NODE_INFO[run.currentNode?.type]?.label ?? 'Node')}`, 'color:#fc8;border-color:#664;');
        bottom += btn('menu', '≡ Menu');
        this._bottombar.innerHTML = bottom;
    }

    _updateSide() {
        const run = this.run;

        const floor = run.currentNode?.floor ?? 0;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:13px;">${run.actLabel}: ${esc(run.realm.name)}</div>
            <div style="color:#888;font-size:10px;">${esc(CHAINS[run.realm.chain].name)} · Floor ${floor} of 15</div>
            ${this._challengeHtml()}
            <div style="color:#99a;font-size:10px;line-height:1.4;margin:5px 0 8px;">${esc(run.realm.blurb)}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #335;">
                <span style="color:#fc8;">★ ${run.gold} gold</span><span style="color:#9cf;" data-tip="${esc(SCORE_TIP)}">✦ ${run.score || 0} score</span><span style="color:#888;">${Object.values(run.inventory).reduce((s, n) => s + n, 0)} in bag</span>
            </div>`;

        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin-bottom:5px;">Party (${run.party.length}/${MAX_PARTY})</div>`;
        for (const m of run.party) {
            const hp = run.hp(m), max = run.maxHp(m);
            const spend = pointsToSpend(m);
            html += `<div data-action="member" data-member="${esc(m.name)}" title="Open ${esc(m.name)}" style="display:flex;gap:7px;align-items:center;margin-bottom:5px;padding:3px;border:1px solid ${spend ? '#6f6' : 'transparent'};border-radius:4px;cursor:pointer;${spend ? GLOW : ''}">
                ${this._portraitWithPops(m, 26)}
                <div style="flex:1;min-width:0;">
                    <div style="color:${m.appearance?.nameColor || '#ccc'};font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.name)}${run.canPromote(m) ? ' <span style="color:#fc6;">★</span>' : ''}</div>
                    <div style="font-size:9px;color:#777;text-transform:uppercase;">Lv ${m.level} ${jobLabel(m.job)} ${spend ? `<span style="color:#afa;font-weight:bold;">● ${m.sp} SP</span>` : ''}</div>
                    <div style="font-size:9px;color:#999;">${hpBar(hp, max, 70)} ${hp}/${max}</div>
                </div>
            </div>`;
        }

        html += `<div style="height:6px;"></div>
            <button data-action="party" style="${BTN}color:#adf;border-color:#448;${run.party.some(pointsToSpend) ? GLOW : ''}">☰ Party <span style="color:#666;font-size:10px;">(P)</span>${run.party.some(pointsToSpend) ? ' <span style="color:#afa;font-size:10px;">● skill points!</span>' : ''}</button>
            <button data-action="gear" style="${BTN}color:#fda;border-color:#664;">⚔ Equipment <span style="color:#666;font-size:10px;">(G)</span></button>
            <button data-action="tactics" style="${BTN}color:#cf9;border-color:#575;">⚙ Tactics <span style="color:#666;font-size:10px;">(T, optional)</span></button>`;
        if (run.pending && run.status === 'active') {
            html += `<button data-action="resume" style="${BTN}color:#fc8;border-color:#664;">› Return to ${esc(NODE_INFO[run.currentNode?.type]?.label ?? 'node')}</button>`;
        }

        html += this._relicsHtml() + this._legendHtml() + `
            <div style="margin-top:14px;border-top:1px solid #223;padding-top:8px;">
                <button data-action="quit" style="${BTN}color:#888;">Save &amp; quit to title</button>
                <button data-action="abandon" style="${BTN}${BTN_DANGER}">Abandon run</button>
            </div>`;
        this._sidebar.innerHTML = html;
        drawSprites(this._sidebar, run.party, this._skin);
    }

    // ---- Map input ----

    _resize() {
        const rect = this._container.getBoundingClientRect();
        const w = rect.width || window.innerWidth, h = rect.height || window.innerHeight;
        const insets = isPortrait()
            ? { top: this._topbar.offsetHeight, bottom: this._bottombar.offsetHeight, right: 0 }
            : { top: 0, bottom: 0, right: SIDEBAR_W };
        const r = this._renderer;
        if (r.w === w && r.h === h && JSON.stringify(r.insets) === JSON.stringify(insets)) return;
        r.resize(w, h, insets);
        // A layout change (e.g. rotating the phone) keeps the next choices in view.
        if (this._lastPortrait !== isPortrait()) {
            this._lastPortrait = isPortrait();
            r.focusFloor((this.run.currentNode?.floor ?? 0) + 1);
        }
    }

    _point(e) {
        const r = this._canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    _handleDown(e) {
        if (e.button !== 0) return;
        this._drag = { id: e.pointerId, y: e.clientY, startY: e.clientY, startX: e.clientX, moved: false };
    }

    _handleMove(e) {
        const d = this._drag;
        if (d && d.id === e.pointerId) {
            if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= DRAG_THRESHOLD) d.moved = true;
            if (d.moved) {
                this._renderer.scrollBy(e.clientY - d.y);
                d.y = e.clientY;
                this._renderer.hoveredId = null;
                return;
            }
        }
        if (e.pointerType !== 'mouse') return;
        const p = this._point(e);
        const id = this._renderer.nodeAt(this.run, p.x, p.y);
        this._renderer.hoveredId = id;
        this._canvas.style.cursor = id && this.run.reachable().includes(id) ? 'pointer' : 'default';
    }

    _handleUp(e) {
        const d = this._drag;
        this._drag = null;
        if (!d || d.id !== e.pointerId || d.moved) return;
        if (e.pointerType !== 'mouse') swallowNextClick();
        this._handleTap(e);
    }

    _handleTap(e) {
        if (this._modal.isOpen) return;
        const p = this._point(e);
        const id = this._renderer.nodeAt(this.run, p.x, p.y);
        if (!id) return;
        if (!this.run.reachable().includes(id)) {
            if (this.run.pending) this._screens.show();
            return;
        }
        this.run.enterNode(id);
        Sound.playSfx('travel');
        this._afterChange();
    }
}
