// Random events met on '?' nodes: the general events (content/events.js) and each realm's
// own (content/realms/<realm>.js). EVENTS holds both; eventsFor picks those an act can meet.
// The event format is described in content/events.js and content/vocab.js (SCHEMAS.event).

import { REALMS, realmSources } from './realms.js';
import { GENERAL_EVENTS } from '../../content/events.js';
import { CHAINS } from '../../content/realms/index.js';

// Realm events, in realm order. An event in a realm file appears in that realm unless it
// lists its own `realms`.
export const REALM_EVENTS = Object.values(CHAINS).flatMap(c => c.realms).flatMap(mod =>
    mod.events.map(({ id, realms, ...rest }) => ({ id, realms: realms ?? [mod.realm.id], ...rest })));

export const EVENTS = [...GENERAL_EVENTS, ...REALM_EVENTS];

// Events for a '?' node in `act`, set in `realmId`: { realm: [...], general: [...] }.
// `realm` also holds the events of the realms folded into it (realmSources).
export function eventsFor(act, realmId) {
    const chain = REALMS[realmId]?.chain;
    const sources = realmSources(realmId);
    const inAct = e => !e.acts || e.acts.includes(act);
    return {
        // The realm's own events and those of the realms folded into it.
        realm: REALM_EVENTS.filter(e => inAct(e) && e.realms.some(r => sources.includes(r))),
        general: GENERAL_EVENTS.filter(e => inAct(e) && (!e.chains || e.chains.includes(chain))),
    };
}
