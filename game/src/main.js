// Boot and the one interaction loop: clicks and keys drive the game, Maris's turn
// runs as visible steps with a short pause between them, and the table repaints
// after every move. ?seed=N fixes the shuffle; ?shot=title|table|win|loss stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { createGame, startGame, playCard, attack, useHeroPower, endTurn, discardCard, spellTargets, needsTarget } from './state.js';
import { aiNextBigCard, aiStep } from './ai.js';
import { renderApp } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const app = document.getElementById('app');
const ui = {
  screen: 'title',
  selectedCardUid: null,
  selectedAttackerUid: null,
  targeting: null,
  banner: null,
  helpOpen: false,
  aiBusy: false,
  wins: 0,
  losses: 0,
};
let game = createGame(seed);
let bannerTimer = null;

// Exposed for play-testing and debugging from the browser console.
window.__game = game;
window.__ui = ui;

function sleep(milliseconds) {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds); });
}

function showBanner(text, milliseconds = 2600) {
  ui.banner = text;
  render();
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    ui.banner = null;
    render();
  }, milliseconds);
}

function render() {
  window.__game = game;
  renderApp(app, game, ui);
}

function clearChoices() {
  ui.selectedCardUid = null;
  ui.selectedAttackerUid = null;
  ui.targeting = null;
}

function checkOver() {
  if (game.phase === 'over') {
    clearChoices();
    ui.screen = 'over';
    if (game.winner === 0) ui.wins += 1;
    else ui.losses += 1;
    render();
    return true;
  }
  return false;
}

function newGame() {
  game = createGame(Math.floor(Math.random() * 4294967296));
  startGame(game);
  clearChoices();
  ui.screen = 'table';
  ui.aiBusy = false;
  render();
}

async function runAiTurn() {
  ui.aiBusy = true;
  render();
  await sleep(700);
  while (game.phase === 'play' && game.active === 1) {
    const big = aiNextBigCard(game, 1);
    if (big) {
      showBanner(`The tide swells — Maris is about to summon ${big.def.name} (${big.def.cost} mana)!`, 1400);
      await sleep(1300);
    }
    const step = aiStep(game, 1);
    render();
    if (step.type === 'done') break;
    await sleep(step.type === 'play' ? 850 : 650);
  }
  ui.aiBusy = false;
  if (checkOver()) return;
  if (game.phase === 'play' && game.active === 1) {
    endTurn(game);
    render();
  }
}

function tryPlayCard(uid) {
  const card = game.players[0].hand.find((c) => c.uid === uid);
  if (!card) return;
  if (needsTarget(card)) {
    ui.targeting = { card, targets: spellTargets(game, 0, card) };
    ui.selectedCardUid = uid;
    showBanner(`Choose a target for ${card.def.name} — click a glowing creature or hero (Esc to cancel).`, 5000);
    render();
    return;
  }
  const result = playCard(game, 0, uid, null);
  if (!result.ok) {
    showBanner(result.reason);
    return;
  }
  clearChoices();
  render();
  if (!checkOver() && game.phase === 'play') render();
}

function tryAttack(attackerUid, target) {
  const result = attack(game, attackerUid, target);
  if (!result.ok) {
    showBanner(result.reason);
    return;
  }
  clearChoices();
  render();
  checkOver();
}

function onClick(event) {
  const ignored = event.target.closest('[data-action="none"]');
  if (ignored) return;
  const element = event.target.closest('[data-action]');
  if (!element) {
    if (ui.targeting || ui.selectedAttackerUid !== null) {
      clearChoices();
      render();
    }
    return;
  }
  const action = element.dataset.action;
  if (action === 'close-help') {
    ui.helpOpen = false;
    render();
    return;
  }
  if (action === 'help') {
    ui.helpOpen = true;
    render();
    return;
  }
  if (action === 'play') {
    newGame();
    return;
  }
  if (action === 'title') {
    ui.screen = 'title';
    clearChoices();
    render();
    return;
  }
  if (action === 'restart') {
    newGame();
    return;
  }
  if (ui.screen !== 'table' || ui.aiBusy) return;
  if (game.phase !== 'play' || game.active !== 0) return;
  if (action === 'end-turn') {
    clearChoices();
    if (endTurn(game).ok) {
      render();
      runAiTurn();
    }
    return;
  }
  if (action === 'hero-power') {
    const result = useHeroPower(game, 0);
    if (!result.ok) showBanner(result.reason);
    else {
      render();
      checkOver();
    }
    return;
  }
  if (action === 'discard') {
    const uid = Number(element.dataset.uid);
    const result = discardCard(game, 0, uid);
    if (!result.ok) showBanner(result.reason);
    render();
    return;
  }
  if (action === 'card') {
    const uid = Number(element.dataset.uid);
    if (game.awaitingDiscard) return;
    tryPlayCard(uid);
    return;
  }
  if (action === 'creature') {
    const uid = Number(element.dataset.uid);
    const owner = Number(element.dataset.owner);
    if (ui.targeting) {
      const target = ui.targeting.targets.find((t) => t.type === 'creature' && t.uid === uid);
      if (target) {
        const cardUid = ui.targeting.card.uid;
        ui.targeting = null;
        const result = playCard(game, 0, cardUid, target);
        if (!result.ok) showBanner(result.reason);
        clearChoices();
        render();
        checkOver();
      }
      return;
    }
    if (owner === 0) {
      const creature = game.players[0].board.find((c) => c.uid === uid);
      if (creature && creature.canAttack) {
        ui.selectedAttackerUid = ui.selectedAttackerUid === uid ? null : uid;
        ui.selectedCardUid = null;
        render();
      } else if (creature) {
        showBanner(`${creature.def.name} cannot attack yet — creatures rest the turn they are played (unless Swift).`);
      }
      return;
    }
    if (ui.selectedAttackerUid !== null) {
      tryAttack(ui.selectedAttackerUid, { type: 'creature', owner: 1, uid });
    }
    return;
  }
  if (action === 'hero') {
    const owner = Number(element.dataset.owner);
    if (ui.targeting) {
      const target = ui.targeting.targets.find((t) => t.type === 'hero' && t.owner === owner);
      if (target) {
        const cardUid = ui.targeting.card.uid;
        ui.targeting = null;
        const result = playCard(game, 0, cardUid, target);
        if (!result.ok) showBanner(result.reason);
        clearChoices();
        render();
        checkOver();
      }
      return;
    }
    if (owner === 1 && ui.selectedAttackerUid !== null) {
      tryAttack(ui.selectedAttackerUid, { type: 'hero', owner: 1 });
    }
  }
}

function onKey(event) {
  if (event.key === 'Escape') {
    if (ui.helpOpen) ui.helpOpen = false;
    else clearChoices();
    render();
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    if (ui.screen === 'title' || ui.screen === 'over') {
      event.preventDefault();
      newGame();
    }
    return;
  }
  if ((event.key === 'e' || event.key === 'E') && ui.screen === 'table' && !ui.aiBusy
    && game.phase === 'play' && game.active === 0) {
    clearChoices();
    if (endTurn(game).ok) {
      render();
      runAiTurn();
    }
  }
}

function runShot(name) {
  const scene = stageShot(name, seed);
  game = scene.game;
  ui.screen = scene.screen;
  if (scene.screen === 'over') {
    if (game.winner === 0) ui.wins = 1;
    else ui.losses = 1;
  }
  let painted = 0;
  function paint() {
    render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else {
  app.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  render();
}
