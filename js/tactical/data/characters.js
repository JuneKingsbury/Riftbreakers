// Named character definitions for scenarios/battles.
// Characters reference a job and can optionally override stats or abilities.
//
// Fields:
//   job        string   Key into JOB_DATA
//   team       'player'|'enemy'
//   x, y       number   Starting tile position
//   ct         number   Starting charge-time offset (staggers initiative)
//   statMods   object   Per-stat overrides applied on top of the job's base stats
//   extraAbilities string[] Additional abilities beyond what the job provides
//   desc       string   Flavour description (optional)
//   appearance object   Optional visual description for sprite compositing:
//     race         'human'|'nymph'|'ferin'|'kobalos'|'bufos'
//     bodyVariant  number  1-based index, wraps to available count
//     hairVariant  number  1-based index, wraps to available count
//     shirtVariant number  1-based index, wraps to available count
//     nameColor    string  CSS color — tints shirt and used for selection outline
//     clothesKey   string|null  equipment_worn: sprite key
//     armorKey     string|null
//     helmetKey    string|null
//     weaponKey    string|null
//     toolKey      string|null
//   If appearance is absent the unit falls back to the job's spriteKey.

export const CHARACTER_DATA = [
    // ---- Player party ----
    {
        name: 'Aldric',
        job: 'paladin',
        team: 'player',
        x: 3, y: 8,
        ct: 40,
        xp: { novice: 120, evoker: 340, warden: 340, paladin: 80 },
        appearance: {
            race: 'human', bodyVariant: 1, hairVariant: 1, shirtVariant: 1,
            nameColor: '#4488ff',
            armorKey: 'runic_plate', helmetKey: 'iron_helmet', weaponKey: 'runic_blade', toolKey: null,
        },
    },
    {
        name: 'Lyria',
        job: 'battlemage',
        team: 'player',
        x: 2, y: 6,
        ct: 10,
        xp: { novice: 120, evoker: 340, enchanter: 340, battlemage: 40 },
        appearance: {
            race: 'human', bodyVariant: 2, hairVariant: 3, shirtVariant: 2,
            nameColor: '#cc44ff',
            armorKey: 'mana_weave_robe', helmetKey: 'runic_hood', weaponKey: 'crystal_staff', toolKey: null,
        },
    },
    {
        name: 'Ryn',
        job: 'conjurer',
        team: 'player',
        x: 3, y: 11,
        ct: 55,
        xp: { novice: 120, conjurer: 260 },
        appearance: {
            race: 'human', bodyVariant: 1, hairVariant: 2, shirtVariant: 1,
            nameColor: '#44cc66',
            armorKey: 'leather_vest', helmetKey: 'sharpshooters_visor', weaponKey: 'hunting_bow', toolKey: 'hunters_quiver',
        },
    },
    {
        name: 'Fenn',
        job: 'sanctifier',
        team: 'player',
        x: 2, y: 9,
        ct: 25,
        xp: { novice: 120, warden: 340, enchanter: 340, sanctifier: 60 },
        appearance: {
            race: 'human', bodyVariant: 2, hairVariant: 4, shirtVariant: 2,
            nameColor: '#ffcc44',
            armorKey: 'enchanted_tunic', helmetKey: 'mages_circlet', weaponKey: 'staff_of_regrowth', toolKey: null,
        },
    },

    // ---- Enemies ----
    {
        name: 'Grok',
        job: 'orc_captain',
        team: 'enemy',
        x: 18, y: 8,
        ct: 20,
        appearance: {
            race: 'human', bodyVariant: 1, hairVariant: 1, shirtVariant: 1,
            nameColor: '#cc2222',
            armorKey: 'iron_chainmail', helmetKey: 'iron_helmet', weaponKey: 'etched_axe', toolKey: null,
        },
    },
    {
        name: 'Vesper',
        job: 'shadow_mage',
        team: 'enemy',
        x: 19, y: 6,
        ct: 45,
        appearance: {
            race: 'human', bodyVariant: 2, hairVariant: 2, shirtVariant: 2,
            nameColor: '#6622aa',
            armorKey: 'cloak_of_shadows', helmetKey: 'void_crown', weaponKey: 'void_staff', toolKey: null,
        },
    },
    {
        name: 'Nix',
        job: 'goblin',
        team: 'enemy',
        x: 17, y: 4,
        ct: 60,
        appearance: {
            race: 'human', bodyVariant: 1, hairVariant: 3, shirtVariant: 1,
            nameColor: '#447722',
            armorKey: 'leather_jacket', helmetKey: null, weaponKey: 'void_dagger', toolKey: null,
        },
    },
    {
        name: 'Brix',
        job: 'goblin',
        team: 'enemy',
        x: 17, y: 12,
        ct: 5,
        appearance: {
            race: 'human', bodyVariant: 1, hairVariant: 4, shirtVariant: 1,
            nameColor: '#887722',
            armorKey: 'leather_jacket', helmetKey: null, weaponKey: 'wooden_club', toolKey: null,
        },
    },
];
