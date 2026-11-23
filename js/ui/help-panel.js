// How to Play and the Glossary: one panel with tabs, opened from the title screen (How to
// Play), the run map's Menu, and the battle sidebar. The Glossary is built from the content
// vocabulary (content/vocab.js) and the affixes file, so a new stat, status or affix shows up
// here with no extra work.
import { Modal, BTN, esc, NODE_INFO } from '../run/ui-kit.js';
import { STATS, STATUSES, ENGINE_STATES } from '../content/vocab.js';
import { AFFIXES } from '../content/affixes.js';
import { PROMOTION_LEVEL } from '../tactical/loadout.js';

const H = (t) => `<div style="color:#fc8;font-weight:bold;font-size:13px;margin:12px 0 4px;">${t}</div>`;
const P = (t) => `<div style="line-height:1.55;margin-bottom:6px;color:#bbc;">${t}</div>`;
const K = (t) => `<span style="display:inline-block;min-width:16px;padding:0 4px;border:1px solid #557;border-radius:3px;background:#151528;color:#fff;text-align:center;font-size:11px;">${t}</span>`;
const ROW = (term, desc, color = '#ddd') =>
    `<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #1a1a2a;"><span style="flex:0 0 110px;color:${color};font-weight:bold;">${term}</span><span style="flex:1;color:#aab;line-height:1.45;">${desc}</span></div>`;

// More than the map's hover line (NODE_INFO.desc) says, where there is more to say.
const NODE_HELP = {
    elite: 'A tougher fight, led by an enemy with special traits (see the Glossary). The reward is better items and a relic.',
    rest: 'Train to give everyone XP, or enchant one item to make it stronger (up to +2).',
    recruit: 'Someone wants to join you. Pick one of the candidates. Your party can hold up to six.',
};

const TABS = {
    basics: {
        label: 'Basics',
        html: () => H('The run')
            + P('A run has four acts. Each act is a map you climb from the bottom, choosing your path as you go, until you reach the boss at the top. Beat all four bosses to seal the rifts and win.')
            + P('You start with up to three heroes and can recruit more along the way, up to six. If your party falls in battle the run is over, but the renown you earned still goes toward new classes and bonuses for next time.')
            + H('Battles play out on their own')
            + P('You don\'t give orders during a fight. Each member follows their <b>tactics</b>, a set of rules built from the skills they know, so a newly learned skill gets used right away.')
            + P('Your part happens before the fighting starts: who\'s in the party, what they learn, what they wear, where they stand, and which way you go on the map.')
            + P('Win a battle and everyone heals to full. Wounds from events stick around until your next win.')
            + H('Your first run')
            + P('Try three classes that do different jobs, like a Warden to protect and heal, an Evoker for damage and a Runebow to shoot from range. Leave build focus on and your party will spend their skill points for you.')
            + P('Battles on the map give XP and items. Elites hit harder but drop relics. And it\'s worth stopping at a rest site before the boss.'),
    },
    battles: {
        label: 'Battles',
        html: () => H('Before the battle')
            + P('The briefing tells you what you\'re up against. Then, on the deploy screen, you can move your party around the highlighted tiles. Keep fragile members at the back, away from the front line.')
            + H('During the battle')
            + P('Battles happen in real time. A unit acts whenever its speed gauge (CT) fills up, so faster units act more often. Numbers pop up over units as they\'re hit or healed, along with the name of each skill as it\'s used.')
            + P(`Press ${K('Space')} to pause and ${K('1')} ${K('2')} ${K('3')} to change the speed. Click a unit to see its stats and statuses, and hover over a status to find out what it does.`)
            + P('Some spells need time to charge. A bar with the spell\'s name fills up over the caster, and the spell picks its target when it finally goes off.')
            + P('Facing matters. A unit\'s EVA (its chance to dodge) works fully against attacks from the front, half as well from the side, and not at all from behind.')
            + H('After the battle')
            + P('The breakdown shows how much damage everyone dealt and took, skill by skill. If someone keeps going down, try better armor, a spot further back at deploy, or different tactics.')
            + H('Tactics')
            + P('Press T on the map, or pick Tactics from the menu, to open the tactics editor. Each member checks their rules from top to bottom and does the first one that applies. The default rules update themselves as members learn skills, so you only need to write your own if you want more control.'),
    },
    growth: {
        label: 'Growth',
        html: () => H('Levels and skill points')
            + P('Winning battles earns XP, and every level brings a skill point (SP). Spend them in the Party menu (P) to learn new skills from a class\'s tree, or to upgrade ones you already have to rank II and III.')
            + P('With build focus on, members follow a suggested build and spend their points for you. If you\'d rather plan it yourself, Skill Plans in Settings let you set up your own build for each class.')
            + H('Promotion')
            + P(`At level ${PROMOTION_LEVEL}, each member can promote into one of two Tier 2 classes from the Party menu. It's free, and they keep every skill they've learned.`)
            + H('Equipment')
            + P('Everyone has six gear slots: weapon, armor, helmet, tool, trinket and boots. Not every class can wear every kind of gear. Open Equipment (G) and hover over an item to see how it would change someone\'s stats before you put it on.')
            + P('Some items come with a skill or a passive ability too. Turn on auto-equip in Settings and new items go straight to whoever they suit best.')
            + H('Relics')
            + P('You\'ll find relics from elites, bosses, treasure and shops. Each one affects the whole party for the rest of the run.'),
    },
    map: {
        label: 'Map',
        html: () => H('Places on the map')
            + Object.entries(NODE_INFO).map(([k, n]) => ROW(`${n.icon} ${n.label}`, esc(NODE_HELP[k] ?? n.desc ?? ''), n.color)).join('')
            + H('Choosing a path')
            + P('You can only move upward along the paths. Hover over a place to see what\'s there. On a touch screen, tap it once to look and again to go.')
            + P('Try to reach the boss in good shape. An elite or two for relics and a rest stop near the end make a big difference.'),
    },
    glossary: {
        label: 'Glossary',
        html: () => H('Stats')
            + Object.values(STATS).map(s => ROW(esc(s.short), esc(s.desc))).join('')
            + H('Harmful statuses')
            + Object.values(STATUSES).filter(s => s.harmful).map(s => ROW(esc(s.name), esc(s.desc), '#f99')).join('')
            + H('Helpful statuses')
            + Object.values(STATUSES).filter(s => !s.harmful).map(s => ROW(esc(s.name), esc(s.desc), '#9e9')).join('')
            + H('Other states')
            + Object.values(ENGINE_STATES).map(s => ROW(esc(s.name), esc(s.desc), '#aab')).join('')
            + H('Elite affixes')
            + P('The leader of an elite fight has one or more of these. The briefing tells you which.')
            + Object.values(AFFIXES).map(a => ROW(esc(a.name), esc(a.desc), '#fb6')).join(''),
    },
    controls: {
        label: 'Controls',
        html: () => H('Map')
            + ROW(K('P'), 'Party menu') + ROW(K('G'), 'Equipment') + ROW(K('T'), 'Tactics editor') + ROW(K('H'), 'How to Play')
            + ROW('Scroll / drag', 'Look further along the map')
            + H('Deploy')
            + ROW('Click', 'Pick a member, then a highlighted tile to place them') + ROW(K('Enter'), 'Start the battle')
            + ROW(K('Esc'), 'Cancel the selection')
            + H('Battle')
            + ROW(K('Space'), 'Pause or resume') + ROW(`${K('1')} ${K('2')} ${K('3')}`, 'Battle speed')
            + ROW('Click', 'Inspect a unit')
            + H('Camera (deploy and battle)')
            + ROW(K('Q') + ' ' + K('E'), 'Rotate the view') + ROW('Arrows', 'Pan') + ROW('Scroll', 'Zoom')
            + ROW(K('F'), 'Focus the camera') + ROW(K('V'), 'Free camera')
            + H('Menus')
            + ROW(K('Esc'), 'Close or go back') + ROW('Hold (touch)', 'Show a tooltip'),
    },
};

let modal = null;

/** Opens the help panel on `tab` (a TABS key: basics, battles, growth, map, glossary, controls). */
export function showHelp(tab = 'basics', { onClose } = {}) {
    modal ??= new Modal(1500);
    const render = (current) => {
        const tabs = Object.entries(TABS).map(([k, t]) => {
            const on = k === current;
            return `<button data-help-tab="${k}" style="${BTN}width:auto;display:inline-block;margin:0 4px 4px 0;padding:4px 9px;${on ? 'background:#2a2a4e;color:#fc8;border-color:#88a;' : 'color:#99a;'}">${t.label}</button>`;
        }).join('');
        const body = modal.show(TABS[current].html(), {
            width: 560, view: `help:${current}`, onClose,
            header: `<div style="color:#ffcc00;font-weight:bold;font-size:15px;margin-bottom:8px;">How to Play</div><div>${tabs}</div>`,
        });
        body.querySelectorAll('[data-help-tab]').forEach(b => b.addEventListener('click', () => render(b.dataset.helpTab)));
    };
    render(TABS[tab] ? tab : 'basics');
}
