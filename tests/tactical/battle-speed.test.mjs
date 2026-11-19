import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBattleSpeed, saveBattleSpeed } from '../../js/tactical/battle-speed.js';

function memoryStorage() {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('battles start at 1x when no speed has been picked', () => {
    assert.equal(loadBattleSpeed(memoryStorage()), 1);
});

test('a picked speed carries over to the next battle until another is picked', () => {
    const store = memoryStorage();
    saveBattleSpeed(4, store);
    assert.equal(loadBattleSpeed(store), 4);
    saveBattleSpeed(2, store);
    assert.equal(loadBattleSpeed(store), 2);
    saveBattleSpeed(1, store);
    assert.equal(loadBattleSpeed(store), 1);
});

test('an unsupported speed is not remembered', () => {
    const store = memoryStorage();
    saveBattleSpeed(2, store);
    saveBattleSpeed(3, store);
    assert.equal(loadBattleSpeed(store), 2);
});

test('a corrupt saved value falls back to 1x', () => {
    const store = memoryStorage();
    store.setItem('riftbreak.battle_speed', 'fast');
    assert.equal(loadBattleSpeed(store), 1);
});

test('missing or failing storage falls back to 1x without throwing', () => {
    assert.equal(loadBattleSpeed(null), 1);
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.doesNotThrow(() => saveBattleSpeed(2, broken));
    assert.equal(loadBattleSpeed(broken), 1);
});
