// Equipment: the item table and the rules around it (enchanting, prices, what a character's
// gear adds up to). The items themselves are in js/content/items/, one file per slot, with
// every field described in js/content/vocab.js (SCHEMAS.item).
import { ITEM_FILES } from '../../content/items/index.js';
import { ITEM_STATS, EQUIP_FIELDS } from '../../content/vocab.js';

export { EQUIP_FIELDS };

// Item key → item, every slot's file in turn.
export const EQUIPMENT = {};
for (const [file, items] of Object.entries(ITEM_FILES)) {
    for (const [key, item] of Object.entries(items)) {
        if (Object.hasOwn(EQUIPMENT, key)) throw new Error(`content: item '${key}' is defined twice (items/${file}.js)`);
        EQUIPMENT[key] = item;
    }
}

// Stat fields that equipment can modify (content/vocab.js).
export const EQUIP_STAT_KEYS = ITEM_STATS;

// ---- Enchanting ----
// An item can be enchanted up to MAX_ENCHANT times (at rest sites, and very rarely an item is
// found already enchanted). Like ability ranks, an enchanted item is its own key, the base key
// plus '+N' (iron_sword+1), so inventories, equipping, saving and battle need nothing new.
// The variants are registered on EQUIPMENT as non-enumerable entries: EQUIPMENT['x+1'] works,
// but loops over EQUIPMENT (loot and shop pools, editors) only see base items.
export const MAX_ENCHANT = 2;
// Each level adds 20% of each of these stats the item has (at least 1). Speed, movement and
// evasion are left alone, so enchanting can't break movement or dodge balance.
const ENCHANT_STATS = ['atk', 'def', 'mat', 'mdf', 'maxHp', 'maxMp'];
const ENCHANT_FRAC = 0.2;
const ENCHANT_FALLBACK_HP = 4;   // per level, for an item with none of ENCHANT_STATS

export function enchantLevel(key) {
    const m = /\+(\d)$/.exec(String(key));
    return m ? Number(m[1]) : 0;
}

export function baseItemKey(key) {
    return typeof key === 'string' ? key.replace(/\+\d$/, '') : key;
}

export function enchantedKey(key, level) {
    const base = baseItemKey(key);
    return level > 0 ? `${base}+${level}` : base;
}

// Can this item be enchanted once more?
export function canEnchant(key) {
    return !!EQUIPMENT[key] && enchantLevel(key) < MAX_ENCHANT;
}

function enchantedEntry(item, level) {
    const out = { ...item, name: `${item.name} +${level}`, enchant: level };
    const boosted = ENCHANT_STATS.filter(s => item[s] > 0);
    for (const s of boosted) out[s] = item[s] + level * Math.max(1, Math.round(item[s] * ENCHANT_FRAC));
    if (!boosted.length) out.maxHp = (item.maxHp || 0) + level * ENCHANT_FALLBACK_HP;
    return out;
}

for (const [key, item] of Object.entries(EQUIPMENT)) {
    for (let lv = 1; lv <= MAX_ENCHANT; lv++) {
        Object.defineProperty(EQUIPMENT, enchantedKey(key, lv), { value: enchantedEntry(item, lv), enumerable: false });
    }
}

// Returns the combined stat bonuses from all equipped items on a member's appearance.
export function equipmentStatBonuses(appearance) {
    const bonuses = {};
    if (!appearance) return bonuses;
    for (const key of equippedItems(appearance)) {
        const item = EQUIPMENT[key];
        for (const stat of EQUIP_STAT_KEYS) {
            if (item[stat]) bonuses[stat] = (bonuses[stat] || 0) + item[stat];
        }
    }
    return bonuses;
}


// Keys of the items equipped on an appearance, in slot order.
export function equippedItems(appearance) {
    if (!appearance) return [];
    return EQUIP_FIELDS.map(f => appearance[f]).filter(k => k && EQUIPMENT[k]);
}

// Abilities granted by everything equipped: { actions: [...], passives: [...] }.
export function equipmentGrants(appearance) {
    const actions = [], passives = [];
    for (const key of equippedItems(appearance)) {
        for (const a of EQUIPMENT[key].grants || []) if (!actions.includes(a)) actions.push(a);
        for (const a of EQUIPMENT[key].grantsPassive || []) if (!passives.includes(a)) passives.push(a);
    }
    return { actions, passives };
}

export function itemRarity(key) {
    return EQUIPMENT[key]?.rarity ?? 'common';
}

// Shop price: by rarity, plus a premium for items that grant an ability, scaled up by enchants.
export function itemPrice(key) {
    const item = EQUIPMENT[key];
    if (!item) return 0;
    const base = { common: 60, uncommon: 120, rare: 220 }[itemRarity(key)];
    // Each enchant level adds half the price again.
    return Math.round((base + ((item.grants || item.grantsPassive) ? 40 : 0)) * (1 + 0.5 * enchantLevel(key)));
}

// Display name for an item key, e.g. 'scholars_spectacles' → "Scholar's Spectacles".
export function itemName(key) {
    return EQUIPMENT[key]?.name ?? String(key).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
