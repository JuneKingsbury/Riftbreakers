import { SkinManager } from '../ui/skin-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    const startScreen   = document.getElementById('start-screen');
    const settingsPanel = document.getElementById('start-settings-panel');
    const creditsPanel  = document.getElementById('credits-panel');
    const modalBackdrop = document.getElementById('modal-backdrop');

    // --- Skin manager (shared with tactical scenes) ---
    const skinManager = new SkinManager();
    window._sharedSkinManager = skinManager;

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
                skinManager.switchSkin(savedSkin);
            }
        })
        .catch(() => {});

    skinSelect?.addEventListener('change', () => {
        const val = skinSelect.value;
        localStorage.setItem('convocation_skin', val);
        skinManager.switchSkin(val);
    });

    // --- Settings persistence ---
    const SETTINGS_KEY = 'riftbreakers_settings';
    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
    }
    function saveSettings() {
        const s = {
            musicVolume: parseInt(document.getElementById('start-music-vol')?.value) || 50,
            sfxVolume:   parseInt(document.getElementById('start-sfx-vol')?.value) || 50,
            colorblindMode: document.getElementById('start-colorblind')?.value || 'none',
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
    }
    applySettings(loadSettings());

    settingsPanel?.addEventListener('change', saveSettings);
    settingsPanel?.addEventListener('input',  saveSettings);

    document.getElementById('start-reset-defaults')?.addEventListener('click', () => {
        document.getElementById('start-skin').value = 'ascii';
        document.getElementById('start-music-vol').value = 50;
        document.getElementById('start-music-vol-val').textContent = '50';
        document.getElementById('start-sfx-vol').value = 80;
        document.getElementById('start-sfx-vol-val').textContent = '80';
        document.getElementById('start-colorblind').value = 'none';
        saveSettings();
    });

    // --- Settings tab switching ---
    document.querySelectorAll('[data-start-tab-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-start-tab-btn');
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

    // --- New Game → world map ---
    const gameEl = document.createElement('div');
    gameEl.id = 'game-container';
    // position:fixed keeps it fullscreen. startWorldMap overwrites position to
    // 'relative', so we also set explicit width/height so the canvas children
    // that use width:100%/height:100% always resolve to the viewport size.
    gameEl.style.cssText = `position:fixed;inset:0;width:${window.innerWidth}px;height:${window.innerHeight}px;background:#000;z-index:100;display:none;`;
    document.body.appendChild(gameEl);
    window.addEventListener('resize', () => {
        gameEl.style.width  = window.innerWidth  + 'px';
        gameEl.style.height = window.innerHeight + 'px';
    });

    document.getElementById('demo-battle')?.addEventListener('click', () => {
        import('../tactical/demo.js').then(({ startWorldMap }) => {
            startScreen.style.display = 'none';
            gameEl.style.display = 'block';
            requestAnimationFrame(() => {
                startWorldMap(gameEl, skinManager, () => {
                    gameEl.style.display = 'none';
                    gameEl.innerHTML = '';
                    startScreen.style.display = '';
                });
            });
        });
    });
});
