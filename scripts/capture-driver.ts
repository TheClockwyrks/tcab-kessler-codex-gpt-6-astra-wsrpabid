// Browser-only authoring driver. It is never imported by the published game.
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "../src/game";
import * as C from "../src/constants";
import { offset, polar, position } from "../src/model";
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const engine = createEngine({
  canvas,
  width: C.STAGE_W,
  height: C.STAGE_H,
  game,
  background: BACKGROUND,
  clock: new ConstantClock(1000 / C.TICK_HZ),
});
await engine.initialize();
const d = engine.debug;
export async function title() {
  engine.apply(d.reset);
  await engine.advance(1);
}
export async function action() {
  engine.apply(d.reset);
  engine.apply((s) => d.setScreen(s, "playing"));
  engine.apply((s) => d.setWave(s, 3));
  engine.apply((s) => d.setScore(s, 3850));
  engine.apply((s) => d.setPodSpawn(s, false));
  engine.apply(d.clearTargets);
  for (let ring = 1; ring <= 3; ring++)
    for (let slot = 0; slot < C.RINGS[ring - 1].slots; slot++)
      if ((slot + ring) % 5 !== 0)
        engine.apply((s) =>
          d.spawnTarget(s, ring, slot, ring === 2 && slot % 3 !== 0 ? 2 : 1),
        );
  engine.apply((s) => d.setPaddleAngle(s, 65));
  engine.apply(d.parkBall);
  engine.apply(d.launchBall);
  for (const k of ["widen", "shield", "multiball"] as const) {
    const p = polar(197, 65);
    engine.apply((s) => d.spawnPod(s, k, p.x, p.y));
  }
  await engine.advance(1);
  for (const [k, a, r] of [
    ["pierce", 160, 320],
    ["multiball", 300, 380],
    ["narrow", 20, 280],
  ] as const) {
    const p = polar(r, a);
    engine.apply((s) => d.spawnPod(s, k, p.x, p.y));
  }
  engine.apply((s) => d.setPodSpawn(s, true));
  engine.apply((s) => d.setNextPod(s, "pierce"));
  engine.startRecording();
  for (let frame = 0; frame < 300; frame++) {
    const s = d.snapshot(engine.state);
    const ball = s.balls
      .filter((b) => !b.parked)
      .sort((a, b) => position(a.x, a.y).r - position(b.x, b.y).r)[0];
    if (ball) {
      const desired = position(
        ball.x + ball.vx * 0.1,
        ball.y + ball.vy * 0.1,
      ).angle;
      const delta = offset(desired, s.paddle.angleDeg);
      engine.apply((st) =>
        d.setPaddleAngle(
          st,
          s.paddle.angleDeg + Math.max(-4.5, Math.min(4.5, delta)),
        ),
      );
    }
    await engine.advance(1);
  }
  return engine.stopRecording();
}
export async function liveStill() {
  engine.apply(d.reset);
  engine.apply((s) => d.setScreen(s, "playing"));
  engine.apply((s) => d.setWave(s, 3));
  engine.apply((s) => d.setScore(s, 6450));
  engine.apply((s) => d.setPaddleAngle(s, 40));
  engine.apply((s) => d.setEffectTicks(s, "widen", 480));
  engine.apply((s) => d.setShield(s, true));
  engine.apply((s) => d.setPodSpawn(s, false));
  engine.apply(d.clearTargets);
  for (let i = 0; i < 3; i++)
    for (let slot = 0; slot < C.RINGS[i].slots; slot++)
      if ((slot + i) % 4 !== 0)
        engine.apply((s) =>
          d.spawnTarget(s, i + 1, slot, i === 1 && slot % 3 ? 2 : 1),
        );
  for (const [r, a, v] of [
    [280, 45, 300],
    [350, 200, 300],
    [420, 315, 300],
  ]) {
    const p = polar(r, a),
      angle = (a * Math.PI) / 180;
    engine.apply((s) =>
      d.spawnBall(s, p.x, p.y, Math.cos(angle) * v, Math.sin(angle) * v),
    );
  }
  for (const [k, r, a] of [
    ["pierce", 245, 20],
    ["multiball", 335, 130],
    ["narrow", 395, 260],
  ] as const) {
    const p = polar(r, a);
    engine.apply((s) => d.spawnPod(s, k, p.x, p.y));
  }
  await engine.advance(7);
}
