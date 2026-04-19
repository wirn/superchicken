import "../styles/main.scss";
import "../styles/level-2.scss";
import type Phaser from "phaser";
import { createGame } from "./game/createGame";
import { loadHighscores, saveHighscore } from "./game/highscores";
import { isValidLevelNumber } from "./game/levels";
import type { GameResult, HighscoreEntry } from "./game/types";

const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button");
const saveScoreButton = document.querySelector<HTMLButtonElement>("#save-score-button");
const menuOverlay = document.querySelector<HTMLElement>("#menu-overlay");
const gameOverOverlay = document.querySelector<HTMLElement>("#game-over-overlay");
const highscoreLists = document.querySelectorAll<HTMLOListElement>(".highscore-list");
const hud = document.querySelector<HTMLElement>("#hud");
const hudLevel = document.querySelector<HTMLElement>("#hud-level");
const hudLives = document.querySelector<HTMLElement>("#hud-lives");
const hudScore = document.querySelector<HTMLElement>("#hud-score");
const nameInput = document.querySelector<HTMLInputElement>("#player-name");
const gameOverTitle = document.querySelector<HTMLElement>("#game-over-title");
const gameOverSummary = document.querySelector<HTMLElement>("#game-over-summary");

let game: Phaser.Game | null = null;
let lastResult: GameResult | null = null;
let hasSavedCurrentScore = false;

function getDebugStartLevel() {
  if (!import.meta.env.DEV) {
    return 1;
  }

  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (!levelParam) {
    return 1;
  }

  const parsedLevel = Number(levelParam);
  return isValidLevelNumber(parsedLevel) ? parsedLevel : 1;
}

function syncLevelClass(level: number) {
  document.body.classList.toggle("level-2", level === 2);
}

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

function setHud(level: number, levelLabel: string, lives: number, score: number) {
  syncLevelClass(level);

  if (hudLevel) {
    hudLevel.textContent = levelLabel;
  }

  if (hudLives) {
    hudLives.textContent = String(lives);
  }

  if (hudScore) {
    hudScore.textContent = String(score);
  }
}

function openMenu() {
  syncLevelClass(0);
  menuOverlay?.classList.add("overlay--visible");
  gameOverOverlay?.classList.remove("is-open");
  hud?.classList.add("hud--hidden");
}

function openGameOver(result: GameResult) {
  lastResult = result;
  hasSavedCurrentScore = false;
  syncLevelClass(0);
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
  const startLevel = getDebugStartLevel();
  setHud(startLevel, `Level ${startLevel}`, 3, 0);

  game = createGame("game-container", {
    onHudChange(snapshot) {
      setHud(snapshot.level, snapshot.levelLabel, snapshot.lives, snapshot.score);
    },
    onGameOver(result) {
      openGameOver(result);
    }
  }, {
    startLevel
  });
}

function shouldStartFromMenu(event: KeyboardEvent) {
  if (!menuOverlay?.classList.contains("overlay--visible")) {
    return false;
  }

  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    return false;
  }

  return event.key === " " || event.key === "Spacebar" || event.key === "ArrowRight";
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
document.addEventListener("keydown", (event) => {
  if (!shouldStartFromMenu(event)) {
    return;
  }

  event.preventDefault();
  startGame();
});
