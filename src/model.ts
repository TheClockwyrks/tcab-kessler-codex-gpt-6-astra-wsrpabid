import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  parked: boolean;
  born: number;
}
export interface Ring {
  angleDeg: number;
  speedDegPerSec: number;
  targets: { slot: number; hp: number }[];
}
export interface Pod {
  kind: C.PodKind;
  r: number;
  angle: number;
}
export interface Effects {
  widenTicks: number;
  narrowTicks: number;
  pierceTicks: number;
  shieldActive: boolean;
}
export interface Assets {
  planet: ImageBitmap;
  pods: Record<C.PodKind, ImageBitmap>;
  ball: ImageBitmap[];
  particles: Record<EffectName, ParticleSystem>;
}
export type EffectName = "burst" | "spark" | "burnup";
export interface Flash {
  id: number;
  kind: EffectName;
  x: number;
  y: number;
  age: number;
  seed: number;
}
export interface KesslerState {
  assets: Assets;
  screen: C.Screen;
  ticks: number;
  simTicks: number;
  wave: number;
  score: number;
  lives: number;
  interstitialTicks: number;
  waveAdvance: boolean;
  podSpawn: boolean;
  nextPod: C.PodKind | "none" | null;
  paddleAngle: number;
  balls: Ball[];
  rings: Ring[];
  pods: Pod[];
  effects: Effects;
  menuIndex: number;
  remainder: number;
  flashes: Flash[];
  serial: number;
  frame: number;
  delta: number;
  pointerDown: Record<number, number>;
}
export type State = DeepReadonly<KesslerState>;
export const norm = (a: number): number => ((a % 360) + 360) % 360;
export const offset = (a: number, b: number): number => norm(a - b + 180) - 180;
export const rad = (a: number): number => (a * Math.PI) / 180;
export const polar = (r: number, a: number): { x: number; y: number } => ({
  x: C.STAGE_CX + r * Math.cos(rad(a)),
  y: C.STAGE_CY + r * Math.sin(rad(a)),
});
export const position = (
  x: number,
  y: number,
): { r: number; angle: number } => ({
  r: Math.hypot(x - C.STAGE_CX, y - C.STAGE_CY),
  angle: norm((Math.atan2(y - C.STAGE_CY, x - C.STAGE_CX) * 180) / Math.PI),
});
export const speed = (wave: number): number =>
  Math.min(
    C.BALL_SPEED_CAP,
    C.BALL_SPEED_BASE + C.BALL_SPEED_PER_WAVE * (wave - 1),
  );
export const ringSpeed = (i: number, w: number): number => {
  const r = C.RINGS[i];
  return (
    r.orbitSign *
    Math.min(
      r.orbitCapDegPerSec,
      r.orbitBaseDegPerSec + r.orbitPerWaveDegPerSec * (w - 1),
    )
  );
};
export const span = (s: State): number =>
  s.effects.widenTicks > 0
    ? C.WIDEN_SPAN_DEG
    : s.effects.narrowTicks > 0
      ? C.NARROW_SPAN_DEG
      : C.DEFLECTOR_BASE_SPAN_DEG;
export const emptyEffects = (): Effects => ({
  widenTicks: 0,
  narrowTicks: 0,
  pierceTicks: 0,
  shieldActive: false,
});
export const fullRings = (w: number): Ring[] =>
  C.RINGS.map((r, i) => ({
    angleDeg: 0,
    speedDegPerSec: ringSpeed(i, w),
    targets: Array.from({ length: r.slots }, (_, slot) => ({
      slot,
      hp: r.hitPoints,
    })),
  }));
export function boot(assets: Assets): KesslerState {
  return {
    assets,
    screen: "title",
    ticks: 0,
    simTicks: 0,
    wave: C.START_WAVE,
    score: 0,
    lives: C.START_LIVES,
    interstitialTicks: 0,
    waveAdvance: true,
    podSpawn: true,
    nextPod: null,
    paddleAngle: C.DEFLECTOR_START_ANGLE_DEG,
    balls: [],
    rings: fullRings(C.START_WAVE),
    pods: [],
    effects: emptyEffects(),
    menuIndex: 0,
    remainder: 0,
    flashes: [],
    serial: 0,
    frame: 0,
    delta: 0,
    pointerDown: {},
  };
}
/** Clone mutable simulation branches; immutable decoded resources retain identity. */
export function copy(s: State): KesslerState {
  return {
    ...s,
    assets: s.assets as Assets,
    balls: s.balls.map((b) => ({ ...b })),
    rings: s.rings.map((r) => ({
      ...r,
      targets: r.targets.map((t) => ({ ...t })),
    })),
    pods: s.pods.map((p) => ({ ...p })),
    effects: { ...s.effects },
    flashes: s.flashes.map((f) => ({ ...f })),
    pointerDown: { ...s.pointerDown },
  };
}
export function park(s: KesslerState): void {
  s.balls.push({
    ...polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle),
    vx: 0,
    vy: 0,
    parked: true,
    born: s.simTicks,
  });
}
export function launch(s: KesslerState): void {
  const b = s.balls.find((b) => b.parked);
  if (!b) throw new RangeError("No parked ball");
  b.parked = false;
  b.vx = speed(s.wave) * Math.cos(rad(s.paddleAngle));
  b.vy = speed(s.wave) * Math.sin(rad(s.paddleAngle));
}
export function movePaddle(s: KesslerState, a: number): void {
  s.paddleAngle = norm(a);
  for (const b of s.balls)
    if (b.parked)
      Object.assign(b, polar(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.paddleAngle));
}
export function randomPod(): C.PodKind | null {
  if (Math.random() >= C.POD_DROP_CHANCE) return null;
  let n = Math.random();
  for (const row of C.POD_KIND_TABLE) {
    n -= row.probability;
    if (n < 0) return row.kind;
  }
  return C.POD_KIND_TABLE[C.POD_KIND_TABLE.length - 1].kind;
}
export function effect(
  s: KesslerState,
  kind: "widen" | "narrow" | "pierce",
  ticks: number,
): void {
  s.effects[`${kind}Ticks`] = ticks;
  if (ticks > 0 && kind !== "pierce")
    s.effects[kind === "widen" ? "narrowTicks" : "widenTicks"] = 0;
}
export function menuRect(
  s: State,
  index: number,
): { x: number; y: number; width: number; height: number } | null {
  if (
    !["title", "paused"].includes(s.screen) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 1
  )
    return null;
  return {
    x: 330,
    y: (s.screen === "title" ? 620 : 520) + index * 76,
    width: 340,
    height: 60,
  };
}
