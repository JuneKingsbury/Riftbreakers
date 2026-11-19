// Elite affixes: a twist on an elite fight's leader (its first roster entry), named before it
// ("Thorned Bandit Captain") and shown before the fight. An elite fight rolls one affix in
// Acts 1 and 2 and two in Acts 3 and 4, never the same one twice. Bosses get none.
// Every field is described in js/content/vocab.js (SCHEMAS.affix); in short:
//   statMods      stat changes for the leader;  maxHpPct  max HP raised by this fraction
//   battleStart   [{ status, duration }] the leader starts the battle with
//   passives      reaction/support/movement abilities on top of its own
//   extraAbilities  actions on top of its own
//   acts          acts it can appear in (default: all)
// The order is the order affixes are rolled from: add new ones at the end.
//
// The passives below are affix-only copies of class skills (`extends`), so tuning an affix
// never changes the class skill it borrows from, and the other way round.

export const AFFIXES = {
    thorned:      { name: 'Thorned', passives: ['affix_thorns'],
                    desc: 'Whoever hits it in melee takes back 30% of the damage they dealt.' },
    shielded:     { name: 'Shielded', battleStart: [{ status: 'protect', duration: 99 }, { status: 'shell', duration: 99 }],
                    desc: 'Has Protect and Shell all battle (takes 25% less damage) until they are removed.' },
    hasted:       { name: 'Hasted', statMods: { spd: 2 }, battleStart: [{ status: 'haste', duration: 3 }],
                    desc: '+2 SPD, and starts the battle with Haste for 3 turns.' },
    vampiric:     { name: 'Vampiric', passives: ['affix_lifesteal'],
                    desc: 'Heals for 35% of the damage it deals.' },
    regenerating: { name: 'Regenerating', battleStart: [{ status: 'regen', duration: 99 }],
                    desc: 'Regenerates about 8% of its max HP every turn, until cured.' },
    commanding:   { name: 'Commanding', passives: ['affix_command'],
                    desc: 'At the start of each of its turns, it and adjacent allies gain ATK and DEF +3 for 2 turns.' },
    undying:      { name: 'Undying', passives: ['affix_undying'], acts: [2, 3, 4],
                    desc: 'Once per battle, a killing blow leaves it at 1 HP.' },
    warded:       { name: 'Warded', passives: ['affix_warded'],
                    desc: 'Immune to Stun, Sleep, Charm, Slow, Silence and Poison.' },
    hulking:      { name: 'Hulking', maxHpPct: 0.4, statMods: { def: 2, spd: -1 },
                    desc: '+40% max HP and +2 DEF, but -1 SPD.' },
    splitting:    { name: 'Splitting', passives: ['affix_split'], acts: [2, 3, 4],
                    desc: 'When knocked out, it breaks into two weaker copies of itself (35% of its max HP, 70% of its power) that fight on.' },
};

export const abilities = {
    affix_thorns: {
        extends: 'thorn_hide', name: 'Thorned',
        desc: 'Whoever hits it in melee takes back 30% of the damage they dealt.',
    },
    affix_lifesteal: {
        extends: 'support', name: 'Vampiric', passiveMpCost: 0, dmgDealt: null,
        lifestealFrac: 0.35,
        desc: 'Heals for 35% of the damage it deals.',
    },
    affix_command: {
        extends: 'iron_discipline', name: 'Commanding',
        turnAlliesBuff: [{ stat: 'atk', value: 3, duration: 2 }, { stat: 'def', value: 3, duration: 2 }],
        desc: 'At the start of each of its turns, it and adjacent allies gain ATK and DEF +3 for 2 turns.',
    },
    affix_undying: {
        extends: 'providence', name: 'Undying',
        desc: 'Once per battle, a killing blow leaves it at 1 HP.',
    },
    affix_split: {
        extends: 'brace', name: 'Splitting', trigger: 'onDown', chance: 1, oncePerBattle: true, selfStatus: null,
        splitInto: { count: 2, hpFrac: 0.35, statFrac: 0.7 },
        desc: 'When knocked out, it breaks into two weaker copies of itself that fight on.',
    },
    affix_warded: {
        extends: 'iron_will', name: 'Warded',
        statusImmune: ['stun', 'sleep', 'charm', 'slow', 'silence', 'poison'],
        desc: 'Immune to Stun, Sleep, Charm, Slow, Silence and Poison.',
    },
};
