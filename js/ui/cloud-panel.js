// The Cloud Save part of Settings > Save Data: connect Google Drive, sync, disconnect. Once
// connected, progress uploads by itself after each save (run/cloud-sync.js), and the game syncs
// when it starts, asking first if this device and the cloud both have new progress.
import { gdrive } from '../core/gdrive.js';
import { createCloudSync } from '../run/cloud-sync.js';

const timeText = (d) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Wires up the Cloud Save buttons in index.html and starts syncing.
 * @param {() => void} onReplaced  Called after a download replaced progress (refresh the title screen).
 */
export function wireCloudPanel(onReplaced) {
    const $ = (id) => document.getElementById(id);
    const status = $('cloud-status'), connectBtn = $('cloud-connect'), syncBtn = $('cloud-sync'), offBtn = $('cloud-disconnect');
    if (!status) return;

    let lastSync = null, busy = false;
    const say = (msg, color = '#999') => { status.textContent = msg; status.style.color = color; };

    const resolveConflict = async ({ local, cloud }) => {
        const useCloud = window.confirm('Your Google Drive save and this device both have new progress.\n\n'
            + `Google Drive: ${cloud}\n\nThis device: ${local}\n\n`
            + 'Press OK to load the Google Drive save here (this device\'s progress is replaced).\n'
            + 'Press Cancel to keep this device\'s progress (it replaces the Google Drive save).');
        return useCloud ? 'cloud' : 'local';
    };
    const sync = createCloudSync({
        drive: gdrive,
        resolveConflict,
        onStatus: (s) => {
            if (s.kind === 'uploaded' || s.kind === 'downloaded') { lastSync = new Date(); render(); }
            if (s.kind === 'error') say(`Cloud save problem: ${s.message}`, '#f88');
        },
    });
    sync.start();

    function render() {
        const on = gdrive.isConnected();
        connectBtn.style.display = on ? 'none' : '';
        syncBtn.style.display = on ? '' : 'none';
        offBtn.style.display = on ? '' : 'none';
        for (const b of [connectBtn, syncBtn, offBtn]) b.disabled = busy;
        if (!on) say('Not connected. Progress is only on this device.');
        else say(lastSync ? `Connected. Last synced at ${timeText(lastSync)}.` : 'Connected.', '#8c8');
    }

    async function runSync(manual) {
        busy = true;
        render();
        if (manual) say('Syncing…', '#cde');
        try {
            const result = await sync.sync();
            busy = false;
            if (result === 'downloaded') onReplaced?.();
            if (result === 'up-to-date') lastSync = lastSync ?? new Date();
            render();
            if (result === 'downloaded') say('Loaded your progress from Google Drive.', '#8c8');
            else if (result === 'undecided') { /* onStatus explained it */ }
        } catch (e) {
            busy = false;
            render();
            say(`Couldn't sync with Google Drive: ${e.message}`, '#f88');
        }
    }

    connectBtn.addEventListener('click', async () => {
        if (!window.isSecureContext) return say('Google sign-in needs the game to be opened over https.', '#f88');
        busy = true;
        render();
        say('Waiting for Google sign-in…', '#cde');
        try {
            await gdrive.connect();
        } catch (e) {
            busy = false;
            render();
            return say(e.message, '#f88');
        }
        busy = false;
        await runSync(true);
    });
    syncBtn.addEventListener('click', () => runSync(true));
    offBtn.addEventListener('click', async () => {
        if (!window.confirm('Disconnect Google Drive?\n\nYour progress stays on this device, and your cloud save stays in Google Drive. Progress made from now on won\'t be uploaded.')) return;
        busy = true;
        render();
        await sync.flush();   // upload anything not yet sent first
        await gdrive.disconnect();
        sync.forget();
        busy = false;
        lastSync = null;
        render();
        say('Disconnected. Your cloud save is still in Google Drive.');
    });

    render();
    if (gdrive.isConnected()) runSync(false);
}
