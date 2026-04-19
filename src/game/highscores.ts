import type { HighscoreEntry } from "./types";

const STORAGE_KEY = "super-chicken-highscores";
const DEFAULT_SCORES: HighscoreEntry[] = [
  { name: "Nugget", score: 12, createdAt: "2026-04-01T08:00:00.000Z" },
  { name: "Pip", score: 9, createdAt: "2026-04-02T09:30:00.000Z" },
  { name: "Feather", score: 7, createdAt: "2026-04-03T10:15:00.000Z" }
];

function sortScores(scores: HighscoreEntry[]) {
  return [...scores]
    .sort((left, right) => right.score - left.score || left.createdAt.localeCompare(right.createdAt))
    .slice(0, 10);
}

export function loadHighscores(): HighscoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SCORES));
      return sortScores(DEFAULT_SCORES);
    }

    const parsed = JSON.parse(raw) as HighscoreEntry[];
    return sortScores(parsed);
  } catch {
    return sortScores(DEFAULT_SCORES);
  }
}

export function saveHighscore(name: string, score: number): HighscoreEntry[] {
  const normalizedName = name.trim() || "Anonym Kyckling";
  const nextScores = sortScores([
    ...loadHighscores(),
    {
      name: normalizedName.slice(0, 18),
      score,
      createdAt: new Date().toISOString()
    }
  ]);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScores));
  return nextScores;
}
