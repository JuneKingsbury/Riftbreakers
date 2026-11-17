import { SkinManager } from '../ui/skin-manager.js';
import { watchLayout } from '../ui/layout.js';
import { Sound } from '../audio/sound.js';
import { TITLE_MUSIC } from '../audio/game-sounds.js';
import { wireSavePanel } from '../ui/save-panel.js';
import { mountStartBackdrop } from '../ui/start-backdrop.js';
import { renderSkillPlanEditor } from '../ui/skill-plan-panel.js';
import { runSplash } from '../ui/splash.js';

document.addEventListener('DOMContentLoaded', () => {
    watchLayout();
    const startScreen   = document.getElementById('start-screen');
    const settingsPanel = document.getElementById('start-settings-panel');
    const creditsPanel  = document.getElementById('credits-panel');
    const modalBackdrop = document.getElementById('modal-backdrop');
    runSplash(startScreen);

    // --- Skin manager (shared with tactical scenes) ---
    const skinManager = new SkinManager();
    window._sharedSkinManager = skinManager;
    const redrawBackdrop = mountStartBackdrop(document.getElementById('start-bg-canvas'), skinManager);

    // Load skin preference and populate selector
    const savedSkin = localStorage.getItem('convocation_skin') || '16x16_tiny_world';
    const skinSelect = document.getElementById('start-skin');
    fetch('skins/index.json')
        .then(r => r.json())
        .then(index => {
            const skins = index.skins || index;
            for (const s of skins) {
                const opt = document.createElement('option');
                opt.value = s.id || s;
                opt.textContent = s.name || s;
                if (opt.value === savedSkin) opt.selected = true;
                skinSelect.appendChild(opt);
            }
            if (savedSkin !== 'ascii') {
                skinManager.switchSkin(savedSkin).then(redrawBackdrop);
            }
        })
        .catch(() => {});

    skinSelect?.addEventListener('change', () => {
        const val = skinSelect.value;
        localStorage.setItem('convocation_skin', val);
        skinManager.switchSkin(val).then(redrawBackdrop);
    });

    // --- Settings persistence ---
    const SETTINGS_KEY = 'riftbreakers_settings';
    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
    }
    // A slider at 0 must stay at 0 (|| would turn it back into the default).
    const sliderValue = (id, fallback) => {
        const n = parseInt(document.getElementById(id)?.value, 10);
        return Number.isFinite(n) ? n : fallback;
    };
    function saveSettings() {
        const s = {
            musicVolume: sliderValue('start-music-vol', 50),
            sfxVolume:   sliderValue('start-sfx-vol', 80),
            colorblindMode: document.getElementById('start-colorblind')?.value || 'none',
            tacticsLog: !!document.getElementById('start-tactics-log')?.checked,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    function applySettings(s) {
        if (s.musicVolume != null) {
            const el = document.getElementById('start-music-vol');
            if (el) { el.value = s.musicVolume; document.getElementById('start-music-vol-val').textContent = s.musicVolume; }
        }
        if (s.sfxVolume != null) {
            const el = document.getElementById('start-sfx-vol');
            if (el) { el.value = s.sfxVolume; document.getElementById('start-sfx-vol-val').textContent = s.sfxVolume; }
        }
        if (s.colorblindMode && s.colorblindMode !== 'none') {
            document.getElementById('start-colorblind').value = s.colorblindMode;
        }
        const tacticsLog = document.getElementById('start-tactics-log');
        if (tacticsLog) tacticsLog.checked = s.tacticsLog === true;
    }
    // The volume sliders drive the sound buses directly, so a change is heard at once.
    function applyVolumes() {
        Sound.setMusicVolume(sliderValue('start-music-vol', 50));
        Sound.setSfxVolume(sliderValue('start-sfx-vol', 80));
    }
    applySettings(loadSettings());
    applyVolumes();

    settingsPanel?.addEventListener('change', () => { saveSettings(); applyVolumes(); });
    settingsPanel?.addEventListener('input',  () => { saveSettings(); applyVolumes(); });

    // --- Sound ---
    // Browsers only start audio after the player interacts with the page.
    const unlockAudio = () => Sound.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
        document.addEventListener(type, unlockAudio, { capture: true, passive: true });
    }
    // Every enabled button clicks. Screens add their own sound for what the click did.
    document.addEventListener('click', (e) => {
        const button = e.target.closest?.('button');
        if (button && !button.disabled) Sound.playSfx('click');
    }, true);
    Sound.playMusic(TITLE_MUSIC);

    document.getElementById('start-reset-defaults')?.addEventListener('click', () => {
        document.getElementById('start-skin').value = 'ascii';
        document.getElementById('start-music-vol').value = 50;
        document.getElementById('start-music-vol-val').textContent = '50';
        document.getElementById('start-sfx-vol').value = 80;
        document.getElementById('start-sfx-vol-val').textContent = '80';
        document.getElementById('start-colorblind').value = 'none';
        document.getElementById('start-tactics-log').checked = false;
        saveSettings();
        applyVolumes();
    });

    // --- Settings tab switching ---
    document.querySelectorAll('[data-start-tab-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-start-tab-btn');
            // Rendered on opening, so plans changed during a run show up.
            if (tab === 'skillplans') renderSkillPlanEditor(document.getElementById('skill-plan-editor'));
            document.querySelectorAll('[data-start-tab-btn]').forEach(b => {
                b.style.background = b === btn ? '#2a2a4e' : '#16162a';
                b.style.color      = b === btn ? '#ffcc00' : '#999';
                b.classList.toggle('active', b === btn);
            });
            document.querySelectorAll('[data-start-tab]').forEach(section => {
                section.style.display = section.getAttribute('data-start-tab') === tab ? '' : 'none';
            });
        });
    });

    // --- Modal open/close ---
    function closeModals() {
        [settingsPanel, creditsPanel].forEach(p => p && (p.style.display = 'none'));
        if (modalBackdrop) modalBackdrop.style.display = 'none';
    }
    function openModal(panel) {
        if (panel) panel.style.display = 'block';
        if (modalBackdrop) modalBackdrop.style.display = 'block';
    }
    document.getElementById('start-settings')?.addEventListener('click', () => openModal(settingsPanel));
    document.getElementById('start-credits')?.addEventListener('click',  () => openModal(creditsPanel));
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    modalBackdrop?.addEventListener('click', closeModals);

    // --- Dev tools ---
    document.getElementById('start-skin-editor')?.addEventListener('click', () => {
        import('../editor/skin-editor.js').then(({ launchSkinEditor }) => {
            launchSkinEditor();
        });
    });
    document.getElementById('start-map-editor')?.addEventListener('click', () => {
        closeModals();
        import('../editor/map-editor.js').then(({ launchMapEditor }) => {
            launchMapEditor(skinManager);
        });
    });

    // --- Runs ---
    const gameEl = document.createElement('div');
    gameEl.id = 'game-container';
    // position:fixed keeps it fullscreen. Starting a run overwrites position to
    // 'relative', so we also set explicit width/height so the canvas children
    // that use width:100%/height:100% always resolve to the viewport size.
    gameEl.style.cssText = `position:fixed;inset:0;width:${window.innerWidth}px;height:${window.innerHeight}px;background:#000;z-index:100;display:none;`;
    document.body.appendChild(gameEl);
    window.addEventListener('resize', () => {
        gameEl.style.width  = window.innerWidth  + 'px';
        gameEl.style.height = window.innerHeight + 'px';
    });

    const continueBtn = document.getElementById('continue-run');
    const showGame = () => {
        startScreen.style.display = 'none';
        gameEl.style.display = 'block';
    };
    const backToTitle = () => {
        gameEl.style.display = 'none';
        gameEl.innerHTML = '';
        startScreen.style.display = '';
        redrawBackdrop();   // a resize while hidden drew at zero size
        refreshContinue();
        Sound.playMusic(TITLE_MUSIC);
    };
    const refreshContinue = () => {
        import('../run/start.js').then(({ hasSavedRun }) => { continueBtn.disabled = !hasSavedRun(); });
    };
    refreshContinue();
    // Importing a save can add or remove a run in progress, so Continue follows it.
    wireSavePanel(refreshContinue);

    document.getElementById('new-run')?.addEventListener('click', () => {
        import('../run/start.js').then(({ newRun }) => {
            newRun(gameEl, skinManager, { onStart: showGame, onExit: backToTitle });
        });
    });
    continueBtn?.addEventListener('click', () => {
        import('../run/start.js').then(({ continueRun }) => {
            showGame();
            requestAnimationFrame(() => {
                if (!continueRun(gameEl, skinManager, backToTitle)) backToTitle();
            });
        });
    });
    document.getElementById('start-unlocks')?.addEventListener('click', () => {
        import('../run/start.js').then(({ showUnlocks }) => showUnlocks());
    });
});
