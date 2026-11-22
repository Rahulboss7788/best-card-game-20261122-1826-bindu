// The table, drawn as DOM: every card, creature, life total and mana crystal is a
// real element, so values stay readable at any size and the screenshots show the
// game itself. renderApp rebuilds the view from the game state on every change;
// clicks are handled by delegation in main.js through data-action attributes.
import { CURRENTS } from './cards.js';
import { HERO_POWER_COST, MAX_BOARD } from './state.js';

function currentOf(card) {
  return CURRENTS[card.def.current];
}

function manaDots(player) {
  let dots = '';
  for (let index = 0; index < 10; index += 1) {
    const filled = index < player.mana;
    const owned = index < player.maxMana;
    dots += `<span class="mana-dot${filled ? ' filled' : ''}${owned ? '' : ' locked'}"></span>`;
  }
  return `<span class="mana">${dots}<b>${player.mana}/${player.maxMana}</b></span>`;
}

function heroHtml(game, index, ui) {
  const player = game.players[index];
  const isFoe = index === 1;
  const active = game.active === index && game.phase === 'play';
  const targetable = ui.targeting && ui.targeting.targets.some((t) => t.type === 'hero' && t.owner === index);
  return `<div class="hero${isFoe ? ' foe' : ' mine'}${active ? ' active' : ''}${targetable ? ' targetable' : ''}"
      data-action="hero" data-owner="${index}">
    <div class="hero-face">${isFoe ? '♛' : '⚓'}</div>
    <div class="hero-info">
      <div class="hero-name">${player.name}</div>
      <div class="hero-sub">${isFoe ? 'Queen of the Reef' : 'Tidecaller'}</div>
    </div>
    <div class="hero-life" title="Life">♥ ${player.life}</div>
    ${manaDots(player)}
  </div>`;
}

function cardFace(card, options) {
  const current = currentOf(card);
  const playable = options.playable ? ' playable' : '';
  const selected = options.selected ? ' selected' : '';
  const dimmed = options.dimmed ? ' dimmed' : '';
  const targetable = options.targetable ? ' targetable' : '';
  const guard = (card.def.keywords ?? []).includes('Guard');
  const stats = card.def.kind === 'creature'
    ? `<span class="stat atk" title="Attack">${card.attack}</span><span class="stat hp" title="Health">${card.health}</span>`
    : '';
  const keywords = (card.def.keywords ?? []).length > 0
    ? `<div class="keywords">${card.def.keywords.join(' · ')}</div>` : '';
  const action = options.action ?? 'card';
  return `<div class="card${playable}${selected}${dimmed}${targetable}" style="--suit:${current.colour}"
      data-action="${action}" data-uid="${card.uid}" title="${card.def.name} — ${card.def.text}">
    <div class="card-top"><span class="card-cost">${card.def.cost}</span><span class="card-current" title="${current.name}">${current.glyph} ${current.name}</span></div>
    <div class="card-name">${card.def.name}</div>
    <div class="card-art"><span class="art-glyph">${current.glyph}</span><span class="art-kind">${card.def.kind}</span></div>
    ${keywords}
    <div class="card-text">${card.def.text}</div>
    ${stats}
  </div>`;
}

function creatureMini(game, index, creature, ui) {
  const current = currentOf(creature);
  const mine = index === 0;
  const selectable = mine && game.phase === 'play' && game.active === 0 && creature.canAttack;
  const selected = ui.selectedAttackerUid === creature.uid;
  const guard = (creature.def.keywords ?? []).includes('Guard');
  const targetable = ui.targeting && ui.targeting.targets.some((t) => t.type === 'creature' && t.uid === creature.uid);
  const attackable = ui.selectedAttackerUid !== null && !mine && game.phase === 'play' && game.active === 0
    && (guard || game.players[1].board.every((c) => !(c.def.keywords ?? []).includes('Guard')));
  const resting = mine && !creature.canAttack;
  return `<div class="creature${selectable ? ' can-attack' : ''}${selected ? ' selected' : ''}${targetable || attackable ? ' targetable' : ''}${guard ? ' guard' : ''}${resting ? ' resting' : ''}"
      style="--suit:${current.colour}" data-action="creature" data-uid="${creature.uid}" data-owner="${index}"
      title="${creature.def.name} — ${creature.def.text}">
    <div class="creature-cost">${creature.def.cost}</div>
    <div class="creature-glyph">${current.glyph}</div>
    <div class="creature-name">${creature.def.name}</div>
    ${guard ? '<div class="guard-tag">GUARD</div>' : ''}
    ${resting ? '<div class="rest-tag">RESTING</div>' : ''}
    <span class="stat atk">${creature.attack}</span><span class="stat hp">${creature.health}</span>
  </div>`;
}

function boardHtml(game, index, ui) {
  const board = game.players[index].board;
  let cells = '';
  for (let slot = 0; slot < MAX_BOARD; slot += 1) {
    const creature = board[slot];
    cells += creature ? creatureMini(game, index, creature, ui) : '<div class="slot"></div>';
  }
  return `<div class="board${index === 1 ? ' foe-board' : ' my-board'}">${cells}</div>`;
}

function handHtml(game, index, ui) {
  const player = game.players[index];
  if (index === 1) {
    let backs = '';
    for (let count = 0; count < player.hand.length; count += 1) {
      backs += '<div class="card-back">≋</div>';
    }
    return `<div class="hand foe-hand">${backs}<span class="hand-count">${player.hand.length} cards · ${player.deck.length} left in deck</span></div>`;
  }
  const myTurn = game.phase === 'play' && game.active === 0;
  let cards = '';
  for (const card of player.hand) {
    const affordable = card.def.cost <= player.mana;
    const discarding = game.awaitingDiscard !== null;
    cards += cardFace(card, {
      playable: myTurn && affordable && !discarding,
      dimmed: myTurn && !affordable && !discarding,
      selected: ui.selectedCardUid === card.uid,
      action: discarding ? 'discard' : 'card',
    });
  }
  return `<div class="hand my-hand">${cards}<span class="hand-count">${player.hand.length} cards · ${player.deck.length} left in deck</span></div>`;
}

function logHtml(game) {
  const lines = game.log.slice(-14).map((line) => `<div class="log-line">${line}</div>`).join('');
  return `<div class="log"><div class="log-title">Tide log</div>${lines}</div>`;
}

function bannerHtml(ui) {
  if (ui.banner) return `<div class="banner">${ui.banner}</div>`;
  return '';
}

function tableHtml(game, ui) {
  const myTurn = game.phase === 'play' && game.active === 0;
  const heroPowerDisabled = !myTurn || game.players[0].heroPowerUsed || game.players[0].mana < HERO_POWER_COST || game.awaitingDiscard !== null;
  const endDisabled = !myTurn || game.awaitingDiscard !== null;
  const turnLabel = game.phase === 'play'
    ? (myTurn ? 'Your turn — play cards, attack, end the turn' : 'Maris is playing…')
    : 'Game over';
  return `<div class="layout">
    <div class="table">
      <header class="topbar">
        <span class="brand">TIDEBOUND</span>
        <span class="turn-label">${turnLabel}</span>
        <span class="top-actions">
          <button data-action="help">How to play</button>
          <button data-action="restart">Restart</button>
        </span>
      </header>
      ${bannerHtml(ui)}
      <div class="side-row">${heroHtml(game, 1, ui)}${handHtml(game, 1, ui)}</div>
      ${boardHtml(game, 1, ui)}
      <div class="midrow">
        <button class="hero-power" data-action="hero-power" ${heroPowerDisabled ? 'disabled' : ''}>
          Riptide · ${HERO_POWER_COST} mana — deal 1 damage to the enemy hero
          ${game.players[0].heroPowerUsed ? '(used)' : ''}
        </button>
        <button class="end-turn" data-action="end-turn" ${endDisabled ? 'disabled' : ''}>End turn ⏎</button>
      </div>
      ${boardHtml(game, 0, ui)}
      <div class="side-row">${heroHtml(game, 0, ui)}${handHtml(game, 0, ui)}</div>
    </div>
    <aside class="sidebar">${logHtml(game)}
      <div class="tip">Tip: Guard creatures must be attacked first. Surge cards reward playing
      a cheap card first. Your hero power deals 1 damage for 2 mana, once a turn.</div>
    </aside>
  </div>`;
}

function titleHtml(ui) {
  return `<div class="title-screen">
    <div class="title-kicker">A mana-duel card game</div>
    <h1 class="title-name">TIDEBOUND</h1>
    <p class="title-sub">Summon tide creatures, cast current spells, and sink the Reef Queen's
    30 life before she sinks yours.</p>
    <button class="play-button" data-action="play">▶&nbsp; Play against Maris</button>
    <div class="title-record">This visit: ${ui.wins} wins · ${ui.losses} losses</div>
    <div class="rules">
      <div class="rule"><b>Each turn</b> gain +1 mana (max 10) and draw a card.</div>
      <div class="rule"><b>Play cards</b> by clicking them; creatures attack the turn after, unless Swift.</div>
      <div class="rule"><b>Attack</b> by clicking your creature, then an enemy creature or hero.</div>
      <div class="rule"><b>Guard</b> creatures must be attacked first. <b>Surge</b> cards are stronger when another card was played first.</div>
      <div class="rule"><b>Riptide</b> hero power: 2 mana, once a turn, 1 damage to the enemy hero.</div>
      <div class="rule"><b>Win</b> by reducing Maris to 0 life. Empty deck? Each draw then hurts.</div>
      <div class="rule"><b>Second player</b> Maris holds a Tide Coin: 1 free mana to make up for going second.</div>
    </div>
    <p class="title-foot">Four currents — Wave, Coral, Storm, Deep — thirty cards, endless tides.</p>
  </div>`;
}

function endHtml(game, ui) {
  const won = game.winner === 0;
  const stats = game.stats;
  return `<div class="end-screen${won ? ' won' : ' lost'}">
    <h1>${won ? 'VICTORY' : 'DEFEAT'}</h1>
    <p class="end-sub">${won
    ? 'The tide is yours. Maris bows to the new Tidecaller.'
    : 'The reef claims another. The tide will turn — try again.'}</p>
    <div class="end-stats">
      <div><b>${stats.turns}</b><span>turns</span></div>
      <div><b>${stats.cardsPlayed}</b><span>cards played</span></div>
      <div><b>${stats.damageDealt[0]}</b><span>damage you dealt</span></div>
      <div><b>${game.players[1].life}</b><span>Maris's life left</span></div>
    </div>
    <button class="play-button" data-action="play">▶&nbsp; Play again</button>
    <button class="ghost-button" data-action="title">Back to title</button>
    <div class="title-record">This visit: ${ui.wins} wins · ${ui.losses} losses</div>
  </div>`;
}

function helpHtml() {
  return `<div class="help-overlay" data-action="close-help">
    <div class="help-card" data-action="none">
      <h2>How to play Tidebound</h2>
      <p>Both heroes have <b>30 life</b>. Each turn you gain <b>+1 mana</b> (up to 10) and draw a card.</p>
      <p><b>Play a card:</b> click it in your hand. Creatures join your side of the table; spells resolve at once.
      Spells that need a target ask you to click one — click anywhere else, or press Esc, to cancel.</p>
      <p><b>Attack:</b> click one of your creatures that can attack (glowing), then click an enemy creature or
      Maris herself. Creatures strike back: both take damage. A creature with <b>Guard</b> must be attacked first.</p>
      <p><b>Keywords:</b> Swift attacks the turn it is played. Surge is stronger when you already played a card
      this turn. Tidal Bargain draws 2 and makes you discard 1 — choose wisely.</p>
      <p><b>Hero power Riptide:</b> 2 mana, once a turn, 1 damage to the enemy hero.</p>
      <p><b>Win</b> by taking Maris to 0 life. If your deck runs out, every further draw hurts.</p>
      <p>Keyboard: <b>Space</b> starts, <b>E</b> ends the turn, <b>Esc</b> cancels a choice.</p>
      <button class="play-button" data-action="close-help">Got it</button>
    </div>
  </div>`;
}

export function renderApp(root, game, ui) {
  let html = '';
  if (ui.screen === 'title') html = titleHtml(ui);
  else if (ui.screen === 'over') html = endHtml(game, ui);
  else html = tableHtml(game, ui);
  if (ui.helpOpen) html += helpHtml();
  root.innerHTML = html;
  const status = document.getElementById('status');
  if (status) {
    status.textContent = ui.screen === 'title'
      ? 'Tidebound. Press Space or click Play to start.'
      : ui.screen === 'over'
        ? (game.winner === 0 ? 'Victory. The tide is yours.' : 'Defeat. The reef claims another.')
        : `Turn ${game.turn}. ${game.active === 0 ? 'Your turn.' : "Maris's turn."} Your life ${game.players[0].life}, Maris ${game.players[1].life}.`;
  }
}
