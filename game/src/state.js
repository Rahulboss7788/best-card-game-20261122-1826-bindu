// Tidebound's rules, with no DOM in sight: two heroes at 30 life, mana that grows
// by 1 each turn to a cap of 10, hands, boards, combat and spells. Every function
// either applies a legal move or refuses it with a reason, so the UI, the AI and
// the screenshot stager all play through the same rules.
import { buildDeck, CARD_DEFS_BY_ID, createCardInstance } from './cards.js';
import { createRandom } from './random.js';

export const MAX_HAND = 10;
export const MAX_BOARD = 7;
export const HERO_POWER_COST = 2;
export const STARTING_LIFE = 30;

let nextUid = 1;

function createPlayer(name, rng) {
  return {
    name,
    life: STARTING_LIFE,
    mana: 0,
    maxMana: 0,
    heroPowerUsed: false,
    fatigue: 0,
    deck: buildDeck(rng),
    hand: [],
    board: [],
  };
}

export function createGame(seed) {
  const rng = createRandom(seed);
  const game = {
    seed,
    rng,
    phase: 'title',
    turn: 0,
    active: 0,
    cardsPlayedThisTurn: 0,
    awaitingDiscard: null,
    winner: null,
    log: [],
    stats: { turns: 0, cardsPlayed: 0, damageDealt: [0, 0] },
    players: [createPlayer('You', rng), createPlayer('Maris, the Reef Queen', rng)],
  };
  return game;
}

function log(game, text) {
  game.log.push(text);
  if (game.log.length > 80) game.log.shift();
}

export function other(index) {
  return index === 0 ? 1 : 0;
}

function heroName(game, index) {
  return game.players[index].name;
}

// Drawing from an empty deck hurts: fatigue grows by 1 each empty draw.
export function drawCard(game, index) {
  const player = game.players[index];
  if (player.deck.length === 0) {
    player.fatigue += 1;
    damageHero(game, index, player.fatigue, 'fatigue');
    log(game, `${heroName(game, index)} draws from an empty deck and takes ${player.fatigue} fatigue damage.`);
    return null;
  }
  const def = player.deck.pop();
  if (player.hand.length >= MAX_HAND) {
    log(game, `${heroName(game, index)} draws ${def.name}, but the hand is full — it sinks.`);
    return null;
  }
  const card = createCardInstance(def, nextUid);
  nextUid += 1;
  player.hand.push(card);
  return card;
}

export function startGame(game) {
  game.phase = 'play';
  game.turn = 0;
  game.winner = null;
  game.log = [];
  game.stats = { turns: 0, cardsPlayed: 0, damageDealt: [0, 0] };
  for (let index = 0; index < 3; index += 1) drawCard(game, 0);
  for (let index = 0; index < 4; index += 1) drawCard(game, 1);
  // Maris goes second, so she holds a Tide Coin: one free mana to spend early.
  const coinDef = CARD_DEFS_BY_ID['tide-coin'];
  game.players[1].hand.push(createCardInstance(coinDef, nextUid));
  nextUid += 1;
  log(game, 'The tide rises. You hold the first turn.');
  beginTurn(game, 0);
}

export function beginTurn(game, index) {
  const player = game.players[index];
  game.active = index;
  game.turn += 1;
  game.stats.turns += 1;
  game.cardsPlayedThisTurn = 0;
  player.maxMana = Math.min(10, player.maxMana + 1);
  player.mana = player.maxMana;
  player.heroPowerUsed = false;
  for (const creature of player.board) creature.canAttack = true;
  drawCard(game, index);
  if (game.phase === 'play') log(game, `${heroName(game, index)} begins turn ${game.turn} with ${player.mana} mana.`);
}

export function damageHero(game, index, amount, source) {
  const player = game.players[index];
  player.life = Math.max(0, player.life - amount);
  game.stats.damageDealt[other(index)] += amount;
  if (source !== 'fatigue') log(game, `${heroName(game, index)} takes ${amount} damage.`);
  checkEnd(game);
}

function damageCreature(game, owner, creature, amount) {
  creature.health -= amount;
  if (creature.health <= 0) {
    const board = game.players[owner].board;
    const at = board.indexOf(creature);
    if (at !== -1) board.splice(at, 1);
    log(game, `${creature.def.name} sinks beneath the waves.`);
  }
}

function checkEnd(game) {
  if (game.phase !== 'play') return;
  for (let index = 0; index < 2; index += 1) {
    if (game.players[index].life <= 0) {
      game.phase = 'over';
      game.winner = other(index);
      log(game, game.winner === 0 ? 'Victory! The tide is yours.' : 'Defeat. The reef claims another.');
      return;
    }
  }
}

function hasKeyword(card, keyword) {
  return (card.def.keywords ?? []).includes(keyword);
}

function guardsOf(game, index) {
  return game.players[index].board.filter((creature) => hasKeyword(creature, 'Guard'));
}

// Which targets a spell may legally choose, for the UI to highlight.
export function spellTargets(game, index, card) {
  if (card.def.id === 'riptide-blast') {
    const targets = [{ type: 'hero', owner: other(index) }];
    for (const creature of game.players[other(index)].board) targets.push({ type: 'creature', owner: other(index), uid: creature.uid });
    for (const creature of game.players[index].board) targets.push({ type: 'creature', owner: index, uid: creature.uid });
    return targets;
  }
  if (card.def.id === 'anchor-smash') {
    return game.players[other(index)].board.map((creature) => ({ type: 'creature', owner: other(index), uid: creature.uid }));
  }
  if (card.def.id === 'coral-shield') {
    return game.players[index].board.map((creature) => ({ type: 'creature', owner: index, uid: creature.uid }));
  }
  return [];
}

export function needsTarget(card) {
  return card.def.id === 'riptide-blast' || card.def.id === 'anchor-smash' || card.def.id === 'coral-shield';
}

function findCard(player, uid) {
  return player.hand.find((card) => card.uid === uid) ?? null;
}

function removeFromHand(player, uid) {
  const at = player.hand.findIndex((card) => card.uid === uid);
  if (at !== -1) player.hand.splice(at, 1);
}

function applySurge(game, index, creature, playedBefore) {
  if (!hasKeyword(creature, 'Surge')) return;
  if (playedBefore < 1) return;
  if (creature.def.id === 'surge-eel') {
    creature.attack += 2;
    creature.health += 2;
    creature.maxHealth += 2;
    log(game, `Surge! ${creature.def.name} swells to ${creature.attack}/${creature.health}.`);
  } else if (creature.def.id === 'tidecaller-adept') {
    log(game, `Surge! ${creature.def.name} calls the tide against the enemy hero.`);
    damageHero(game, other(index), 2, 'surge');
  }
}

function resolveSpell(game, index, card, target) {
  const foe = other(index);
  switch (card.def.id) {
    case 'riptide-blast': {
      if (!target) return { ok: false, reason: 'Choose a target for Riptide Blast.' };
      if (target.type === 'hero') damageHero(game, target.owner, 3, 'spell');
      else {
        const creature = game.players[target.owner].board.find((c) => c.uid === target.uid);
        if (!creature) return { ok: false, reason: 'That target is gone.' };
        damageCreature(game, target.owner, creature, 3);
      }
      log(game, `${heroName(game, index)} hurls a Riptide Blast.`);
      return { ok: true };
    }
    case 'healing-current': {
      const player = game.players[index];
      player.life = Math.min(STARTING_LIFE, player.life + 6);
      log(game, `${heroName(game, index)} is soothed by a Healing Current (+6 life).`);
      return { ok: true };
    }
    case 'tidal-bargain': {
      drawCard(game, index);
      drawCard(game, index);
      game.awaitingDiscard = { player: index, count: 1 };
      log(game, `${heroName(game, index)} strikes a Tidal Bargain: draw 2, discard 1.`);
      return { ok: true };
    }
    case 'mana-bloom': {
      game.players[index].mana += 2;
      log(game, `${heroName(game, index)} blooms an extra 2 mana this turn.`);
      return { ok: true };
    }
    case 'tide-coin': {
      game.players[index].mana += 1;
      log(game, `${heroName(game, index)} spends a Tide Coin for 1 extra mana.`);
      return { ok: true };
    }
    case 'coral-shield': {
      if (!target) return { ok: false, reason: 'Choose a friendly creature for Coral Shield.' };
      const creature = game.players[index].board.find((c) => c.uid === target.uid);
      if (!creature) return { ok: false, reason: 'That creature is gone.' };
      creature.attack += 2;
      creature.health += 2;
      creature.maxHealth += 2;
      if (!creature.def.keywords.includes('Guard')) creature.def = { ...creature.def, keywords: [...creature.def.keywords, 'Guard'] };
      log(game, `${creature.def.name} gains +2/+2 and Guard from Coral Shield.`);
      return { ok: true };
    }
    case 'anchor-smash': {
      if (!target) return { ok: false, reason: 'Choose an enemy creature for Anchor Smash.' };
      const creature = game.players[foe].board.find((c) => c.uid === target.uid);
      if (!creature) return { ok: false, reason: 'That creature is gone.' };
      damageCreature(game, foe, creature, 4);
      log(game, `${heroName(game, index)} drops an Anchor Smash.`);
      return { ok: true };
    }
    case 'storm-surge': {
      const victims = game.players[foe].board.slice();
      for (const creature of victims) damageCreature(game, foe, creature, 2);
      log(game, `A Storm Surge crashes over ${heroName(game, foe)}'s creatures.`);
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'Unknown spell.' };
  }
}

export function playCard(game, index, uid, target) {
  if (game.phase !== 'play') return { ok: false, reason: 'The game is over.' };
  if (game.active !== index) return { ok: false, reason: 'It is not your turn.' };
  if (game.awaitingDiscard) return { ok: false, reason: 'Discard a card first.' };
  const player = game.players[index];
  const card = findCard(player, uid);
  if (!card) return { ok: false, reason: 'That card is not in your hand.' };
  if (card.def.cost > player.mana) return { ok: false, reason: 'Not enough mana.' };
  if (card.def.kind === 'creature' && player.board.length >= MAX_BOARD) {
    return { ok: false, reason: 'Your side of the table is full.' };
  }
  if (needsTarget(card)) {
    const legal = spellTargets(game, index, card);
    const match = legal.find((t) => t.type === target?.type && t.owner === target?.owner && t.uid === target?.uid);
    if (!match) return { ok: false, reason: 'Choose a legal target.' };
  }
  player.mana -= card.def.cost;
  removeFromHand(player, uid);
  game.stats.cardsPlayed += 1;
  const playedBefore = game.cardsPlayedThisTurn;
  game.cardsPlayedThisTurn += 1;
  if (card.def.kind === 'creature') {
    const creature = createCardInstance(card.def, card.uid);
    creature.canAttack = hasKeyword(creature, 'Swift');
    creature.justPlayed = !creature.canAttack;
    player.board.push(creature);
    log(game, `${heroName(game, index)} plays ${card.def.name} (${card.def.cost} mana).`);
    // Surge counts cards played before this one, so pass playedBefore.
    applySurge(game, index, creature, playedBefore);
    if (card.def.id === 'pearl-diver') {
      log(game, 'Pearl Diver surfaces with a card.');
      drawCard(game, index);
    } else if (card.def.id === 'moon-jelly') {
      player.life = Math.min(STARTING_LIFE, player.life + 3);
      log(game, `Moon Jelly glows: ${heroName(game, index)} restores 3 life.`);
    }
    checkEnd(game);
    return { ok: true, played: creature };
  }
  const result = resolveSpell(game, index, card, target);
  if (!result.ok) {
    // Refund an unresolvable spell rather than eating the card.
    player.mana += card.def.cost;
    player.hand.push(card);
    game.stats.cardsPlayed -= 1;
    game.cardsPlayedThisTurn = playedBefore;
    return result;
  }
  checkEnd(game);
  return { ok: true, played: card };
}

export function attack(game, attackerUid, target) {
  if (game.phase !== 'play') return { ok: false, reason: 'The game is over.' };
  const attackerOwner = game.active;
  const attacker = game.players[attackerOwner].board.find((c) => c.uid === attackerUid);
  if (!attacker) return { ok: false, reason: 'That creature is not on your side.' };
  if (!attacker.canAttack) return { ok: false, reason: 'That creature cannot attack yet.' };
  const foe = other(attackerOwner);
  const guards = guardsOf(game, foe);
  if (target.type === 'hero') {
    if (guards.length > 0) return { ok: false, reason: 'A Guard blocks the way — attack it first.' };
    attacker.canAttack = false;
    log(game, `${attacker.def.name} strikes ${heroName(game, foe)} for ${attacker.attack}.`);
    damageHero(game, foe, attacker.attack, 'attack');
    return { ok: true };
  }
  const defender = game.players[foe].board.find((c) => c.uid === target.uid);
  if (!defender) return { ok: false, reason: 'That creature is gone.' };
  if (guards.length > 0 && !hasKeyword(defender, 'Guard')) {
    return { ok: false, reason: 'A Guard blocks the way — attack it first.' };
  }
  attacker.canAttack = false;
  log(game, `${attacker.def.name} (${attacker.attack}/${attacker.health}) trades with ${defender.def.name} (${defender.attack}/${defender.health}).`);
  const attackerAttack = attacker.attack;
  const defenderAttack = defender.attack;
  // Combat is simultaneous: both strike even if one of them falls.
  damageCreature(game, foe, defender, attackerAttack);
  damageCreature(game, attackerOwner, attacker, defenderAttack);
  checkEnd(game);
  return { ok: true };
}

export function useHeroPower(game, index) {
  if (game.phase !== 'play') return { ok: false, reason: 'The game is over.' };
  if (game.active !== index) return { ok: false, reason: 'It is not your turn.' };
  if (game.awaitingDiscard) return { ok: false, reason: 'Discard a card first.' };
  const player = game.players[index];
  if (player.heroPowerUsed) return { ok: false, reason: 'The hero power is spent this turn.' };
  if (player.mana < HERO_POWER_COST) return { ok: false, reason: 'The hero power costs 2 mana.' };
  player.mana -= HERO_POWER_COST;
  player.heroPowerUsed = true;
  log(game, `${heroName(game, index)} calls the Riptide (hero power): 1 damage to the enemy hero.`);
  damageHero(game, other(index), 1, 'hero power');
  return { ok: true };
}

export function discardCard(game, index, uid) {
  if (!game.awaitingDiscard || game.awaitingDiscard.player !== index) {
    return { ok: false, reason: 'Nothing to discard.' };
  }
  const player = game.players[index];
  const at = player.hand.findIndex((card) => card.uid === uid);
  if (at === -1) return { ok: false, reason: 'That card is not in your hand.' };
  const [discarded] = player.hand.splice(at, 1);
  game.awaitingDiscard.count -= 1;
  if (game.awaitingDiscard.count <= 0) game.awaitingDiscard = null;
  log(game, `${heroName(game, index)} discards ${discarded.def.name} to the deep.`);
  return { ok: true };
}

export function endTurn(game) {
  if (game.phase !== 'play') return { ok: false, reason: 'The game is over.' };
  if (game.awaitingDiscard) return { ok: false, reason: 'Discard a card first.' };
  log(game, `${heroName(game, game.active)} ends the turn.`);
  beginTurn(game, other(game.active));
  return { ok: true };
}

// How much damage the active side could deal to the enemy hero right now.
export function faceDamage(game, index) {
  return game.players[index].board
    .filter((creature) => creature.canAttack)
    .reduce((total, creature) => total + creature.attack, 0);
}
