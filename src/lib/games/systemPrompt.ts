import { GAME_LIBRARIES, libraryTag } from "./libraries";
import { STARTER_KITS } from "./kits";

/**
 * The craft standard every generated game is held to. The agent's instructions
 * (src/lib/agent/prompt.ts) wrap this with Mishi's voice and the build → test →
 * fix workflow; this part is only about what a great game file looks like.
 * The library list and kit list come from their catalogs, so they never drift.
 */

const LIBRARY_LIST = GAME_LIBRARIES.map((lib) => `- ${libraryTag(lib.id)}\n  ${lib.purpose}`).join("\n");

const KIT_LIST = Object.values(STARTER_KITS)
  .map((kit) => `- ${kit.id} — ${kit.name}. Best for: ${kit.bestFor}`)
  .join("\n");

export const GAME_CRAFT_RULES = `# The bar: a game that feels professionally made
Every game should feel like it came from a real game studio: one clear idea, great game feel, a cohesive look, smooth on any device, and zero bugs. A child should want to play it again straight away.

# Build on a starter kit
New games start from a polished, tested kit (startFromKit), never from an empty file:
${KIT_LIST}
- Keep the kit's structure: the settings block, the helpers, the screens/scenes, layout-on-resize, input setup and sound unlock. Replace the demo content with the child's idea. Many ideas need only new settings, emoji, colours and a few behaviour changes; bigger ideas rework the Play scene (or the quiz logic) and keep the rest.
- Only write a game from scratch when no kit fits (e.g. a drawing toy or a music maker) — and then still use the libraries below and meet everything in this standard.

# Libraries — the only files a game may load
Copy these tags exactly, in <head>, before the game's own script. Nothing else can load: other URLs, other versions, images, audio files and web fonts from anywhere else are rejected.
${LIBRARY_LIST}

# Phaser 3.90 — use it correctly (it is Phaser 3, not Phaser 4)
- Game: new Phaser.Game({ type: Phaser.AUTO, parent: "game", transparent: true, scale: { mode: Phaser.Scale.RESIZE }, physics: { default: "arcade" }, scene: [Boot, Title, Play, End] }). The page background (CSS) shows through the transparent canvas.
- There are no image files. Make every texture in Boot: emojiTexture(scene, key, emoji, size) for characters and items, Graphics + generateTexture for shapes and tiles, dotTexture for particles.
- Scenes: class Play extends Phaser.Scene { constructor() { super("Play"); } init(data) {} create() {} update(time, delta) {} }. Switch with this.scene.start("End", { score }).
- Phaser reuses each scene object every time it starts: reset EVERY flag and counter at the top of init() or create() (e.g. this.leaving = false), or the second round breaks.
- Responsive: read this.scale.width/height; place everything in layout() and call keepLaidOut(this); size UI with uiScale(this). Never assume 800×600.
- Arcade physics: this.physics.add.image/sprite/group, body.setCircle(r, offsetX, offsetY) for fair round hitboxes, this.physics.add.overlap / collider, setVelocity, setCollideWorldBounds. Pool things that come and go: group.get(x, y, key) then enableBody(true, x, y, true, true); remove with disableBody(true, true).
- Matter physics (physics: { default: "matter" }) is built in, for rolling, stacking and wobbly games.
- Particles (Phaser 3.60+ API): const burst = this.add.particles(0, 0, "spark", { speed: { min, max }, lifespan, scale: { start: 1, end: 0 }, emitting: false }); burst.explode(count, x, y). There is no createEmitter.
- Tweens: this.tweens.add({ targets, scale, y, alpha, duration, ease: "Back.easeOut", yoyo, repeat }); this.tweens.addCounter({ from, to, onUpdate }) to count numbers up.
- Camera: this.cameras.main.shake(ms, intensity), .flash(ms, r, g, b), .fadeIn(ms) / .fadeOut(ms) then once("camerafadeoutcomplete", …).
- Timers: this.time.addEvent({ delay, loop: true, callback, callbackScope: this }) and this.time.delayedCall(ms, fn). Stop timers with this.time.removeEvent([timerA, timerB]) — NOT timer.remove(): in 3.90 that can stop later delayed calls in the scene from ever firing.
- Input, attached once in create(): this.input.keyboard.addKeys({ left: "LEFT", right: "RIGHT", a: "A", d: "D" }) checked in update(); this.input.keyboard.once("keydown-SPACE", fn) on menus; this.input.on("pointerdown" | "pointermove" | "pointerup", fn) so touch and mouse work too.
- Text: this.add.text(x, y, words, textStyle(size, color)).setOrigin(0.5); change it with setText — never create text every frame.
- update(time, delta): no new objects or closures; loop over group.getChildren() with a plain for loop.

# GSAP — for DOM games (quiz, cards, words)
- gsap.to / from / fromTo(targets, { y, scale, opacity, duration, ease: "back.out(1.6)" }); gsap.timeline() for sequences; stagger for lists; animate transform and opacity only.
- Layout with CSS grid/flex and clamp() sizes so it fits a phone; buttons at least 56px tall (64px+ for main actions).
- confetti({ particleCount, spread, origin: { y: 0.7 } }) to celebrate wins and streaks.
- Put text on the page with textContent, never innerHTML.

# Sound — ZzFX, no audio files
- Keep sounds in one SOUNDS object of ZzFX number lists and play them with zzfx(...SOUNDS.name) inside try/catch.
- Browsers start sound only after the first tap or key press: call zzfxX.resume() in that first handler (the kits' wakeUpSound()).
- Short, pleasant sounds for every important event (start, score, hurt, win). No constant noise.

# Fonts
- Fredoka (titles, buttons, scores) and Nunito (readable text) via the catalog stylesheets, with system-ui as the fallback. In Phaser, wait for document.fonts.load(...) before showing text (the kit's Boot does).

# Correctness — non-negotiable
- The file MUST run immediately on load with ZERO console errors and NO build step.
- Output COMPLETE code: no placeholders, no "TODO", no "...", no omitted functions. Every variable and function is defined before it is used.
- Attach each input listener exactly once, at startup — never inside the game loop or a restart path.
- Guard against errors: null checks, clamp values, no divide-by-zero.
- Keep scope tight: a polished small game that works flawlessly beats an ambitious one with bugs.

# Where the game runs — a locked-down sandbox
- It runs in an <iframe sandbox="allow-scripts"> with no same-origin access. So:
  - localStorage, sessionStorage, indexedDB and document.cookie THROW. Keep high scores in memory (or wrap storage in try/catch so the game still works).
  - alert(), confirm() and prompt() are blocked — show messages in the page instead.
  - Never add a full-screen button or call requestFullscreen: it is blocked in the frame, and the app already has its own Full screen button. Just make the game fill whatever size it is given.
  - No network beyond the catalog libraries: never use fetch, XMLHttpRequest, WebSocket, images or sounds from URLs, or links/forms that leave the page.
- Playtest screenshots may show emoji as empty boxes if the test browser lacks an emoji font — that is the test machine, not the game.

# Structure — a kid will read this code and change it with tiny edits
- The game's name lives in ONE place, the GAME_TITLE setting; the title screen and the browser tab show it (the kits already do). Rename the game there.
- Every tunable number, word, emoji and colour lives in the settings block near the top with a clear name and a friendly comment (const JUMP_POWER = 12; // how high you jump). Later the child changes the game by asking for small edits — changing one well-named setting should often be the whole edit.
- All values that change during play start fresh in one place (Phaser: the top of Play.create(); DOM: one state object made by resetGame()), so replaying always begins from a clean slate.
- Short functions, clear names, and a friendly one-line comment above each important part.

# Performance — a steady 60fps, even on a cheap tablet
- One game loop (Phaser's update, or one requestAnimationFrame loop driven by delta time, with dt clamped to 0.05s). Never setInterval for animation.
- Allocate nothing per frame; pool short-lived objects; remove what leaves the screen so nothing grows without limit.
- Look things up once at startup, not inside the loop.

# Game feel — what makes it feel professional
- Three screens: a title screen (the game's name, a one-line how-to-play that shows the real controls, a big Play button that also works with Space/Enter), the game, and an end screen (final score counting up, best score, a one-tap Play again).
- Feedback for every action: a tween pop on the score, particles or confetti on success, a floating "+1", a short sound; a brief shake and flash on damage with a moment of safety after; eased transitions between screens; something gently animated on the title screen.
- A fair difficulty curve: the first seconds are winnable by anyone, then it ramps up steadily. No instant, unavoidable losses.
- The goal and the score/time/lives are always visible and readable (at least 24px on a phone).
- A cohesive look: one palette of 5–6 colours, a gradient background, outlined or shadowed text for contrast, rounded shapes, consistent spacing. Characters and items are emoji or drawn shapes — never plain grey boxes.
- Respect prefers-reduced-motion: skip shakes, flashes and confetti, keep the game playable.

# Every screen, every input
- Everything in ONE HTML file. Include <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />.
- Fully responsive: fills the screen at any size, re-lays out on resize, never scrolls. Works on phone, tablet and desktop, portrait and landscape.
- Works with BOTH keyboard and touch/mouse. Keyboard-steered games also steer by touch (drag, or big on-screen buttons of at least 56px). Set touch-action: none on the play area so playing never scrolls or zooms.
- Kid-appropriate: friendly themes; no gore, scary or adult content.
- Learning games genuinely teach the skill — real questions, words or sums with clear right-and-wrong feedback — while staying playful and encouraging.
- If something is underspecified, make a fun, sensible choice rather than leaving it incomplete.`;
