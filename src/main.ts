import "../styles/main.scss";
import type Phaser from "phaser";
import { createGame } from "./game/createGame";
import { loadHighscores, saveHighscore } from "./game/highscores";
import type { GameResult, HighscoreEntry } from "./game/types";

const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button");
const saveScoreButton = document.querySelector<HTMLButtonElement>("#save-score-button");
const menuOverlay = document.querySelector<HTMLElement>("#menu-overlay");
const gameOverOverlay = document.querySelector<HTMLElement>("#game-over-overlay");
const highscoreLists = document.querySelectorAll<HTMLOListElement>(".highscore-list");
const hud = document.querySelector<HTMLElement>("#hud");
const hudLives = document.querySelector<HTMLElement>("#hud-lives");
const hudScore = document.querySelector<HTMLElement>("#hud-score");
const nameInput = document.querySelector<HTMLInputElement>("#player-name");
const gameOverTitle = document.querySelector<HTMLElement>("#game-over-title");
const gameOverSummary = document.querySelector<HTMLElement>("#game-over-summary");

let game: Phaser.Game | null = null;
let lastResult: GameResult | null = null;
let hasSavedCurrentScore = false;

function renderHighscores(scores: HighscoreEntry[]) {
  if (highscoreLists.length === 0) {
    return;
  }

  highscoreLists.forEach((highscoreList) => {
    highscoreList.innerHTML = "";

    scores.forEach((entry, index) => {
      const item = document.createElement("li");
      item.textContent = `${index + 1}. ${entry.name} - ${entry.score} p`;
      highscoreList.appendChild(item);
    });
  });
}

function setHud(lives: number, score: number) {
  if (hudLives) {
    hudLives.textContent = String(lives);
  }

  if (hudScore) {
    hudScore.textContent = String(score);
  }
}

function openMenu() {
  menuOverlay?.classList.add("overlay--visible");
  gameOverOverlay?.classList.remove("is-open");
  hud?.classList.add("hud--hidden");
}

function openGameOver(result: GameResult) {
  lastResult = result;
  hasSavedCurrentScore = false;
  if (gameOverTitle) {
    gameOverTitle.textContent = result.completed ? "Game Complete" : "Game Over";
  }

  if (gameOverSummary) {
    const intro = result.completed ? "Game complete! " : "";
    gameOverSummary.textContent =
      `${intro}Du fick ${result.score} poang. ` +
      `Mynt: ${result.collectedCoins}, besegrade fiender: ${result.defeatedEnemies}, tid: ${result.durationSeconds}s.`;
  }

  gameOverOverlay?.classList.add("is-open");
  hud?.classList.add("hud--hidden");
}

function closeOverlaysForGame() {
  menuOverlay?.classList.remove("overlay--visible");
  gameOverOverlay?.classList.remove("is-open");
  hud?.classList.remove("hud--hidden");
}

function destroyRunningGame() {
  if (!game) {
    return;
  }

  game.destroy(true);
  game = null;
}

function startGame() {
  destroyRunningGame();
  closeOverlaysForGame();
  setHud(3, 0);

  game = createGame("game-container", {
    onHudChange(snapshot) {
      setHud(snapshot.lives, snapshot.score);
    },
    onGameOver(result) {
      openGameOver(result);
    }
  });
}

function saveScore() {
  if (!lastResult || hasSavedCurrentScore) {
    return;
  }

  const scores = saveHighscore(nameInput?.value ?? "", lastResult.score);
  renderHighscores(scores);
  hasSavedCurrentScore = true;
}

renderHighscores(loadHighscores());
openMenu();

startButton?.addEventListener("click", startGame);
restartButton?.addEventListener("click", startGame);
saveScoreButton?.addEventListener("click", saveScore);
nameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveScore();
  }
});
