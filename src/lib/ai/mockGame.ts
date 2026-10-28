import { getStarter } from "@/lib/games/registry";
import type { AppliedEdit } from "./edits";
import type { StarterKitId } from "@/lib/agent/protocol";

/**
 * Offline game material for local demos (MOCK_AI=1). The scripted mock agent
 * (src/lib/agent/mockModel.ts) builds new games from the real starter kits
 * (mockKitEdits) and makes real find/replace edits to them, so the whole
 * studio — live preview, tool steps, what-changed diff, undo — works with no AI
 * provider at all. buildMockGame is a plain, library-free game kept for tests
 * that must run without a network (the browser playtest harness).
 */

const ACCENTS = ["#7a3cf0", "#ff4fa3", "#45b6fe", "#25d0a8", "#ffc233", "#ff7a66"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function clean(s: string): string {
  return s.replace(/[<>"'\\\r\n]/g, " ").trim().slice(0, 80);
}

function buildGame(opts: {
  title: string;
  accent: string;
  speed: number;
  note?: string;
}): string {
  const { title, accent, speed, note } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
<title>${clean(title)}</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:radial-gradient(120% 100% at 50% 0%,#173a8a,#0b1c44);font-family:system-ui,sans-serif;color:#fff;}
  #c{display:block;width:100vw;height:100vh;touch-action:none;}
  #hud{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:14px 18px;font-size:18px;font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.5);pointer-events:none;}
  #over{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(11,28,68,.86);text-align:center;}
  #over h1{font-size:32px;margin:0 0 6px;}
  #over button{margin-top:18px;padding:12px 26px;border:none;border-radius:999px;background:${accent};color:#fff;font-size:18px;font-weight:700;cursor:pointer;}
</style>
</head>
<body>
<div id="hud"><span>Score: <b id="s">0</b></span><span>Time: <b id="t">30</b></span></div>
<canvas id="c"></canvas>
<div id="over"><h1>Time's up! ${"⭐"}</h1><div>Final score: <b id="fs">0</b></div><button id="r">Play again</button></div>
<script>
(function(){
  var note="${clean(note || "first build")}";
  var cv=document.getElementById("c"),x=cv.getContext("2d");
  var W,H;function size(){W=cv.width=innerWidth;H=cv.height=innerHeight;}size();addEventListener("resize",size);
  var accent="${accent}",stars=[],score=0,time=30,running=true,spawn=0,fall=${speed};
  function makeStar(){return {x:Math.random()*(W-60)+30,y:-30,r:22+Math.random()*10,vy:fall+Math.random()*1.2,a:Math.random()*6.28};}
  function pop(px,py){for(var i=stars.length-1;i>=0;i--){var st=stars[i],dx=px-st.x,dy=py-st.y;if(dx*dx+dy*dy<(st.r+12)*(st.r+12)){stars.splice(i,1);score++;document.getElementById("s").textContent=score;return;}}}
  cv.addEventListener("pointerdown",function(e){var b=cv.getBoundingClientRect();pop(e.clientX-b.left,e.clientY-b.top);});
  function drawStar(st){x.save();x.translate(st.x,st.y);x.rotate(st.a);x.fillStyle=accent;x.beginPath();for(var i=0;i<5;i++){x.lineTo(0,-st.r);x.rotate(0.628);x.lineTo(0,-st.r*0.5);x.rotate(0.628);}x.closePath();x.fill();x.restore();}
  function loop(){if(!running)return;x.clearRect(0,0,W,H);spawn++;if(spawn>34){spawn=0;stars.push(makeStar());}for(var i=stars.length-1;i>=0;i--){var st=stars[i];st.y+=st.vy;st.a+=0.03;drawStar(st);if(st.y>H+40)stars.splice(i,1);}requestAnimationFrame(loop);}
  loop();
  var tm=setInterval(function(){if(!running)return;time--;document.getElementById("t").textContent=time;if(time<=0){running=false;document.getElementById("fs").textContent=score;document.getElementById("over").style.display="flex";}},1000);
  document.getElementById("r").addEventListener("click",function(){stars=[];score=0;time=30;running=true;document.getElementById("s").textContent=0;document.getElementById("t").textContent=30;document.getElementById("over").style.display="none";loop();});
})();
</script>
</body>
</html>`;
}

/** A brand-new demo game for a starter + idea. */
export function buildMockGame(input: { starterId: string; prompt: string }): {
  title: string;
  code: string;
} {
  const starter = getStarter(input.starterId);
  const accent = ACCENTS[hash(input.prompt) % ACCENTS.length];
  const idea = clean(input.prompt) || "Surprise";
  const title = `${starter?.label ?? "Game"}: ${idea}`.slice(0, 48);
  return { title, code: buildGame({ title, accent, speed: 2.2 }) };
}

/** The title the mock gives a new game: the kind of game plus the idea. */
export function mockTitle(input: { starterId: string; prompt: string }): string {
  const starter = getStarter(input.starterId);
  return `${starter?.label ?? "Game"}: ${clean(input.prompt) || "Surprise"}`.slice(0, 48);
}

/** Edits that turn a starter kit into the child's game (its title). */
export function mockKitEdits(kit: StarterKitId, title: string): AppliedEdit[] {
  const safe = clean(title);
  if (kit === "phaser-arcade") {
    return [
      { find: "<title>Star Catcher</title>", replace: `<title>${safe}</title>` },
      { find: 'const GAME_TITLE = "Star Catcher";', replace: `const GAME_TITLE = "${safe}";`, because: "Your game's name! ✨" },
    ];
  }
  return [
    { find: "<title>Math Quest</title>", replace: `<title>${safe}</title>` },
    { find: '<h1 id="game-title">Math Quest</h1>', replace: `<h1 id="game-title">${safe}</h1>`, because: "Your game's name! ✨" },
  ];
}

export const MOCK_NEW_GAME_SUGGESTIONS = [
  "make the stars fall faster",
  "change the star colour",
  "add a high score",
];

/** Real, small find/replace edits on the demo game for a change request, so
 *  the change log — hero snippet included — shows true before/after values. */
export function mockChangeEdits(
  code: string,
  instruction: string,
): { edits: AppliedEdit[]; summary: string; suggestions: string[] } {
  const faster = /fast|speed|hard|quick/i.test(instruction);
  const edits: AppliedEdit[] = [];

  // Games built from the starter kits: change their named settings.
  const fallStart = code.match(/const FALL_SPEED_START = (\d+);/);
  if (fallStart) {
    const next = String(faster ? Number(fallStart[1]) + 120 : Math.max(120, Number(fallStart[1]) - 60));
    edits.push({
      find: fallStart[0],
      replace: `const FALL_SPEED_START = ${next};`,
      because: "This number is how fast things fall — bigger = faster! ⚡",
    });
  }
  const biggest = code.match(/const BIGGEST_NUMBER = (\d+);/);
  if (biggest) {
    const next = String(faster ? Number(biggest[1]) * 2 : Math.max(5, Math.round(Number(biggest[1]) / 2)));
    edits.push({
      find: biggest[0],
      replace: `const BIGGEST_NUMBER = ${next};`,
      because: "Bigger numbers make the sums trickier! 🧠",
    });
  }
  const titleColor = code.match(/title: "(#[0-9a-fA-F]{6})",/) ?? code.match(/--choice: (#[0-9a-fA-F]{6});/);
  if (titleColor && !faster) {
    const next = ACCENTS[(hash(instruction) + 3) % ACCENTS.length];
    if (next.toLowerCase() !== titleColor[1].toLowerCase()) {
      edits.push({
        find: titleColor[0],
        replace: titleColor[0].replace(titleColor[1], next),
        because: "This is one of the game's colours. 🎨",
      });
    }
  }

  const fall = code.match(/fall=([\d.]+)/);
  if (fall) {
    const next = faster ? "3.6" : "2.8";
    if (next !== fall[1]) {
      edits.push({
        find: `fall=${fall[1]}`,
        replace: `fall=${next}`,
        because: "This number is how fast the stars fall — bigger = faster! ⚡",
      });
    }
  }

  const color = code.match(/accent="(#[0-9a-fA-F]{6})"/);
  if (color) {
    const next = ACCENTS[(hash(instruction) + 3) % ACCENTS.length];
    if (next.toLowerCase() !== color[1].toLowerCase()) {
      edits.push({
        find: `accent="${color[1]}"`,
        replace: `accent="${next}"`,
        because: "This is the colour of the stars. 🎨",
      });
    }
  }

  return {
    edits,
    summary: faster
      ? "I made the stars fall faster! ⚡"
      : "I gave your game a fresh new look! 🎨",
    suggestions: faster
      ? ["make the stars bigger", "change the colours", "add a high score"]
      : ["make it harder", "make the stars fall slower", "add a timer"],
  };
}
