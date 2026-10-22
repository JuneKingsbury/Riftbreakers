// Resolves the 2D image for a unit: composited layers when unit.appearance is set,
// otherwise the flat job sprite. Shared by the battle view and the sidebar portraits.

export class UnitSprites {
    constructor(skinManager) {
        this.skinManager = skinManager || null;
        this._outlineCache = new Map();
    }

    /**
     * @param {object} unit
     * @param {boolean} outlined  true for the selection-glow version
     * @param {string|null} outlineColor  used for flat job sprites
     * @returns {HTMLCanvasElement|HTMLImageElement|null}
     */
    get(unit, outlined = false, outlineColor = null) {
        const sm = this.skinManager;
        if (!sm) return null;
        if (unit.appearance) {
            const a = unit.appearance;
            return sm.getCompositedColonistSprite(
                unit.id, false,
                a.race, a.armorKey, a.helmetKey,
                a.bodyVariant, a.hairVariant, a.shirtVariant,
                a.nameColor,
                a.weaponKey, a.toolKey, null,
                outlined
            );
        }
        if (unit.spriteKey) {
            if (outlined) return this._outlined(unit.spriteKey, outlineColor);
            return sm.getSprite('entities', unit.spriteKey);
        }
        return null;
    }

    _outlined(spriteKey, color) {
        const cacheKey = spriteKey + ':' + color;
        if (this._outlineCache.has(cacheKey)) return this._outlineCache.get(cacheKey);

        const sm = this.skinManager;
        const src = sm?.getSprite('entities', spriteKey);
        if (!src) return null;   // not loaded yet: retry on a later frame

        const w = src.naturalWidth || src.width;
        const h = src.naturalHeight || src.height;
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        const tmpCtx = tmp.getContext('2d');
        tmpCtx.imageSmoothingEnabled = false;
        tmpCtx.drawImage(src, 0, 0);

        const result = typeof sm._addOutline === 'function' ? sm._addOutline(tmp, color) : null;
        this._outlineCache.set(cacheKey, result);
        return result;
    }
}
