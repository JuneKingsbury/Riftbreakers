// Every player class, one file each. A class file holds the class (`job`) and the abilities
// of its skill tree (`abilities`); see js/content/README.md.
//
// To add a class, add its file here. The order is the order classes are listed in menus and
// offered as recruits: starting classes first, then promotions.

import * as evoker from './evoker.js';
import * as spellblade from './spellblade.js';
import * as warden from './warden.js';
import * as runebow from './runebow.js';
import * as stoneshaper from './stoneshaper.js';
import * as seer from './seer.js';
import * as illusionist from './illusionist.js';
import * as gravecaller from './gravecaller.js';
import * as alchemist from './alchemist.js';
import * as warlord from './warlord.js';
import * as battlemage from './battlemage.js';
import * as paladin from './paladin.js';
import * as riftcaller from './riftcaller.js';
import * as earthshaker from './earthshaker.js';
import * as sanctifier from './sanctifier.js';
import * as spiritbinder from './spiritbinder.js';
import * as worldsinger from './worldsinger.js';
import * as fatebinder from './fatebinder.js';
import * as lifeseer from './lifeseer.js';
import * as beastcaller from './beastcaller.js';
import * as skyhunter from './skyhunter.js';
import * as bastion from './bastion.js';
import * as dreamweaver from './dreamweaver.js';
import * as mirage_oracle from './mirage_oracle.js';
import * as lich from './lich.js';
import * as gravewarden from './gravewarden.js';
import * as plaguewright from './plaguewright.js';
import * as field_surgeon from './field_surgeon.js';
import * as marshal from './marshal.js';
import * as tactician from './tactician.js';

export const CLASSES = [
    evoker, spellblade, warden, runebow, stoneshaper, seer,
    illusionist, gravecaller, alchemist, warlord, battlemage, paladin,
    riftcaller, earthshaker, sanctifier, spiritbinder, worldsinger, fatebinder,
    lifeseer, beastcaller, skyhunter, bastion, dreamweaver, mirage_oracle,
    lich, gravewarden, plaguewright, field_surgeon, marshal, tactician,
];
