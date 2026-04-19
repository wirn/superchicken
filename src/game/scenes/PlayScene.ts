import Phaser from "phaser";
import { getRuntimeBridge } from "../createGame";
import type { GameResult } from "../types";

type GroundSegment = {
  x: number;
  width: number;
  y: number;
};

type EnemyKind = "fox" | "eagle";

type EnemySprite = Phaser.Physics.Arcade.Sprite & {
  enemyKind: EnemyKind;
  patrolSpeed: number;
  isStomped?: boolean;
};

type MushroomSprite = Phaser.Physics.Arcade.Sprite & {
  resetFrameTimer?: Phaser.Time.TimerEvent;
};

type CactusSprite = Phaser.Physics.Arcade.Sprite & {
  resetFrameTimer?: Phaser.Time.TimerEvent;
};

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const WORLD_WIDTH = 7400;
const RESPAWN_Y_OFFSET = 78;
const FOX_SCALE = 0.34;
const FOX_SPAWN_Y_OFFSET = 6;
const MUSHROOM_SCALE = 0.19;
const MUSHROOM_BOUNCE_VELOCITY = -760;
const CACTUS_SCALE = 0.17;
const WALK_SPEED = 240;
const RUN_SPEED = 340;

export class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private mushrooms!: Phaser.Physics.Arcade.StaticGroup;
  private cactuses!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private goal!: Phaser.Types.Physics.Arcade.ImageWithStaticBody;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bridge = getRuntimeBridge();
  private segments: GroundSegment[] = [];
  private checkpointX = 110;
  private checkpointY = 380;
  private invulnerableUntil = 0;
  private lives = 3;
  private score = 0;
  private defeatedEnemies = 0;
  private collectedCoins = 0;
  private startedAt = 0;
  private maxCameraScrollX = 0;
  private foxSpawnDelay = 9200;
  private eagleSpawnDelay = 12500;
  private difficultyLevel = 0;
  private foxTimer?: Phaser.Time.TimerEvent;
  private eagleTimer?: Phaser.Time.TimerEvent;
  private difficultyTimer?: Phaser.Time.TimerEvent;
  private gameEnded = false;

  constructor() {
    super("play");
  }

  create() {
    this.startedAt = this.time.now;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT + 220);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.createBackdrop();
    this.createWorld();
    this.createPlayer();
    this.createFoxAnimations();
    this.createEagleAnimations();
    this.createGroups();
    this.populateWorld();
    this.configureCollisions();
    this.configureInput();
    this.configureTimers();
    this.pushHud();
  }

  update() {
    if (this.gameEnded) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const moveLeft = this.keys.left.isDown;
    const moveRight = this.keys.right.isDown;
    const isSprinting = this.keys.sprint.isDown;
    const isMoving = moveLeft !== moveRight;
    const wantsJump =
      Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.jumpAlt);
    const fastFall = this.keys.down.isDown && !body.blocked.down;
    const moveSpeed = isSprinting ? RUN_SPEED : WALK_SPEED;

    if (moveLeft && !moveRight) {
      body.setVelocityX(-moveSpeed);
      this.player.setFlipX(true);
    } else if (moveRight && !moveLeft) {
      body.setVelocityX(moveSpeed);
      this.player.setFlipX(false);
    } else {
      body.setVelocityX(0);
    }

    if (wantsJump && body.blocked.down) {
      body.setVelocityY(-560);
    }

    if (fastFall) {
      body.setVelocityY(Math.min(body.velocity.y + 28, 720));
    }

    if (isMoving && body.blocked.down) {
      this.player.anims.play("chicken-run", true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(1);
    }

    if (this.time.now < this.invulnerableUntil) {
      this.player.setAlpha(Math.floor(this.time.now / 80) % 2 === 0 ? 0.45 : 1);
    } else {
      this.player.setAlpha(1);
    }

    if (this.player.y > GAME_HEIGHT + 120) {
      this.loseLife();
    }

    this.updateCheckpoint();
    this.updateEnemies();
    this.updateCamera();
  }

  private createBackdrop() {
    this.add.rectangle(WORLD_WIDTH / 2, GAME_HEIGHT / 2, WORLD_WIDTH, GAME_HEIGHT, 0x9de7ff).setScrollFactor(0);
    this.add.rectangle(WORLD_WIDTH / 2, GAME_HEIGHT - 48, WORLD_WIDTH, 96, 0xb6ef84).setScrollFactor(0.1);

    for (let index = 0; index < 12; index += 1) {
      const x = 220 + index * 560;
      const hill = this.add.image(x, 420 - (index % 2) * 40, "hill");
      hill.setScrollFactor(0.35);
      hill.setTint(index % 2 === 0 ? 0x90d88e : 0x7ecb80);
      hill.setAlpha(0.95);
    }

    for (let index = 0; index < 16; index += 1) {
      const cloud = this.add.ellipse(120 + index * 410, 70 + (index % 3) * 26, 140, 52, 0xffffff, 0.8);
      cloud.setScrollFactor(0.18);
    }
  }

  private createWorld() {
    this.platforms = this.physics.add.staticGroup();
    this.mushrooms = this.physics.add.staticGroup();
    this.cactuses = this.physics.add.staticGroup();

    const widths = [520, 430, 510, 360, 540, 420, 500, 390, 580, 440, 520, 460];
    const heights = [430, 398, 364, 404, 380, 342, 392, 358, 420, 372, 336, 390];
    const gaps = [0, 120, 145, 130, 180, 135, 165, 120, 170, 135, 190, 0];

    let cursorX = 0;
    widths.forEach((width, index) => {
      cursorX += gaps[index];
      const y = heights[index];
      this.platforms
        .create(cursorX + width / 2, y, "ground")
        .setDisplaySize(width, 48)
        .refreshBody();

      this.segments.push({ x: cursorX, width, y });
      this.decorateSegment(this.segments[this.segments.length - 1], index);
      cursorX += width;
    });

    this.createGoal();
  }

  private createGoal() {
    const finalSegment = this.segments[this.segments.length - 1];
    const goalX = finalSegment.x + finalSegment.width - 112;
    const goalY = finalSegment.y + 40;

    this.goal = this.physics.add.staticImage(goalX, goalY, "castle");
    this.goal.setOrigin(0.5, 1);
    this.goal.setDisplaySize(250, 250);
    this.goal.setDepth(2);
    this.goal.refreshBody();
  }

  private decorateSegment(segment: GroundSegment, index: number) {
    const mushroomCount = index % 2 === 0 ? 1 : 0;
    const cactusCount = index > 0 && index < 10 && index % 3 === 1 ? 1 : 0;
    const bushCount = 1 + ((index + 1) % 2);

    for (let i = 0; i < mushroomCount; i += 1) {
      this.createMushroom(segment.x + 90 + i * 120, segment.y - 6, 1 + (i % 2) * 0.08);
    }

    for (let i = 0; i < cactusCount; i += 1) {
      this.createCactus(segment.x + segment.width * 0.62 + i * 70, segment.y - 2);
    }

    for (let i = 0; i < bushCount; i += 1) {
      this.add
        .image(segment.x + segment.width - 90 - i * 68, segment.y - 18, "bush")
        .setScale(1 + i * 0.08)
        .setDepth(1);
    }
  }

  private createPlayer() {
    this.createChickenAnimations();
    this.player = this.physics.add.sprite(110, 330, "chicken");
    this.player.setScale(0.42);
    this.player.setFrame(1);
    this.player.setCollideWorldBounds(false);
    this.player.setBounce(0);
    this.player.setDepth(4);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(112, 126);
    body.setOffset(42, 42);
  }

  private createChickenAnimations() {
    if (this.anims.exists("chicken-run")) {
      return;
    }

    this.anims.create({
      key: "chicken-run",
      frames: this.anims.generateFrameNumbers("chicken", { start: 0, end: 2 }),
      frameRate: 10,
      repeat: -1
    });
  }

  private createEagleAnimations() {
    if (this.anims.exists("eagle-fly")) {
      return;
    }

    this.anims.create({
      key: "eagle-fly",
      frames: this.anims.generateFrameNumbers("eagle", { start: 0, end: 2 }),
      frameRate: 9,
      repeat: -1,
      yoyo: true
    });
  }

  private createFoxAnimations() {
    if (this.anims.exists("fox-sneak")) {
      return;
    }

    this.anims.create({
      key: "fox-sneak",
      frames: this.anims.generateFrameNumbers("fox", { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1
    });
  }

  private createMushroom(x: number, y: number, extraScale = 1) {
    const mushroom = this.mushrooms.create(x, y, "mushroom", 0) as MushroomSprite;
    const scale = MUSHROOM_SCALE * extraScale;
    mushroom.setOrigin(0.5, 1);
    mushroom.setScale(scale);
    mushroom.setDepth(2);
    mushroom.refreshBody();

    const body = mushroom.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(150, 56);
    body.setOffset(150, 338);
    mushroom.refreshBody();
  }

  private createCactus(x: number, y: number) {
    const cactus = this.cactuses.create(x, y, "cactus", 0) as CactusSprite;
    cactus.setOrigin(0.5, 1);
    cactus.setScale(CACTUS_SCALE);
    cactus.setDepth(2);
    cactus.refreshBody();

    const body = cactus.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(220, 250);
    body.setOffset(190, 185);
    cactus.refreshBody();
  }

  private createGroups() {
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemies = this.physics.add.group();
  }

  private populateWorld() {
    this.segments.forEach((segment, index) => {
      const coinCount = Math.max(2, Math.floor(segment.width / 150));

      for (let i = 0; i < coinCount; i += 1) {
        const coin = this.coins.create(
          segment.x + 80 + i * ((segment.width - 160) / Math.max(1, coinCount - 1)),
          segment.y - 92 - ((i + index) % 2) * 24,
          "coin"
        ) as Phaser.Physics.Arcade.Sprite;

        coin.setDepth(3);
      }

      if (index > 1 && index < 6) {
        this.spawnFox(segment.x + segment.width * 0.55, segment.y - FOX_SPAWN_Y_OFFSET, 70 + index * 8);
      }
    });
  }

  private configureCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.mushrooms, this.handleMushroomBounce, undefined, this);
    this.physics.add.overlap(this.player, this.cactuses, this.handleCactusContact, undefined, this);
    this.physics.add.collider(this.enemies, this.platforms, this.onEnemyHitPlatform, undefined, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.handleEnemyContact, undefined, this);
    this.physics.add.overlap(this.player, this.goal, this.completeLevel, undefined, this);
  }

  private configureInput() {
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      jumpAlt: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      sprint: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private configureTimers() {
    this.scheduleFoxSpawns();
    this.scheduleEagleSpawns();
    this.difficultyTimer = this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => {
        this.difficultyLevel += 1;
        this.foxSpawnDelay = Math.max(4200, this.foxSpawnDelay - 900);
        this.eagleSpawnDelay = Math.max(5200, this.eagleSpawnDelay - 1100);
        this.scheduleFoxSpawns();
        this.scheduleEagleSpawns();
      }
    });
  }

  private scheduleFoxSpawns() {
    this.foxTimer?.remove(false);
    this.foxTimer = this.time.addEvent({
      delay: this.foxSpawnDelay,
      loop: true,
      callback: () => {
        const futureX = Math.min(WORLD_WIDTH - 120, this.cameras.main.scrollX + GAME_WIDTH + Phaser.Math.Between(180, 420));
        const segment = this.findSegmentAtX(futureX);

        if (!segment) {
          return;
        }

        this.spawnFox(futureX, segment.y - FOX_SPAWN_Y_OFFSET, 105 + this.difficultyLevel * 14);
      }
    });
  }

  private scheduleEagleSpawns() {
    this.eagleTimer?.remove(false);
    this.eagleTimer = this.time.addEvent({
      delay: this.eagleSpawnDelay,
      loop: true,
      callback: () => {
        const x = Math.min(WORLD_WIDTH - 80, this.cameras.main.scrollX + GAME_WIDTH + Phaser.Math.Between(60, 260));
        const eagle = this.enemies.create(x, -30, "eagle") as EnemySprite;
        const eagleBody = eagle.body as Phaser.Physics.Arcade.Body;
        eagle.enemyKind = "eagle";
        eagle.patrolSpeed = 150 + this.difficultyLevel * 18;
        eagle.setScale(0.34);
        eagle.setVelocity(-eagle.patrolSpeed, 135 + this.difficultyLevel * 10);
        eagle.setDepth(4);
        eagle.anims.play("eagle-fly");
        eagleBody.allowGravity = false;
        eagleBody.setSize(210, 78);
        eagleBody.setOffset(36, 118);
      }
    });
  }

  private spawnFox(x: number, y: number, speed: number) {
    const fox = this.enemies.create(x, y, "fox", 0) as EnemySprite;
    const foxBody = fox.body as Phaser.Physics.Arcade.Body;
    fox.enemyKind = "fox";
    fox.patrolSpeed = speed;
    fox.isStomped = false;
    fox.setOrigin(0.5, 1);
    fox.setScale(FOX_SCALE);
    fox.setVelocityX(speed);
    fox.setFlipX(true);
    fox.setDepth(5);
    fox.setAlpha(1);
    fox.anims.play("fox-sneak");
    foxBody.setSize(190, 104);
    foxBody.setOffset(52, 148);
  }

  private collectCoin(
    _playerObject: unknown,
    coinObject: unknown
  ) {
    const coin = coinObject as Phaser.Physics.Arcade.Sprite;
    coin.destroy();
    this.collectedCoins += 1;
    this.score += 1;
    this.pushHud();
  }

  private handleMushroomBounce(
    playerObject: unknown,
    mushroomObject: unknown
  ) {
    const player = playerObject as Phaser.Physics.Arcade.Sprite;
    const mushroom = mushroomObject as MushroomSprite;
    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    const mushroomBody = mushroom.body as Phaser.Physics.Arcade.StaticBody;

    const landedOnTop =
      playerBody.velocity.y > 120 &&
      playerBody.bottom <= mushroomBody.top + 22 &&
      Math.abs(player.x - mushroom.x) < 72;

    if (!landedOnTop) {
      return;
    }

    playerBody.setVelocityY(MUSHROOM_BOUNCE_VELOCITY);
    mushroom.setFrame(1);
    mushroom.refreshBody();
    mushroom.resetFrameTimer?.remove(false);
    mushroom.resetFrameTimer = this.time.delayedCall(180, () => {
      if (!mushroom.active) {
        return;
      }

      mushroom.setFrame(0);
      mushroom.refreshBody();
    });
  }

  private handleCactusContact(
    _playerObject: unknown,
    cactusObject: unknown
  ) {
    const cactus = cactusObject as CactusSprite;
    if (!cactus.active || this.gameEnded) {
      return;
    }

    cactus.setFrame(1);
    cactus.refreshBody();
    cactus.resetFrameTimer?.remove(false);
    cactus.resetFrameTimer = this.time.delayedCall(180, () => {
      if (!cactus.active) {
        return;
      }

      cactus.setFrame(0);
      cactus.refreshBody();
    });

    this.loseLife(cactus.x < this.player.x ? 220 : -220);
  }

  private handleEnemyContact(
    _playerObject: unknown,
    enemyObject: unknown
  ) {
    if (this.gameEnded) {
      return;
    }

    const enemy = enemyObject as EnemySprite;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;

    if (!enemy.active || enemy.isStomped || (this.time.now < this.invulnerableUntil && playerBody.velocity.y <= 150)) {
      return;
    }

    const stomped =
      playerBody.velocity.y > 170 &&
      playerBody.bottom <= enemyBody.top + 18 &&
      this.player.y < enemy.y;

    if (stomped) {
      this.stompEnemy(enemy);
      playerBody.setVelocityY(-360);
      this.defeatedEnemies += 1;
      this.score += 1;
      this.pushHud();
      return;
    }

    this.loseLife(enemy.x < this.player.x ? 220 : -220);
  }

  private onEnemyHitPlatform(
    enemyObject: unknown,
    _platformObject: unknown
  ) {
    const enemy = enemyObject as EnemySprite;

    if (enemy.enemyKind !== "fox" || enemy.isStomped) {
      return;
    }

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.left || body.touching.left) {
      enemy.setVelocityX(enemy.patrolSpeed);
      enemy.setFlipX(true);
    } else if (body.blocked.right || body.touching.right) {
      enemy.setVelocityX(-enemy.patrolSpeed);
      enemy.setFlipX(false);
    }
  }

  private updateCheckpoint() {
    const segment = this.findSegmentAtX(this.player.x);
    if (segment) {
      this.checkpointX = Math.max(segment.x + 48, this.player.x);
      this.checkpointY = segment.y;
    }
  }

  private updateEnemies() {
    this.enemies.children.each((child) => {
      const enemy = child as EnemySprite;

      if (!enemy.active) {
        return false;
      }

      if (enemy.enemyKind === "fox") {
        if (enemy.isStomped) {
          if (enemy.x < this.cameras.main.scrollX - 240) {
            enemy.destroy();
          }

          return false;
        }

        const direction = Math.sign((enemy.body as Phaser.Physics.Arcade.Body).velocity.x) || 1;
        const groundAhead = this.findSegmentAtX(enemy.x + direction * 34);

        if (!groundAhead) {
          enemy.setVelocityX(-direction * enemy.patrolSpeed);
          enemy.setFlipX(direction < 0);
        }

        if (enemy.x < this.cameras.main.scrollX - 240) {
          enemy.destroy();
        } else if (enemy.y > GAME_HEIGHT + 120) {
          enemy.destroy();
        }
      } else if (enemy.y > GAME_HEIGHT + 140 || enemy.x < this.cameras.main.scrollX - 220) {
        enemy.destroy();
      }

      return false;
    });
  }

  private updateCamera() {
    const target = Math.max(0, this.player.x - GAME_WIDTH * 0.35);
    this.maxCameraScrollX = Math.max(this.maxCameraScrollX, Math.min(target, WORLD_WIDTH - GAME_WIDTH));
    this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, this.maxCameraScrollX, 0.12);
  }

  private stompEnemy(enemy: EnemySprite) {
    enemy.isStomped = true;
    enemy.anims.stop();
    enemy.setVelocity(0, 0);
    enemy.setFlipX(false);
    enemy.setTint(0xb8b8b8);

    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    this.tweens.add({
      targets: enemy,
      alpha: 0,
      delay: 260,
      duration: 180,
      onComplete: () => enemy.destroy()
    });
  }

  private loseLife(knockbackX = 0) {
    if (this.time.now < this.invulnerableUntil || this.gameEnded) {
      return;
    }

    this.lives -= 1;
    this.pushHud();

    if (this.lives <= 0) {
      this.finishGame();
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.player.setPosition(this.checkpointX, this.checkpointY - RESPAWN_Y_OFFSET);
    body.setVelocity(knockbackX, -250);
    this.invulnerableUntil = this.time.now + 1000;
  }

  private completeLevel() {
    this.finishGame(true);
  }

  private finishGame(completed = false) {
    this.gameEnded = true;
    this.player.setVelocity(0, 0);
    this.player.setTint(completed ? 0xfff1a8 : 0xffd1d1);
    this.foxTimer?.remove(false);
    this.eagleTimer?.remove(false);
    this.difficultyTimer?.remove(false);
    this.physics.pause();

    const result: GameResult = {
      score: this.score,
      defeatedEnemies: this.defeatedEnemies,
      collectedCoins: this.collectedCoins,
      durationSeconds: Math.round((this.time.now - this.startedAt) / 1000),
      completed
    };

    this.bridge.onGameOver(result);
  }

  private pushHud() {
    this.bridge.onHudChange({
      lives: this.lives,
      score: this.score
    });
  }

  private findSegmentAtX(x: number) {
    return this.segments.find((segment) => x >= segment.x && x <= segment.x + segment.width);
  }
}
