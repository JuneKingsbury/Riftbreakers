// Void Sanctum: tier 2 of The Void Pact.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'void_sanctum', name: 'Void Sanctum',
    blurb: 'A structure of smooth black stone, like a solid block of the void. Its prisoners guard it viciously, paying off their debts for the rest of time.',
    look: { sky: '#120e1c', mapBg: '#1b1528', blocks: { grass: 'abyss_tile', marble: 'abyss_tile', carpet: 'cobble', dirt: 'cobble', wall: 'void_wall', stone_wall: 'void_wall', bookshelf: 'void_wall', water: 'void_water' } },
    maps: ['grand_hall', 'ruined_temple', 'crossroads'],
    bosses: ['boss_hollow_abbot', 'boss_void_arbiter'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['void_hollow', 'void_heart'],
    // Its fights were written for act 2, before it moved to a later act (see shiftLevels in run/data/encounters.js).
    writtenFor: 2,
};

export const encounters = {
    normal: [
        fight('bone_chatter', 'Bone Chatter', 2, [
            e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel', { statMods: { maxHp: -10 } }),
            e('raider', 'Prisoner', 'void_penitent'),
            e('raider', 'Prisoner', 'void_penitent'),
            e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel', { statMods: { maxHp: -10 } }),
            e('raider_archer', 'Prisoner Archer', 'void_penitent'),
            e('raider', 'Prisoner', 'void_penitent'),
        ]),
        fight('sanctum_acolytes', 'Sanctum Acolytes', 3, [
            e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
            e('void_walker', 'Void Walker'),
            e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('void_walker', 'Void Walker'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
        ]),
        fight('debt_collectors', 'Debt Collectors', 3, [
            e('battlemage', 'Collector', 'void_broker'),
            e('void_stalker', 'Enforcer', 'void_brute'),
            e('fatebinder', 'Scribe of Debts', 'void_acolyte'),
            e('void_stalker', 'Enforcer', 'void_brute'),
            e('raider_archer', 'Bailiff', 'void_penitent'),
            e('void_stalker', 'Enforcer', 'void_brute'),
        ]),
        fight('martyrs_procession', 'Martyrs\' Procession', 2, [
            e('void_martyr', 'Void Martyr', 'void_acolyte', { tint: '#d0a0f0' }),
            e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel', { statMods: { maxHp: -10 } }),
            e('void_martyr', 'Void Martyr', 'void_acolyte', { tint: '#d0a0f0' }),
            e('raider', 'Prisoner', 'void_penitent'),
            e('void_martyr', 'Void Martyr', 'void_acolyte', { tint: '#d0a0f0' }),
        ]),
    ],
    elite: [
        fight('chapel_guardians', 'Chapel Guardians', 3, [
            e('shadow_mage', 'Chapel Shade', 'shade'),
            e('void_walker', 'Void Wraith'),
            e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
            e('spectral_wisp', 'Lost Soul', 'ghost'),
            e('void_walker', 'Void Wraith'),
            e('spectral_wisp', 'Lost Soul', 'ghost'),
        ]),
        fight('crypt_wardens', 'Crypt Wardens', 4, [
            e('orc_captain', 'Crypt Warden', 'crypt_warden'),
            e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel'),
            e('sanctifier', 'Penitent Priest', 'void_acolyte'),
            e('kingdom_guard', 'Bone Sentinel', 'bone_sentinel'),
            e('void_stalker', 'Void Penitent', 'void_penitent'),
            e('shadow_mage', 'Void Acolyte', 'void_acolyte'),
        ]),
    ],
    boss: [
        fight('boss_hollow_abbot', 'The Hollow Abbot', 4, [
            e('spiritbinder', 'Hollow Abbot', 'penitent_guardian', { level: 5, statMods: { maxHp: 50, mat: 3, mdf: 3 } }),
            e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
            e('kingdom_guard', 'Fallen Knight', 'revenant_knight'),
            e('shadow_mage', 'Acolyte', 'void_acolyte'),
            e('spectral_wisp', 'Lost Soul', 'ghost'),
            e('shadow_mage', 'Acolyte', 'void_acolyte'),
        ], { scouting: 'The Hollow Abbot leads fallen knights and acolytes in a hymn no one should finish. The knights are slow. The acolytes are not.',
          phases: [
            { at: 0.5, name: 'Rite of the Hollow', say: 'The Hollow Abbot chants, and the fallen knights rise to serve again!',
              allies: { status: { status: 'regen', duration: 3 } },
              summon: [e('kingdom_guard', 'Fallen Knight', 'revenant_knight'), e('kingdom_guard', 'Fallen Knight', 'revenant_knight')] },
          ] }),
    ],
};

export const events = [
    {
        id: 'vs_contract_chest',
        title: 'Contract Lock',
        text: 'A chest whose lock is a contract. The terms seem reasonable. That is what worries you.',
        choices: [
            { label: 'Accept the terms', effect: { relic: 'uncommon', loseItem: true }, resultText: 'One of your spare items vanishes. In the chest: {relic}.' },
            { label: 'Read the fine print', effect: { xp: 45 }, resultText: 'Three hours of clauses. You walk away wiser, and 45 XP richer each.' },
        ],
    },

    {
        id: 'vs_prisoner', realms: ['void_sanctum', 'void_heart'],
        title: 'Lucid Prisoner',
        text: 'Among the chattering penitents, one still remembers their name. They beg to be taken home.',
        choices: [
            { label: 'Lead them to the gate', effect: { healPct: -0.1, relic: 'common' }, resultText: 'The way out is hard going. At the gate they press {relic} into your hands and walk on alone.' },
            { label: 'Share your rations', effect: { xp: 30 }, resultText: 'They tell you which halls to avoid. Everyone gains 30 XP.' },
        ],
    },
];
