export interface HighscoreEntry {
  name: string;
  score: number;
  createdAt: string;
}

export interface HudSnapshot {
  lives: number;
  score: number;
}

export interface GameResult {
  score: number;
  defeatedEnemies: number;
  collectedCoins: number;
  durationSeconds: number;
  completed: boolean;
}

export interface GameBridge {
  onHudChange(snapshot: HudSnapshot): void;
  onGameOver(result: GameResult): void;
}
