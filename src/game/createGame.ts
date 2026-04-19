import Phaser from "phaser";
import type { GameBridge } from "./types";
import { BootScene } from "./scenes/BootScene";
import { PlayScene } from "./scenes/PlayScene";

let runtimeBridge: GameBridge | null = null;

export function getRuntimeBridge() {
  if (!runtimeBridge) {
    throw new Error("Game bridge is not initialized.");
  }

  return runtimeBridge;
}

export function createGame(containerId: string, bridge: GameBridge) {
  runtimeBridge = bridge;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: containerId,
    width: 960,
    height: 540,
    backgroundColor: "#9ce7ff",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1300 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, PlayScene]
  });
}
