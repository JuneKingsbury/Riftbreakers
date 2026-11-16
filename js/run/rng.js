// Seeded random numbers for a run (mulberry32). The whole generator state is one
// 32-bit integer, so a run can be saved mid-way and resumed with the same rolls.
export class Rng {
    constructor(seed = Date.now()) {
        this.state = seed >>> 0;
    }

    // Float in [0, 1).
    next() {
        let t = (this.state = (this.state + 0x6D2B79F5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Integer in [0, n).
    int(n) {
        return Math.floor(this.next() * n);
    }

    // Integer in [min, max].
    range(min, max) {
        return min + this.int(max - min + 1);
    }

    chance(p) {
        return this.next() < p;
    }

    pick(arr) {
        return arr[this.int(arr.length)];
    }

    // A new array with the elements of `arr` in random order.
    shuffle(arr) {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    // Up to `n` distinct elements of `arr`.
    sample(arr, n) {
        return this.shuffle(arr).slice(0, n);
    }

    // Key of `weights` ({ key: weight }) chosen in proportion to its weight.
    weighted(weights) {
        const entries = Object.entries(weights).filter(([, w]) => w > 0);
        let roll = this.next() * entries.reduce((s, [, w]) => s + w, 0);
        for (const [key, w] of entries) {
            roll -= w;
            if (roll < 0) return key;
        }
        return entries.at(-1)?.[0];
    }
}

export function randomSeed() {
    return (Math.random() * 4294967296) >>> 0;
}
