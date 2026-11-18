// Every item, one file per slot. The order here is the order items are listed (and rolled from):
// add a new item to its slot's file.

import { items as armor } from './armor.js';
import { items as helmets } from './helmets.js';
import { items as weapons } from './weapons.js';
import { items as tools } from './tools.js';
import { items as boots } from './boots.js';
import { items as trinkets } from './trinkets.js';

export const ITEM_FILES = { armor, helmets, weapons, tools, boots, trinkets };
