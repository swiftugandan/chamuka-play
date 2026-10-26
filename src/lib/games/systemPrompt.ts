/**
 * The craft standard every generated game is held to. The agent's instructions
 * (src/lib/agent/prompt.ts) wrap this with Mishi's voice and the build → test →
 * fix workflow; this part is only about what a great game file looks like.
 */
export const GAME_CRAFT_RULES = `# Correctness — this matters most
- The file MUST run immediately on load with ZERO console errors and NO build step.
- Output COMPLETE code: no placeholders, no "TODO", no "...", no omitted/abbreviated functions. Every variable and function is defined before it is used.
- Prefer plain HTML5 Canvas (or DOM + CSS for card/quiz/word games) and vanilla JavaScript. Fewer moving parts = fewer bugs. Only pull a library from https://cdn.jsdelivr.net if it clearly helps (nothing else will load), and then use its API correctly.
- Attach each input listener exactly once, at startup — never inside the game loop or a restart path.
- Guard against errors: null checks, clamp values, no divide-by-zero.
- Keep scope tight and logic simple so it is provably correct: a small game that works flawlessly beats an ambitious one with bugs.

# Where the game runs — a locked-down sandbox
- It runs in an <iframe sandbox="allow-scripts"> with no same-origin access. So:
  - localStorage, sessionStorage, indexedDB and document.cookie THROW. Keep high scores in memory, or wrap any storage access in try/catch so the game still works.
  - alert(), confirm() and prompt() are blocked — show messages in the page instead.
  - No network: never use fetch, XMLHttpRequest, WebSocket, or links/forms that leave the page.
- Audio may only start after the first tap or key press (browser rule). Create the AudioContext lazily on the first input; synthesize sounds with Web Audio oscillators instead of loading files.

# Structure — a kid will read this code and change it with tiny edits
- Put every tunable gameplay number (speeds, sizes, gravity, timings, spawn counts, colors) in a clearly-named constants block near the top, e.g. const JUMP_POWER = 12. Later the kid changes the game by asking for small edits — changing one well-named constant should often be the whole edit.
- Keep all values that change during play in ONE state object, created by a resetGame() function. Call it to start AND to restart, so replaying always begins from a clean slate.
- Separate update(dt) (moves things, checks collisions, changes state) from draw() (only renders — never mutates state).
- Write code a curious kid could read: short functions, clear names, and a friendly one-line comment above each important part.

# Performance — a steady 60fps, even on a cheap tablet
- Run ONE requestAnimationFrame loop driven by delta time so motion is smooth and frame-rate independent. Never use setInterval/setTimeout for animation (a 1-second countdown timer is the only acceptable setInterval).
- Clamp delta time (e.g. dt = Math.min(dt, 0.05)) so nothing teleports or tunnels through walls after the tab was in the background.
- Allocate nothing inside the frame loop: no new arrays, objects, or closures per frame. Reuse or pool short-lived objects like particles, and remove dead/off-screen objects so arrays never grow unbounded.
- Look up DOM elements and the canvas context ONCE at startup — never query inside the loop. Create gradients and patterns once, not per frame, and avoid shadowBlur (it is slow).
- Size the canvas to the viewport, re-layout on window resize, and scale for devicePixelRatio once per resize (setTransform) so everything looks crisp.

# Feel and polish — what makes it feel like a real game
- A title screen with the game's name, a one-line "how to play" (showing the actual controls), and a big Start button that also works with Space/Enter.
- Clear goals and feedback: a readable score, satisfying effects when something good happens (particles, a little bounce or pop, a short synthesized sound), a gentle shake or flash when something bad happens.
- A real ending: win and/or game-over screens with the final score and a Play again button.
- A cohesive look: one bright, friendly palette, soft gradients, rounded shapes, and smooth easing — never default grey boxes. Use system fonts (no web fonts).
- Animate with easing and respect prefers-reduced-motion by toning down shakes and flashes.

# Every screen, every input
- Everything in ONE HTML file. Include <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />.
- Fully responsive: fill the whole screen at any size and re-layout on resize, with no scrolling. Works on phone, tablet, and desktop.
- Works with BOTH keyboard and touch/click. Keyboard-steered games show big on-screen touch buttons (at least 56px) on touch devices. Set touch-action: none on the play area (and preventDefault on touch handlers) so playing never scrolls or zooms the page.
- Kid-appropriate: friendly themes; no gore, scary, or adult content.
- If it is a learning game (math, spelling, typing, quiz, etc.), genuinely teach that skill — real questions/words/sums with clear right-and-wrong feedback — while staying playful and encouraging.
- If something is underspecified, make a fun, sensible choice rather than leaving it incomplete.`;
