// The Save Data section of Settings: export progress to a file or code, and import it back
// (see run/save-transfer.js). Importing asks first, since it replaces current progress.
import {
    exportSave, saveFileName, saveToCode, readSaveText, describeSave, applySave,
} from '../run/save-transfer.js';
import { confirmDialog } from '../run/ui-kit.js';

/**
 * Wires up the Save Data buttons in index.html.
 * @param {() => void} onImported  Called after progress was replaced (refresh the title screen).
 */
export function wireSavePanel(onImported) {
    const $ = (id) => document.getElementById(id);
    const status = $('save-status');
    const box = $('save-code-box'), text = $('save-code-text'), loadBtn = $('save-code-load');
    if (!status) return;

    const say = (msg, ok = true) => { status.textContent = msg; status.style.color = ok ? '#8c8' : '#f88'; };
    const showBox = (code, forLoading) => {
        box.style.display = '';
        text.value = code;
        text.readOnly = !forLoading;
        text.placeholder = forLoading ? 'Paste a save code here' : '';
        loadBtn.style.display = forLoading ? '' : 'none';
        (forLoading ? text.focus() : text.select());
    };

    const importText = async (raw) => {
        const { save, error } = readSaveText(raw);
        if (error) return say(error, false);
        const ok = await confirmDialog(`Replace your current progress with this save?\n${describeSave(save)}\n`
            + 'This overwrites your current renown, unlocks and any run in progress.', { ok: 'Replace', danger: true });
        if (!ok) return say('Import cancelled. Nothing changed.');
        if (!applySave(save)) return say('Couldn\'t save on this device. Storage may be full or turned off.', false);
        box.style.display = 'none';
        say(save.runDropped ? 'Progress imported. The unreadable run was left out.' : 'Progress imported.');
        onImported?.();
    };

    $('save-export-file').addEventListener('click', () => {
        const save = exportSave();
        const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 1)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = saveFileName(save);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        say(`Saved ${a.download}.`);
    });

    $('save-copy-code').addEventListener('click', async () => {
        const code = saveToCode(exportSave());
        try {
            await navigator.clipboard.writeText(code);
            box.style.display = 'none';
            say('Save code copied. Paste it somewhere safe.');
        } catch {
            // No clipboard access (insecure page, or refused): show it to copy by hand.
            showBox(code, false);
            say('Copy the code below and keep it somewhere safe.');
        }
    });

    $('save-paste-code').addEventListener('click', () => { showBox('', true); say(''); });
    loadBtn.addEventListener('click', () => importText(text.value));

    const input = $('save-import-input');
    $('save-import-file').addEventListener('click', () => { input.value = ''; input.click(); });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 2_000_000) return say('That file is too big to be a save.', false);
        importText(await file.text());
    });
}
