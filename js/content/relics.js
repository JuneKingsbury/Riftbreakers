// Relics: party-wide modifiers found during a run (treasure, elites, bosses, shops and events).
// Every field is described in js/content/vocab.js (SCHEMAS.relic); in short:
//   rarity       'common' | 'uncommon' | 'rare' (rare relics come from bosses)
//   statMods     Stat bonuses for every party member in battle
//   battleStart  { status, duration } applied to every party member when a battle begins
//   xpMult, goldMult, shopDiscount, extraItemChoice   run-wide bonuses (or, negative, drawbacks)
//   passives     Support/reaction/movement skills every member has on top of their own
//   triggers     Battle triggers every member has (see tactical/triggers.js)
//   acts, realms Where it can be found (default: anywhere)
// The order is the order relics are rolled from.

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

    // Relics that change how a party plays: battle triggers (tactical/triggers.js) and
    // passives every member gains. The rare ones below them have a drawback.
    soul_lantern:     { rarity: 'common', name: 'Soul Lantern', triggers: [{ on: 'enemyDown', mp: 5, text: '+5 MP' }],
                        desc: 'Whenever an enemy is knocked out, every member regains 5 MP.' },
    martyrs_locket:   { rarity: 'uncommon', name: "Martyr's Locket", triggers: [{ on: 'allyDown', status: { status: 'haste', duration: 2 } }],
                        desc: 'When a member is knocked out, the others gain Haste for 2 turns.' },
    bloodied_banner:  { rarity: 'uncommon', name: 'Bloodied Banner', triggers: [{ on: 'hpBelow', pct: 0.5, status: { status: 'protect', duration: 3 } }],
                        desc: 'The first time each member drops below half HP in a battle, they gain Protect for 3 turns.' },
    executioners_mark: { rarity: 'uncommon', name: "Executioner's Mark", triggers: [{ on: 'kill', healPct: 0.15 }],
                        desc: 'A member who knocks out an enemy heals 15% of their max HP.' },
    beast_whistle:    { rarity: 'uncommon', name: 'Beast Whistle', passives: ['relic_summon_boost'],
                        desc: "Your summoned creatures and copies have 50% more HP, ATK and MAT." },
    hunters_perch:    { rarity: 'uncommon', name: "Hunter's Perch", passives: ['relic_high_ground'],
                        desc: 'Members deal 50% more damage from higher ground (instead of 25%), and enemies get no high-ground bonus against them.' },
    leech_fang:       { rarity: 'rare', name: 'Leech Fang', passives: ['relic_lifesteal'],
                        desc: 'Every member heals for 10% of the damage they deal.' },
    last_stand_idol:  { rarity: 'rare', name: 'Last Stand Idol',
                        triggers: [{ on: 'hpBelow', pct: 0.25, status: { status: 'haste', duration: 2 },
                                     buffs: [{ stat: 'atk', value: 4, duration: 3 }, { stat: 'mat', value: 4, duration: 3 }] }],
                        desc: 'The first time each member drops below 25% HP in a battle, they gain Haste and +4 ATK and MAT for 3 turns.' },
    glass_sigil:      { rarity: 'rare', name: 'Glass Sigil', statMods: { atk: 4, mat: 4, maxHp: -15 },
                        desc: 'Every member has +4 ATK and +4 MAT, but -15 max HP.' },
    gamblers_crown:   { rarity: 'rare', name: "Gambler's Crown", extraItemChoice: true, goldMult: 1.25, shopDiscount: -0.3,
                        desc: 'Battle rewards offer one more item and pay 25% more gold, but shop prices are 30% higher.' },

    // More boss relics: each a strong pull in one direction, most with a price.
    riftheart_shard:  { rarity: 'rare', name: 'Riftheart Shard', statMods: { spd: 1, maxHp: -8 },
                        desc: 'Every member has +1 SPD, but -8 max HP.' },
    oath_of_the_fallen: { rarity: 'rare', name: 'Oath of the Fallen', triggers: [{ on: 'allyDown', healPct: 0.2, buffs: [{ stat: 'atk', value: 3, duration: 3 }, { stat: 'mat', value: 3, duration: 3 }] }],
                        desc: 'When a member is knocked out, the others heal 20% of their max HP and gain +3 ATK and MAT for 3 turns.' },
    hunting_horn:     { rarity: 'rare', name: 'Hunting Horn', triggers: [{ on: 'kill', status: { status: 'haste', duration: 2 } }],
                        desc: 'A member who knocks out an enemy gains Haste for 2 turns.' },
    tome_of_ages:     { rarity: 'rare', name: 'Tome of Ages', xpMult: 1.5, goldMult: 0.75,
                        desc: 'The party earns 50% more XP from battles, but 25% less gold.' },
    heavy_crown:      { rarity: 'rare', name: 'Heavy Crown', statMods: { atk: 5, mat: 5 }, battleStart: { status: 'slow', duration: 2 },
                        desc: 'Every member has +5 ATK and +5 MAT, but starts each battle Slowed for 2 turns.' },
    bramble_crown:    { rarity: 'rare', name: 'Bramble Crown', passives: ['relic_thorns'], statMods: { def: 2 },
                        desc: 'Every member has +2 DEF, and anyone who strikes them in melee takes 25% of the damage back.' },
};

// The passives relics give (`passives` above): copies of support skills, so tuning a relic
// never changes the class skill it borrows from.
export const abilities = {
    relic_summon_boost: {
        extends: 'support', name: 'Beast Whistle', passiveMpCost: 0, dmgDealt: null,
        summonBoost: 0.5,
        desc: 'Your summoned creatures and copies have 50% more HP, ATK and MAT.',
    },
    relic_high_ground: {
        extends: 'support', name: "Hunter's Perch", passiveMpCost: 0, dmgDealt: null,
        highGroundMult: 1.5,
        desc: 'You deal 50% more damage from higher ground (instead of 25%), and enemies get no high-ground bonus against you.',
    },
    relic_lifesteal: {
        extends: 'support', name: 'Leech Fang', passiveMpCost: 0, dmgDealt: null,
        lifestealFrac: 0.1,
        desc: 'You heal for 10% of the damage you deal.',
    },
    relic_thorns: {
        extends: 'thorn_hide', name: 'Bramble Crown', thornsFrac: 0.25,
        desc: 'Anyone who strikes you in melee takes 25% of the damage back.',
    },
};
