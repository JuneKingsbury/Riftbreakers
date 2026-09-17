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

export const CHARACTER_DATA = [
    // ---- Player party ----
    {
        name: 'Aldric',
        job: 'knight',
        team: 'player',
        x: 3, y: 8,
        ct: 40,
    },
    {
        name: 'Lyria',
        job: 'mage',
        team: 'player',
        x: 2, y: 6,
        ct: 10,
    },
    {
        name: 'Ryn',
        job: 'archer',
        team: 'player',
        x: 3, y: 11,
        ct: 55,
    },
    {
        name: 'Fenn',
        job: 'healer',
        team: 'player',
        x: 2, y: 9,
        ct: 25,
    },

    // ---- Enemies ----
    {
        name: 'Grok',
        job: 'orc_captain',
        team: 'enemy',
        x: 18, y: 8,
        ct: 20,
    },
    {
        name: 'Vesper',
        job: 'shadow_mage',
        team: 'enemy',
        x: 19, y: 6,
        ct: 45,
    },
    {
        name: 'Nix',
        job: 'goblin',
        team: 'enemy',
        x: 17, y: 4,
        ct: 60,
    },
    {
        name: 'Brix',
        job: 'goblin',
        team: 'enemy',
        x: 17, y: 12,
        ct: 5,
    },
];
