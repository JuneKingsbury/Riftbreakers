import { SceneManager } from './scene-manager.js';
import { WorldMapScene } from './world-map-scene.js';

export function startWorldMap(containerEl, skinManager, onExit) {
    containerEl.innerHTML = '';
    containerEl.style.position = 'relative';
    const sm = new SceneManager(containerEl, skinManager, onExit);
    sm.push(new WorldMapScene());
    return () => {
        // Force immediate teardown if the caller needs it
        sm._stop();
        sm.current?.exit();
        if (onExit) onExit();
    };
}
