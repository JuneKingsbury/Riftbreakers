// Palace Fortress: tier 3 of The Kingdom.
//
// `realm` is the realm itself, `encounters` its fights by kind, and `events` the '?' events
// only met here. Which acts it appears in is set in realms/index.js. Format: js/content/README.md.
import { fight, e } from './helpers.js';

export const realm = {
    id: 'palace_fortress', name: 'Palace Fortress',
    blurb: 'A grand fortress within the castle walls, filled with wards and traps disguised as miracles. White-robed priests and the king\'s own guard patrol its halls.',
    look: { sky: '#2a2420', mapBg: '#302922', blocks: { grass: [['marble', 3], ['carpet', 1]], dirt: 'brick', wall: 'kingdom_wall', stone_wall: 'kingdom_wall' } },
    maps: ['grand_hall', 'ruined_temple', 'crossroads'],
    bosses: ['boss_high_king', 'boss_high_priest'],
    // Realms whose fights and events this realm also fields, retuned for its act. Keep the
    // order: seeded runs pick fights from the combined list by position.
    draws: ['kingdom_outskirts', 'crusader_barracks'],
};

export const encounters = {
    normal: [
        fight('citadel_patrol', 'Citadel Patrol', 5, [
            e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
            e('raider_archer', 'Palace Archer', 'crusader_archer'),
            e('paladin', 'Palace Paladin', 'knight'),
            e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
            e('runebow', 'Palace Runebow', 'crusader_archer'),
            e('evoker', 'Royal Mage', 'royal_mage'),
        ]),
        fight('white_robes', 'White Robes', 5, [
            e('sanctifier', 'High Priest', 'high_priest'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('lifeseer', 'Miracle Worker', 'high_priest'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('evoker', 'Ward Mage', 'royal_mage'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
        ]),
        fight('etched_guard', 'The Etched Guard', 4, [
            e('orc_captain', 'Palace Champion', 'palace_champion'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('raider_archer', 'Royal Crossbow', 'crusader_archer'),
            e('kingdom_guard', 'Palace Husk', 'palace_husk'),
            e('raider_archer', 'Royal Crossbow', 'crusader_archer'),
        ]),
        fight('shield_line', 'Shield Line', 5, [
            e('palace_shieldbearer', 'Shieldbearer', 'kingdom_guard', { tint: '#e0e0ff' }),
            e('raider_archer', 'Palace Archer', 'crusader_archer'),
            e('palace_shieldbearer', 'Shieldbearer', 'kingdom_guard', { tint: '#e0e0ff' }),
            e('runebow', 'Palace Runebow', 'crusader_archer'),
            e('kingdom_guard', 'Palace Guard', 'kingdom_guard'),
        ]),
    ],
    elite: [
        fight('royal_inquisitors', 'Royal Inquisitors', 6, [
            e('sanctifier', 'Inquisitor', 'high_priest'),
            e('paladin', 'Templar', 'crusader'),
            e('battlemage', 'Witch Hunter', 'royal_mage'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('fatebinder', 'Confessor', 'high_priest'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
        ]),
        fight('palace_champions', 'Palace Champions', 6, [
            e('paladin', 'Palace Champion', 'palace_champion'),
            e('orc_captain', 'Palace Champion', 'palace_champion'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
            e('lifeseer', 'Royal Physician', 'high_priest'),
            e('kingdom_guard', 'Royal Guard', 'knight'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
        ]),
    ],
    boss: [
        fight('boss_high_king', 'The High King', 6, [
            e('battlemage', 'The High King', 'boss_high_king', { level: 8, statMods: { maxHp: 85, atk: 5, def: 5, mat: 3, mdf: 4 } }),
            e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard'),
            e('sanctifier', 'High Priest', 'high_priest'),
            e('paladin', 'Palace Champion', 'palace_champion'),
            e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard'),
            e('runebow', 'Royal Marksman', 'crusader_archer'),
        ], { scouting: 'The High King keeps his best around him: a priest to heal, a champion to hold, a marksman on the walls. Take the priest first.',
          phases: [
            { at: 0.5, name: 'To the King!', say: 'Guards! To your king! The palace guard rushes in, and the court rallies.',
              allies: { buffs: [{ stat: 'atk', value: 3, duration: 3 }, { stat: 'def', value: 3, duration: 3 }] },
              summon: [e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard'), e('kingdom_guard', 'King\'s Guard', 'boss_high_king_guard')] },
          ] }),
        fight('boss_high_priest', 'The High Priest', 6, [
            e('sanctifier', 'The High Priest', 'high_priest', { level: 8, statMods: { maxHp: 80, mat: 5, mdf: 5, def: 3 } }),
            e('paladin', 'Palace Champion', 'palace_champion'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('lifeseer', 'Miracle Worker', 'royal_mage'),
            e('kingdom_guard', 'Temple Guard', 'crusader'),
            e('evoker', 'Ward Mage', 'royal_mage'),
        ], { scouting: 'The High Priest works miracles for the Crusade. Its healers undo your damage unless you strike them down fast.',
          phases: [
            { at: 0.5, name: 'Blessing', say: 'The High Priest calls down a blessing. Light washes over its faithful.',
              cleanse: true, allies: { healPct: 0.25, status: { status: 'regen', duration: 3 } } },
            { at: 0.25, name: 'Last Defense', say: 'Temple guards run to shield the High Priest!',
              summon: [e('kingdom_guard', 'Temple Guard', 'crusader')], status: { status: 'protect', duration: 3 } },
          ] }),
    ],
};

export const events = [
    {
        id: 'pf_confiscated_vault',
        title: 'Vault of Confiscated Magic',
        text: 'Behind a gilded door, the kingdom keeps the magic it fears. A ward flares as you approach.',
        choices: [
            { label: 'Break in', outcomes: [
                { weight: 2, effect: { relic: 'rare' }, resultText: 'Among the forbidden tomes: {relic}.' },
                { weight: 1, effect: { healPct: -0.25 }, resultText: 'The royal ward lashes arcane fire at everyone.' },
            ] },
            { label: 'Read the warding', effect: { xp: 60 }, resultText: 'So this is how the priests work their miracles. Everyone gains 60 XP.' },
        ],
    },

    {
        id: 'pf_war_gallery',
        title: 'War Gallery',
        text: 'Display cases of legendary weaponry line a hall of tapestries showing historic battles.',
        choices: [
            { label: 'Smash a case', outcomes: [
                { weight: 1, effect: { item: 'rare' }, resultText: 'You take {item} before the guards arrive.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The king\'s guard was closer than you thought.' },
            ] },
            { label: 'Study the tapestries', effect: { xp: 45 }, resultText: 'Every battle the High King has fought, woven in thread. 45 XP for every member.' },
        ],
    },
];
