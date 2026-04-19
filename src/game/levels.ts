export interface LevelConfig {
  number: number;
  label: string;
  musicKey: string;
  groundTextureKey: string;
  bounceSprite: {
    textureKey: string;
    baseScale: number;
    singleUse: boolean;
    bodySize: {
      width: number;
      height: number;
    };
    bodyOffset: {
      x: number;
      y: number;
    };
    topLandingPadding: number;
    bounceRangeX: number;
  };
  backdrop: {
    skyColor: number;
    horizonColor: number;
    hillTintA: number;
    hillTintB: number;
    cloudColor: number;
    cloudAlpha: number;
  };
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
  groundTextureKey: string,
  bounceSprite: LevelConfig["bounceSprite"],
  backdrop: LevelConfig["backdrop"],
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
    groundTextureKey,
    bounceSprite,
    backdrop,
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
    "ground",
    {
      textureKey: "mushroom",
      baseScale: 0.19,
      singleUse: false,
      bodySize: {
        width: 150,
        height: 56
      },
      bodyOffset: {
        x: 150,
        y: 338
      },
      topLandingPadding: 22,
      bounceRangeX: 72
    },
    {
      skyColor: 0x9de7ff,
      horizonColor: 0xb6ef84,
      hillTintA: 0x90d88e,
      hillTintB: 0x7ecb80,
      cloudColor: 0xffffff,
      cloudAlpha: 0.8
    },
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
    "ground-ice",
    {
      textureKey: "snowman",
      baseScale: 0.19,
      singleUse: true,
      bodySize: {
        width: 186,
        height: 58
      },
      bodyOffset: {
        x: 132,
        y: 300
      },
      topLandingPadding: 20,
      bounceRangeX: 76
    },
    {
      skyColor: 0x081a33,
      horizonColor: 0x102847,
      hillTintA: 0x2b5d7f,
      hillTintB: 0x214968,
      cloudColor: 0xc9e9ff,
      cloudAlpha: 0.22
    },
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
