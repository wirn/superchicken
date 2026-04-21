import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.load.spritesheet("chicken", "/assets/chicken-run.svg", {
      frameWidth: 192,
      frameHeight: 192
    });
    this.load.spritesheet("eagle", "/assets/eagle.svg", {
      frameWidth: 300,
      frameHeight: 300
    });
    this.load.spritesheet("mushroom", "/assets/mushroom.svg", {
      frameWidth: 450,
      frameHeight: 420
    });
    this.load.spritesheet("snowman", "/assets/snowman.svg", {
      frameWidth: 450,
      frameHeight: 420
    });
    this.load.spritesheet("cactus", "/assets/cactus.svg", {
      frameWidth: 600,
      frameHeight: 520
    });
    this.load.spritesheet("fox", "/assets/fox.svg", {
      frameWidth: 300,
      frameHeight: 300
    });
    this.load.audio("coin-sfx", "/assets/sound/coin.mp3");
    this.load.audio("complete-sfx", "/assets/sound/complete.mp3");
    this.load.audio("damage-sfx", "/assets/sound/damage.mp3");
    this.load.audio("death-sfx", "/assets/sound/death.mp3");
    this.load.audio("bgm-level-1", "/assets/sound/background1.mp3");
    this.load.audio("bgm-level-2", "/assets/sound/background2.mp3");
    this.load.audio("jump-sfx", "/assets/sound/jump.mp3");
    this.load.audio("stomp-sfx", "/assets/sound/stomp.mp3");
    this.load.svg("castle", "/assets/castle.svg", {
      width: 160,
      height: 160
    });
    this.load.svg("icicle", "/assets/icicle.svg", {
      width: 72,
      height: 144
    });
  }

  create() {
    this.createTextures();
    this.scene.start("play");
  }

  private createTextures() {
    const graphics = this.add.graphics();

    graphics.clear();
    graphics.fillStyle(0x59b54c, 1);
    graphics.fillRoundedRect(0, 0, 128, 32, 8);
    graphics.fillStyle(0x8b5734, 1);
    graphics.fillRect(0, 24, 128, 8);
    graphics.generateTexture("ground", 128, 32);

    graphics.clear();
    graphics.fillStyle(0xbfefff, 1);
    graphics.fillRoundedRect(0, 0, 128, 32, 8);
    graphics.fillStyle(0xeefcff, 1);
    graphics.fillRoundedRect(0, 0, 128, 12, 8);
    graphics.fillStyle(0x8ed4f5, 1);
    graphics.fillRect(0, 24, 128, 8);
    graphics.generateTexture("ground-ice", 128, 32);

    graphics.clear();
    graphics.fillStyle(0xffd84a, 1);
    graphics.fillCircle(12, 12, 10);
    graphics.lineStyle(3, 0xffef9f, 1);
    graphics.strokeCircle(12, 12, 10);
    graphics.generateTexture("coin", 24, 24);

    graphics.clear();
    graphics.fillStyle(0x3fa75c, 1);
    graphics.fillCircle(18, 16, 12);
    graphics.fillCircle(34, 16, 12);
    graphics.fillCircle(26, 24, 14);
    graphics.fillStyle(0x2f7a42, 1);
    graphics.fillRect(18, 24, 16, 10);
    graphics.generateTexture("bush", 52, 40);

    graphics.clear();
    graphics.fillStyle(0x87c97a, 1);
    graphics.fillEllipse(80, 50, 160, 70);
    graphics.generateTexture("hill", 160, 80);

    graphics.destroy();
  }
}
