// Ability templates: groups of fields that abilities `extends` to avoid repeating them.
// A template is not an ability itself (no unit can have it), so changing one only changes
// the abilities built on it. `extends` looks here when no ability has the name.

export const ABILITY_TEMPLATES = {
    // A support passive: always on, costs nothing, targets nobody.
    support: { type: 'passive', slot: 'support', passive: true, range: 0, aoe: 0, mpCost: 0, actionCost: 0, targetType: 'self', chargeTime: 0 },
};
