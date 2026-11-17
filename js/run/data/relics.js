// Relics: party-wide modifiers found during a run.
//
// Fields (all optional except name/desc):
//   rarity       'common' | 'uncommon' | 'rare' (rare relics come from bosses)
//   statMods     Stat bonuses for every party member in battle
//   battleStart  { status, duration } applied to every party member when a battle begins
//   xpMult       Multiplies the XP the party earns from battles
//   goldMult     Multiplies gold from battles
//   shopDiscount Fraction off shop prices
//   extraItemChoice  Battle rewards offer one more item to choose from

export const RELICS = {
    iron_ration:      { rarity: 'common', name: 'Iron Ration', statMods: { maxHp: 6, def: 1 },
                        desc: 'Every member has +6 max HP and +1 DEF.' },
    whetstone:        { rarity: 'common', name: 'Whetstone', statMods: { atk: 2 },
                        desc: 'Every member has +2 ATK.' },
    focus_crystal:    { rarity: 'common', name: 'Focus Crystal', statMods: { mat: 2 },
                        desc: 'Every member has +2 MAT.' },
    stone_heart:      { rarity: 'common', name: 'Stone Heart', statMods: { maxHp: 10 },
                        desc: 'Every member has +10 max HP.' },
    mana_font:        { rarity: 'common', name: 'Mana Font', statMods: { maxMp: 10 },
                        desc: 'Every member has +10 max MP.' },
    merchants_seal:   { rarity: 'common', name: "Merchant's Seal", goldMult: 1.25,
                        desc: 'Battles give 25% more gold.' },
    lucky_coin:       { rarity: 'uncommon', name: 'Lucky Coin', shopDiscount: 0.2,
                        desc: 'Shop prices are 20% lower.' },
    scholars_tome:    { rarity: 'uncommon', name: "Scholar's Tome", xpMult: 1.25,
                        desc: 'The party earns 25% more XP from battles.' },
    featherweight:    { rarity: 'uncommon', name: 'Featherweight Charm', statMods: { eva: 5 },
                        desc: 'Every member has +5 EVA.' },
    bulwark_sigil:    { rarity: 'uncommon', name: 'Bulwark Sigil', battleStart: { status: 'protect', duration: 3 },
                        desc: 'Every member starts each battle with Protect for 3 turns.' },
    silver_veil:      { rarity: 'uncommon', name: 'Silver Veil', battleStart: { status: 'shell', duration: 3 },
                        desc: 'Every member starts each battle with Shell for 3 turns.' },
    verdant_charm:    { rarity: 'uncommon', name: 'Verdant Charm', battleStart: { status: 'regen', duration: 3 },
                        desc: 'Every member starts each battle with Regen for 3 turns.' },
    trophy_belt:      { rarity: 'uncommon', name: 'Trophy Belt', extraItemChoice: true,
                        desc: 'Battle rewards offer one more item to choose from.' },
    swift_boots:      { rarity: 'rare', name: 'Swift Boots', statMods: { move: 1 },
                        desc: 'Every member has +1 Move.' },
    war_banner:       { rarity: 'rare', name: 'War Banner', battleStart: { status: 'haste', duration: 2 },
                        desc: 'Every member starts each battle with Haste for 2 turns.' },
    phoenix_feather:  { rarity: 'rare', name: 'Phoenix Feather', battleStart: { status: 'reraise', duration: 99 },
                        desc: 'Every member starts each battle with Reraise: the first knockout leaves them at 1 HP.' },
    crown_of_insight: { rarity: 'rare', name: 'Crown of Insight', statMods: { mat: 3, mdf: 3, maxMp: 8 },
                        desc: 'Every member has +3 MAT, +3 MDF and +8 max MP.' },
    titans_belt:      { rarity: 'rare', name: "Titan's Belt", statMods: { atk: 3, def: 3, maxHp: 12 },
                        desc: 'Every member has +3 ATK, +3 DEF and +12 max HP.' },
};

// Combined statMods of a list of relic keys.
export function relicStatMods(relics) {
    const out = {};
    for (const key of relics || []) {
        for (const [k, v] of Object.entries(RELICS[key]?.statMods || {})) out[k] = (out[k] || 0) + v;
    }
    return out;
}

// Product of a numeric multiplier field across relics (e.g. 'jpMult').
export function relicMult(relics, field) {
    return (relics || []).reduce((m, key) => m * (RELICS[key]?.[field] ?? 1), 1);
}

export function relicsWith(relics, field) {
    return (relics || []).filter(key => RELICS[key]?.[field] != null);
}
