// Title-screen entry points: start a new run (pick three starting roles),
// continue the saved run, or spend renown on unlocks.
import { SceneManager } from '../tactical/scene-manager.js';
import { RunMapScene } from './run-map-scene.js';
import { RunState, START_PARTY, MIN_START_PARTY } from './run-state.js';
import {
    loadProfile, saveProfile, runOptions, UNLOCKS, canBuyUnlock, buyUnlock, hasUnlock, unlockCost, RIFT_TIERS, renownMultiplier, SMALL_PARTY_RENOWN, CHALLENGES,
} from './profile.js';
import { jobsOfTier } from '../tactical/data-registry.js';
import { JOB_DATA } from '../content/jobs.js';
import { Modal, BTN, BTN_DISABLED, BTN_GOOD, BTN_GOLD, esc, jobLabel, abilityName } from './ui-kit.js';
import { riftTransition } from '../ui/rift-transition.js';
import { dailyDate, dailyJobs, dailyLabel, dailyPlayed, createDailyRun, markDailyStarted } from './daily.js';


// Button labels for each Rift Tier (RIFT_TIERS), from 'None' up.
const TIER_NUMERALS = ['None', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export function hasSavedRun() {
    return !!RunState.load();
}

// The warning shown before replacing the saved run. A saved daily run can't be started again.
function savedRunWarning() {
    return RunState.load()?.options?.daily
        ? 'Starting a new run abandons your daily run in progress, and today\'s daily can\'t be played again.'
        : 'Starting a new run abandons the saved one.';
}

function launch(containerEl, skinManager, run, onExit) {
    containerEl.innerHTML = '';
    containerEl.style.position = 'relative';
    const sm = new SceneManager(containerEl, skinManager, onExit);
    sm.push(new RunMapScene(run));
}

export function continueRun(containerEl, skinManager, onExit) {
    const run = RunState.load();
    if (!run) return false;
    launch(containerEl, skinManager, run, onExit);
    return true;
}

// Shows the starting-party picker; on confirm, starts the run in containerEl.
// onCancel: the player backed out. onStart: the game container is about to be used.
// challenge: a CHALLENGES id when started from Feats > Challenges (locked in for the run).
export function newRun(containerEl, skinManager, { onStart, onExit, onCancel, challenge = null }) {
    const profile = loadProfile();
    const options = runOptions(profile);
    const modal = new Modal(1200);
    const picked = [];
    const maxTier = profile.stats.riftTier ?? 0;
    let tier = 0;

    const render = () => {
        const c = CHALLENGES[challenge];
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">${c ? 'New Challenge Run' : 'New Run'}</div>
            <div style="color:#999;font-size:11px;margin-bottom:10px;">Choose up to ${START_PARTY} starting classes. You'll meet recruits on the road, and the party can grow to six.</div>`;
        if (c) {
            html += `<div style="margin-bottom:10px;padding:8px;border:1px solid #a7c;border-radius:4px;background:#1a1028;">
                <div style="color:#daf;font-weight:bold;font-size:12px;">⚑ Challenge: ${esc(c.name)}</div>
                <div style="color:#bab;font-size:11px;line-height:1.4;margin-top:2px;">${esc(c.desc)}</div>
                <div style="color:#887;font-size:10px;margin-top:4px;">Pick any Rift Tier and party size. Challenge runs earn renown as usual but can't go on the online leaderboard.</div>
            </div>`;
        }
        if (hasSavedRun()) html += `<div style="color:#f99;font-size:11px;margin-bottom:8px;">${savedRunWarning()}</div>`;
        for (const job of jobsOfTier(1)) {
            const unlocked = options.jobs.includes(job);
            const on = picked.includes(job);
            const kit = Object.keys(JOB_DATA[job].learnable).map(abilityName).join(', ');
            const lock = Object.keys(UNLOCKS).find(k => UNLOCKS[k].job === job);
            html += `<button data-job="${job}" ${unlocked ? '' : 'disabled'} style="${BTN}${unlocked ? '' : BTN_DISABLED}${on ? 'border:2px solid #7bf;background:#0a1830;' : ''}">
                <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;color:${on ? '#9cf' : '#ddd'};">${on ? '✓ ' : ''}${jobLabel(job)}</span>
                <span style="color:#888;font-size:10px;">${unlocked ? esc(JOB_DATA[job].role) : `🔒 ${lock ? unlockCost(profile, lock) : '?'} renown`}</span></div>
                <div style="color:#778;font-size:10px;margin-top:2px;line-height:1.4;">${esc(kit)}</div>
            </button>`;
        }
        const ready = picked.length >= MIN_START_PARTY;
        if (ready && picked.length < START_PARTY) {
            html += `<div style="color:#fc8;font-size:11px;margin-top:6px;">Challenge run: starting with ${picked.length === 1 ? 'a lone hero' : `${picked.length} members`} makes the road a lot harder, and earns +${Math.round(SMALL_PARTY_RENOWN[picked.length] * 100)}% renown.</div>`;
        }
        // Rift Tiers: open once the profile has won a run (each win opens the next tier).
        if (maxTier > 0) {
            html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">Rift Tier</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">`;
            for (let t = 0; t < RIFT_TIERS.length; t++) {
                const open = t <= maxTier, on = t === tier;
                html += `<button data-tier="${t}" ${open ? '' : 'disabled'} style="${BTN}width:auto;margin:0;padding:4px 10px;text-align:center;
                    ${on ? 'border:2px solid #f96;background:#2a1408;color:#fc9;' : ''}${open ? '' : BTN_DISABLED}">${TIER_NUMERALS[t]}${open ? '' : ' 🔒'}</button>`;
            }
            html += `</div><div style="color:#aab;font-size:11px;margin-top:5px;line-height:1.5;">`;
            if (tier === 0) html += 'No extra twists.';
            else html += RIFT_TIERS.slice(1, tier + 1).map(t => `<div><span style="color:#f96;">${esc(t.name)}</span>: ${esc(t.desc)}</div>`).join('');
            html += `</div>`;
            if (maxTier < RIFT_TIERS.length - 1) html += `<div style="color:#667;font-size:10px;margin-top:3px;">Win a run at Tier ${TIER_NUMERALS[maxTier]} to open the next one.</div>`;
        }
        const mult = renownMultiplier(tier, ready ? picked.length : START_PARTY);
        if (mult > 1) html += `<div style="color:#fc6;font-size:11px;margin-top:6px;">Renown this run: ×${mult.toFixed(2).replace(/\.?0+$/, '')}</div>`;
        html += `<div style="height:6px;"></div>
            <button data-begin ${ready ? '' : 'disabled'} style="${BTN}${ready ? BTN_GOOD : BTN_DISABLED}text-align:center;font-weight:bold;">${ready ? `Set out (${picked.length}/${START_PARTY})` : `Choose a class to begin (0/${START_PARTY})`}</button>`;
        const body = modal.show(html, { width: 480, onClose: () => { modal.destroy(); onCancel?.(); }, view: 'new-run' });
        body.querySelectorAll('[data-job]').forEach(b => b.addEventListener('click', () => {
            const job = b.dataset.job;
            const i = picked.indexOf(job);
            if (i >= 0) picked.splice(i, 1);
            else if (picked.length < START_PARTY) picked.push(job);
            render();
        }));
        body.querySelectorAll('[data-tier]').forEach(b => b.addEventListener('click', () => {
            const t = Number(b.dataset.tier);
            if (t <= maxTier) { tier = t; render(); }
        }));
        body.querySelector('[data-begin]')?.addEventListener('click', () => {
            if (picked.length < MIN_START_PARTY || picked.length > START_PARTY) return;
            const run = RunState.create({ jobs: [...picked], options: { ...options, tier, challenge: CHALLENGES[challenge] ? challenge : null } });
            run.save();
            // Step through the rift into the first act.
            riftTransition({ skinManager, onMidpoint: () => {
                modal.destroy();
                onStart?.();
                launch(containerEl, skinManager, run, onExit);
            } });
        });
    };
    render();
}

// Shows today's daily run (its date, classes and rules); on confirm, starts it in containerEl.
// The day's one attempt is used as soon as the run starts. Callbacks as for newRun.
export function dailyRun(containerEl, skinManager, { onStart, onExit, onCancel }) {
    const date = dailyDate();
    if (dailyPlayed(date)) { onCancel?.(); return; }
    const modal = new Modal(1200);
    const jobs = dailyJobs(date);
    let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">Daily Run · ${esc(dailyLabel(date))}</div>
        <div style="color:#aab;font-size:11px;line-height:1.5;margin-bottom:10px;">Every player gets the same run today: the same map, fights and rewards, with the same starting party.
        Unlocks and Rift Tiers don't apply. You get <b style="color:#fc8;">one attempt</b>, and it counts as soon as you set out.</div>
        <div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:6px 0 4px;">Today's party</div>`;
    for (const job of jobs) {
        const kit = Object.keys(JOB_DATA[job].learnable).map(abilityName).join(', ');
        html += `<div style="${BTN}cursor:default;">
            <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;color:#ddd;">${jobLabel(job)}</span>
            <span style="color:#888;font-size:10px;">${esc(JOB_DATA[job].role)}</span></div>
            <div style="color:#778;font-size:10px;margin-top:2px;line-height:1.4;">${esc(kit)}</div></div>`;
    }
    if (hasSavedRun()) html += `<div style="color:#f99;font-size:11px;margin:8px 0;">${savedRunWarning()}</div>`;
    html += `<div style="color:#778;font-size:10px;margin:6px 0;">Finish (win or lose) to post your score on today's daily leaderboard. A new daily starts at midnight Eastern Time.</div>
        <button data-begin style="${BTN}${BTN_GOOD}text-align:center;font-weight:bold;">Set out</button>`;
    const body = modal.show(html, { width: 480, onClose: () => { modal.destroy(); onCancel?.(); }, view: 'daily-run' });
    body.querySelector('[data-begin]').addEventListener('click', () => {
        // The day may have turned over while this was open: that day's run is a different one.
        if (dailyDate() !== date || dailyPlayed(date)) { modal.destroy(); onCancel?.(); return; }
        const run = createDailyRun(date);
        markDailyStarted(date);
        run.save();
        riftTransition({ skinManager, onMidpoint: () => {
            modal.destroy();
            onStart?.();
            launch(containerEl, skinManager, run, onExit);
        } });
    });
}

export function showUnlocks(onClose) {
    const profile = loadProfile();
    const modal = new Modal(1200);
    const render = () => {
        const s = profile.stats;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">Unlocks</div>
            <div style="color:#fc6;margin-bottom:2px;">${profile.renown} renown</div>
            <div style="color:#777;font-size:10px;margin-bottom:10px;">Runs ${s.runs} · Wins ${s.wins} · Best: act ${s.bestAct || '-'}, ${s.bestFloor} floors<br>Earn renown by climbing floors, beating elites and bosses, and winning runs.</div>`;
        const tier = profile.stats.riftTier ?? 0;
        html += `<div style="color:#f96;font-size:11px;margin-bottom:8px;">${tier
            ? `Rift Tiers open: up to ${RIFT_TIERS[tier].name}. Win at your highest tier to open the next.`
            : 'Win a run to open Rift Tiers: harder runs for more renown.'}</div>`;
        const groups = [
            ['Classes', ([, u]) => u.job],
            ['Run perks', ([, u]) => !u.job && !u.backdrop],
            ['Title backdrops', ([, u]) => u.backdrop],
        ];
        for (const [title, test] of groups) {
        html += `<div style="color:#fc8;font-size:10px;text-transform:uppercase;margin:10px 0 4px;">${title}</div>`;
        if (title === 'Classes') html += `<div style="color:#889;font-size:10px;margin:-2px 0 4px;">All classes cost the same. Each one you unlock raises the price of the rest.</div>`;
        for (const [key, u] of Object.entries(UNLOCKS).filter(test)) {
            const owned = hasUnlock(profile, key);
            const can = canBuyUnlock(profile, key);
            const needs = u.requires && !hasUnlock(profile, u.requires) ? ` · needs ${UNLOCKS[u.requires].name}` : '';
            html += `<button data-buy="${key}" ${can ? '' : 'disabled'} style="${BTN}${owned ? BTN_GOOD : can ? BTN_GOLD : BTN_DISABLED}">
                <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;">${owned ? '✓ ' : ''}${esc(u.name)}</span>
                <span style="font-size:10px;">${owned ? 'owned' : `${unlockCost(profile, key)} renown${needs}`}</span></div>
                <div style="color:#889;font-size:10px;margin-top:2px;">${esc(u.desc)}</div>
            </button>`;
        }
        }
        const body = modal.show(html, { width: 480, onClose: () => { modal.destroy(); onClose?.(); }, view: 'unlocks' });
        body.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
            if (buyUnlock(profile, b.dataset.buy)) { saveProfile(profile); render(); }
        }));
    };
    render();
}
