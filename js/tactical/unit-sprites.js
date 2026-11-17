// Resolves the 2D image for a unit: composited layers when unit.appearance is set,
// otherwise the flat job sprite, recolored by unit.tint when set. Shared by the battle view
// and the sidebar portraits.

export class UnitSprites {
    constructor(skinManager) {
        this.skinManager = skinManager || null;
        this._outlineCache = new Map();
        this._tintCache = new Map();
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
            if (outlined) return this._outlined(unit.spriteKey, unit.tint ?? null, outlineColor);
            return this._flat(unit.spriteKey, unit.tint ?? null);
        }
        return null;
    }

    // The job sprite, multiplied by `tint` (a CSS color) when given. Tinted copies are cached,
    // so the view's texture cache sees one stable image per sprite and tint.
    _flat(spriteKey, tint) {
        const src = this.skinManager?.getSprite('entities', spriteKey);
        if (!src || !tint) return src ?? null;
        const cacheKey = spriteKey + ':' + tint;
        if (this._tintCache.has(cacheKey)) return this._tintCache.get(cacheKey);
        const w = src.naturalWidth || src.width;
        const h = src.naturalHeight || src.height;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(src, 0, 0);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = tint;
        g.fillRect(0, 0, w, h);
        // Multiply fills the transparent pixels too: cut back to the sprite's own shape.
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(src, 0, 0);
        this._tintCache.set(cacheKey, c);
        return c;
    }

    _outlined(spriteKey, tint, color) {
        const cacheKey = spriteKey + ':' + tint + ':' + color;
        if (this._outlineCache.has(cacheKey)) return this._outlineCache.get(cacheKey);

        const sm = this.skinManager;
        const src = this._flat(spriteKey, tint);
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
