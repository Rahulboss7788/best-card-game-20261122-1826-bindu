// Seeded random numbers (mulberry32) so a game can be replayed exactly from its seed:
// the same seed always shuffles the same decks and drives the same AI choices.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function int(limit) {
    return Math.floor(next() * limit);
  }
  function pick(list) {
    return list[int(list.length)];
  }
  function shuffle(list) {
    const copy = list.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = int(index + 1);
      const held = copy[index];
      copy[index] = copy[other];
      copy[other] = held;
    }
    return copy;
  }
  return { next, int, pick, shuffle };
}
