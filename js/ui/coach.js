// First-time tips: a small card that explains a screen the first time a player reaches it,
// then never again. Seen tips are kept in the settings (riftbreakers_settings.tipsSeen), so
// they survive between runs; Settings > Reset tips shows them again.
import { loadGameSettings, setGameSetting } from '../run/game-settings.js';
import { FONT, esc } from '../run/ui-kit.js';

export const COACH_TIPS = {
    map: ['The act map', 'Choose a glowing spot to travel there. Battles give XP and items, elites drop relics, and the boss waits at the top. Press H whenever you want the How to Play guide.'],
    briefing: ['Hands off', 'Your party fights on its own, with each member following their tactics. What you control is everything before the fight: skills, gear and where everyone stands. Win, and everyone heals back to full.'],
    deploy: ['Deploy your party', 'Pick a member, then a highlighted tile to move them there. Fragile members are safer at the back. Start the battle whenever you\'re ready.'],
    battle: ['Watching the battle', 'Press Space to pause, or 1, 2 and 3 to change the speed. Click any unit to check its stats, and hover over a status to see what it does.'],
    reward: ['Spoils', 'Pick one item to keep. Hover over each one to see how it compares with what your party has on.'],
};

// Added to the reward tip only when someone spends skill points by hand: with build focus or
// an auto skill plan (the default), points are spent for them and nothing glows.
export const MANUAL_SP_TIP = 'Anyone with skill points to spend glows green. Head to the Party menu (P) to use them.';

let card = null;

/** Whether a tip has been shown before. */
export function tipSeen(key) {
    return !!loadGameSettings().tipsSeen?.[key];
}

/** Forgets every seen tip, so each shows again. */
export function resetTips() {
    setGameSetting('tipsSeen', {});
}

/**
 * Shows tip `key` (a COACH_TIPS key) once ever. Returns whether it was shown.
 * opts.top: at the top of the screen (over a panel whose buttons are at the bottom).
 * opts.more: a sentence added to the tip's text.
 */
export function coachTip(key, { top = false, more = '' } = {}) {
    const tip = COACH_TIPS[key];
    if (!tip || tipSeen(key) || typeof document === 'undefined') return false;
    setGameSetting('tipsSeen', { ...loadGameSettings().tipsSeen, [key]: true });
    card?.remove();
    card = document.createElement('div');
    card.setAttribute('role', 'status');
    const edge = top ? 'top:calc(12px + env(safe-area-inset-top))' : 'bottom:calc(16px + env(safe-area-inset-bottom))';
    card.style.cssText = `position:fixed;left:50%;${edge};transform:translateX(-50%);
        z-index:1800;max-width:min(420px,92vw);background:rgba(10,10,30,0.97);border:1px solid #fc8;border-radius:6px;
        padding:10px 14px;font-family:${FONT};font-size:12px;color:#ccd;line-height:1.5;box-shadow:0 4px 18px rgba(0,0,0,0.7);`;
    card.innerHTML = `<div style="color:#fc8;font-weight:bold;margin-bottom:3px;">${esc(tip[0])}</div>
        <div>${esc(more ? `${tip[1]} ${more}` : tip[1])}</div>
        <div style="text-align:right;margin-top:6px;"><button data-coach-ok style="background:#1e1e3a;border:1px solid #664;color:#fc8;font-family:inherit;font-size:11px;padding:3px 12px;border-radius:3px;cursor:pointer;">Got it</button></div>`;
    const el = card;
    el.querySelector('[data-coach-ok]').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    return true;
}

/** Removes the tip on screen, if any (e.g. when the screen it explains closes). */
export function hideCoachTip() {
    card?.remove();
    card = null;
}
