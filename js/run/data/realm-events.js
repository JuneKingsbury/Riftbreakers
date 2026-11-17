// Events that only happen in one realm (see data/realms.js), drawn from Rifthold's
// expedition events. Same format as data/events.js, plus:
//   realms  Realm ids the event can appear in
// RunState mixes these with the general events, so about half of a realm's '?' nodes
// are realm events while fresh ones remain. A realm folded into an act realm (realmSources in
// data/realms.js) lends its events to that act, so rewards are sized for the act an event
// shows up in, not the realm's tier.

export const REALM_EVENTS = [
    // ---- The Wild Frontiers ----
    {
        id: 'wf_overgrown_trail', realms: ['wild_frontiers'],
        title: 'Overgrown Trail',
        text: 'Your scouts find a half-overgrown trail leading deeper into the wilds. A collapsed lean-to sits where it forks.',
        choices: [
            { label: 'Search the lean-to', effect: { gold: 25, item: 'common' }, resultText: 'Under the fallen roof: 25 gold and {item}, left by an earlier traveller.' },
            { label: 'Follow the game trail', outcomes: [
                { weight: 2, effect: { healPct: 1, xp: 20 }, resultText: 'It ends in a quiet clearing by a stream. Everyone rests and recovers. Every member gains 20 XP.' },
                { weight: 1, effect: { healPct: -0.1 }, resultText: 'A hunter\'s snare snaps shut on the lead walker. Nobody is badly hurt, but it stings.' },
            ] },
        ],
    },
    {
        id: 'wf_ritual_site', realms: ['wild_frontiers'],
        title: 'Old Ritual Site',
        text: 'Standing stones ring a patch of scorched earth. Amid the rubble, something glints.',
        choices: [
            { label: 'Dig through the rubble', effect: { relic: 'common' }, resultText: 'You uncover {relic}, still warm from whatever happened here.' },
            { label: 'Leave it undisturbed', effect: { xp: 25 }, resultText: 'You study the carvings instead. Every member gains 25 XP.' },
        ],
    },

    {
        id: 'wf_refugees', realms: ['wild_frontiers'],
        title: 'Displaced Family',
        text: 'A family pushed from their home by the Crusade camps by the trail, with everything they own on one cart.',
        choices: [
            { label: 'Share your supplies', effect: { healPct: -0.05, xp: 30 }, resultText: 'Lean rations tonight, but their stories of the Crusade are worth hearing. Every member gains 30 XP.' },
            { label: 'Ask if anyone can fight', requires: { partyBelow: 6 }, effect: { recruit: true }, resultText: 'The eldest child is older than they look, and handy with a sling.' },
            { label: 'Point them to the settlement', effect: { gold: 20 }, resultText: 'They press 20 gold on you for the directions.' },
        ],
    },
    {
        id: 'wf_blight_bloom', realms: ['wild_frontiers'],
        title: 'Blight Bloom',
        text: 'A swollen purple flower pulses at the edge of the clearing. The grass around it is grey and dead.',
        choices: [
            { label: 'Burn it out', effect: { xp: 35 }, resultText: 'It pops and hisses in the fire. Every member gains 35 XP.' },
            { label: 'Harvest the spores', outcomes: [
                { weight: 2, effect: { gold: 45 }, resultText: 'An alchemist will pay well for these: 45 gold.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'The bloom bursts. Everyone coughs for an hour.' },
            ] },
        ],
    },
    {
        id: 'wf_hedge_mages', realms: ['wild_frontiers'],
        title: 'Hedge Mages\' Camp',
        text: 'A circle of wagons painted with runes. The hedge mages inside eye your weapons, then your purses.',
        choices: [
            { label: 'Buy a charm (50 gold)', requires: { gold: 50 }, effect: { gold: -50, relic: 'common' }, resultText: 'They hand over {relic}, still warm from the fire.' },
            { label: 'Trade stories', effect: { xp: 25 }, resultText: 'They know a few tricks worth hearing. Every member gains 25 XP.' },
        ],
    },

    // ---- Verdant Wilds ----
    {
        id: 'vd_pitcher_plant', realms: ['verdant_depths', 'fungal_hollows'],
        title: 'Pitcher Plant',
        text: 'A pitcher plant the size of a wagon blocks the path. Something shiny rests at the bottom of its acid pool.',
        choices: [
            { label: 'Reach in', outcomes: [
                { weight: 2, effect: { item: 'uncommon', healPct: -0.1 }, resultText: 'The acid burns, but you come up holding {item}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'The plant snaps shut. You pull free empty-handed and badly burned.' },
            ] },
            { label: 'Cut a path around it', effect: { healPct: -0.05 }, resultText: 'Thorny vines tear at everyone on the long way round.' },
        ],
    },
    {
        id: 'vd_fruit_grove', realms: ['verdant_depths'],
        title: 'Bursting Grove',
        text: 'A grove heavy with ripe fruit, untouched by any bestiary. Bioluminescent flowers line the path.',
        choices: [
            { label: 'Eat your fill', effect: { healPct: 1 }, resultText: 'Sweet and strange. Everyone feels whole again.' },
            { label: 'Gather some to sell', effect: { gold: 45 }, resultText: 'Undocumented fruit fetches 45 gold from the right buyer.' },
        ],
    },
    {
        id: 'fh_puffball', realms: ['fungal_hollows'],
        title: 'Puffball Field',
        text: 'Phosphorescent caps pulse along the path. A fungal garden, tended by some long-gone cultivator, glows beyond them.',
        choices: [
            { label: 'Harvest the garden', outcomes: [
                { weight: 1, effect: { gold: 60 }, resultText: 'Giant truffles. A fortune to the right cook: 60 gold.' },
                { weight: 1, effect: { gold: 30, healPct: -0.15 }, resultText: 'A puffball bursts in your faces, choking spores! You still salvage 30 gold of fungi.' },
            ] },
            { label: 'Hold your breath and hurry past', resultText: 'You make it through without a cough.' },
        ],
    },
    {
        id: 'fh_symbiote', realms: ['fungal_hollows'],
        title: 'Fungal Crown',
        text: 'A ring of mushrooms grows visibly as you watch, forming a crown around a mossy skull.',
        choices: [
            { label: 'Let someone wear it', effect: { memberStatMods: { mat: 2 } }, resultText: 'The crown takes root in {name}\'s hair. Their thoughts sharpen: +2 MAT.' },
            { label: 'Burn it', effect: { xp: 30 }, resultText: 'It shrieks as it burns. Every member gains 30 XP.' },
        ],
    },
    {
        id: 'pc_world_root', realms: ['primeval_canopy'],
        title: 'The World-Root',
        text: 'Roots thicker than castle walls converge on a nexus of primal energy. Spores drift up from rotted patches.',
        choices: [
            { label: 'Draw on its power', effect: { memberStatMods: { maxHp: 8 } }, resultText: 'Living wood laces through {name}\'s skin. +8 max HP.' },
            { label: 'Cut away the rot', effect: { healPct: -0.1, xp: 70 }, resultText: 'Hard, filthy work. The root breathes easier. Every member gains 70 XP.' },
        ],
    },
    {
        id: 'pc_wasp_nest', realms: ['primeval_canopy', 'verdant_depths'],
        title: 'Hanging Nest',
        text: 'A wasp nest the size of a cart hangs over the only way forward. Something drips from it, golden and thick.',
        choices: [
            { label: 'Raid the honey', outcomes: [
                { weight: 1, effect: { item: 'uncommon', healPct: -0.15 }, resultText: 'Stung everywhere, but inside the comb is {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'The nest wakes, and so does everything nearby.' },
            ] },
            { label: 'Sneak beneath it', effect: { xp: 20 }, resultText: 'Slow and silent. Every member gains 20 XP.' },
        ],
    },

    // ---- Crystal Caverns ----
    {
        id: 'cc_geode', realms: ['crystal_caves', 'crystal_mines'],
        title: 'Humming Geode',
        text: 'A geode the size of a barrel hums with resonant energy. The walls around it chime in answer.',
        choices: [
            { label: 'Crack it open', outcomes: [
                { weight: 2, effect: { gold: 55 }, resultText: 'Raw runite inside. It sells for 55 gold.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'It explodes in a spray of crystal shards.' },
            ] },
            { label: 'Listen to it', effect: { xp: 30 }, resultText: 'The chime settles your minds. Every member gains 30 XP.' },
        ],
    },
    {
        id: 'cc_dwarven_cache', realms: ['crystal_caves'],
        title: 'Dwarven Cache',
        text: 'Behind a crumbled seal, an ancient dwarven storeroom. A strange compass sits embedded in crystal.',
        choices: [
            { label: 'Take the compass', effect: { relic: 'uncommon' }, resultText: 'You feel compelled to keep it. You now carry {relic}.' },
            { label: 'Take the supplies', effect: { gold: 40, item: 'common' }, resultText: 'Old but well kept: 40 gold and {item}.' },
        ],
    },
    {
        id: 'cm_trapped_miner', realms: ['crystal_mines'],
        title: 'Trapped Miner',
        text: 'A voice calls from behind a collapsed tunnel. A miner, alive, pinned under a cart.',
        choices: [
            { label: 'Dig them out', effect: { healPct: -0.1, gold: 60 }, resultText: 'It takes hours. The grateful miner hands over a pouch of 60 gold.' },
            { label: 'Offer them a place', requires: { partyBelow: 6 }, effect: { recruit: true }, resultText: 'Once free, they pick up a pick and fall in line.' },
            { label: 'Leave them', resultText: 'Their calls fade behind you.' },
        ],
    },
    {
        id: 'cm_golem_battery', realms: ['crystal_mines', 'crystal_depths'],
        title: 'Golem Battery',
        text: 'An ancient mining golem battery still hums with power, wired into a sleeping golem.',
        choices: [
            { label: 'Pull the battery', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'It comes free with a spark. You now carry {relic}.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The golem\'s eyes light up.' },
            ] },
            { label: 'Leave it sleeping', resultText: 'Some things are best left switched off.' },
        ],
    },
    {
        id: 'cd_crystal_heart', realms: ['crystal_depths'],
        title: 'Heart-Shaped Formation',
        text: 'A massive runite formation in the shape of a heart pulses in time with the whole cavern.',
        choices: [
            { label: 'Touch it', effect: { memberStatMods: { def: 2 } }, resultText: 'Crystal spines grow along {name}\'s arms, then settle into a hard sheen. +2 DEF.' },
            { label: 'Chip off a piece', effect: { gold: 60, healPct: -0.15 }, resultText: 'The cavern shudders and shards rain down, but the piece sells for 60 gold.' },
        ],
    },

    // ---- University Ruins ----
    {
        id: 'al_secret_shelf', realms: ['arcane_library', 'ancient_university'],
        title: 'Secret Shelf',
        text: 'A shelf clicks open behind two heavy tomes. Inside, a glowing codex rests on a lectern.',
        choices: [
            { label: 'Read it together', effect: { xp: 55 }, resultText: 'It shares its knowledge with all who stand near. Every member gains 55 XP.' },
            { label: 'Take it', outcomes: [
                { weight: 1, effect: { item: 'uncommon' }, resultText: 'Tucked in its back cover: {item}.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'The book is warded. It shocks everyone in reach.' },
            ] },
        ],
    },
    {
        id: 'al_brooms', realms: ['arcane_library'],
        title: 'Tireless Brooms',
        text: 'Brooms sweep the halls by themselves, herding dust toward a door marked "Staff Only".',
        choices: [
            { label: 'Follow them', effect: { gold: 55, item: 'common' }, resultText: 'The staff room has a forgotten lockbox: 55 gold and {item}.' },
            { label: 'Help them sweep', effect: { healPct: 1 }, resultText: 'A quiet hour of chores. The library seems to approve. Everyone feels rested.' },
        ],
    },
    {
        id: 'au_exam_vault', realms: ['ancient_university'],
        title: 'Examination Vault',
        text: 'A sealed vault still holds graded manuscripts. A student\'s old ward guards the door.',
        choices: [
            { label: 'Break the ward', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'Among the top marks: {relic}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'Lightning arcs through the party.' },
            ] },
            { label: 'Study the ward instead', effect: { xp: 40 }, resultText: 'A clever bit of work. Every member gains 40 XP.' },
        ],
    },
    {
        id: 'au_crusader_camp', realms: ['ancient_university'],
        title: 'Crusader Encampment',
        text: 'Crusaders have turned a lecture hall into a barracks. Their supply tent is lightly watched.',
        choices: [
            { label: 'Raid the supplies', outcomes: [
                { weight: 1, effect: { gold: 50, item: 'common' }, resultText: 'You slip away with 50 gold and {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'A sentry spots you.' },
            ] },
            { label: 'Go around', resultText: 'You take the long way through the ruined gardens.' },
        ],
    },
    {
        id: 'lab_stasis', realms: ['abandoned_laboratory'],
        title: 'Stasis Chamber',
        text: 'A mutated specimen floats in a cracked stasis tank. Beside it, a researcher\'s emergency kit.',
        choices: [
            { label: 'Grab the kit', outcomes: [
                { weight: 2, effect: { item: 'rare' }, resultText: 'Inside a condensed field manual: {item}.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The tank gives way.' },
            ] },
            { label: 'Read the research notes', effect: { xp: 70 }, resultText: 'The researcher\'s work lives on in you. Every member gains 70 XP.' },
        ],
    },
    {
        id: 'lab_reagents', realms: ['abandoned_laboratory'],
        title: 'Unstable Reagents',
        text: 'A shelf of bubbling reagents, labels faded. One is marked, in a shaky hand, "DO NOT".',
        choices: [
            { label: 'Someone drinks the "DO NOT"', effect: { memberStatMods: { mat: 2, maxMp: 6 } }, resultText: '{name} glows faintly for an hour. +2 MAT, +6 max MP.' },
            { label: 'Sell the rest', effect: { gold: 70, healPct: -0.1 }, resultText: 'One combusts on the way out, but the rest fetch 70 gold.' },
        ],
    },

    // ---- The Abyss ----
    {
        id: 'ag_fading_rift', realms: ['shadow_realm', 'void_abyss'],
        title: 'Fading Rift',
        text: 'A small rift flickers on the ledge, spilling residual energy as it collapses.',
        choices: [
            { label: 'Absorb the energy', effect: { xp: 45, healPct: -0.1 }, resultText: 'It burns going in. Every member gains 45 XP.' },
            { label: 'Grab what falls out', effect: { item: 'uncommon' }, resultText: 'A pocket dimension collapses, dropping {item}.' },
        ],
    },
    {
        id: 'ag_living_lantern', realms: ['shadow_realm'],
        title: 'Eyes in the Stone',
        text: 'Plant-like eyes rooted in the rock follow your every step. One holds a lantern in its tendrils.',
        choices: [
            { label: 'Take the lantern', outcomes: [
                { weight: 2, effect: { relic: 'uncommon' }, resultText: 'It never goes dark. You now carry {relic}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'The eyes close. Things climb out of the dark.' },
            ] },
            { label: 'Keep your distance', resultText: 'You keep to the far edge of the ledge, and the eyes lose interest.' },
        ],
    },
    {
        id: 'sa_drifting_wreck', realms: ['void_abyss'],
        title: 'Drifting Wreck',
        text: 'The remains of another expedition float past on a broken raft, their supplies intact.',
        choices: [
            { label: 'Haul it in', effect: { gold: 40, item: 'common' }, resultText: 'Waterlogged but useful: 40 gold and {item}.' },
            { label: 'Give them a burial at sea', effect: { xp: 35 }, resultText: 'A quiet moment on the black water. Every member gains 35 XP.' },
        ],
    },
    {
        id: 'sa_isle_market', realms: ['void_abyss'],
        title: 'Isle Market',
        text: 'Bug-like islanders trade from ramshackle stalls. One offers a raft ride and a curious charm.',
        choices: [
            { label: 'Buy the charm (70 gold)', requires: { gold: 70 }, effect: { gold: -70, relic: 'uncommon' }, resultText: 'It pulses with abyss energy, barely contained: {relic}.' },
            { label: 'Ride the raft', effect: { healPct: 1 }, resultText: 'Hours of gentle drifting. Everyone recovers.' },
        ],
    },
    {
        id: 'or_waterfall', realms: ['oblivion_rift'],
        title: 'Edge of the World',
        text: 'The abyssal ocean pours over the edge into blackness. Fragments of a destroyed world tumble past.',
        choices: [
            { label: 'Salvage a fragment', outcomes: [
                { weight: 1, effect: { relic: 'uncommon' }, resultText: 'You pull {relic} from the wreckage of another world.' },
                { weight: 1, effect: { healPct: -0.25 }, resultText: 'Colliding fragments crush the ledge you stand on.' },
            ] },
            { label: 'Stare into it', effect: { xp: 60, healPct: -0.1 }, resultText: 'For a moment you understand. It hurts. Every member gains 60 XP.' },
        ],
    },
    {
        id: 'or_sovereign_gaze', realms: ['oblivion_rift'],
        title: 'A Silent Gaze',
        text: 'The Sovereign\'s attention turns briefly toward your party. Even partial focus is agony.',
        choices: [
            { label: 'Endure it', effect: { healPct: -0.2, memberStatMods: { mdf: 2 } }, resultText: 'Everyone suffers, but {name} stares back, and comes away hardened. +2 MDF.' },
            { label: 'Hide in the black stone', effect: { gold: 50 }, resultText: 'You wait it out in a collapsed vault and find 50 gold in the dark.' },
        ],
    },

    // ---- The Void Pact ----
    {
        id: 'vh_ledger', realms: ['void_hollow', 'void_sanctum'],
        title: 'Open Ledger',
        text: 'A ledger lies open on a stone table. Every entry is a price. One line has your party\'s names, and a blank.',
        choices: [
            { label: 'Sign it', effect: { gold: 90, healPct: -0.2 }, resultText: 'Gold appears in your packs: 90 of it. Something is collected in return.' },
            { label: 'Tear out the page', effect: { xp: 40 }, resultText: 'The ink screams. Every member gains 40 XP.' },
        ],
    },
    {
        id: 'vh_wall_walk', realms: ['void_hollow'],
        title: 'Following the Wall',
        text: 'Lantern light dies within a few paces. The only way forward is a hand on the wall.',
        choices: [
            { label: 'Keep walking', outcomes: [
                { weight: 2, effect: { item: 'uncommon' }, resultText: 'Your fingers find a niche, and in it {item}.' },
                { weight: 1, effect: { healPct: -0.15 }, resultText: 'Something brushes against you and drains a little life from everyone.' },
            ] },
            { label: 'Light a magical flame', effect: { xp: 25 }, resultText: 'It barely helps, but you learn how the dark moves. Every member gains 25 XP.' },
        ],
    },
    {
        id: 'vs_contract_chest', realms: ['void_sanctum'],
        title: 'Contract Lock',
        text: 'A chest whose lock is a contract. The terms seem reasonable. That is what worries you.',
        choices: [
            { label: 'Accept the terms', effect: { relic: 'uncommon', loseItem: true }, resultText: 'One of your spare items vanishes. In the chest: {relic}.' },
            { label: 'Read the fine print', effect: { xp: 45 }, resultText: 'Three hours of clauses. You walk away wiser. Every member gains 45 XP.' },
        ],
    },
    {
        id: 'vs_prisoner', realms: ['void_sanctum', 'void_heart'],
        title: 'Lucid Prisoner',
        text: 'Among the chattering penitents, one still remembers their name. They beg to be taken home.',
        choices: [
            { label: 'Take them with you', requires: { partyBelow: 6 }, effect: { recruit: true }, resultText: 'They have been here a long time. They know how to fight.' },
            { label: 'Share your rations', effect: { xp: 30 }, resultText: 'They tell you which halls to avoid. Every member gains 30 XP.' },
        ],
    },
    {
        id: 'vheart_tribute', realms: ['void_heart'],
        title: 'Uncollected Tribute',
        text: 'A tribute sits before a door with no lock. It was never collected.',
        choices: [
            { label: 'Collect it', outcomes: [
                { weight: 2, effect: { gold: 80 }, resultText: 'You collect it: 80 gold.' },
                { weight: 1, effect: { gold: 40, healPct: -0.2 }, resultText: 'A binding agreement activates, draining everyone. You still keep 40 gold.' },
            ] },
            { label: 'Burn a page of the ledger', effect: { memberStatMods: { atk: 2, mat: 2 } }, resultText: 'The flames leap to {name}, who feels lighter, freer. +2 ATK, +2 MAT.' },
        ],
    },

    // ---- The Kingdom ----
    {
        id: 'ko_supply_wagon', realms: ['kingdom_outskirts', 'crusader_barracks'],
        title: 'Supply Wagon',
        text: 'A Crusader supply wagon sits at the roadside, its driver asleep in the hay.',
        choices: [
            { label: 'Raid it', outcomes: [
                { weight: 2, effect: { gold: 70, item: 'uncommon' }, resultText: 'You slip away with 70 gold and {item}.' },
                { weight: 1, effect: { battle: 'normal' }, resultText: 'An alarm bell clangs. Soldiers come running.' },
            ] },
            { label: 'Let them sleep', resultText: 'You walk on past the snoring driver.' },
        ],
    },
    {
        id: 'ko_villagers', realms: ['kingdom_outskirts'],
        title: 'Laboring Villagers',
        text: 'Villagers bring in the harvest. A farmer waves you over: "You don\'t look like soldiers."',
        choices: [
            { label: 'Help with the harvest', effect: { xp: 50, gold: 50 }, resultText: 'Honest work. They pay 50 gold, and every member gains 50 XP.' },
            { label: 'Ask about the patrols', effect: { healPct: 1 }, resultText: 'They hide you in a barn for the night. Everyone rests.' },
        ],
    },
    {
        id: 'cb_training_dummy', realms: ['crusader_barracks'],
        title: 'Training Yard',
        text: 'Racks of runic-forged steel stand beside rigged training dummies.',
        choices: [
            { label: 'Train with them', effect: { healPct: -0.15, xp: 75 }, resultText: 'One dummy swings a live blade. Bruised but sharper, every member gains 75 XP.' },
            { label: 'Strip the weapons rack', effect: { item: 'rare' }, resultText: 'You take {item}.' },
        ],
    },
    {
        id: 'cb_battle_standard', realms: ['crusader_barracks'],
        title: 'Battle Standard',
        text: 'A battle standard hangs on the barracks wall, its enchantments still potent.',
        choices: [
            { label: 'Tear it down', effect: { relic: 'uncommon' }, resultText: 'It is yours now: {relic}.' },
            { label: 'Burn it', effect: { xp: 60 }, resultText: 'A blow to the Crusade. Every member gains 60 XP.' },
        ],
    },
    {
        id: 'pf_confiscated_vault', realms: ['palace_fortress'],
        title: 'Vault of Confiscated Magic',
        text: 'Behind a gilded door, the kingdom keeps the magic it fears. A ward flares as you approach.',
        choices: [
            { label: 'Break in', outcomes: [
                { weight: 2, effect: { relic: 'rare' }, resultText: 'Among the forbidden tomes: {relic}.' },
                { weight: 1, effect: { healPct: -0.25 }, resultText: 'The royal ward lashes arcane fire at everyone.' },
            ] },
            { label: 'Read the warding', effect: { xp: 60 }, resultText: 'Miracle working, indeed. Every member gains 60 XP.' },
        ],
    },
    {
        id: 'pf_war_gallery', realms: ['palace_fortress'],
        title: 'War Gallery',
        text: 'Display cases of legendary weaponry line a hall of tapestries showing historic battles.',
        choices: [
            { label: 'Smash a case', outcomes: [
                { weight: 1, effect: { item: 'rare' }, resultText: 'You take {item} before the guards arrive.' },
                { weight: 1, effect: { battle: 'elite' }, resultText: 'The king\'s guard was closer than you thought.' },
            ] },
            { label: 'Study the tapestries', effect: { xp: 45 }, resultText: 'Every battle the High King has fought, woven in thread. Every member gains 45 XP.' },
        ],
    },

    // ---- The Unraveling ----
    {
        id: 'fg_two_chests', realms: ['fracture_gate', 'shifting_labyrinth'],
        title: 'A Chest in Two Places',
        text: 'A chest exists in two places at once. Both are the same chest. Both are slightly different.',
        choices: [
            { label: 'Open the left one', effect: { gold: 70 }, resultText: '70 gold, or possibly 70 of something else that spends like gold.' },
            { label: 'Open the right one', outcomes: [
                { weight: 1, effect: { item: 'uncommon' }, resultText: 'Inside: {item}, which may or may not be from this realm.' },
                { weight: 1, effect: { healPct: -0.1 }, resultText: 'The floor inverts, slamming everyone against the ceiling.' },
            ] },
        ],
    },
    {
        id: 'fg_familiar_face', realms: ['fracture_gate'],
        title: 'A Familiar Face',
        text: 'A shifting creature wears a face you swear you recognize. It doesn\'t attack. It waits.',
        choices: [
            { label: 'Speak to it', effect: { xp: 60 }, resultText: 'It answers in your own voice, and teaches you something. Every member gains 60 XP.' },
            { label: 'Strike first', effect: { battle: 'normal' }, resultText: 'Its face changes, and more come.' },
        ],
    },
    {
        id: 'sl_still_room', realms: ['shifting_labyrinth'],
        title: 'The Still Room',
        text: 'A perfectly calm room in the middle of the chaos. It wasn\'t here a moment ago.',
        choices: [
            { label: 'Rest here', effect: { healPct: 1, xp: 20 }, resultText: 'For an hour, nothing moves. Every member gains 20 XP.' },
            { label: 'Search it', effect: { relic: 'uncommon' }, resultText: 'The labyrinth has been carrying {relic} around. Now you are.' },
        ],
    },
    {
        id: 'uc_paradox', realms: ['unraveling_core'],
        title: 'Paradox',
        text: 'One of you steps forward and arrives back before they leave. The other one looks equally confused.',
        choices: [
            { label: 'Let them merge', effect: { memberStatMods: { maxHp: 10, spd: 1 } }, resultText: '{name} becomes one person again, with the best of both. +10 max HP, +1 SPD.' },
            { label: 'Walk away quickly', effect: { healPct: -0.1 }, resultText: 'A reality tear cuts across the party on the way out.' },
        ],
    },
    {
        id: 'uc_unravelers_eye', realms: ['unraveling_core', 'shifting_labyrinth'],
        title: 'An Eye in the Wall',
        text: 'An eye is embedded in the wall, watching nothing in particular. It hums with chaotic energy.',
        choices: [
            { label: 'Pry it loose', outcomes: [
                { weight: 1, effect: { relic: 'rare' }, resultText: 'It is still watching. You now carry {relic}.' },
                { weight: 1, effect: { healPct: -0.2 }, resultText: 'The wall closes on your hands.' },
            ] },
            { label: 'Stare back', effect: { xp: 50 }, resultText: 'It blinks first. Every member gains 50 XP.' },
        ],
    },
];
