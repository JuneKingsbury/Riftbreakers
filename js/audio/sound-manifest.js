// Every sound the game can play, by name. A missing file is skipped quietly, so a name can be
// wired up before its .ogg exists (see audio/README.md).
//
// sfx:   name -> { file, gain?, pitch? }
//          gain   Volume of this sound relative to the SFX slider (default 1). Every sfx file
//                 is normalized to −28 LUFS (see audio/README.md), so gain is purely a mix
//                 choice: 1 plays at −28, 0.5 is 6 dB quieter. The loudest file peaks at
//                 −10.8 dBTP, so keep gain at or below 3 to stay clear of clipping.
//          pitch  Random pitch spread in cents, ± (default 300, as in Rifthold: up to three
//                 semitones either way, so a sound heard over and over never quite repeats)
// music: name -> file. Every track loops; changing track crossfades.

export const SOUND_MANIFEST = {
    sfx: {
        // Combat
        hit_party:      { file: 'audio/sfx/combat/colonist_damaged.ogg' },
        hit_enemy:      { file: 'audio/sfx/work/chop_hit.ogg', gain: 0.55 },
        miss:           { file: 'audio/sfx/combat/shield_block.ogg' },
        party_down:     { file: 'audio/sfx/combat/colonist_death.ogg' },
        enemy_down:     { file: 'audio/sfx/combat/enemy_death.ogg', gain: 0.8 },
        arrow_fire:     { file: 'audio/sfx/combat/arrow_fire.ogg', gain: 0.7 },
        battle_alert:   { file: 'audio/sfx/ui/wave_alert.ogg', gain: 0.7, pitch: 0 },
        rift_travel:    { file: 'audio/sfx/spells/spell_teleport.ogg', gain: 0.9, pitch: 0 },   // the portal between acts

        // Spells
        spell_cast:     { file: 'audio/sfx/spells/spell_cast.ogg', gain: 0.7 },
        spell_heal:     { file: 'audio/sfx/spells/spell_heal.ogg', gain: 0.8 },
        spell_buff:     { file: 'audio/sfx/spells/spell_buff.ogg', gain: 0.7 },
        spell_shield:   { file: 'audio/sfx/spells/spell_shield.ogg', gain: 0.8 },
        spell_affliction: { file: 'audio/sfx/ui/mental_break.ogg', gain: 0.6 },
        spell_revive:   { file: 'audio/sfx/spells/magic_levelup.ogg', gain: 0.9, pitch: 100 },
        summon:         { file: 'audio/sfx/spells/summon_arrival.ogg', gain: 0.8 },
        terraform:      { file: 'audio/sfx/spells/spell_terraform.ogg', gain: 0.7 },
        thunder:        { file: 'audio/sfx/environment/thunder_crack.ogg', gain: 0.6 },

        // Run
        level_up:       { file: 'audio/sfx/spells/magic_levelup.ogg', pitch: 100 },
        skill_learned:  { file: 'audio/sfx/spells/magic_levelup.ogg', gain: 0.7, pitch: 100 },
        promote:        { file: 'audio/sfx/spells/spell_divination.ogg', pitch: 100 },
        loot:           { file: 'audio/sfx/combat/loot_drop.ogg' },
        equip:          { file: 'audio/sfx/work/craft_complete.ogg', gain: 0.8, pitch: 150 },
        rest:           { file: 'audio/sfx/spells/spell_heal.ogg', gain: 0.8, pitch: 150 },
        travel:         { file: 'audio/sfx/environment/footstep.ogg', gain: 0.5 },
        event:          { file: 'audio/sfx/ui/notification.ogg', gain: 0.7, pitch: 100 },

        // UI. Clicks are heard constantly, so they vary less.
        click:          { file: 'audio/sfx/ui/button_click.ogg', gain: 0.45, pitch: 100 },
        panel:          { file: 'audio/sfx/ui/open_close_click.ogg', gain: 0.5, pitch: 100 },
        notify:         { file: 'audio/sfx/ui/notification.ogg', gain: 0.6, pitch: 100 },
    },
    music: {
        menu_theme: 'audio/music/menu_theme.ogg',
        combat:     'audio/music/combat.ogg',
        credits:    'audio/music/credits.ogg',
        // Generic exploration track, used when a realm has no track of its own.
        expedition: 'audio/music/expedition.ogg',
        // One per realm (data/realms.js): 'expedition_' + realm id.
        expedition_wild_frontiers:       'audio/music/expedition_wild_frontiers.ogg',
        expedition_verdant_depths:       'audio/music/expedition_verdant_depths.ogg',
        expedition_fungal_hollows:       'audio/music/expedition_fungal_hollows.ogg',
        expedition_primeval_canopy:      'audio/music/expedition_primeval_canopy.ogg',
        expedition_crystal_caves:        'audio/music/expedition_crystal_caves.ogg',
        expedition_crystal_mines:        'audio/music/expedition_crystal_mines.ogg',
        expedition_crystal_depths:       'audio/music/expedition_crystal_depths.ogg',
        expedition_arcane_library:       'audio/music/expedition_arcane_library.ogg',
        expedition_ancient_university:   'audio/music/expedition_ancient_university.ogg',
        expedition_abandoned_laboratory: 'audio/music/expedition_abandoned_laboratory.ogg',
        expedition_shadow_realm:         'audio/music/expedition_shadow_realm.ogg',
        expedition_void_abyss:           'audio/music/expedition_void_abyss.ogg',
        expedition_oblivion_rift:        'audio/music/expedition_oblivion_rift.ogg',
        expedition_void_hollow:          'audio/music/expedition_void_hollow.ogg',
        expedition_void_sanctum:         'audio/music/expedition_void_sanctum.ogg',
        expedition_void_heart:           'audio/music/expedition_void_heart.ogg',
        expedition_kingdom_outskirts:    'audio/music/expedition_kingdom_outskirts.ogg',
        expedition_crusader_barracks:    'audio/music/expedition_crusader_barracks.ogg',
        expedition_palace_fortress:      'audio/music/expedition_palace_fortress.ogg',
        expedition_fracture_gate:        'audio/music/expedition_fracture_gate.ogg',
        expedition_shifting_labyrinth:   'audio/music/expedition_shifting_labyrinth.ogg',
        expedition_unraveling_core:      'audio/music/expedition_unraveling_core.ogg',
    },
};
