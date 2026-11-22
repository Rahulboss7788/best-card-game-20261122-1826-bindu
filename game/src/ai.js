// Maris, the Reef Queen, and the autopilot that stages screenshots. One step at a
// time: aiStep plays a single card, fires the hero power, makes one attack, or says
// it is done, so the live game can animate each choice and the player can read it.
// The same steps drive both sides when the game plays itself for a screenshot.
import {
  attack,
  discardCard,
  endTurn,
  faceDamage,
  needsTarget,
  playCard,
  spellTargets,
  useHeroPower,
} from './state.js';

function hasKeyword(card, keyword) {
  return (card.def.keywords ?? []).includes(keyword);
}

// Score a playable card in the current position; null means "do not play it now".
// Returns the card, the target a targeted spell needs, and the score.
function bestPlay(game, index) {
  const me = game.players[index];
  const foe = game.players[index === 0 ? 1 : 0];
  let best = null;
  function consider(card, target, score) {
    if (score === null) return;
    if (best === null || score > best.score) best = { card, target, score };
  }
  for (const card of me.hand) {
    if (card.def.cost > me.mana) continue;
    if (card.def.kind === 'creature') {
      if (me.board.length >= 7) continue;
      let score = card.def.attack + card.def.health;
      if (hasKeyword(card, 'Guard')) score += 1;
      if (hasKeyword(card, 'Swift')) score += 0.5;
      if (hasKeyword(card, 'Surge') && game.cardsPlayedThisTurn >= 1) score += 2;
      if (card.def.id === 'moon-jelly' && me.life >= 30) score -= 1;
      consider(card, null, score);
      continue;
    }
    switch (card.def.id) {
      case 'riptide-blast': {
        const targets = spellTargets(game, index, card);
        const big = foe.board.filter((c) => c.attack >= 4).sort((a, b) => b.attack - a.attack)[0];
        if (big) consider(card, { type: 'creature', owner: index === 0 ? 1 : 0, uid: big.uid }, 6);
        else if (foe.life <= 3) consider(card, { type: 'hero', owner: index === 0 ? 1 : 0 }, 6);
        else {
          const any = foe.board.sort((a, b) => b.attack - a.attack)[0];
          if (any && any.attack >= 2) consider(card, { type: 'creature', owner: index === 0 ? 1 : 0, uid: any.uid }, 3.5);
          else consider(card, { type: 'hero', owner: index === 0 ? 1 : 0 }, 1.0);
        }
        break;
      }
      case 'anchor-smash': {
        const target = foe.board.slice().sort((a, b) => b.attack - a.attack)[0];
        if (target) consider(card, { type: 'creature', owner: index === 0 ? 1 : 0, uid: target.uid }, 2 + target.attack);
        break;
      }
      case 'healing-current':
        consider(card, null, me.life <= 16 ? 5 : null);
        break;
      case 'tidal-bargain':
        consider(card, null, me.hand.length <= 5 ? 4 : 2);
        break;
      case 'mana-bloom': {
        const enabled = me.hand.some((c) => c !== card && c.def.cost > me.mana && c.def.cost <= me.mana + 2);
        consider(card, null, enabled ? 3 : null);
        break;
      }
      case 'tide-coin': {
        const enabled = me.hand.some((c) => c !== card && c.def.cost > me.mana && c.def.cost <= me.mana + 1);
        consider(card, null, enabled ? 2.5 : null);
        break;
      }
      case 'coral-shield': {
        const target = me.board.slice().sort((a, b) => b.attack - a.attack)[0];
        if (target) consider(card, { type: 'creature', owner: index, uid: target.uid }, 3);
        break;
      }
      case 'storm-surge':
        consider(card, null, foe.board.length >= 2 ? 4.5 : foe.board.some((c) => c.attack >= 4) ? 3 : null);
        break;
      default:
        break;
    }
  }
  return best;
}

// The card the AI would play next, when it is a big one — the live game shows a
// warning banner before it lands, so a huge play never comes out of nowhere.
export function aiNextBigCard(game, index) {
  const play = bestPlay(game, index);
  if (play && play.card.def.cost >= 5) return play.card;
  return null;
}

function chooseAttackTarget(game, index, attacker) {
  const foe = index === 0 ? 1 : 0;
  const enemyBoard = game.players[foe].board;
  const guards = enemyBoard.filter((c) => hasKeyword(c, 'Guard'));
  if (guards.length > 0) {
    const killable = guards.filter((c) => c.health <= attacker.attack).sort((a, b) => a.health - b.health)[0];
    const chosen = killable ?? guards.slice().sort((a, b) => b.health - a.health)[0];
    return { type: 'creature', owner: foe, uid: chosen.uid };
  }
  if (faceDamage(game, index) >= game.players[foe].life) return { type: 'hero', owner: foe };
  // Behind on the table, clear the biggest threat this creature can kill;
  // ahead, press the advantage and go for the hero.
  const ownPower = game.players[index].board.reduce((total, c) => total + c.attack, 0);
  const foePower = enemyBoard.reduce((total, c) => total + c.attack, 0);
  const prey = enemyBoard
    .filter((c) => c.health <= attacker.attack && (foePower > ownPower || c.attack >= 4) && attacker.health > c.attack)
    .sort((a, b) => b.attack - a.attack)[0];
  if (prey) return { type: 'creature', owner: foe, uid: prey.uid };
  return { type: 'hero', owner: foe };
}

// One AI action. Returns a description of what happened, or { type: 'done' }.
export function aiStep(game, index) {
  if (game.phase !== 'play' || game.active !== index) return { type: 'done' };
  const me = game.players[index];
  const foe = index === 0 ? 1 : 0;
  if (game.awaitingDiscard && game.awaitingDiscard.player === index) {
    const worst = me.hand.slice().sort((a, b) => a.def.cost - b.def.cost)[0];
    if (worst) {
      discardCard(game, index, worst.uid);
      return { type: 'discard', name: worst.def.name };
    }
    return { type: 'done' };
  }
  const play = bestPlay(game, index);
  if (play && play.score >= 1.5) {
    const result = playCard(game, index, play.card.uid, play.target);
    if (result.ok) return { type: 'play', name: play.card.def.name, cost: play.card.def.cost };
  }
  const playableLeft = me.hand.some((c) => c.def.cost <= me.mana);
  if (!me.heroPowerUsed && me.mana >= 2 && (!playableLeft || game.players[foe].life <= 8)) {
    if (useHeroPower(game, index).ok) return { type: 'heroPower' };
  }
  const ready = me.board.filter((c) => c.canAttack).sort((a, b) => b.attack - a.attack);
  if (ready.length > 0) {
    const attacker = ready[0];
    const target = chooseAttackTarget(game, index, attacker);
    const result = attack(game, attacker.uid, target);
    if (result.ok) {
      return {
        type: 'attack',
        attacker: attacker.def.name,
        target: target.type === 'hero' ? game.players[foe].name : 'a creature',
      };
    }
  }
  return { type: 'done' };
}

// Play both sides until the game ends or maxTurns turns have begun. Used only to
// stage screenshot scenes; the live game never calls it.
export function runAutopilot(game, maxTurns) {
  let guard = 0;
  while (game.phase === 'play' && game.turn < maxTurns && guard < 5000) {
    guard += 1;
    const side = game.active;
    let steps = 0;
    while (game.phase === 'play' && game.active === side && steps < 60) {
      steps += 1;
      if (aiStep(game, side).type === 'done') break;
    }
    if (game.phase === 'play' && game.active === side) endTurn(game);
  }
  return game;
}
