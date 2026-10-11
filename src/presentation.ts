import type { RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import { menuRect, polar, rad, span, type State } from "./model";
export const BACKGROUND = "#060d17";
const INK = "#e5f3f4",
  MUTED = "#7795a7",
  ICE = "#9de8ed",
  GOLD = "#e5b17e";
const ringColors = ["#90cdd5", "#b2bcd9", "#caa580"];
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 14,
  color = MUTED,
  align: CanvasTextAlign = "left",
  weight = 400,
): void {
  ctx.font = `${weight} ${size}px ${size > 42 ? "Arial, sans-serif" : "monospace"}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function circle(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  width = 1,
): void {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function arc(
  ctx: CanvasRenderingContext2D,
  inner: number,
  outer: number,
  start: number,
  end: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, outer, rad(start), rad(end));
  ctx.arc(C.STAGE_CX, C.STAGE_CY, inner, rad(end), rad(start), true);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
function stars(ctx: CanvasRenderingContext2D): void {
  const glow = ctx.createRadialGradient(500, 460, 40, 500, 500, 680);
  glow.addColorStop(0, "#102432");
  glow.addColorStop(0.55, "#0a1723");
  glow.addColorStop(1, BACKGROUND);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (let i = 0; i < 230; i++) {
    const x = (i * 7919 + 67) % C.STAGE_W,
      y = (i * i * 137 + 97) % C.STAGE_H,
      r = i % 17 === 0 ? 1.3 : 0.65;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 7 === 0 ? "#81959d" : "#354b5c";
    ctx.fill();
    if (i % 41 === 0) {
      line(ctx, x - 4, y, x + 4, y, "#324956");
      line(ctx, x, y - 4, x, y + 4, "#324956");
    }
  }
}
function field(s: State, ctx: CanvasRenderingContext2D): void {
  circle(ctx, C.FIELD_RADIUS, "#365260");
  circle(ctx, C.FIELD_RADIUS + 5, "#132c3a");
  for (let a = 0; a < 360; a += 3) {
    const p = polar(C.FIELD_RADIUS + 3, a),
      q = polar(C.FIELD_RADIUS + (a % 15 === 0 ? 10 : 6), a);
    line(ctx, p.x, p.y, q.x, q.y, a % 15 === 0 ? "#547280" : "#253b48");
  }
  for (let i = 0; i < C.RINGS.length; i++) {
    const spec = C.RINGS[i],
      ring = s.rings[i],
      color = ringColors[i];
    circle(ctx, spec.midRadius, "#162d3a");
    for (const t of ring.targets) {
      const start =
          ring.angleDeg + t.slot * spec.slotWidthDeg + C.STRUCTURAL_GAP_DEG,
        end = start + spec.targetArcDeg,
        damaged = i === 1 && t.hp === 1;
      arc(
        ctx,
        spec.innerRadius,
        spec.outerRadius,
        start,
        end,
        damaged ? "#392e33" : ["#233e49", "#303a50", "#3b3834"][i],
        damaged ? "#c68078" : color,
      );
      arc(
        ctx,
        spec.innerRadius + 3,
        spec.innerRadius + 6,
        start + 0.5,
        end - 0.5,
        damaged ? "#d99479" : color,
      );
      arc(
        ctx,
        spec.outerRadius - 4,
        spec.outerRadius - 2,
        start + 0.8,
        end - 0.8,
        "#10242f",
      );
      for (let a = start + 2.5; a < end - 1; a += 3.5) {
        const p = polar(spec.innerRadius + 9, a),
          q = polar(spec.outerRadius - 6, a);
        line(ctx, p.x, p.y, q.x, q.y, damaged ? "#775359" : "#58717c");
      }
      const middle = (start + end) / 2,
        p = polar(spec.midRadius, middle);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rad(middle + 90));
      ctx.fillStyle = "#0c1d28";
      ctx.fillRect(-8, -5, 16, 10);
      ctx.strokeStyle = damaged ? "#ae6c68" : color;
      ctx.strokeRect(-8, -5, 16, 10);
      ctx.fillStyle = damaged ? "#ed9678" : ICE;
      ctx.fillRect(-4, -1, damaged ? 3 : 8, 2);
      ctx.restore();
      if (damaged) {
        const p1 = polar(spec.innerRadius, start + 4),
          p2 = polar(spec.midRadius, start + 7),
          p3 = polar(spec.outerRadius, start + 5);
        line(ctx, p1.x, p1.y, p2.x, p2.y, "#f0a78c", 2);
        line(ctx, p2.x, p2.y, p3.x, p3.y, "#f0a78c", 2);
      }
    }
  }
  circle(ctx, C.DEFLECTOR_TRACK_INNER - 4, "#183b48");
  circle(ctx, C.DEFLECTOR_TRACK_OUTER + 4, "#142f3b");
  for (let a = 0; a < 360; a += 30) {
    const p = polar(C.DEFLECTOR_TRACK_INNER - 13, a),
      q = polar(C.DEFLECTOR_TRACK_INNER - 7, a);
    line(ctx, p.x, p.y, q.x, q.y, "#335867");
  }
  const half = span(s) / 2,
    a = s.paddleAngle;
  ctx.save();
  ctx.shadowColor = ICE;
  ctx.shadowBlur = 14;
  arc(
    ctx,
    C.DEFLECTOR_TRACK_INNER,
    C.DEFLECTOR_TRACK_OUTER,
    a - half,
    a + half,
    "#7ad6dd",
    "#daffff",
  );
  ctx.restore();
  arc(
    ctx,
    C.DEFLECTOR_TRACK_INNER + 3,
    C.DEFLECTOR_TRACK_OUTER - 5,
    a - half + 1,
    a + half - 1,
    "#193f4f",
  );
  arc(
    ctx,
    C.DEFLECTOR_TRACK_OUTER - 3,
    C.DEFLECTOR_TRACK_OUTER,
    a - half + 1,
    a + half - 1,
    "#d6ffff",
  );
  for (const side of [-1, 1]) {
    const p = polar(
      (C.DEFLECTOR_TRACK_INNER + C.DEFLECTOR_TRACK_OUTER) / 2,
      a + side * (half - 2),
    );
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
  if (s.effects.shieldActive) {
    ctx.save();
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 16;
    circle(ctx, C.SHIELD_RADIUS, "#9cf7ef", 3);
    ctx.setLineDash([3, 6]);
    circle(ctx, C.SHIELD_RADIUS + 5, "#478d91");
    ctx.restore();
  }
  ctx.drawImage(
    s.assets.planet,
    C.STAGE_CX - C.PLANET_SPRITE_SIZE / 2,
    C.STAGE_CY - C.PLANET_SPRITE_SIZE / 2,
  );
  for (const p of s.pods) {
    const q = polar(p.r, p.angle);
    ctx.drawImage(
      s.assets.pods[p.kind],
      q.x - C.POD_SPRITE_SIZE / 2,
      q.y - C.POD_SPRITE_SIZE / 2,
    );
  }
  for (const b of s.balls) {
    if (s.effects.pierceTicks > 0) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const frame =
      Math.floor((s.simTicks - b.born) / C.BALL_FRAME_TICKS) %
      C.BALL_SPIN_FRAMES;
    ctx.drawImage(
      s.assets.ball[frame],
      b.x - C.BALL_SPRITE_SIZE / 2,
      b.y - C.BALL_SPRITE_SIZE / 2,
    );
  }
}
interface Playback {
  player: ParticleCanvasPlayer;
  age: number;
  seed: number;
}
const players = new WeakMap<CanvasRenderingContext2D, Map<number, Playback>>();
function particles(s: State, ctx: CanvasRenderingContext2D): void {
  let cache = players.get(ctx);
  if (!cache) {
    cache = new Map();
    players.set(ctx, cache);
  }
  for (const id of cache.keys())
    if (!s.flashes.some((f) => f.id === id)) cache.delete(id);
  for (const f of s.flashes) {
    ctx.save();
    const system = s.assets.particles[f.kind];
    // Undo only the player's built-in canvas fit, retaining the engine's stage fit.
    ctx.translate(f.x, f.y);
    ctx.scale(
      system.field.width / ctx.canvas.width,
      system.field.height / ctx.canvas.height,
    );
    ctx.translate(0, -ctx.canvas.height);
    let p = cache.get(f.id);
    if (!p || p.seed !== f.seed || p.age > f.age) {
      p = {
        player: new ParticleCanvasPlayer(system as ParticleSystem, ctx, {
          seed: f.seed,
          clear: false,
          composite: "lighter",
          pixelRadius: 1,
        }),
        age: 0,
        seed: f.seed,
      };
      cache.set(f.id, p);
    }
    p.player.update(Math.max(0, f.age - p.age));
    p.age = f.age;
    ctx.restore();
  }
}
function hud(s: State, ctx: CanvasRenderingContext2D): void {
  text(ctx, "SALVAGE VALUE", 30, 35, 12);
  text(ctx, String(s.score).padStart(6, "0"), 30, 68, 30, INK, "left", 600);
  text(ctx, "WAVE", 970, 35, 12, MUTED, "right");
  text(ctx, String(s.wave).padStart(2, "0"), 970, 68, 30, INK, "right", 600);
  text(ctx, "DEFLECTORS", 30, 926, 12);
  for (let i = 0; i < C.START_LIVES; i++) {
    ctx.fillStyle = i < s.lives ? ICE : "#263440";
    ctx.beginPath();
    ctx.moveTo(30 + i * 26, 940);
    ctx.lineTo(47 + i * 26, 940);
    ctx.lineTo(44 + i * 26, 947);
    ctx.lineTo(33 + i * 26, 947);
    ctx.closePath();
    ctx.fill();
  }
  text(ctx, String(s.lives) + " REMAINING", 30, 974, 11);
  const active: C.PodKind[] = [];
  if (s.effects.widenTicks) active.push("widen");
  if (s.effects.narrowTicks) active.push("narrow");
  if (s.effects.pierceTicks) active.push("pierce");
  if (s.effects.shieldActive) active.push("shield");
  text(ctx, "SYSTEMS", 970, 886, 12, MUTED, "right");
  if (!active.length) text(ctx, "NOMINAL", 970, 920, 14, ICE, "right");
  active.forEach((k, i) => {
    const y = 910 + i * 21;
    ctx.drawImage(s.assets.pods[k], 838, y - 16);
    const duration =
      k === "shield"
        ? "READY"
        : `${Math.ceil(s.effects[`${k as "widen" | "narrow" | "pierce"}Ticks`] / C.TICK_HZ)}s`;
    text(ctx, `${k.toUpperCase()} ${duration}`, 970, y, 11, ICE, "right");
  });
  if (s.balls.some((b) => b.parked)) {
    text(ctx, "SPACE  /  LAUNCH", 500, 737, 15, ICE, "center");
    text(ctx, "A / D  OR  ← / →  TO ORBIT", 500, 758, 10, MUTED, "center");
  }
  text(ctx, "P / ESC  PAUSE", 970, 974, 11, MUTED, "right");
}
function menu(s: State, ctx: CanvasRenderingContext2D): void {
  const items = s.screen === "title" ? C.TITLE_ITEMS : C.PAUSE_ITEMS;
  items.forEach((label, i) => {
    const r = menuRect(s, i)!;
    const selected = s.menuIndex === i;
    ctx.fillStyle = selected ? "#153542" : "#0a1721";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = selected ? "#85d4da" : "#294451";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
    if (selected) {
      ctx.fillStyle = ICE;
      ctx.fillRect(r.x, r.y, 3, r.height);
      text(ctx, "›", r.x + 24, r.y + 38, 24, ICE);
    }
    text(
      ctx,
      label,
      r.x + r.width / 2,
      r.y + 37,
      17,
      selected ? INK : MUTED,
      "center",
    );
    text(
      ctx,
      `0${i + 1}`,
      r.x + r.width - 28,
      r.y + 36,
      10,
      selected ? ICE : MUTED,
      "center",
    );
  });
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "rgba(5,14,24,.94)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#304e5e";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  for (const [a, b, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]) {
    line(ctx, a, b, a + dx * 14, b, ICE, 2);
    line(ctx, a, b, a, b + dy * 14, ICE, 2);
  }
}
export function render(s: State, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  stars(ctx);
  if (s.screen === "title") {
    ctx.save();
    ctx.globalAlpha = 0.34;
    field(s, ctx);
    ctx.restore();
    const shade = ctx.createRadialGradient(500, 500, 80, 500, 500, 440);
    shade.addColorStop(0, "rgba(6,13,23,.95)");
    shade.addColorStop(0.8, "rgba(6,13,23,.62)");
    shade.addColorStop(1, "rgba(6,13,23,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    text(ctx, "K / 07", 40, 47, 15, ICE);
    text(ctx, "ORBITAL RECOVERY DIVISION", 960, 47, 12, MUTED, "right");
    text(ctx, "A CONTROLLED CHAIN REACTION", 500, 245, 12, GOLD, "center");
    text(ctx, C.TITLE_TEXT, 500, 350, 104, INK, "center", 700);
    line(ctx, 337, 375, 663, 375, "#416675");
    text(
      ctx,
      "O R B I T A L   D E M O L I T I O N",
      500,
      405,
      13,
      ICE,
      "center",
    );
    ctx.drawImage(
      s.assets.planet,
      C.STAGE_CX - C.PLANET_SPRITE_SIZE / 2,
      C.STAGE_CY - C.PLANET_SPRITE_SIZE / 2,
    );
    menu(s, ctx);
    text(ctx, "CLEAR THE SKY. KEEP THE WORLD.", 500, 826, 12, MUTED, "center");
    text(
      ctx,
      "↑ ↓  SELECT     ENTER / SPACE  CONFIRM",
      500,
      922,
      11,
      MUTED,
      "center",
    );
    text(ctx, "SECTOR 03  /  LOW ORBIT", 40, 968, 10);
    text(ctx, "48 DERELICTS • ONE PLANET", 960, 968, 10, MUTED, "right");
  } else if (s.screen === "howto") {
    ctx.save();
    ctx.globalAlpha = 0.18;
    field(s, ctx);
    ctx.restore();
    panel(ctx, 150, 130, 700, 740);
    text(ctx, "FLIGHT MANUAL / 01", 195, 180, 12, GOLD);
    text(ctx, "HOW TO PLAY", 195, 245, 44, INK, "left", 600);
    const rows = [
      [
        "01  ORBIT",
        "A / D or ← / → circles your deflector.",
        "Meet the ball and send it back into the sky.",
      ],
      [
        "02  DEMOLISH",
        "SPACE launches. Hit derelicts to score.",
        "Clear all three rings to reach the next wave.",
      ],
      [
        "03  PROTECT",
        "A ball that reaches the planet burns up.",
        "Losing the last ball costs one life.",
      ],
      [
        "04  SALVAGE",
        "Broken derelicts may release a falling pod.",
        "Catch it with the deflector to claim its tool.",
      ],
    ];
    rows.forEach((r, i) => {
      const y = 305 + i * 99;
      text(ctx, r[0], 195, y, 13, ICE);
      text(ctx, r[1], 195, y + 28, 15, INK);
      text(ctx, r[2], 195, y + 51, 14, MUTED);
    });
    C.POD_KINDS.forEach((k, i) => {
      const x = 215 + i * 137;
      ctx.drawImage(s.assets.pods[k], x - 12, 701);
      text(
        ctx,
        k.toUpperCase(),
        x,
        746,
        10,
        k === "narrow" ? "#f49b92" : ICE,
        "center",
      );
      text(
        ctx,
        (
          {
            widen: "+ARC",
            narrow: "−ARC",
            multiball: "+2 BALLS",
            shield: "SAVE",
            pierce: "CUT THROUGH",
          } as const
        )[k],
        x,
        764,
        9,
        MUTED,
        "center",
      );
    });
    text(
      ctx,
      "P / ESC pause   •   ↑ / W, ↓ / S select menus",
      500,
      790,
      13,
      MUTED,
      "center",
    );
    text(ctx, "ENTER / SPACE / ESC  —  RETURN", 500, 833, 13, INK, "center");
  } else {
    field(s, ctx);
    particles(s, ctx);
    hud(s, ctx);
    if (s.screen === "paused") {
      ctx.fillStyle = "rgba(4,10,19,.63)";
      ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
      panel(ctx, 275, 345, 450, 380);
      text(ctx, "FLIGHT SUSPENDED", 500, 403, 12, GOLD, "center");
      text(ctx, "PAUSED", 500, 471, 54, INK, "center", 600);
      menu(s, ctx);
      text(ctx, "P / ESC TO RESUME", 500, 696, 11, MUTED, "center");
    }
    if (s.screen === "waveclear") {
      panel(ctx, 260, 390, 480, 205);
      text(ctx, "ORBIT SECURED", 500, 436, 12, ICE, "center");
      text(ctx, `WAVE ${s.wave} CLEAR`, 500, 495, 40, INK, "center", 600);
      text(
        ctx,
        `+${C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave}   /   NEXT ORBIT IN ${Math.ceil(s.interstitialTicks / C.TICK_HZ)}`,
        500,
        551,
        14,
        GOLD,
        "center",
      );
    }
    if (s.screen === "gameover") {
      ctx.fillStyle = "rgba(4,10,19,.7)";
      ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
      panel(ctx, 240, 305, 520, 390);
      text(ctx, "SIGNAL LOST / MISSION ENDED", 500, 358, 12, GOLD, "center");
      text(ctx, C.GAMEOVER_TEXT, 500, 433, 52, INK, "center", 600);
      text(ctx, "FINAL SALVAGE VALUE", 500, 485, 12, MUTED, "center");
      text(
        ctx,
        String(s.score).padStart(6, "0"),
        500,
        544,
        48,
        ICE,
        "center",
        600,
      );
      text(ctx, `WAVE ${s.wave} REACHED`, 500, 589, 15, MUTED, "center");
      text(
        ctx,
        "ENTER / SPACE  —  RETURN TO BASE",
        500,
        656,
        12,
        INK,
        "center",
      );
    }
  }
  ctx.restore();
}
