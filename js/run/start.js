// Title-screen entry points: start a new run (pick three starting roles),
// continue the saved run, or spend renown on unlocks.
import { SceneManager } from '../tactical/scene-manager.js';
import { RunMapScene } from './run-map-scene.js';
import { RunState, START_PARTY, MIN_START_PARTY } from './run-state.js';
import { loadProfile, saveProfile, runOptions, UNLOCKS, canBuyUnlock, buyUnlock, hasUnlock } from './profile.js';
import { jobsOfTier } from '../tactical/data-registry.js';
import { JOB_DATA } from '../tactical/data/jobs.js';
import { Modal, BTN, BTN_DISABLED, BTN_GOOD, BTN_GOLD, esc, jobLabel, abilityName } from './ui-kit.js';

// One-line role summaries for the starting picks.
const ROLE = {
    warden: 'Healer and protector',
    evoker: 'Ranged magic damage',
    runebow: 'Long-range archer',
    spellblade: 'Melee debuffer',
    stoneshaper: 'Durable melee bruiser',
    seer: 'Control and support',
};

export function hasSavedRun() {
    return !!RunState.load();
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
export function newRun(containerEl, skinManager, { onStart, onExit, onCancel }) {
    const profile = loadProfile();
    const options = runOptions(profile);
    const modal = new Modal(1200);
    const picked = [];

    const render = () => {
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">New Run</div>
            <div style="color:#999;font-size:11px;margin-bottom:10px;">Choose up to ${START_PARTY} starting roles. You will meet recruits on the road and can grow to six.</div>`;
        if (hasSavedRun()) html += `<div style="color:#f99;font-size:11px;margin-bottom:8px;">Starting a new run abandons the saved one.</div>`;
        for (const job of jobsOfTier(1)) {
            const unlocked = options.jobs.includes(job);
            const on = picked.includes(job);
            const kit = Object.keys(JOB_DATA[job].learnable).map(abilityName).join(', ');
            const lock = Object.values(UNLOCKS).find(u => u.job === job);
            html += `<button data-job="${job}" ${unlocked ? '' : 'disabled'} style="${BTN}${unlocked ? '' : BTN_DISABLED}${on ? 'border:2px solid #7bf;background:#0a1830;' : ''}">
                <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;color:${on ? '#9cf' : '#ddd'};">${on ? '✓ ' : ''}${jobLabel(job)}</span>
                <span style="color:#888;font-size:10px;">${unlocked ? esc(ROLE[job]) : `🔒 ${lock?.cost ?? '?'} renown`}</span></div>
                <div style="color:#778;font-size:10px;margin-top:2px;line-height:1.4;">${esc(kit)}</div>
            </button>`;
        }
        const ready = picked.length >= MIN_START_PARTY;
        if (ready && picked.length < START_PARTY) {
            html += `<div style="color:#fc8;font-size:11px;margin-top:6px;">Challenge run: starting with ${picked.length === 1 ? 'a lone hero' : `${picked.length} members`} makes the road a lot harder.</div>`;
        }
        html += `<div style="height:6px;"></div>
            <button data-begin ${ready ? '' : 'disabled'} style="${BTN}${ready ? BTN_GOOD : BTN_DISABLED}text-align:center;font-weight:bold;">${ready ? `Begin with ${picked.length} (${picked.length}/${START_PARTY})` : `Choose a role to begin (0/${START_PARTY})`}</button>`;
        const body = modal.show(html, { width: 480, onClose: () => { modal.destroy(); onCancel?.(); }, view: 'new-run' });
        body.querySelectorAll('[data-job]').forEach(b => b.addEventListener('click', () => {
            const job = b.dataset.job;
            const i = picked.indexOf(job);
            if (i >= 0) picked.splice(i, 1);
            else if (picked.length < START_PARTY) picked.push(job);
            render();
        }));
        body.querySelector('[data-begin]')?.addEventListener('click', () => {
            if (picked.length < MIN_START_PARTY || picked.length > START_PARTY) return;
            const run = RunState.create({ jobs: [...picked], options });
            run.save();
            modal.destroy();
            onStart?.();
            requestAnimationFrame(() => launch(containerEl, skinManager, run, onExit));
        });
    };
    render();
}

export function showUnlocks(onClose) {
    const profile = loadProfile();
    const modal = new Modal(1200);
    const render = () => {
        const s = profile.stats;
        let html = `<div style="color:#ffcc44;font-weight:bold;font-size:16px;margin-bottom:4px;">Unlocks</div>
            <div style="color:#fc6;margin-bottom:2px;">${profile.renown} renown</div>
            <div style="color:#777;font-size:10px;margin-bottom:10px;">Runs ${s.runs} · Wins ${s.wins} · Best: act ${s.bestAct || '-'}, ${s.bestFloor} floors. Renown comes from floors climbed, elites, bosses and victories.</div>`;
        for (const [key, u] of Object.entries(UNLOCKS)) {
            const owned = hasUnlock(profile, key);
            const can = canBuyUnlock(profile, key);
            const needs = u.requires && !hasUnlock(profile, u.requires) ? ` · needs ${UNLOCKS[u.requires].name}` : '';
            html += `<button data-buy="${key}" ${can ? '' : 'disabled'} style="${BTN}${owned ? BTN_GOOD : can ? BTN_GOLD : BTN_DISABLED}">
                <div style="display:flex;justify-content:space-between;"><span style="font-weight:bold;">${owned ? '✓ ' : ''}${esc(u.name)}</span>
                <span style="font-size:10px;">${owned ? 'owned' : `${u.cost} renown${needs}`}</span></div>
                <div style="color:#889;font-size:10px;margin-top:2px;">${esc(u.desc)}</div>
            </button>`;
        }
        const body = modal.show(html, { width: 480, onClose: () => { modal.destroy(); onClose?.(); }, view: 'unlocks' });
        body.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
            if (buyUnlock(profile, b.dataset.buy)) { saveProfile(profile); render(); }
        }));
    };
    render();
}
