import Phaser from "phaser";
import { getRuntimeBridge, getRuntimeStartLevelIndex } from "../createGame";
import { getLevelWorldWidth, LEVELS, type LevelConfig } from "../levels";
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
  isUsed?: boolean;
};

type CactusSprite = Phaser.Physics.Arcade.Sprite & {
  resetFrameTimer?: Phaser.Time.TimerEvent;
};

type IcicleState = "hanging" | "shaking" | "falling" | "spent";

type IcicleSprite = Phaser.Physics.Arcade.Sprite & {
  icicleState: IcicleState;
  baseX: number;
  hasDamagedPlayer?: boolean;
};

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const RESPAWN_Y_OFFSET = 78;
const FOX_SCALE = 0.34;
const POLAR_BEAR_SCALE = 0.24;
const FOX_SPAWN_Y_OFFSET = 6;
const MUSHROOM_BOUNCE_VELOCITY = -760;
const CACTUS_SCALE = 0.15;
const ICICLE_SCALE = 0.34;
const ICICLE_TRIGGER_DISTANCE_X = 120;
const PLAYER_JUMP_VELOCITY = -560;
const PLAYER_JUMP_HOLD_TIME = 180;
const PLAYER_JUMP_HOLD_FORCE = -18;
const PLAYER_JUMP_RELEASE_DAMPING = 0.48;

export class PlayScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private mushrooms!: Phaser.Physics.Arcade.StaticGroup;
  private cactuses!: Phaser.Physics.Arcade.StaticGroup;
  private goals!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private icicles!: Phaser.Physics.Arcade.Group;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bridge = getRuntimeBridge();
  private segments: GroundSegment[] = [];
  private backdropObjects: Phaser.GameObjects.GameObject[] = [];
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
  private backgroundMusic?: Phaser.Sound.BaseSound;
  private currentMusicKey?: string;
  private levelBanner?: Phaser.GameObjects.Text;
  private gameEnded = false;
  private isTransitioning = false;
  private jumpHoldUntil = 0;
  private readonly levels = LEVELS;
  private currentLevelIndex = getRuntimeStartLevelIndex();
  private currentLevel: LevelConfig = this.levels[this.currentLevelIndex];
  private currentWorldWidth = getLevelWorldWidth(this.levels[this.currentLevelIndex]);

  constructor() {
    super("play");
  }

  create() {
    this.startedAt = this.time.now;

    this.createGroups();
    this.createPlayer();
    this.createChickenAnimations();
    this.createFoxAnimations();
    this.createEagleAnimations();
    this.configureCollisions();
    this.configureInput();
    this.loadLevel(this.currentLevelIndex, true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopBackgroundMusic();
      this.clearLevelTimers();
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.stopBackgroundMusic();
      this.clearLevelTimers();
    });
  }

  update() {
    if (this.gameEnded || this.isTransitioning) {
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
    const jumpHeld = this.keys.jump.isDown || this.keys.up.isDown || this.keys.jumpAlt.isDown;
    const fastFall = this.keys.down.isDown && !body.blocked.down;
    const moveConfig = this.currentLevel.movement;
    const targetSpeed = isMoving ? (moveLeft ? -1 : 1) * (isSprinting ? moveConfig.runSpeed : moveConfig.walkSpeed) : 0;
    const acceleration = body.blocked.down ? moveConfig.groundAcceleration : moveConfig.airAcceleration;
    const deceleration = moveConfig.groundDeceleration;

    body.setVelocityX(this.getNextHorizontalVelocity(body.velocity.x, targetSpeed, isMoving ? acceleration : deceleration));

    if (moveLeft && !moveRight) {
      this.player.setFlipX(true);
    } else if (moveRight && !moveLeft) {
      this.player.setFlipX(false);
    }

    if (wantsJump && body.blocked.down) {
      body.setVelocityY(PLAYER_JUMP_VELOCITY);
      this.jumpHoldUntil = this.time.now + PLAYER_JUMP_HOLD_TIME;
      this.sound.play("jump-sfx", { volume: 0.45 });
    }

    if (jumpHeld && this.time.now < this.jumpHoldUntil && body.velocity.y < 0) {
      body.setVelocityY(body.velocity.y + PLAYER_JUMP_HOLD_FORCE);
    } else if (!jumpHeld && this.time.now < this.jumpHoldUntil && body.velocity.y < 0) {
      body.setVelocityY(Math.max(body.velocity.y * PLAYER_JUMP_RELEASE_DAMPING, -180));
      this.jumpHoldUntil = 0;
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
    this.updateIcicles();
    this.updateEnemies();
    this.updateCamera();
  }

  private loadLevel(levelIndex: number, isInitialLoad = false) {
    this.currentLevelIndex = levelIndex;
    this.currentLevel = this.levels[levelIndex];
    this.currentWorldWidth = getLevelWorldWidth(this.currentLevel);

    this.resetLevelState();
    this.clearLevelObjects();
    this.syncBackgroundMusic();
    this.createBackdrop();
    this.createWorld();
    this.populateWorld();
    this.resetPlayerForLevelStart(isInitialLoad);
    this.configureTimers();
    this.pushHud();
    this.showLevelBanner(this.currentLevel.label);
  }

  private getNextHorizontalVelocity(currentVelocity: number, targetVelocity: number, deltaPerSecond: number) {
    const step = deltaPerSecond * (this.game.loop.delta / 1000);
    const difference = targetVelocity - currentVelocity;

    if (Math.abs(difference) <= step) {
      return targetVelocity;
    }

    return currentVelocity + Math.sign(difference) * step;
  }

  private resetLevelState() {
    this.segments = [];
    this.maxCameraScrollX = 0;
    this.difficultyLevel = 0;
    this.foxSpawnDelay = this.currentLevel.foxSpawnDelay;
    this.eagleSpawnDelay = this.currentLevel.eagleSpawnDelay;
    this.invulnerableUntil = 0;
    this.jumpHoldUntil = 0;
  }

  private clearLevelObjects() {
    this.clearLevelTimers();
    this.platforms.clear(true, true);
    this.mushrooms.clear(true, true);
    this.cactuses.clear(true, true);
    this.goals.clear(true, true);
    this.coins.clear(true, true);
    this.enemies.clear(true, true);
    this.icicles.clear(true, true);
    this.backdropObjects.forEach((object) => object.destroy());
    this.backdropObjects = [];
  }

  private createBackdrop() {
    const backdrop = this.currentLevel.backdrop;

    this.backdropObjects.push(
      this.add
        .rectangle(this.currentWorldWidth / 2, GAME_HEIGHT / 2, this.currentWorldWidth, GAME_HEIGHT, backdrop.skyColor)
        .setScrollFactor(0)
    );
    this.backdropObjects.push(
      this.add
        .rectangle(this.currentWorldWidth / 2, GAME_HEIGHT - 48, this.currentWorldWidth, 96, backdrop.horizonColor)
        .setScrollFactor(0.1)
    );

    const hillCount = Math.max(12, Math.ceil(this.currentWorldWidth / 560));
    for (let index = 0; index < hillCount; index += 1) {
      const x = 220 + index * 560;
      const hill = this.add.image(x, 420 - (index % 2) * 40, "hill");
      hill.setScrollFactor(0.35);
      hill.setTint(index % 2 === 0 ? backdrop.hillTintA : backdrop.hillTintB);
      hill.setAlpha(0.95);
      this.backdropObjects.push(hill);
    }

    const cloudCount = Math.max(16, Math.ceil(this.currentWorldWidth / 410));
    for (let index = 0; index < cloudCount; index += 1) {
      const cloud = this.add.ellipse(
        120 + index * 410,
        70 + (index % 3) * 26,
        140,
        52,
        backdrop.cloudColor,
        backdrop.cloudAlpha
      );
      cloud.setScrollFactor(0.18);
      this.backdropObjects.push(cloud);
    }
  }

  private createWorld() {
    this.physics.world.setBounds(0, 0, this.currentWorldWidth, GAME_HEIGHT + 220);
    this.cameras.main.setBounds(0, 0, this.currentWorldWidth, GAME_HEIGHT);

    let cursorX = 0;
    this.currentLevel.segmentWidths.forEach((width, index) => {
      cursorX += this.currentLevel.segmentGaps[index];

      const segment: GroundSegment = {
        x: cursorX,
        width,
        y: this.currentLevel.segmentHeights[index]
      };

      this.platforms
        .create(segment.x + segment.width / 2, segment.y, this.currentLevel.groundTextureKey)
        .setDisplaySize(segment.width, 48)
        .refreshBody();

      this.segments.push(segment);
      this.decorateSegment(segment, index);
      cursorX += width;
    });

    this.createGoal();
  }

  private createGoal() {
    const finalSegment = this.segments[this.segments.length - 1];
    const goalX = finalSegment.x + finalSegment.width - 112;
    const goalY = finalSegment.y + 40;
    const goal = this.physics.add.staticImage(goalX, goalY, "castle");

    goal.setOrigin(0.5, 1);
    goal.setDisplaySize(250, 250);
    goal.setDepth(2);
    goal.refreshBody();
    this.goals.add(goal);
  }

  private decorateSegment(segment: GroundSegment, index: number) {
    const mushroomCount = index % 2 === 0 ? 1 : 0;
    const cactusCount = this.currentLevel.number === 2 ? 0 : index > 0 && index < 10 && index % 3 === 1 ? 1 : 0;
    const bushCount = 1 + ((index + 1) % 2);

    for (let i = 0; i < mushroomCount; i += 1) {
      this.createMushroom(segment.x + 90 + i * 120, segment.y - 6, 1 + (i % 2) * 0.08);
    }

    for (let i = 0; i < cactusCount; i += 1) {
      this.createCactus(segment.x + segment.width * 0.62 + i * 70, segment.y - 2);
    }

    for (let i = 0; i < bushCount; i += 1) {
      this.backdropObjects.push(
        this.add
          .image(segment.x + segment.width - 90 - i * 68, segment.y - 18, "bush")
          .setScale(1 + i * 0.08)
          .setDepth(1)
      );
    }
  }

  private createPlayer() {
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

  private resetPlayerForLevelStart(isInitialLoad: boolean) {
    const firstSegment = this.segments[0];
    const startX = Math.max(110, firstSegment.x + 60);
    const startY = firstSegment.y - RESPAWN_Y_OFFSET;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    this.checkpointX = startX;
    this.checkpointY = firstSegment.y;
    this.player.clearTint();
    this.player.setAlpha(1);
    this.player.setFlipX(false);
    this.player.setPosition(startX, startY);
    this.player.setVelocity(0, 0);
    this.player.setFrame(1);
    body.setVelocity(0, 0);
    this.jumpHoldUntil = 0;
    this.cameras.main.scrollX = 0;
    this.physics.resume();

    if (!isInitialLoad) {
      this.invulnerableUntil = this.time.now + 1300;
    }
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

  private createGroups() {
    this.platforms = this.physics.add.staticGroup();
    this.mushrooms = this.physics.add.staticGroup();
    this.cactuses = this.physics.add.staticGroup();
    this.goals = this.physics.add.staticGroup();
    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemies = this.physics.add.group();
    this.icicles = this.physics.add.group();
  }

  private configureCollisions() {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.mushrooms, this.handleMushroomBounce, undefined, this);
    this.physics.add.overlap(this.player, this.cactuses, this.handleCactusContact, undefined, this);
    this.physics.add.collider(this.enemies, this.platforms, this.onEnemyHitPlatform, undefined, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.handleEnemyContact, undefined, this);
    this.physics.add.collider(this.icicles, this.platforms, this.handleIcicleHitPlatform, undefined, this);
    this.physics.add.overlap(this.player, this.icicles, this.handleIcicleContact, undefined, this);
    this.physics.add.overlap(this.player, this.goals, this.completeLevel, undefined, this);
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

      if (index >= this.currentLevel.initialFoxRange.startIndex && index <= this.currentLevel.initialFoxRange.endIndex) {
        this.spawnFox(segment.x + segment.width * 0.55, segment.y - FOX_SPAWN_Y_OFFSET, 70 + index * 8);
      }
    });

    this.populateIcicles();
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

  private clearLevelTimers() {
    this.foxTimer?.remove(false);
    this.eagleTimer?.remove(false);
    this.difficultyTimer?.remove(false);
    this.foxTimer = undefined;
    this.eagleTimer = undefined;
    this.difficultyTimer = undefined;
  }

  private scheduleFoxSpawns() {
    this.foxTimer?.remove(false);
    this.foxTimer = this.time.addEvent({
      delay: this.foxSpawnDelay,
      loop: true,
      callback: () => {
        const futureX = Math.min(
          this.currentWorldWidth - 120,
          this.cameras.main.scrollX + GAME_WIDTH + Phaser.Math.Between(180, 420)
        );
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
        const x = Math.min(this.currentWorldWidth - 80, this.cameras.main.scrollX + GAME_WIDTH + Phaser.Math.Between(60, 260));
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

  private syncBackgroundMusic() {
    if (this.currentMusicKey === this.currentLevel.musicKey && this.backgroundMusic?.isPlaying) {
      return;
    }

    this.stopBackgroundMusic();
    this.currentMusicKey = this.currentLevel.musicKey;
    this.backgroundMusic = this.sound.add(this.currentLevel.musicKey, {
      loop: true,
      volume: 0.32
    });
    this.backgroundMusic.play();
  }

  private stopBackgroundMusic() {
    this.backgroundMusic?.stop();
    this.backgroundMusic?.destroy();
    this.backgroundMusic = undefined;
    this.currentMusicKey = undefined;
  }

  private showLevelBanner(label: string) {
    this.levelBanner?.destroy();
    this.levelBanner = this.add
      .text(GAME_WIDTH / 2, 82, label, {
        fontFamily: "Trebuchet MS",
        fontSize: "30px",
        color: "#213447",
        backgroundColor: "rgba(255,255,255,0.78)",
        padding: { x: 18, y: 10 }
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setScrollFactor(0);

    this.tweens.add({
      targets: this.levelBanner,
      alpha: 0,
      delay: 1200,
      duration: 350,
      onComplete: () => {
        this.levelBanner?.destroy();
        this.levelBanner = undefined;
      }
    });
  }

  private createMushroom(x: number, y: number, extraScale = 1) {
    const bounceSprite = this.currentLevel.bounceSprite;
    const mushroom = this.mushrooms.create(x, y, bounceSprite.textureKey, 0) as MushroomSprite;
    const scale = bounceSprite.baseScale * extraScale;

    mushroom.isUsed = false;
    mushroom.setOrigin(0.5, 1);
    mushroom.setScale(scale);
    mushroom.setDepth(2);
    mushroom.refreshBody();

    const body = mushroom.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(bounceSprite.bodySize.width, bounceSprite.bodySize.height);
    body.setOffset(bounceSprite.bodyOffset.x, bounceSprite.bodyOffset.y);
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

  private populateIcicles() {
    if (!this.currentLevel.icicles?.length) {
      return;
    }

    this.currentLevel.icicles.forEach(({ segmentIndex, offsetX }) => {
      const segment = this.segments[segmentIndex];
      if (!segment) {
        return;
      }

      const x = Phaser.Math.Clamp(segment.x + offsetX, segment.x + 56, segment.x + segment.width - 56);
      this.createIcicle(x);
    });
  }

  private createIcicle(x: number) {
    const icicle = this.icicles.create(x, 0, "icicle") as IcicleSprite;
    const body = icicle.body as Phaser.Physics.Arcade.Body;

    icicle.icicleState = "hanging";
    icicle.baseX = x;
    icicle.hasDamagedPlayer = false;
    icicle.setOrigin(0.5, 0);
    icicle.setScale(ICICLE_SCALE);
    icicle.setDepth(3);
    icicle.setVelocity(0, 0);

    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(72, 118);
    body.setOffset(64, 12);
  }

  private spawnFox(x: number, y: number, speed: number) {
    const isLevelTwo = this.currentLevel.number === 2;
    const fox = this.enemies.create(x, y, isLevelTwo ? "polar-bear-1" : "fox", 0) as EnemySprite;
    const foxBody = fox.body as Phaser.Physics.Arcade.Body;

    fox.enemyKind = "fox";
    fox.patrolSpeed = speed;
    fox.isStomped = false;
    fox.setOrigin(0.5, 1);
    fox.setScale(isLevelTwo ? POLAR_BEAR_SCALE : FOX_SCALE);
    fox.setVelocityX(speed);
    fox.setFlipX(true);
    fox.setDepth(5);
    fox.setAlpha(1);
    if (!isLevelTwo) {
      fox.anims.play("fox-sneak");
    }

    if (isLevelTwo) {
      fox.setY(y - 12);
      foxBody.setSize(420, 170);
      foxBody.setOffset(76, 152);
      return;
    }

    foxBody.setSize(190, 104);
    foxBody.setOffset(52, 148);
  }

  private collectCoin(_playerObject: unknown, coinObject: unknown) {
    const coin = coinObject as Phaser.Physics.Arcade.Sprite;

    if (this.isTransitioning) {
      return;
    }

    coin.destroy();
    this.sound.play("coin-sfx", { volume: 0.4 });
    this.collectedCoins += 1;
    this.score += 1;
    this.pushHud();
  }

  private handleMushroomBounce(playerObject: unknown, mushroomObject: unknown) {
    if (this.isTransitioning) {
      return;
    }

    const player = playerObject as Phaser.Physics.Arcade.Sprite;
    const mushroom = mushroomObject as MushroomSprite;
    const playerBody = player.body as Phaser.Physics.Arcade.Body;
    const mushroomBody = mushroom.body as Phaser.Physics.Arcade.StaticBody;
    const bounceSprite = this.currentLevel.bounceSprite;

    if (bounceSprite.singleUse && mushroom.isUsed) {
      return;
    }

    const landedOnTop =
      playerBody.velocity.y > 120 &&
      playerBody.bottom <= mushroomBody.top + bounceSprite.topLandingPadding &&
      Math.abs(player.x - mushroom.x) < bounceSprite.bounceRangeX;

    if (!landedOnTop) {
      return;
    }

    playerBody.setVelocityY(MUSHROOM_BOUNCE_VELOCITY);
    this.sound.play("jump-sfx", { volume: 0.45 });
    mushroom.setFrame(1);
    mushroom.refreshBody();

    if (bounceSprite.singleUse) {
      mushroom.isUsed = true;
      mushroom.resetFrameTimer?.remove(false);
      return;
    }

    mushroom.resetFrameTimer?.remove(false);
    mushroom.resetFrameTimer = this.time.delayedCall(180, () => {
      if (!mushroom.active) {
        return;
      }

      mushroom.setFrame(0);
      mushroom.refreshBody();
    });
  }

  private handleCactusContact(_playerObject: unknown, cactusObject: unknown) {
    const cactus = cactusObject as CactusSprite;
    if (!cactus.active || this.gameEnded || this.isTransitioning) {
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

  private handleIcicleContact(_playerObject: unknown, icicleObject: unknown) {
    const icicle = icicleObject as IcicleSprite;
    if (!icicle.active || icicle.icicleState === "spent" || icicle.hasDamagedPlayer || this.gameEnded || this.isTransitioning) {
      return;
    }

    icicle.hasDamagedPlayer = true;
    icicle.icicleState = "spent";
    icicle.disableBody(true, true);
    this.loseLife(icicle.x < this.player.x ? 170 : -170);
  }

  private handleIcicleHitPlatform(icicleObject: unknown, _platformObject: unknown) {
    const icicle = icicleObject as IcicleSprite;
    if (!icicle.active || icicle.icicleState !== "falling") {
      return;
    }

    const body = icicle.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) {
      return;
    }

    icicle.icicleState = "spent";
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.enable = false;
    this.tweens.add({
      targets: icicle,
      alpha: 0,
      duration: 180,
      onComplete: () => icicle.destroy()
    });
  }

  private handleEnemyContact(_playerObject: unknown, enemyObject: unknown) {
    if (this.gameEnded || this.isTransitioning) {
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

  private onEnemyHitPlatform(enemyObject: unknown, _platformObject: unknown) {
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

  private updateIcicles() {
    this.icicles.children.each((child) => {
      const icicle = child as IcicleSprite;
      if (!icicle.active || icicle.icicleState !== "hanging") {
        return false;
      }

      const isNearEnough =
        Math.abs(this.player.x - icicle.x) <= ICICLE_TRIGGER_DISTANCE_X;

      if (isNearEnough) {
        this.triggerIcicle(icicle);
      }

      return false;
    });
  }

  private triggerIcicle(icicle: IcicleSprite) {
    if (!icicle.active || icicle.icicleState !== "hanging") {
      return;
    }

    icicle.icicleState = "shaking";
    icicle.setX(icicle.baseX);

    this.tweens.add({
      targets: icicle,
      x: {
        from: icicle.baseX - 4,
        to: icicle.baseX + 4
      },
      duration: 38,
      repeat: 5,
      yoyo: true,
      onComplete: () => {
        if (!icicle.active) {
          return;
        }

        icicle.setX(icicle.baseX);
        this.dropIcicle(icicle);
      }
    });
  }

  private dropIcicle(icicle: IcicleSprite) {
    if (!icicle.active || icicle.icicleState !== "shaking") {
      return;
    }

    const body = icicle.body as Phaser.Physics.Arcade.Body;
    icicle.icicleState = "falling";
    body.setImmovable(false);
    body.setAllowGravity(true);
    body.setVelocity(0, 40);
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

        if (this.currentLevel.number === 2) {
          const polarBearFrame = 1 + (Math.floor(this.time.now / 130) % 3);
          enemy.setTexture(`polar-bear-${polarBearFrame}`);
        }

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
    this.maxCameraScrollX = Math.max(this.maxCameraScrollX, Math.min(target, this.currentWorldWidth - GAME_WIDTH));
    this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, this.maxCameraScrollX, 0.12);
  }

  private stompEnemy(enemy: EnemySprite) {
    enemy.isStomped = true;
    this.sound.play("stomp-sfx", { volume: 0.45 });
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
    if (this.time.now < this.invulnerableUntil || this.gameEnded || this.isTransitioning) {
      return;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.sound.play("death-sfx", { volume: 0.5 });
    } else {
      this.sound.play("damage-sfx", { volume: 0.45 });
    }
    this.pushHud();

    if (this.lives <= 0) {
      this.finishGame();
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.player.setPosition(this.checkpointX, this.checkpointY - RESPAWN_Y_OFFSET);
    body.setVelocity(knockbackX, -250);
    this.invulnerableUntil = this.time.now + 1500;
  }

  private completeLevel() {
    if (this.gameEnded || this.isTransitioning) {
      return;
    }

    const nextLevelIndex = this.currentLevelIndex + 1;
    if (nextLevelIndex >= this.levels.length) {
      this.sound.play("complete-sfx", { volume: 0.5 });
      this.finishGame(true);
      return;
    }

    this.isTransitioning = true;
    this.sound.play("complete-sfx", { volume: 0.5 });
    this.clearLevelTimers();
    this.physics.pause();
    this.player.setVelocity(0, 0);
    this.player.setTint(0xfff1a8);

    this.time.delayedCall(900, () => {
      if (this.gameEnded) {
        return;
      }

      this.player.clearTint();
      this.loadLevel(nextLevelIndex);
      this.isTransitioning = false;
    });
  }

  private finishGame(completed = false) {
    this.gameEnded = true;
    this.isTransitioning = false;
    this.stopBackgroundMusic();
    this.player.setVelocity(0, 0);
    this.player.setTint(completed ? 0xfff1a8 : 0xffd1d1);
    this.clearLevelTimers();
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
      score: this.score,
      level: this.currentLevel.number,
      levelLabel: this.currentLevel.label
    });
  }

  private findSegmentAtX(x: number) {
    return this.segments.find((segment) => x >= segment.x && x <= segment.x + segment.width);
  }
}
