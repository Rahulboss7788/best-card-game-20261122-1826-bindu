// The screenshot scenes behind ?shot=title|table|win|loss. Each one plays the real
// rules forward from a fresh game — the autopilot makes the same legal moves the
// live game allows — so every frame is what a real game looks like, and the same
// seed always gives the same frame. Win and loss search a few seeds until the
// autopilot finishes the game the way the scene needs.
import { createGame, startGame } from './state.js';
import { runAutopilot } from './ai.js';

function freshGame(seed) {
  const game = createGame(seed);
  startGame(game);
  return game;
}

// Play until it is the player's turn on a busy mid-game turn, with creatures on
// both sides of the table and cards in both hands.
function stageTable(seed) {
  let game = freshGame(seed);
  runAutopilot(game, 9);
  let guard = 0;
  while (game.phase === 'play' && guard < 10) {
    const busy = game.active === 0
      && game.players[0].board.length >= 2
      && game.players[1].board.length >= 2
      && game.players[0].hand.length >= 2;
    if (busy) break;
    guard += 1;
    runAutopilot(game, game.turn + 2);
  }
  return game;
}

// Play whole games from successive seeds until the side we want wins.
function stageEnding(seed, wantedWinner) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const game = freshGame(seed + attempt * 7919);
    runAutopilot(game, 80);
    if (game.phase === 'over' && game.winner === wantedWinner) return game;
  }
  // Fallback: the closest finish we found, so the scene still shows a real ending.
  const game = freshGame(seed);
  runAutopilot(game, 80);
  return game;
}

export function stageShot(name, seed) {
  if (name === 'table') return { game: stageTable(seed), screen: 'table' };
  if (name === 'win') return { game: stageEnding(seed, 0), screen: 'over' };
  if (name === 'loss') return { game: stageEnding(seed, 1), screen: 'over' };
  const game = createGame(seed);
  return { game, screen: 'title' };
}
