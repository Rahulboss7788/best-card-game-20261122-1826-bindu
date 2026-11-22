// Every card in Tidebound. Four currents (the suits of this game) colour the cards:
// Wave, Coral, Storm and Deep. Creatures fight on the table; spells resolve at once.
// Keywords: Guard (attackers must strike it first), Swift (attacks the turn it is
// played), Surge (a bonus when another card was already played this turn).
export const CURRENTS = {
  wave: { name: 'Wave', glyph: '≋', colour: '#2e86c1' },
  coral: { name: 'Coral', glyph: '✿', colour: '#c0392b' },
  storm: { name: 'Storm', glyph: '↯', colour: '#b7950b' },
  deep: { name: 'Deep', glyph: '◉', colour: '#6c3483' },
};

// id, name, current, cost, kind, attack, health, keywords, rules text, copies in a deck.
export const CARD_DEFS = [
  { id: 'tide-sprite', name: 'Tide Sprite', current: 'wave', cost: 1, kind: 'creature', attack: 1, health: 1, keywords: ['Swift'], text: 'Swift: attacks the turn it is played.', copies: 3 },
  { id: 'coral-crab', name: 'Coral Crab', current: 'coral', cost: 1, kind: 'creature', attack: 1, health: 2, keywords: ['Guard'], text: 'A clawed wall of living coral.', copies: 3 },
  { id: 'foamling', name: 'Foamling', current: 'wave', cost: 2, kind: 'creature', attack: 2, health: 2, keywords: [], text: 'A bubble with opinions.', copies: 1 },
  { id: 'reef-guard', name: 'Reef Guard', current: 'coral', cost: 2, kind: 'creature', attack: 1, health: 4, keywords: ['Guard'], text: 'The reef’s first and last word.', copies: 1 },
  { id: 'storm-gull', name: 'Storm Gull', current: 'storm', cost: 2, kind: 'creature', attack: 3, health: 1, keywords: ['Swift'], text: 'Swift: attacks the turn it is played.', copies: 1 },
  { id: 'moon-jelly', name: 'Moon Jelly', current: 'deep', cost: 2, kind: 'creature', attack: 0, health: 3, keywords: ['Guard'], text: 'Guard. On play: restore 3 life to your hero.', copies: 2 },
  { id: 'kelp-knight', name: 'Kelp Knight', current: 'coral', cost: 3, kind: 'creature', attack: 3, health: 3, keywords: [], text: 'Armoured in living kelp.', copies: 1 },
  { id: 'pearl-diver', name: 'Pearl Diver', current: 'deep', cost: 3, kind: 'creature', attack: 2, health: 3, keywords: [], text: 'On play: draw a card.', copies: 1 },
  { id: 'surge-eel', name: 'Surge Eel', current: 'wave', cost: 3, kind: 'creature', attack: 2, health: 2, keywords: ['Surge'], text: 'Surge: +2/+2 if you played another card this turn.', copies: 2 },
  { id: 'drowned-sailor', name: 'Drowned Sailor', current: 'deep', cost: 4, kind: 'creature', attack: 4, health: 3, keywords: [], text: 'He still rows for the tide.', copies: 1 },
  { id: 'wave-rider', name: 'Wave Rider', current: 'wave', cost: 4, kind: 'creature', attack: 3, health: 5, keywords: ['Swift'], text: 'Swift: attacks the turn it is played.', copies: 1 },
  { id: 'tidecaller-adept', name: 'Tidecaller Adept', current: 'storm', cost: 4, kind: 'creature', attack: 3, health: 4, keywords: ['Surge'], text: 'Surge: deal 2 damage to the enemy hero.', copies: 2 },
  { id: 'leviathan-calf', name: 'Leviathan Calf', current: 'deep', cost: 5, kind: 'creature', attack: 5, health: 4, keywords: [], text: 'Small now. Give it a tide or two.', copies: 1 },
  { id: 'coral-colossus', name: 'Coral Colossus', current: 'coral', cost: 6, kind: 'creature', attack: 6, health: 6, keywords: ['Guard'], text: 'A walking reef, older than the tide.', copies: 1 },
  { id: 'abyssal-serpent', name: 'Abyssal Serpent', current: 'deep', cost: 7, kind: 'creature', attack: 8, health: 7, keywords: [], text: 'The deep does not bargain.', copies: 1 },
  { id: 'riptide-blast', name: 'Riptide Blast', current: 'wave', cost: 2, kind: 'spell', keywords: [], text: 'Deal 3 damage to any target.', copies: 2 },
  { id: 'healing-current', name: 'Healing Current', current: 'coral', cost: 2, kind: 'spell', keywords: [], text: 'Restore 6 life to your hero.', copies: 1 },
  { id: 'tidal-bargain', name: 'Tidal Bargain', current: 'deep', cost: 1, kind: 'spell', keywords: [], text: 'Draw 2 cards, then discard 1 card.', copies: 1 },
  { id: 'mana-bloom', name: 'Mana Bloom', current: 'storm', cost: 1, kind: 'spell', keywords: [], text: 'Gain 2 mana this turn.', copies: 1 },
  { id: 'coral-shield', name: 'Coral Shield', current: 'coral', cost: 1, kind: 'spell', keywords: [], text: 'Give a friendly creature +2/+2 and Guard.', copies: 1 },
  { id: 'anchor-smash', name: 'Anchor Smash', current: 'wave', cost: 3, kind: 'spell', keywords: [], text: 'Deal 4 damage to a creature.', copies: 1 },
  { id: 'storm-surge', name: 'Storm Surge', current: 'storm', cost: 5, kind: 'spell', keywords: [], text: 'Deal 2 damage to all enemy creatures.', copies: 1 },
  // Not in the deck: the Tide Coin is the second player's opening bonus, one free
  // mana to make up for going second.
  { id: 'tide-coin', name: 'Tide Coin', current: 'wave', cost: 0, kind: 'spell', keywords: [], text: 'Gain 1 mana this turn.', copies: 0 },
];

export function deckSize() {
  return CARD_DEFS.reduce((total, def) => total + def.copies, 0);
}

export const CARD_DEFS_BY_ID = Object.fromEntries(CARD_DEFS.map((def) => [def.id, def]));

// A fresh 30-card deck: every definition repeated by its copies, then shuffled.
export function buildDeck(rng) {
  const cards = [];
  for (const def of CARD_DEFS) {
    for (let copy = 0; copy < def.copies; copy += 1) cards.push(def);
  }
  return rng.shuffle(cards);
}

// A card as it exists in a hand or on the table: its own health and attack, so
// buffs and damage never touch the shared definition.
export function createCardInstance(def, uid) {
  return {
    uid,
    def,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    canAttack: false,
    justPlayed: true,
  };
}
