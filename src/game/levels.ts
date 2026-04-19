export interface LevelConfig {
  number: number;
  label: string;
  musicKey: string;
  movement: {
    walkSpeed: number;
    runSpeed: number;
    groundAcceleration: number;
    groundDeceleration: number;
    airAcceleration: number;
  };
  segmentWidths: number[];
  segmentHeights: number[];
  segmentGaps: number[];
  initialFoxRange: {
    startIndex: number;
    endIndex: number;
  };
  foxSpawnDelay: number;
  eagleSpawnDelay: number;
}

function createLevel(
  number: number,
  musicKey: string,
  movement: LevelConfig["movement"],
  segmentWidths: number[],
  segmentHeights: number[],
  segmentGaps: number[],
  foxSpawnDelay: number,
  eagleSpawnDelay: number
): LevelConfig {
  return {
    number,
    label: `Level ${number}`,
    musicKey,
    movement,
    segmentWidths,
    segmentHeights,
    segmentGaps,
    initialFoxRange: {
      startIndex: 2,
      endIndex: 5
    },
    foxSpawnDelay,
    eagleSpawnDelay
  };
}

export const LEVELS: LevelConfig[] = [
  createLevel(
    1,
    "bgm-level-1",
    {
      walkSpeed: 240,
      runSpeed: 340,
      groundAcceleration: 2400,
      groundDeceleration: 2200,
      airAcceleration: 1600
    },
    [520, 430, 510, 360, 540, 420, 500, 390, 580, 440, 520, 460],
    [430, 398, 364, 404, 380, 342, 392, 358, 420, 372, 336, 390],
    [0, 120, 145, 130, 180, 135, 165, 120, 170, 135, 190, 0],
    9200,
    12500
  ),
  createLevel(
    2,
    "bgm-level-2",
    {
      walkSpeed: 235,
      runSpeed: 325,
      groundAcceleration: 780,
      groundDeceleration: 260,
      airAcceleration: 620
    },
    [500, 390, 540, 340, 560, 410, 470, 420, 520, 400, 560, 440],
    [424, 388, 352, 412, 370, 338, 398, 350, 414, 364, 330, 384],
    [0, 130, 160, 120, 190, 145, 175, 125, 185, 140, 180, 0],
    8400,
    11400
  )
];

export function getLevelWorldWidth(level: LevelConfig) {
  return level.segmentWidths.reduce((total, width, index) => total + width + level.segmentGaps[index], 0);
}

export function isValidLevelNumber(level: number) {
  return Number.isInteger(level) && level >= 1 && level <= LEVELS.length;
}

export function getLevelIndex(levelNumber: number) {
  return LEVELS.findIndex((level) => level.number === levelNumber);
}
