import * as C from "./constants";
import {
  boot,
  copy,
  effect,
  launch,
  menuRect,
  movePaddle,
  norm,
  park,
  polar,
  position,
  randomPod,
  ringSpeed,
  span,
  type State,
  type KesslerState,
} from "./model";
function valid(ok: boolean): void {
  if (!ok) throw new RangeError("Invalid debug pose");
}
function finite(...n: number[]): void {
  valid(n.every(Number.isFinite));
}
function integer(n: number, min = 0): void {
  valid(Number.isInteger(n) && n >= min);
}
function ringIndex(n: number): number {
  integer(n, 1);
  valid(n <= C.RINGS.length);
  return n - 1;
}
function kind(k: C.PodKind): void {
  valid(C.POD_KINDS.includes(k));
}
function pose(s: State, change: (n: KesslerState) => void): KesslerState {
  const n = copy(s);
  change(n);
  return n;
}
export const debug = {
  reset: (s: State) => boot(s.assets as KesslerState["assets"]),
  reconcile: copy,
  snapshot: (s: State) => ({
    screen: s.screen,
    ticks: s.ticks,
    wave: s.wave,
    score: s.score,
    lives: s.lives,
    interstitialTicks: s.interstitialTicks,
    waveAdvance: s.waveAdvance,
    podSpawn: s.podSpawn,
    nextPod: s.nextPod,
    paddle: { angleDeg: s.paddleAngle, spanDeg: span(s) },
    balls: s.balls.map(({ x, y, vx, vy, parked }) => ({
      x,
      y,
      vx,
      vy,
      parked,
      piercing: s.effects.pierceTicks > 0,
    })),
    rings: s.rings.map((r) => ({
      ...r,
      targets: r.targets.map((t) => ({ ...t })),
    })),
    pods: s.pods.map((p) => ({ kind: p.kind, ...polar(p.r, p.angle) })),
    effects: { ...s.effects },
    menu: { index: ["title", "paused"].includes(s.screen) ? s.menuIndex : 0 },
  }),
  menuItemRect: menuRect,
  setScreen: (s: State, name: C.Screen) =>
    pose(s, (n) => {
      valid(C.SCREENS.includes(name));
      n.screen = name;
    }),
  setScore: (s: State, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.score = v;
    }),
  setLives: (s: State, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.lives = v;
    }),
  setMenuIndex: (s: State, v: number) =>
    pose(s, (n) => {
      valid(menuRect(s, v) !== null);
      n.menuIndex = v;
    }),
  setInterstitialTicks: (s: State, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.interstitialTicks = v;
    }),
  setWave: (s: State, v: number) =>
    pose(s, (n) => {
      integer(v, 1);
      n.wave = v;
      n.rings.forEach((r, i) => (r.speedDegPerSec = ringSpeed(i, v)));
    }),
  setPaddleAngle: (s: State, v: number) =>
    pose(s, (n) => {
      finite(v);
      movePaddle(n, v);
    }),
  launchBall: (s: State) => pose(s, launch),
  clearBalls: (s: State) =>
    pose(s, (n) => {
      n.balls = [];
    }),
  spawnBall: (s: State, x: number, y: number, vx: number, vy: number) =>
    pose(s, (n) => {
      finite(x, y, vx, vy);
      valid(n.balls.length < C.BALL_CAP);
      n.balls.push({ x, y, vx, vy, parked: false, born: n.simTicks });
    }),
  parkBall: (s: State) =>
    pose(s, (n) => {
      valid(n.balls.length < C.BALL_CAP && !n.balls.some((b) => b.parked));
      park(n);
    }),
  clearTargets: (s: State) =>
    pose(s, (n) => {
      n.rings.forEach((r) => (r.targets = []));
    }),
  spawnTarget: (s: State, ring: number, slot: number, hp: number) =>
    pose(s, (n) => {
      const i = ringIndex(ring);
      integer(slot);
      valid(slot < C.RINGS[i].slots);
      integer(hp, 1);
      n.rings[i].targets = n.rings[i].targets
        .filter((t) => t.slot !== slot)
        .concat({ slot, hp })
        .sort((a, b) => a.slot - b.slot);
    }),
  setRingAngle: (s: State, ring: number, deg: number) =>
    pose(s, (n) => {
      finite(deg);
      n.rings[ringIndex(ring)].angleDeg = norm(deg);
    }),
  setRingSpeed: (s: State, ring: number, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.rings[ringIndex(ring)].speedDegPerSec = v;
    }),
  clearPods: (s: State) =>
    pose(s, (n) => {
      n.pods = [];
    }),
  spawnPod: (s: State, k: C.PodKind, x: number, y: number) =>
    pose(s, (n) => {
      kind(k);
      finite(x, y);
      n.pods.push({ kind: k, ...position(x, y) });
    }),
  setNextPod: (s: State, k: C.PodKind | "none") =>
    pose(s, (n) => {
      if (k !== "none") kind(k);
      n.nextPod = k;
    }),
  drawPod: (_s: State) => randomPod(),
  setEffectTicks: (s: State, k: "widen" | "narrow" | "pierce", ticks: number) =>
    pose(s, (n) => {
      valid(["widen", "narrow", "pierce"].includes(k));
      integer(ticks);
      effect(n, k, ticks);
    }),
  setShield: (s: State, active: boolean) =>
    pose(s, (n) => {
      valid(typeof active === "boolean");
      n.effects.shieldActive = active;
    }),
  setWaveAdvance: (s: State, on: boolean) =>
    pose(s, (n) => {
      valid(typeof on === "boolean");
      n.waveAdvance = on;
    }),
  setPodSpawn: (s: State, on: boolean) =>
    pose(s, (n) => {
      valid(typeof on === "boolean");
      n.podSpawn = on;
    }),
};
export type KesslerDebugApi = typeof debug;
