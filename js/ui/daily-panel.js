// The title screen's daily run: the Daily button (its date, and greyed out once today's daily
// has been started) and the daily leaderboard panel beside the menu, with this device's result
// for today on top and a form to submit it. Everything follows the Eastern Time day (run/daily.js), and
// both refresh by themselves when it turns over.
import { dailyDate, dailyJobs, dailyLabel, loadDaily, dailyPlayed, msUntilNextDaily } from '../run/daily.js';
import { fetchDailyLeaderboard, submitRun, savedName, canSubmit, runResult } from '../run/leaderboard.js';
import { NAME_MAX, nameProblem } from '../run/leaderboard-rules.js';
import { RunState } from '../run/run-state.js';
import { SCORE_TIP } from '../run/score.js';
import { esc, jobLabel } from '../run/ui-kit.js';

const BOARD_SIZE = 50;

/** '5h 12m', '12m', or 'under a minute': how long until `ms` milliseconds have passed. */
export function countdownText(ms) {
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'under a minute';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
}

const partyText = (party) => party.map(m => (m.origin ? `${jobLabel(m.origin)} → ${jobLabel(m.job)}` : jobLabel(m.job)) + ` ${m.level}`).join(', ');
const outcomeHtml = (e) => {
    const { won, act } = runResult(e);
    return won ? '<span style="color:#fc6;">★ Victory</span>' : `<span style="color:#d88;">Fell in Act ${act}</span>`;
};

/**
 * Wires the Daily button and the daily leaderboard panel. `onPlay` starts today's daily (the
 * button only calls it while today's is unplayed). Returns refresh(), to call when the title
 * screen shows again (a daily may have been started or finished meanwhile).
 */
export function mountDailyPanel({ button, panel, onPlay }) {
    let date = dailyDate();
    let board = null;          // { entries } or { error }, for `date`
    let loading = false;
    let nameDraft = savedName();
    let submitMsg = null;      // { ok, text }
    let sending = false;
    let editing = false;       // the name form is open

    const loadBoard = async () => {
        if (loading) return;
        loading = true;
        board = null;
        render();
        const forDate = date;
        let result;
        try { result = { entries: await fetchDailyLeaderboard(forDate, { limit: BOARD_SIZE }) }; } catch (e) { result = { error: e.message }; }
        loading = false;
        if (forDate === date) board = result;
        render();
    };

    const renderButton = () => {
        const played = dailyPlayed(date);
        button.disabled = played;
        button.innerHTML = `Daily Run<span class="daily-date">${esc(dailyLabel(date))}${played ? ' · played ✓' : ''}</span>`;
        button.title = played
            ? `You've played today's daily. The next one starts in ${countdownText(msUntilNextDaily())}.`
            : `Today's daily run (${date}, Eastern Time): the same run for every player, one attempt.`;
    };

    // This device's daily for today: the finished result with its submit form, or a note.
    const mineHtml = () => {
        const rec = loadDaily();
        if (rec?.date !== date) return `<div class="daily-note">You haven't played today's daily yet. Press Daily Run to set out.</div>`;
        if (!rec.result) {
            const inProgress = RunState.load()?.options?.daily === date;
            return `<div class="daily-note">${inProgress ? 'Your daily run is in progress. Continue it to post a score.' : 'Your daily run was abandoned.'}</div>`;
        }
        const r = rec.result;
        let html = `<div class="daily-mine">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <span style="color:#8c8;font-weight:bold;">Your run</span>
                <span style="color:#9cf;font-weight:bold;font-size:14px;">${r.score}</span></div>
            <div style="font-size:10px;">${outcomeHtml({ realms: r.realms, bosses: r.bosses })}</div>
            <div style="color:#889;font-size:10px;">${esc(partyText(r.party))}</div>`;
        if (r.submitted) html += `<div style="color:#8c8;font-size:10px;margin-top:4px;">✓ On today's leaderboard</div>`;
        else if (!r.score) html += `<div style="color:#778;font-size:10px;margin-top:4px;">No battles won, so there's no score to submit.</div>`;
        else if (!canSubmit(r)) html += `<div style="color:#778;font-size:10px;margin-top:4px;">This daily's leaderboard has closed.</div>`;
        else if (!editing) html += `<button data-daily-submit class="daily-btn daily-btn-blue" style="margin-top:6px;">Submit to leaderboard</button>`;
        else {
            html += `<div style="font-size:10px;color:#99a;margin:6px 0 4px;">The name to show with this run (public, so not your real name).</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <input data-daily-name maxlength="${NAME_MAX}" value="${esc(nameDraft)}" placeholder="Your name" autocomplete="nickname">
                    <button data-daily-send class="daily-btn daily-btn-green"${sending ? ' disabled' : ''}>${sending ? 'Sending…' : 'Submit'}</button>
                    <button data-daily-cancel class="daily-btn"${sending ? ' disabled' : ''}>Cancel</button>
                </div>
                <div style="font-size:9px;color:#667;margin-top:4px;">See the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="terms.html" target="_blank" rel="noopener">Terms</a>.</div>`;
        }
        if (submitMsg) html += `<div style="font-size:10px;margin-top:4px;color:${submitMsg.ok ? '#8c8' : '#f88'};">${esc(submitMsg.text)}</div>`;
        return html + `</div>`;
    };

    const listHtml = () => {
        if (!board) return `<div class="daily-note" style="text-align:center;">Loading…</div>`;
        if (board.error) return `<div class="daily-note" style="color:#f88;text-align:center;">${esc(board.error)}</div>`;
        if (!board.entries.length) return `<div class="daily-note" style="text-align:center;">No scores yet today. Finish the daily and be the first.</div>`;
        const mine = loadDaily()?.result?.id;
        return board.entries.map((e, i) => {
            const own = e.id === mine;
            const medal = ['#fc6', '#ccd', '#c96'][i] ?? '#889';
            return `<div class="daily-row${own ? ' own' : ''}">
                <span class="daily-rank" style="color:${medal};">#${i + 1}</span>
                <div style="flex:1;min-width:0;">
                    <div class="daily-name">${esc(e.name)}${own ? ' <span style="color:#8c8;font-size:10px;font-weight:normal;">(you)</span>' : ''}</div>
                    <div style="font-size:10px;">${outcomeHtml(e)}</div>
                    <div class="daily-party">${esc(partyText(e.party))}</div>
                </div>
                <span class="daily-score">${e.score}</span>
            </div>`;
        }).join('');
    };

    const render = () => {
        renderButton();
        const jobs = dailyJobs(date).map(jobLabel).join(' · ');
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <span class="daily-title">Daily Leaderboard</span>
                <button data-daily-refresh class="daily-btn"${loading ? ' disabled' : ''}>Refresh</button></div>
            <div class="daily-sub">${esc(dailyLabel(date))} (ET) · new daily in <span data-daily-countdown>${countdownText(msUntilNextDaily())}</span></div>
            <div class="daily-sub">Today's party: <span style="color:#cde;">${esc(jobs)}</span></div>
            <div class="daily-sub" title="${esc(SCORE_TIP)}" style="text-decoration:underline dotted;cursor:help;width:fit-content;">How scoring works</div>
            ${mineHtml()}
            <div class="daily-list">${listHtml()}</div>`;
        panel.querySelector('[data-daily-refresh]')?.addEventListener('click', loadBoard);
        panel.querySelector('[data-daily-submit]')?.addEventListener('click', () => {
            editing = true; submitMsg = null; render();
            panel.querySelector('[data-daily-name]')?.focus();
        });
        panel.querySelector('[data-daily-cancel]')?.addEventListener('click', () => { editing = false; submitMsg = null; render(); });
        const nameBox = panel.querySelector('[data-daily-name]');
        nameBox?.addEventListener('input', () => { nameDraft = nameBox.value; });
        nameBox?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !sending) send(); });
        panel.querySelector('[data-daily-send]')?.addEventListener('click', send);
    };

    async function send() {
        const result = loadDaily()?.result;
        if (!result) return;
        const problem = nameProblem(nameDraft);
        if (problem) { submitMsg = { ok: false, text: problem }; render(); return; }
        sending = true; submitMsg = null; render();
        try {
            const { rank, total } = await submitRun(result, nameDraft);
            editing = false;
            submitMsg = { ok: true, text: rank ? `Submitted! You're #${rank} of ${total} today.` : 'Submitted!' };
        } catch (e) {
            submitMsg = { ok: false, text: e.message };
        }
        sending = false;
        render();
        if (submitMsg.ok) loadBoard();
    }

    button.addEventListener('click', () => { if (!dailyPlayed(date)) onPlay(); });

    // The countdown ticks each minute, and when the Eastern Time day turns over everything moves to the new daily.
    const tick = () => {
        if (dailyDate() !== date) {
            date = dailyDate();
            editing = false; submitMsg = null;
            loadBoard();
            return;
        }
        const el = panel.querySelector('[data-daily-countdown]');
        if (el) el.textContent = countdownText(msUntilNextDaily());
        renderButton();
    };
    setInterval(tick, 30_000);
    // Plus a timer for the reset itself, so the button opens right at midnight.
    const atMidnight = () => setTimeout(() => { tick(); atMidnight(); }, msUntilNextDaily() + 1000);
    atMidnight();

    loadBoard();
    return function refresh() {
        if (dailyDate() !== date) { tick(); return; }
        submitMsg = null;
        render();
        loadBoard();
    };
}
