import type { StarterKitId } from "@/lib/agent/protocol";
import { libraryTag } from "./libraries";

/**
 * Starter kits: complete, polished, tested games that the agent builds on
 * instead of starting from an empty file. Each one already has everything a
 * professional game needs (title, play and end screens, responsive scaling,
 * keyboard + touch, sound, juice, a settings block a child can tweak), so the
 * agent spends its effort on the child's idea, not on engine plumbing.
 *
 * They load only catalog libraries (src/lib/games/libraries.ts). Kits are
 * verified in a real browser (kits.browser.test.ts): no errors from title to
 * play to the end screen and back, on a laptop and a phone.
 *
 * Note: kit code avoids template literals so it can live in String.raw.
 */

export type { StarterKitId };

export interface StarterKit {
  id: StarterKitId;
  name: string;
  /** When to choose it (shown to the agent). */
  bestFor: string;
  /** How it's put together, so the agent knows where to change what. */
  map: string;
  code: string;
}

const PHASER_ARCADE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Star Catcher</title>
${libraryTag("font-fredoka-600")}
${libraryTag("font-fredoka-700")}
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body {
    /* The sky behind the game. Phaser draws on a see-through canvas on top. */
    background: radial-gradient(120% 90% at 50% 0%, #7b61ff 0%, #3b2a9e 45%, #160d45 100%);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  #game { position: fixed; inset: 0; }
</style>
${libraryTag("phaser")}
${libraryTag("zzfx")}
</head>
<body>
<div id="game"></div>
<script>
// =====================================================================
//  🎮 GAME SETTINGS — change these to change the game!
// =====================================================================
const GAME_TITLE = "Star Catcher";
const HOW_TO_PLAY = "Catch the stars ⭐ and dodge the rocks!";
const PLAYER = "🐰";            // that's you!
const GOOD_THING = "⭐";        // catch these for points
const BAD_THING = "🪨";         // these cost a life
const GAME_SECONDS = 45;        // how long a round lasts
const LIVES = 3;                // how many bumps you can take
const PLAYER_SPEED = 640;       // how fast you move (pixels per second)
const FALL_SPEED_START = 230;   // how fast things fall at the start...
const FALL_SPEED_MAX = 560;     // ...and how fast they can get
const SPAWN_EVERY_MS = 650;     // a new thing appears this often (smaller = more)
const BAD_CHANCE = 0.28;        // 0.28 means about 1 in 4 things is bad

document.title = GAME_TITLE; // the browser tab shows the game's name too

// The game's colours, in one place.
const COLORS = {
  text: "#ffffff",
  title: "#ffd166",
  outline: "#2b1a78",
  good: "#06d6a0",
  bad: "#ff5d8f",
  button: "#7c5cff",
  buttonDark: "#4b2fd1",
  panel: "#ffffff",
  panelDark: "#d9cffd",
  ink: "#2b1a78",
};

// =====================================================================
//  🔊 SOUNDS — made by ZzFX (each list of numbers is one sound)
// =====================================================================
const SOUNDS = {
  start: [1.4, , 262, .02, .06, .18, 1, 1.6, , , 262, .06],
  catch: [1.2, , 1675, , .05, .22, 1, 1.8, , , 837, .05],
  hurt: [1.6, , 120, .02, .12, .35, 4, 2.4, , , , , , .7, , .4],
  tick: [.6, , 1400, , .01, .04, 1, 2],
  end: [1.3, , 330, .04, .25, .45, 1, 1.4, , , -110, .12],
  best: [1.4, , 523, .02, .3, .5, 1, 1.2, , , 262, .1, .12],
};

// Browsers only allow sound after a tap or key press — this wakes it up.
function wakeUpSound() {
  try { if (zzfxX.state !== "running") zzfxX.resume(); } catch (e) { /* no sound, still fun */ }
}
function playSound(name) {
  try { zzfx(...SOUNDS[name]); } catch (e) { /* no sound, still fun */ }
}

// =====================================================================
//  🧰 HELPERS — little tools the scenes share
// =====================================================================
const FONT = "Fredoka, system-ui, sans-serif";
const CALM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let bestScore = 0; // kept while the game is open (this game can't save to the device)

// Turn "#7c5cff" into the number Phaser's drawing tools want.
function hex(color) {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

// Big friendly text with an outline, so it reads on any background.
function textStyle(size, color) {
  return {
    fontFamily: FONT,
    fontSize: size + "px",
    fontStyle: "700",
    color: color || COLORS.text,
    stroke: COLORS.outline,
    strokeThickness: Math.max(4, Math.round(size / 7)),
    align: "center",
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  };
}

// Draw an emoji onto a texture so it can be a sprite.
function emojiTexture(scene, key, emoji, size) {
  if (scene.textures.exists(key)) return;
  const box = Math.ceil(size * 1.3);
  const canvas = scene.textures.createCanvas(key, box, box);
  const ctx = canvas.getContext();
  ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, box / 2, box / 2 + size * 0.05);
  canvas.refresh();
}

// A soft round dot, for sparkles.
function dotTexture(scene, key, radius) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(radius, radius, radius);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

// A chunky toy button shape: a darker "edge" under a bright top.
function roundBoxTexture(scene, key, width, height, color, edgeColor, edge) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  const r = Math.min(28, height / 2);
  g.fillStyle(hex(edgeColor), 1);
  g.fillRoundedRect(0, edge, width, height, r);
  g.fillStyle(hex(color), 1);
  g.fillRoundedRect(0, 0, width, height, r);
  g.generateTexture(key, width, height + edge);
  g.destroy();
}

// A button you can tap or click. Returns a container to position.
function makeButton(scene, label, onPress) {
  const box = scene.add.image(0, 0, "button");
  const text = scene.add.text(0, -4, label, textStyle(34)).setOrigin(0.5);
  const button = scene.add.container(0, 0, [box, text]);
  box.setInteractive({ useHandCursor: true });
  box.on("pointerover", () => scene.tweens.add({ targets: button, scale: button.baseScale * 1.06, duration: 120 }));
  box.on("pointerout", () => scene.tweens.add({ targets: button, scale: button.baseScale, duration: 120 }));
  box.on("pointerdown", () => {
    scene.tweens.add({ targets: button, scale: button.baseScale * 0.94, duration: 70, yoyo: true });
    onPress();
  });
  button.baseScale = 1;
  return button;
}

// How big to draw things, so the game fits phones and big screens alike.
function uiScale(scene) {
  const { width, height } = scene.scale;
  return Phaser.Math.Clamp(Math.min(width / 520, height / 620), 0.6, 1.35);
}

// Run a scene's layout() now and whenever the screen changes size.
function keepLaidOut(scene) {
  scene.layout();
  scene.scale.on("resize", scene.layout, scene);
  scene.events.once("shutdown", () => scene.scale.off("resize", scene.layout, scene));
}

// =====================================================================
//  🥾 BOOT — makes the pictures, waits for the font
// =====================================================================
class Boot extends Phaser.Scene {
  constructor() { super("Boot"); }

  create() {
    emojiTexture(this, "player", PLAYER, 84);
    emojiTexture(this, "good", GOOD_THING, 64);
    emojiTexture(this, "bad", BAD_THING, 64);
    dotTexture(this, "spark", 7);
    roundBoxTexture(this, "button", 280, 84, COLORS.button, COLORS.buttonDark, 8);
    roundBoxTexture(this, "panel", 520, 400, COLORS.panel, COLORS.panelDark, 10);

    // Wait (a little) for the font, so words never flash in the wrong font.
    // If it can't load (offline, blocked), carry on with the backup font.
    const fontReady = document.fonts ? document.fonts.load("700 40px Fredoka").catch(() => null) : Promise.resolve();
    const tooLong = new Promise((done) => setTimeout(done, 1500));
    Promise.race([fontReady, tooLong]).then(() => this.scene.start("Title"));
  }
}

// =====================================================================
//  🏠 TITLE — the game's name, how to play, and a big Play button
// =====================================================================
class Title extends Phaser.Scene {
  constructor() { super("Title"); }

  create() {
    // Drifting background things, just for fun.
    this.floaters = [];
    for (let i = 0; i < 9; i++) {
      const floater = this.add.image(0, 0, i % 3 === 0 ? "bad" : "good").setAlpha(0.3);
      this.floaters.push(floater);
    }
    this.title = this.add.text(0, 0, GAME_TITLE, textStyle(72, COLORS.title)).setOrigin(0.5);
    this.hero = this.add.image(0, 0, "player");
    this.howTo = this.add.text(0, 0, HOW_TO_PLAY, textStyle(28)).setOrigin(0.5);
    this.playButton = makeButton(this, "Play!", () => this.startGame());
    this.hint = this.add.text(0, 0, "← → or drag to move  ·  Space to start", textStyle(22, "#d8cfff")).setOrigin(0.5);

    keepLaidOut(this);

    if (!CALM) {
      this.tweens.add({ targets: this.title, y: "-=10", duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: this.hero, angle: { from: -8, to: 8 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: this.playButton, scale: { from: this.playButton.baseScale, to: this.playButton.baseScale * 1.05 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    this.input.keyboard.once("keydown-SPACE", () => this.startGame());
    this.input.keyboard.once("keydown-ENTER", () => this.startGame());
    this.cameras.main.fadeIn(300);
  }

  layout() {
    const { width, height } = this.scale;
    const s = uiScale(this);
    this.title.setPosition(width / 2, height * 0.22).setScale(s).setWordWrapWidth((width / s) * 0.92);
    this.hero.setPosition(width / 2, height * 0.42).setScale(s * 1.25);
    this.howTo.setPosition(width / 2, height * 0.58).setScale(s).setWordWrapWidth(width / s * 0.9);
    this.playButton.baseScale = s;
    this.playButton.setPosition(width / 2, height * 0.74).setScale(s);
    this.hint.setPosition(width / 2, height * 0.88).setScale(s);
    this.floaters.forEach((floater, i) => {
      floater.setPosition((i + 0.5) * width / this.floaters.length, Phaser.Math.Between(30, height - 30));
      floater.setScale(s * Phaser.Math.FloatBetween(0.6, 1));
    });
  }

  update(time, delta) {
    // Let the background things drift down slowly and wrap around.
    const fall = delta * 0.03;
    for (const floater of this.floaters) {
      floater.y += fall;
      floater.angle += fall * 0.4;
      if (floater.y > this.scale.height + 40) floater.y = -40;
    }
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    wakeUpSound();
    playSound("start");
    this.cameras.main.fadeOut(220);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("Play"));
  }
}

// =====================================================================
//  ⭐ PLAY — the game itself
// =====================================================================
class Play extends Phaser.Scene {
  constructor() { super("Play"); }

  create() {
    // Everything that changes while you play starts fresh here.
    this.score = 0;
    this.lives = LIVES;
    this.timeLeft = GAME_SECONDS;
    this.fallSpeed = FALL_SPEED_START;
    this.safeUntil = 0;
    this.over = false;
    this.targetX = null;

    const { width, height } = this.scale;
    this.physics.world.setBounds(0, 0, width, height);

    // You!
    this.player = this.physics.add.image(width / 2, height - 90, "player");
    this.player.setCollideWorldBounds(true);
    this.fitRoundBody(this.player, 0.34);

    // Falling things come from a pool, so the game never slows down.
    this.things = this.physics.add.group({ maxSize: 40 });
    this.physics.add.overlap(this.player, this.things, this.touchThing, null, this);

    // Sparkles for catching, made once and reused.
    this.sparkles = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 380 },
      lifespan: 600,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd166, 0x06d6a0, 0xffffff],
      blendMode: "ADD",
      emitting: false,
    });

    // The scoreboard along the top.
    this.scoreText = this.add.text(0, 0, "0", textStyle(44, COLORS.title)).setOrigin(0, 0);
    this.timeText = this.add.text(0, 0, String(GAME_SECONDS), textStyle(36)).setOrigin(0.5, 0);
    this.livesText = this.add.text(0, 0, this.hearts(), textStyle(30)).setOrigin(1, 0);

    // Keyboard: arrows or A/D. Touch or mouse: drag to where you want to go.
    this.keys = this.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", a: "A", d: "D" });
    this.input.on("pointerdown", (pointer) => { wakeUpSound(); this.targetX = pointer.x; });
    this.input.on("pointermove", (pointer) => { if (pointer.isDown) this.targetX = pointer.x; });
    this.input.on("pointerup", () => { this.targetX = null; });

    // New things to catch, and the countdown clock.
    this.spawner = this.time.addEvent({ delay: SPAWN_EVERY_MS, loop: true, callback: this.spawnThing, callbackScope: this });
    this.clock = this.time.addEvent({ delay: 1000, loop: true, callback: this.tick, callbackScope: this });

    keepLaidOut(this);
    this.cameras.main.fadeIn(250);
  }

  layout() {
    const { width, height } = this.scale;
    const s = uiScale(this);
    const pad = 18 * s;
    this.physics.world.setBounds(0, 0, width, height);
    this.player.setScale(s * 1.1);
    this.player.y = height - 70 * s;
    this.player.x = Phaser.Math.Clamp(this.player.x, 0, width);
    this.scoreText.setPosition(pad, pad).setScale(s);
    this.timeText.setPosition(width / 2, pad + 4 * s).setScale(s);
    this.livesText.setPosition(width - pad, pad + 6 * s).setScale(s);
  }

  // A round hitbox that matches the emoji (fairer than a square one).
  fitRoundBody(sprite, share) {
    const radius = sprite.width * share;
    sprite.body.setCircle(radius, sprite.width / 2 - radius, sprite.height / 2 - radius);
  }

  hearts() {
    return "❤️".repeat(Math.max(0, this.lives));
  }

  spawnThing() {
    if (this.over) return;
    const bad = Math.random() < BAD_CHANCE;
    const x = Phaser.Math.Between(40, this.scale.width - 40);
    const thing = this.things.get(x, -50, bad ? "bad" : "good");
    if (!thing) return; // the pool is full — skip one
    thing.enableBody(true, x, -50, true, true);
    thing.setTexture(bad ? "bad" : "good");
    thing.isBad = bad;
    thing.setScale(uiScale(this) * Phaser.Math.FloatBetween(0.85, 1.1));
    this.fitRoundBody(thing, 0.32);
    thing.setVelocity(Phaser.Math.Between(-40, 40), this.fallSpeed * Phaser.Math.FloatBetween(0.85, 1.15));
    thing.setAngularVelocity(Phaser.Math.Between(-120, 120));
  }

  touchThing(player, thing) {
    if (!thing.active || this.over) return;
    thing.disableBody(true, true);
    if (thing.isBad) this.bump();
    else this.catchStar(thing.x, thing.y);
  }

  catchStar(x, y) {
    this.score += 1;
    this.scoreText.setText(String(this.score));
    this.tweens.add({ targets: this.scoreText, scale: { from: uiScale(this) * 1.35, to: uiScale(this) }, duration: 220, ease: "Back.easeOut" });
    this.sparkles.explode(16, x, y);
    playSound("catch");

    // A "+1" that floats up and fades away.
    const plus = this.add.text(x, y - 20, "+1", textStyle(30, COLORS.good)).setOrigin(0.5).setScale(uiScale(this));
    this.tweens.add({ targets: plus, y: y - 90, alpha: 0, duration: 650, ease: "Cubic.easeOut", onComplete: () => plus.destroy() });
  }

  bump() {
    if (this.time.now < this.safeUntil) return; // just got bumped — a moment of safety
    this.lives -= 1;
    this.livesText.setText(this.hearts());
    this.safeUntil = this.time.now + 1000;
    playSound("hurt");
    if (!CALM) this.cameras.main.shake(200, 0.012);
    this.cameras.main.flash(140, 255, 93, 143);
    this.tweens.add({ targets: this.player, alpha: 0.25, duration: 100, yoyo: true, repeat: 4 });
    if (this.lives <= 0) this.endGame("Ouch! Out of hearts");
  }

  tick() {
    if (this.over) return;
    this.timeLeft -= 1;
    this.timeText.setText(String(this.timeLeft));
    // Things fall a little faster every second, and appear a little more often.
    this.fallSpeed = Math.min(FALL_SPEED_MAX, this.fallSpeed + (FALL_SPEED_MAX - FALL_SPEED_START) / GAME_SECONDS);
    this.spawner.delay = Math.max(300, this.spawner.delay - 6);
    if (this.timeLeft <= 5 && this.timeLeft > 0) {
      playSound("tick");
      this.timeText.setColor(COLORS.bad);
      this.tweens.add({ targets: this.timeText, scale: { from: uiScale(this) * 1.3, to: uiScale(this) }, duration: 300 });
    }
    if (this.timeLeft <= 0) this.endGame("Time's up!");
  }

  update() {
    if (this.over) return;

    // Steer: keys first, otherwise glide toward your finger or mouse.
    let speed = 0;
    if (this.keys.left.isDown || this.keys.a.isDown) speed = -PLAYER_SPEED;
    else if (this.keys.right.isDown || this.keys.d.isDown) speed = PLAYER_SPEED;
    else if (this.targetX !== null) {
      const gap = this.targetX - this.player.x;
      speed = Math.abs(gap) < 6 ? 0 : Phaser.Math.Clamp(gap * 9, -PLAYER_SPEED, PLAYER_SPEED);
    }
    this.player.setVelocityX(speed);
    this.player.angle = Phaser.Math.Linear(this.player.angle, (speed / PLAYER_SPEED) * 14, 0.2); // lean into the move

    // Put things that fell off the bottom back in the pool.
    const bottom = this.scale.height + 60;
    const things = this.things.getChildren();
    for (let i = 0; i < things.length; i++) {
      if (things[i].active && things[i].y > bottom) things[i].disableBody(true, true);
    }
  }

  endGame(reason) {
    if (this.over) return;
    this.over = true;
    this.time.removeEvent([this.spawner, this.clock]); // stop spawning and the countdown
    this.physics.pause();
    this.player.setVelocity(0);
    playSound("end");
    this.time.delayedCall(700, () => {
      this.cameras.main.fadeOut(250);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("End", { score: this.score, reason: reason }));
    });
  }
}

// =====================================================================
//  🏆 END — your score, and play again
// =====================================================================
class End extends Phaser.Scene {
  constructor() { super("End"); }

  init(data) {
    this.finalScore = data.score || 0;
    this.reason = data.reason || "Game over";
  }

  create() {
    const newBest = this.finalScore > bestScore;
    if (newBest) bestScore = this.finalScore;

    this.panel = this.add.image(0, 0, "panel");
    this.heading = this.add.text(0, 0, this.reason, textStyle(40, COLORS.title)).setOrigin(0.5);
    this.scoreText = this.add.text(0, 0, "0", textStyle(96, COLORS.text)).setOrigin(0.5);
    this.bestText = this.add.text(0, 0, newBest && this.finalScore > 0 ? "🏆 New best!" : "Best: " + bestScore, textStyle(28)).setOrigin(0.5);
    this.againButton = makeButton(this, "Play again", () => this.playAgain());
    this.hint = this.add.text(0, 0, "Space to play again", textStyle(22, "#d8cfff")).setOrigin(0.5);
    this.party = this.add.particles(0, 0, "spark", {
      speed: { min: 260, max: 620 },
      angle: { min: 240, max: 300 },
      gravityY: 700,
      lifespan: 1800,
      scale: { start: 1.5, end: 0.3 },
      tint: [0xffd166, 0x06d6a0, 0xff5d8f, 0x7c5cff, 0x4cc9f0],
      emitting: false,
    });

    keepLaidOut(this);

    // Count the score up, then celebrate.
    this.tweens.addCounter({
      from: 0,
      to: this.finalScore,
      duration: Math.min(1200, 120 + this.finalScore * 60),
      ease: "Cubic.easeOut",
      onUpdate: (tween) => this.scoreText.setText(String(Math.round(tween.getValue()))),
      onComplete: () => {
        if (newBest && this.finalScore > 0) {
          playSound("best");
          this.party.explode(80, this.scale.width / 2, this.scale.height);
        }
      },
    });

    this.input.keyboard.once("keydown-SPACE", () => this.playAgain());
    this.input.keyboard.once("keydown-ENTER", () => this.playAgain());
    this.cameras.main.fadeIn(250);
  }

  layout() {
    const { width, height } = this.scale;
    const s = uiScale(this);
    const cx = width / 2;
    const cy = height * 0.45;
    // The panel never gets wider than the screen.
    const panelScale = Math.min(s, (width * 0.92) / 520);
    this.panel.setPosition(cx, cy).setScale(panelScale).setTint(0x3b2a9e).setAlpha(0.55);
    this.heading.setPosition(cx, cy - 140 * s).setScale(s).setWordWrapWidth((width / s) * 0.85);
    this.scoreText.setPosition(cx, cy - 40 * s).setScale(s);
    this.bestText.setPosition(cx, cy + 52 * s).setScale(s);
    this.againButton.baseScale = s;
    this.againButton.setPosition(cx, cy + 140 * s).setScale(s);
    this.hint.setPosition(cx, cy + 250 * s).setScale(s);
  }

  playAgain() {
    if (this.leaving) return;
    this.leaving = true;
    wakeUpSound();
    playSound("start");
    this.scene.start("Play");
  }
}

// =====================================================================
//  🚀 START THE GAME
// =====================================================================
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE },
  physics: { default: "arcade", arcade: { debug: false } },
  input: { activePointers: 2 },
  scene: [Boot, Title, Play, End],
});
</script>
</body>
</html>
`;

const DOM_QUIZ = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Math Quest</title>
${libraryTag("font-fredoka-600")}
${libraryTag("font-fredoka-700")}
${libraryTag("font-nunito-800")}
${libraryTag("gsap")}
${libraryTag("zzfx")}
${libraryTag("confetti")}
<style>
  /* ===== The look: colours and sizes in one place ===== */
  :root {
    --sky-top: #ffe8a3;
    --sky-bottom: #ffb4c8;
    --ink: #2b1a78;
    --soft-ink: #6b5aa6;
    --card: #ffffff;
    --card-edge: #e3dafc;
    --choice: #7c5cff;
    --choice-edge: #4b2fd1;
    --right: #06d6a0;
    --right-edge: #04a57b;
    --wrong: #ff5d8f;
    --wrong-edge: #d93b6c;
    --gold: #ffb703;
    --radius: 24px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body {
    background: linear-gradient(160deg, var(--sky-top), var(--sky-bottom));
    color: var(--ink);
    font-family: "Nunito", system-ui, sans-serif;
    font-weight: 800;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  h1, h2, button, .big { font-family: "Fredoka", system-ui, sans-serif; font-weight: 700; }

  /* One screen at a time: title, play, end. */
  .screen {
    position: fixed; inset: 0;
    display: none; flex-direction: column; align-items: center; justify-content: center;
    gap: clamp(12px, 3vh, 28px);
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    text-align: center;
  }
  .screen.active { display: flex; }

  .card {
    width: min(560px, 100%);
    background: var(--card);
    border-radius: var(--radius);
    box-shadow: 0 8px 0 var(--card-edge), 0 18px 40px rgba(43, 26, 120, 0.18);
    padding: clamp(18px, 4vw, 32px);
  }
  h1 { font-size: clamp(40px, 9vw, 76px); margin: 0; color: var(--ink); letter-spacing: 0.5px; }
  .tagline { font-size: clamp(18px, 3.6vw, 24px); color: var(--soft-ink); margin: 0; }
  .mascot { font-size: clamp(64px, 16vw, 120px); line-height: 1; }

  /* Chunky toy buttons with a coloured edge underneath. */
  .btn {
    border: 0; cursor: pointer;
    min-height: 64px; padding: 0 36px;
    border-radius: 999px;
    font-size: clamp(22px, 4.6vw, 30px);
    color: #fff;
    background: var(--choice);
    box-shadow: 0 7px 0 var(--choice-edge);
    transition: transform 0.08s, box-shadow 0.08s;
  }
  .btn:active { transform: translateY(5px); box-shadow: 0 2px 0 var(--choice-edge); }
  .btn:focus-visible { outline: 4px solid var(--gold); outline-offset: 4px; }

  /* The game's top bar: progress, streak and score. */
  .hud { width: min(560px, 100%); display: flex; align-items: center; gap: 12px; }
  .progress { flex: 1; height: 18px; border-radius: 99px; background: rgba(255, 255, 255, 0.6); overflow: hidden; }
  .progress > div { height: 100%; width: 0%; border-radius: 99px; background: linear-gradient(90deg, var(--right), #4cc9f0); }
  .pill { background: #fff; border-radius: 99px; padding: 6px 14px; font-size: 20px; box-shadow: 0 4px 0 var(--card-edge); }

  .question { font-size: clamp(44px, 12vw, 88px); margin: 4px 0 0; }
  .prompt { margin: 0; color: var(--soft-ink); font-size: clamp(16px, 3.4vw, 20px); }
  .choices { width: min(560px, 100%); display: grid; grid-template-columns: 1fr 1fr; gap: clamp(10px, 2.4vw, 16px); }
  .choice { min-height: clamp(72px, 14vh, 104px); font-size: clamp(30px, 8vw, 46px); border-radius: var(--radius); }
  .choice .key { display: block; font-size: 13px; opacity: 0.75; font-family: "Nunito", sans-serif; }
  .choice.right { background: var(--right); box-shadow: 0 7px 0 var(--right-edge); }
  .choice.wrong { background: var(--wrong); box-shadow: 0 7px 0 var(--wrong-edge); }
  .choice:disabled { cursor: default; }
  .feedback { min-height: 1.4em; font-size: clamp(20px, 4.4vw, 28px); margin: 0; }

  .score { font-size: clamp(64px, 16vw, 110px); margin: 0; }
  .stars { font-size: clamp(36px, 9vw, 56px); letter-spacing: 6px; }

  @media (prefers-reduced-motion: reduce) {
    .btn { transition: none; }
  }
</style>
</head>
<body>

<!-- 🏠 TITLE -->
<section class="screen active" id="title-screen" aria-labelledby="game-title">
  <div class="mascot" aria-hidden="true">🦉</div>
  <h1 id="game-title">Math Quest</h1>
  <p class="tagline" id="how-to-play">Pick the right answer. Get them in a row for a streak!</p>
  <button class="btn" id="start-button">Let's go!</button>
  <p class="prompt">Tip: press 1, 2, 3 or 4 to answer</p>
</section>

<!-- ⭐ PLAY -->
<section class="screen" id="play-screen" aria-label="Quiz">
  <div class="hud">
    <div class="progress" role="progressbar" aria-label="Progress" aria-valuemin="0" id="progress"><div id="progress-fill"></div></div>
    <span class="pill" id="streak" aria-label="Streak">🔥 0</span>
    <span class="pill" id="score" aria-label="Score">⭐ 0</span>
  </div>
  <div class="card">
    <p class="prompt" id="question-number">Question 1</p>
    <h2 class="question" id="question" aria-live="polite">2 + 3</h2>
  </div>
  <div class="choices" id="choices"></div>
  <p class="feedback" id="feedback" aria-live="assertive"></p>
</section>

<!-- 🏆 END -->
<section class="screen" id="end-screen" aria-labelledby="end-title">
  <div class="card">
    <h2 id="end-title" class="big">Quest complete!</h2>
    <p class="score big" id="final-score">0</p>
    <p class="prompt" id="final-detail">out of 10</p>
    <div class="stars" id="final-stars" aria-label="Stars"></div>
  </div>
  <button class="btn" id="again-button">Play again</button>
</section>

<script>
// =====================================================================
//  🎮 GAME SETTINGS — change these to change the game!
// =====================================================================
const GAME_TITLE = "Math Quest"; // the game's name
const QUESTION_COUNT = 10;     // how many questions in one quest
const BIGGEST_NUMBER = 10;     // the biggest number in a sum
const CHOICES = 4;             // how many answers to pick from
const NEXT_QUESTION_MS = 900;  // pause after answering

// Make one question. Change this to quiz anything!
// (For a fixed list, return items from an array instead.)
function makeQuestion() {
  const a = randomInt(1, BIGGEST_NUMBER);
  const b = randomInt(1, BIGGEST_NUMBER);
  return { text: a + " + " + b, answer: a + b };
}

// =====================================================================
//  🔊 SOUNDS — made by ZzFX (each list of numbers is one sound)
// =====================================================================
const SOUNDS = {
  click: [1, , 520, .01, .02, .08, 1, 1.4],
  right: [1.2, , 784, .02, .08, .25, 1, 1.4, , , 392, .06],
  wrong: [1.2, , 196, .02, .1, .3, 3, 1.2, -6],
  streak: [1.3, , 1046, .02, .1, .3, 1, 1.6, , , 523, .05, .08],
  finish: [1.4, , 523, .02, .35, .5, 1, 1.2, , , 262, .1, .12],
};
function wakeUpSound() {
  try { if (zzfxX.state !== "running") zzfxX.resume(); } catch (e) { /* no sound, still fun */ }
}
function playSound(name) {
  try { zzfx(...SOUNDS[name]); } catch (e) { /* no sound, still fun */ }
}

// =====================================================================
//  🧰 HELPERS
// =====================================================================
const CALM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const keep = list[i]; list[i] = list[j]; list[j] = keep;
  }
  return list;
}

// Wrong answers that look believable (close to the right one).
function makeChoices(answer) {
  const options = new Set([answer]);
  while (options.size < CHOICES) {
    const nearby = answer + randomInt(-4, 4);
    if (nearby >= 0) options.add(nearby);
  }
  return shuffle(Array.from(options));
}

// Fade one screen out and the next one in.
function showScreen(id) {
  const next = $(id);
  document.querySelectorAll(".screen.active").forEach((screen) => {
    if (screen !== next) screen.classList.remove("active");
  });
  next.classList.add("active");
  if (!CALM) gsap.from(next.children, { y: 30, opacity: 0, duration: 0.45, stagger: 0.07, ease: "back.out(1.6)" });
}

function celebrate(power) {
  if (CALM) return;
  confetti({ particleCount: 60 * power, spread: 70 + 20 * power, origin: { y: 0.7 }, colors: ["#7c5cff", "#06d6a0", "#ffb703", "#ff5d8f", "#4cc9f0"] });
}

// =====================================================================
//  ⭐ THE GAME
// =====================================================================
// Everything that changes while you play lives here.
let state = null;

function resetGame() {
  state = { number: 0, score: 0, streak: 0, best: 0, answered: false, current: null };
}

function startGame() {
  wakeUpSound();
  playSound("click");
  resetGame();
  showScreen("play-screen");
  nextQuestion();
}

function nextQuestion() {
  if (state.number >= QUESTION_COUNT) return endGame();
  state.number += 1;
  state.answered = false;
  state.current = makeQuestion();

  $("question-number").textContent = "Question " + state.number + " of " + QUESTION_COUNT;
  $("question").textContent = state.current.text;
  $("feedback").textContent = "";
  $("progress").setAttribute("aria-valuenow", String(state.number - 1));
  $("progress").setAttribute("aria-valuemax", String(QUESTION_COUNT));
  gsap.to("#progress-fill", { width: ((state.number - 1) / QUESTION_COUNT) * 100 + "%", duration: 0.4, ease: "power2.out" });

  // Make a button for each answer.
  const box = $("choices");
  box.textContent = "";
  makeChoices(state.current.answer).forEach((value, i) => {
    const button = document.createElement("button");
    button.className = "btn choice";
    button.dataset.value = String(value);
    button.innerHTML = '<span class="key">' + (i + 1) + "</span>" + value;
    button.addEventListener("click", () => answer(button));
    box.appendChild(button);
  });
  if (!CALM) {
    gsap.from("#question", { scale: 0.6, opacity: 0, duration: 0.35, ease: "back.out(2)" });
    gsap.from(".choice", { y: 24, opacity: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" });
  }
}

function answer(button) {
  if (state.answered) return;
  state.answered = true;
  const right = Number(button.dataset.value) === state.current.answer;
  document.querySelectorAll(".choice").forEach((b) => {
    b.disabled = true;
    if (Number(b.dataset.value) === state.current.answer) b.classList.add("right");
  });

  if (right) {
    state.score += 1;
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
    $("feedback").textContent = state.streak >= 3 ? "🔥 " + state.streak + " in a row!" : "Yes! 🎉";
    playSound(state.streak >= 3 ? "streak" : "right");
    if (!CALM) gsap.fromTo(button, { scale: 1 }, { scale: 1.12, duration: 0.15, yoyo: true, repeat: 1 });
    if (state.streak % 3 === 0) celebrate(1);
  } else {
    state.streak = 0;
    button.classList.add("wrong");
    $("feedback").textContent = "It was " + state.current.answer + " — next one!";
    playSound("wrong");
    if (!CALM) gsap.fromTo(button, { x: -10 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" });
  }

  $("score").textContent = "⭐ " + state.score;
  $("streak").textContent = "🔥 " + state.streak;
  if (!CALM) gsap.fromTo(right ? "#score" : "#streak", { scale: 1.3 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
  setTimeout(nextQuestion, NEXT_QUESTION_MS);
}

function endGame() {
  gsap.to("#progress-fill", { width: "100%", duration: 0.3 });
  const share = state.score / QUESTION_COUNT;
  const stars = share >= 0.9 ? 3 : share >= 0.6 ? 2 : share > 0 ? 1 : 0;
  $("end-title").textContent = stars === 3 ? "Amazing! 🌟" : stars === 2 ? "Great job!" : "Nice try!";
  $("final-detail").textContent = "out of " + QUESTION_COUNT + " · best streak " + state.best;
  $("final-stars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);
  showScreen("end-screen");
  playSound("finish");

  // Count the score up.
  const counter = { value: 0 };
  gsap.to(counter, {
    value: state.score,
    duration: CALM ? 0 : 0.9,
    ease: "power2.out",
    onUpdate: () => { $("final-score").textContent = String(Math.round(counter.value)); },
  });
  if (stars >= 2) celebrate(stars);
}

// =====================================================================
//  🎛️ CONTROLS — set up once
// =====================================================================
document.title = GAME_TITLE;
$("game-title").textContent = GAME_TITLE;
$("start-button").addEventListener("click", startGame);
$("again-button").addEventListener("click", startGame);
document.addEventListener("keydown", (event) => {
  const onTitle = $("title-screen").classList.contains("active");
  const onEnd = $("end-screen").classList.contains("active");
  if ((onTitle || onEnd) && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    startGame();
    return;
  }
  const n = Number(event.key);
  if (n >= 1 && n <= CHOICES) {
    const button = document.querySelectorAll(".choice")[n - 1];
    if (button && !button.disabled) answer(button);
  }
});
if (!CALM) gsap.to(".mascot", { y: -12, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });
</script>
</body>
</html>
`;

export const STARTER_KITS: Record<StarterKitId, StarterKit> = {
  "phaser-arcade": {
    id: "phaser-arcade",
    name: "Action game kit (Phaser)",
    bestFor:
      "Anything that moves: catch, dodge, clicker/tap, maze, platformer, runner, shooter, sports, physics toys.",
    map: [
      "GAME SETTINGS: GAME_TITLE (the game's name, shown everywhere), how-to line, the emoji for the player/good/bad things, speeds, timings, lives.",
      "COLORS and SOUNDS (ZzFX number lists) right below.",
      "HELPERS: textStyle, emojiTexture (any emoji becomes a sprite), dotTexture, roundBoxTexture, makeButton, uiScale (fits phones and big screens), keepLaidOut (layout on resize).",
      "Scenes: Boot (makes textures, waits for the font) → Title → Play (the game: create/layout/update, spawn from a pool, overlap callbacks, sparkles, score pop, shake on hurt, countdown) → End (score count-up, best score, Play again).",
      "Change the game mostly in Play; keep Boot/Title/End and the helpers.",
    ].join("\n"),
    code: PHASER_ARCADE,
  },
  "dom-quiz": {
    id: "dom-quiz",
    name: "Quiz & card game kit (DOM + GSAP)",
    bestFor:
      "Questions, words and cards: quiz, trivia, math, spelling, typing, memory/matching, sorting, story choices.",
    map: [
      "<style>: design tokens in :root (colours, radius), .screen (title/play/end), .card, .btn (toy buttons), .choices grid.",
      "Three <section class=\"screen\"> blocks: #title-screen, #play-screen, #end-screen.",
      "GAME SETTINGS: GAME_TITLE (the game's name — the <h1> and browser tab follow it), counts, and makeQuestion() — change this to quiz anything (or return items from a list).",
      "SOUNDS (ZzFX), helpers (showScreen with GSAP, celebrate with confetti, shuffle).",
      "The game: resetGame → startGame → nextQuestion → answer → endGame; one state object.",
      "CONTROLS: listeners set up once at the bottom (buttons + keys 1-4, Enter/Space).",
    ].join("\n"),
    code: DOM_QUIZ,
  },
};
