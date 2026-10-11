import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  copy,
  boot,
  emptyEffects,
  effect,
  fullRings,
  launch,
  menuRect,
  movePaddle,
  norm,
  offset,
  park,
  polar,
  position,
  rad,
  randomPod,
  span,
  speed,
  type Ball,
  type EffectName,
  type KesslerState,
  type State,
} from "./model";
function flash(s: KesslerState, kind: EffectName, x: number, y: number): void {
  s.flashes.push({
    id: ++s.serial,
    kind,
    x,
    y,
    age: 0,
    seed: Math.floor(Math.random() * 0x7fffffff),
  });
}
function clearTools(s: KesslerState): void {
  s.effects = emptyEffects();
  s.pods = [];
}
/** All non-paddle contacts share specular, moving-surface kick, speed, decay. */
export function reflect(b: Ball, edge = false, orbit = 0): void {
  const p = position(b.x, b.y),
    a = rad(p.angle),
    nx = Math.cos(a),
    ny = Math.sin(a),
    tx = -ny,
    ty = nx,
    v = Math.hypot(b.vx, b.vy);
  const dx = edge ? tx : nx,
    dy = edge ? ty : ny,
    dot = b.vx * dx + b.vy * dy;
  b.vx -= 2 * dot * dx;
  b.vy -= 2 * dot * dy;
  b.vx += C.RING_KICK_FACTOR * rad(orbit) * p.r * tx;
  b.vy += C.RING_KICK_FACTOR * rad(orbit) * p.r * ty;
  let heading = (Math.atan2(b.vy, b.vx) * 180) / Math.PI;
  const axis = b.vx * nx + b.vy * ny >= 0 ? p.angle : p.angle + 180;
  const phi = offset(heading, axis);
  heading -= Math.sign(phi) * Math.min(C.ORBITAL_DECAY_DEG, Math.abs(phi));
  b.vx = v * Math.cos(rad(heading));
  b.vy = v * Math.sin(rad(heading));
}
function paddleBounce(s: KesslerState, b: Ball): void {
  const p = position(b.x, b.y),
    a = rad(p.angle),
    nx = Math.cos(a),
    ny = Math.sin(a),
    dot = b.vx * nx + b.vy * ny;
  const heading =
    (Math.atan2(b.vy - 2 * dot * ny, b.vx - 2 * dot * nx) * 180) / Math.PI +
    C.ENGLISH_DEG_PER_OFFSET_DEG * offset(p.angle, s.paddleAngle);
  const relative = Math.max(
    -C.BOUNCE_CLAMP_DEG,
    Math.min(C.BOUNCE_CLAMP_DEG, offset(heading, p.angle)),
  );
  b.vx = speed(s.wave) * Math.cos(rad(p.angle + relative));
  b.vy = speed(s.wave) * Math.sin(rad(p.angle + relative));
}
function catchPod(s: KesslerState, k: C.PodKind, api: UpdateApi): void {
  s.score += C.POD_CATCH_SCORE;
  api.audio.play(k === "narrow" ? C.CUES.podCatchNarrow : C.CUES.podCatch);
  if (k === "shield") s.effects.shieldActive = true;
  else if (k === "multiball")
    for (
      let i = 0;
      i < C.MULTIBALL_LAUNCH_COUNT && s.balls.length < C.BALL_CAP;
      i++
    ) {
      const a = s.paddleAngle + (i === 0 ? 1 : -1) * C.MULTIBALL_OFFSET_DEG;
      s.balls.push({
        ...polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle),
        vx: speed(s.wave) * Math.cos(rad(a)),
        vy: speed(s.wave) * Math.sin(rad(a)),
        parked: false,
        born: s.simTicks,
      });
    }
  else
    effect(
      s,
      k,
      k === "widen"
        ? C.WIDEN_DURATION_TICKS
        : k === "narrow"
          ? C.NARROW_DURATION_TICKS
          : C.PIERCE_DURATION_TICKS,
    );
}
function inside(angle: number, center: number, width: number): boolean {
  return Math.abs(offset(angle, center)) <= width / 2 + 1e-9;
}
function tick(s: KesslerState, api: UpdateApi, turn: number): void {
  s.ticks++;
  if (s.screen === "waveclear") {
    s.interstitialTicks = Math.max(0, s.interstitialTicks - 1);
    if (!s.interstitialTicks) {
      s.wave++;
      s.rings = fullRings(s.wave);
      s.screen = "playing";
      park(s);
    }
    return;
  }
  if (s.screen !== "playing") return;
  s.simTicks++;
  movePaddle(
    s,
    s.paddleAngle + turn * C.DEFLECTOR_TURN_DEG_PER_SEC * C.TICK_DT,
  );
  const oldAngles = s.rings.map((r) => r.angleDeg);
  for (const r of s.rings)
    r.angleDeg = norm(r.angleDeg + r.speedDegPerSec * C.TICK_DT);
  for (const key of ["widenTicks", "narrowTicks", "pierceTicks"] as const)
    s.effects[key] = Math.max(0, s.effects[key] - 1);
  s.pods = s.pods.filter((p) => {
    const prev = p.r;
    p.r -= C.POD_FALL_SPEED * C.TICK_DT;
    if (
      prev > C.DEFLECTOR_POD_CATCH_RADIUS &&
      p.r <= C.DEFLECTOR_POD_CATCH_RADIUS &&
      inside(p.angle, s.paddleAngle, span(s))
    ) {
      catchPod(s, p.kind, api);
      return false;
    }
    if (p.r <= C.BURNUP_RADIUS) {
      const q = polar(p.r, p.angle);
      flash(s, "burnup", q.x, q.y);
      api.audio.play(C.CUES.podBurn);
      return false;
    }
    return true;
  });
  let burned = false;
  for (const b of [...s.balls]) {
    if (b.parked) continue;
    const prev = position(b.x, b.y);
    b.x += b.vx * C.TICK_DT;
    b.y += b.vy * C.TICK_DT;
    const now = position(b.x, b.y),
      dot = b.vx * Math.cos(rad(now.angle)) + b.vy * Math.sin(rad(now.angle));
    if (
      prev.r > C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      now.r <= C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      dot < 0 &&
      inside(now.angle, s.paddleAngle, span(s))
    ) {
      paddleBounce(s, b);
      api.audio.play(C.CUES.paddleBounce);
      flash(s, "spark", b.x, b.y);
    } else if (
      s.effects.shieldActive &&
      prev.r > C.SHIELD_CONTACT_RADIUS &&
      now.r <= C.SHIELD_CONTACT_RADIUS
    ) {
      s.effects.shieldActive = false;
      reflect(b);
      api.audio.play(C.CUES.shieldReflect);
      flash(s, "spark", b.x, b.y);
    } else if (
      prev.r < C.FIELD_CONTACT_RADIUS &&
      now.r >= C.FIELD_CONTACT_RADIUS &&
      dot > 0
    ) {
      reflect(b);
      api.audio.play(C.CUES.fieldBounce);
      flash(s, "spark", b.x, b.y);
    }
    for (let i = 0; i < s.rings.length; i++) {
      const ring = s.rings[i],
        spec = C.RINGS[i];
      for (const target of [...ring.targets]) {
        const local =
            target.slot * spec.slotWidthDeg +
            C.STRUCTURAL_GAP_DEG +
            spec.targetArcDeg / 2,
          center = ring.angleDeg + local;
        const within = inside(now.angle, center, spec.targetArcDeg);
        const face =
          within &&
          ((prev.r > spec.outerContactRadius &&
            now.r <= spec.outerContactRadius) ||
            (prev.r < spec.innerContactRadius &&
              now.r >= spec.innerContactRadius));
        const edge =
          within &&
          now.r >= spec.innerContactRadius &&
          now.r <= spec.outerContactRadius &&
          !inside(prev.angle, oldAngles[i] + local, spec.targetArcDeg);
        if (!face && !edge) continue;
        if (s.effects.pierceTicks > 0) target.hp = 0;
        else {
          target.hp--;
          reflect(b, !face, ring.speedDegPerSec);
        }
        if (target.hp > 0) {
          s.score += C.HIT_SCORE;
          api.audio.play(C.CUES.targetHit);
        } else {
          s.score += spec.destroyScore;
          ring.targets = ring.targets.filter((t) => t.slot !== target.slot);
          const q = polar(spec.midRadius, center);
          flash(s, "burst", q.x, q.y);
          api.audio.play(C.CUES.targetBreak);
          if (s.podSpawn) {
            const k =
              s.nextPod === null
                ? randomPod()
                : s.nextPod === "none"
                  ? null
                  : s.nextPod;
            s.nextPod = null;
            if (k)
              s.pods.push({ kind: k, r: spec.midRadius, angle: norm(center) });
          }
          if (s.waveAdvance && s.rings.every((r) => r.targets.length === 0)) {
            s.score += C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave;
            s.balls = [];
            clearTools(s);
            s.screen = "waveclear";
            s.interstitialTicks = C.WAVECLEAR_TICKS;
            api.audio.play(C.CUES.waveClear);
            return;
          }
        }
      }
    }
    if (now.r <= C.BURNUP_RADIUS) {
      s.balls = s.balls.filter((other) => other !== b);
      burned = true;
      flash(s, "burnup", b.x, b.y);
      api.audio.play(C.CUES.ballLost);
    }
  }
  if (burned && s.balls.length === 0) {
    s.lives = Math.max(0, s.lives - 1);
    clearTools(s);
    if (s.lives > 0) park(s);
    else {
      s.screen = "gameover";
      s.menuIndex = 0;
      api.audio.play(C.CUES.gameOver);
    }
  }
}
function accept(s: KesslerState, api: UpdateApi): KesslerState {
  api.audio.play(C.CUES.menuSelect);
  if (s.screen === "title") {
    if (s.menuIndex === 1) {
      s.screen = "howto";
      s.menuIndex = 0;
    } else {
      const fresh = boot(s.assets);
      // The public clock counts every resolved tick, including time in menus.
      fresh.ticks = s.ticks;
      fresh.remainder = s.remainder;
      fresh.screen = "playing";
      park(fresh);
      return fresh;
    }
  } else if (s.menuIndex === 0) s.screen = "playing";
  else {
    s.screen = "title";
    s.balls = [];
    clearTools(s);
  }
  s.menuIndex = 0;
  return s;
}
export function update(state: State, api: UpdateApi, dt: number): KesslerState {
  let s = copy(state);
  s.delta = dt;
  s.frame++;
  s.flashes = s.flashes
    .map((f) => ({ ...f, age: f.age + dt }))
    .filter((f) => f.age < 1.4);
  const input = Object.fromEntries(
    C.ACTIONS.map((a) => [
      a,
      a === "left" || a === "right" ? api.input.value(a) : api.input.pressed(a),
    ]),
  );
  const screen = state.screen;
  let changed = false;
  if (screen === "title" || screen === "paused") {
    for (const a of ["up", "down"])
      if (input[a]) {
        s.menuIndex = 1 - s.menuIndex;
        api.audio.play(C.CUES.menuMove);
      }
    let accepted = Boolean(input.confirm);
    for (const p of api.input.pointerSamples()) {
      const index = [0, 1].find((i) => {
        const r = menuRect(s, i)!;
        return (
          p.x >= r.x &&
          p.x <= r.x + r.width &&
          p.y >= r.y &&
          p.y <= r.y + r.height
        );
      });
      if (index !== undefined && s.menuIndex !== index) {
        s.menuIndex = index;
        api.audio.play(C.CUES.menuMove);
      }
      if (p.type === "down") s.pointerDown[p.id] = index ?? -1;
      if (p.type === "up") {
        if (index !== undefined && s.pointerDown[p.id] === index)
          accepted = true;
        delete s.pointerDown[p.id];
      }
    }
    if (screen === "paused" && (input.back || input.pause)) {
      s.screen = "playing";
      s.menuIndex = 0;
      changed = true;
    } else if (accepted) {
      s = accept(s, api);
      changed = true;
    }
  } else if (screen === "howto" && (input.confirm || input.back)) {
    s.screen = "title";
    s.menuIndex = 1;
    changed = true;
  } else if (screen === "gameover" && input.confirm) {
    s.screen = "title";
    s.menuIndex = 0;
    changed = true;
  } else if (screen === "playing") {
    if (input.back || input.pause) {
      s.screen = "paused";
      s.menuIndex = 0;
      changed = true;
    } else if (input.launch && s.balls.some((b) => b.parked)) launch(s);
  }
  s.remainder += dt;
  while (s.remainder + 1e-10 >= C.TICK_DT) {
    s.remainder = Math.max(0, s.remainder - C.TICK_DT);
    if (changed) s.ticks++;
    else tick(s, api, Number(input.right) - Number(input.left));
  }
  const bed =
    s.screen === "title" || s.screen === "howto"
      ? "title"
      : s.screen === "gameover"
        ? null
        : "play";
  for (const name of ["title", "play"] as const) {
    if (name === bed) api.audio.loop(C.BED_PATHS[name]);
    else api.audio.stop(C.BED_PATHS[name]);
  }
  return s;
}
