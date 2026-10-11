/// <reference types="node" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  ConstantClock,
  SequenceClock,
  createEngine,
  type Engine,
} from "@clockwyrks/simple-2d";
import {
  game,
  BACKGROUND,
  type KesslerState,
  type KesslerDebugApi,
} from "./game";
import * as C from "./constants";
import { polar, rad, type State } from "./model";
import { reflect } from "./simulation";
const engines: Engine<KesslerState, KesslerDebugApi>[] = [];
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      async decodeAudioData(bytes: ArrayBuffer) {
        return { duration: bytes.byteLength / 176400 };
      }
    },
  );
});
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup() {
  const events = new EventTarget();
  const canvas = createCanvas(300, 300);
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    background: BACKGROUND,
    game,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => 300,
      cssHeight: () => 300,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(e);
  await e.initialize();
  const cues: string[] = [];
  e.events.on("cue:played", (v) => cues.push(v.cue));
  const d = e.debug;
  const pose = (f: (s: State) => KesslerState) => e.apply(f);
  function key(code: string, type = "keydown") {
    events.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  }
  async function press(code: string) {
    key(code);
    await e.advance(1);
    key(code, "keyup");
  }
  const snap = () => d.snapshot(e.state);
  const live = () => {
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setPodSpawn(s, false));
    pose((s) => d.setWaveAdvance(s, false));
    pose(d.clearTargets);
  };
  function ball(r: number, a: number, vr: number, vt = 0) {
    const p = polar(r, a),
      t = rad(a);
    pose((s) =>
      d.spawnBall(
        s,
        p.x,
        p.y,
        vr * Math.cos(t) - vt * Math.sin(t),
        vr * Math.sin(t) + vt * Math.cos(t),
      ),
    );
  }
  function pod(k: C.PodKind, r = 197, a = 90) {
    const p = polar(r, a);
    pose((s) => d.spawnPod(s, k, p.x, p.y));
  }
  return { e, d, events, pose, key, press, snap, cues, live, ball, pod };
}
describe("engine, menus, fixed time and immutable poses", () => {
  it("loads every produced asset and registers diagnostics", async () => {
    const { e, snap } = await setup();
    expect(snap()).toMatchObject({
      screen: "title",
      lives: 3,
      wave: 1,
      ticks: 0,
      paddle: { angleDeg: 90, spanDeg: 48 },
      balls: [],
    });
    expect(snap().rings.map((r) => r.targets.length)).toEqual([12, 16, 20]);
    expect(e.diagnostics()).toHaveLength(13);
  });
  it("uses one screen per input edge and freezes a paused world", async () => {
    const { e, press, snap } = await setup();
    await e.advance(5);
    await press("Space");
    expect(snap().ticks).toBe(6);
    expect(snap().screen).toBe("playing");
    expect(snap().balls[0].parked).toBe(true);
    await press("Space");
    expect(snap().balls[0].parked).toBe(false);
    await press("KeyP");
    const frozen = snap();
    await e.advance(20);
    expect({ ...snap(), ticks: frozen.ticks }).toEqual(frozen);
    await press("Escape");
    expect(snap().screen).toBe("playing");
  });
  it("navigates instructions and remembers the return entry", async () => {
    const { press, snap, e } = await setup();
    await press("ArrowDown");
    await press("Enter");
    expect(snap().screen).toBe("howto");
    await e.advance(1);
    await press("Escape");
    expect(snap().menu.index).toBe(1);
    await press("ArrowUp");
    await press("Enter");
    await press("Escape");
    await press("ArrowDown");
    await press("Enter");
    expect(snap().screen).toBe("title");
    expect(snap().menu.index).toBe(0);
  });
  it("accepts same-region pointer releases and rejects drags out", async () => {
    const { events, e, snap } = await setup();
    function p(type: string, x: number, y: number) {
      events.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: x * 0.3,
          clientY: y * 0.3,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
        }),
      );
    }
    p("pointerdown", 400, 720);
    p("pointerup", 100, 100);
    await e.advance(1);
    expect(snap().screen).toBe("title");
    p("pointerdown", 400, 720);
    p("pointerup", 400, 720);
    await e.advance(1);
    expect(snap().screen).toBe("howto");
  });
  it("keeps poses immutable and rejects invalid domains", async () => {
    const { e, d, pose } = await setup();
    const before = d.snapshot(e.state);
    pose((s) => d.setWave(s, 7));
    expect(before.wave).toBe(1);
    expect(e.state.rings[1].speedDegPerSec).toBe(30);
    expect(() => d.spawnTarget(e.state, 4, 0, 1)).toThrow();
    expect(() => d.setLives(e.state, -1)).toThrow();
    expect(() => d.setWave(e.state, 1.5)).toThrow();
    expect(() => d.launchBall(e.state)).toThrow();
    pose(d.parkBall);
    expect(() => d.parkBall(e.state)).toThrow();
    pose((s) => d.setPaddleAngle(s, -90));
    expect(d.snapshot(e.state).balls[0].x).toBeCloseTo(500);
    expect(d.snapshot(e.state).balls[0].y).toBeCloseTo(306);
    pose((s) => d.setScreen(s, "playing"));
    expect(() => d.setMenuIndex(e.state, 1)).toThrow();
    expect(d.menuItemRect(e.state, 0)).toBeNull();
    pose(d.reset);
    expect(d.snapshot(e.state)).toEqual(before);
  });
  it("consumes fractional deltas into exact ticks", async () => {
    const { e, live, key, snap } = await setup();
    live();
    key("KeyD");
    e.setClock(new SequenceClock([5, 10, 35]));
    await e.advance(60);
    expect(snap().ticks).toBe(60);
    expect(snap().paddle.angleDeg).toBeCloseTo(0);
    expect(snap().rings[1].angleDeg).toBeCloseTo(12);
  });
});
describe("crossings and reflections", () => {
  it("bounces at the paddle in place and adopts the wave speed", async () => {
    const { e, live, ball, snap, cues, pose, d } = await setup();
    live();
    pose((s) => d.setWave(s, 3));
    ball(197, 90, -240);
    await e.advance(1);
    const b = snap().balls[0];
    expect(b.y).toBeCloseTo(693);
    expect(b.vy).toBeCloseTo(300);
    expect(cues).toContain(C.CUES.paddleBounce);
  });
  it("steers paddle edge hits with English", async () => {
    const { e, live, ball, snap } = await setup();
    live();
    ball(197, 110, -240);
    await e.advance(1);
    const b = snap().balls[0];
    expect((Math.atan2(b.vy, b.vx) * 180) / Math.PI).toBeCloseTo(134);
  });
  it("reflects containment at incoming speed", async () => {
    const { e, live, ball, snap, cues } = await setup();
    live();
    ball(470, 0, 180);
    await e.advance(1);
    expect(snap().balls[0]).toMatchObject({ x: 973, vx: -180 });
    expect(cues).toContain(C.CUES.fieldBounce);
  });
  it("applies radial decay and tangential moving-ring kick", () => {
    const b = { x: 800, y: 500, vx: 200, vy: 120, parked: false, born: 0 };
    const incoming = Math.hypot(b.vx, b.vy);
    reflect(b, false, 12);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(incoming);
    expect(b.vx).toBeLessThan(0);
    expect(b.vy).toBeGreaterThan(0);
    const edge = { x: 800, y: 500, vx: 100, vy: 200, parked: false, born: 0 };
    reflect(edge, true);
    expect(edge.vy).toBeLessThan(0);
  });
  it("passes a structural gap without damage", async () => {
    const { e, live, ball, snap, pose, d, cues } = await setup();
    live();
    pose((s) => d.spawnTarget(s, 1, 0, 1));
    ball(280, 0, 240);
    await e.advance(1);
    expect(snap().rings[0].targets).toHaveLength(1);
    expect(cues).toEqual([]);
  });
  it("damages and destroys a two-hit target with distinct awards", async () => {
    const { e, live, ball, snap, pose, d, cues } = await setup();
    live();
    pose((s) => d.spawnTarget(s, 2, 0, 2));
    pose((s) => d.setRingSpeed(s, 2, 0));
    ball(350, 10, 240);
    await e.advance(1);
    expect(snap().score).toBe(50);
    expect(cues).toEqual([C.CUES.targetHit]);
    pose(d.clearBalls);
    ball(350, 10, 240);
    await e.advance(1);
    expect(snap().score).toBe(250);
    expect(cues[cues.length - 1]).toBe(C.CUES.targetBreak);
  });
  it("recognizes rotating edges with no radial crossing", async () => {
    const { e, live, ball, pose, d, snap } = await setup();
    live();
    pose((s) => d.spawnTarget(s, 2, 0, 2));
    pose((s) => d.setRingSpeed(s, 2, 60));
    ball(372, 21, 0);
    await e.advance(1);
    expect(snap().score).toBe(50);
  });
  it("burns the last ball once and clears tools before serving", async () => {
    const { e, live, ball, pose, d, snap, cues, pod } = await setup();
    live();
    pose((s) => d.setEffectTicks(s, "widen", 40));
    pod("shield", 300);
    ball(80, 0, -240);
    await e.advance(1);
    expect(snap().lives).toBe(2);
    expect(snap().balls[0].parked).toBe(true);
    expect(snap().pods).toEqual([]);
    expect(snap().effects.widenTicks).toBe(0);
    expect(cues).toContain(C.CUES.ballLost);
  });
  it("does not lose a life on a debug clear or one multiball loss", async () => {
    const { e, live, ball, snap, pose, d } = await setup();
    live();
    await e.advance(1);
    expect(snap().lives).toBe(3);
    ball(80, 0, -240);
    ball(220, 90, 240);
    await e.advance(1);
    expect(snap().lives).toBe(3);
    pose(d.clearBalls);
    await e.advance(1);
    expect(snap().lives).toBe(3);
  });
  it("ends the session over silence at zero lives", async () => {
    const { e, live, ball, pose, d, snap, cues, press } = await setup();
    live();
    pose((s) => d.setLives(s, 1));
    ball(80, 0, -240);
    await e.advance(1);
    expect(snap().screen).toBe("gameover");
    expect(cues).toEqual([C.CUES.ballLost, C.CUES.gameOver]);
    await press("Enter");
    expect(snap().screen).toBe("title");
  });
});
describe("salvage, effects and waves", () => {
  it("replaces span tools on catch and expires on the exact tick", async () => {
    const { e, live, pod, snap, pose, d, cues } = await setup();
    live();
    pod("widen");
    await e.advance(1);
    expect(snap().effects.widenTicks).toBe(600);
    expect(snap().paddle.spanDeg).toBe(72);
    pod("narrow");
    await e.advance(1);
    expect(snap().effects.widenTicks).toBe(0);
    expect(snap().paddle.spanDeg).toBe(30);
    expect(cues[cues.length - 1]).toBe(C.CUES.podCatchNarrow);
    pose((s) => d.setEffectTicks(s, "narrow", 1));
    await e.advance(1);
    expect(snap().paddle.spanDeg).toBe(48);
    expect(snap().score).toBe(50);
  });
  it("burns missed pods with no reward or effect", async () => {
    const { e, live, pod, snap, cues } = await setup();
    live();
    pod("pierce", 79, 0);
    await e.advance(1);
    expect(snap().pods).toEqual([]);
    expect(snap().score).toBe(0);
    expect(cues).toEqual([C.CUES.podBurn]);
  });
  it("launches multiballs in order, preserving a parked ball and enforcing cap", async () => {
    const { e, live, pod, snap, pose, d } = await setup();
    live();
    pose(d.parkBall);
    pod("multiball");
    await e.advance(1);
    expect(snap().balls).toHaveLength(3);
    expect(snap().balls[0].parked).toBe(true);
    expect(snap().balls[1].vx).toBeLessThan(0);
    expect(snap().balls[2].vx).toBeGreaterThan(0);
    pod("multiball");
    await e.advance(1);
    pod("multiball");
    await e.advance(1);
    expect(snap().balls).toHaveLength(6);
    expect(() => d.spawnBall(e.state, 0, 0, 1, 1)).toThrow();
    pod("multiball");
    await e.advance(1);
    expect(snap().score).toBe(100);
  });
  it("consumes a shield on the first crossing only", async () => {
    const { e, live, pod, ball, snap, cues } = await setup();
    live();
    pod("shield");
    await e.advance(1);
    ball(102, 0, -240);
    ball(102, 180, -240);
    await e.advance(1);
    expect(snap().effects.shieldActive).toBe(false);
    expect(snap().balls[0].vx).toBeGreaterThan(0);
    expect(snap().balls[1].vx).toBeGreaterThan(0);
    expect(cues.filter((c) => c === C.CUES.shieldReflect)).toHaveLength(1);
  });
  it("pierces armored targets without reflection or hit score", async () => {
    const { e, live, pod, ball, pose, d, snap } = await setup();
    live();
    pod("pierce");
    await e.advance(1);
    pose((s) => d.spawnTarget(s, 2, 0, 2));
    ball(350, 10, 240);
    await e.advance(1);
    expect(snap().score).toBe(225);
    expect(snap().balls[0].piercing).toBe(true);
    expect(snap().balls[0].vx).toBeCloseTo(240 * Math.cos(rad(10)));
  });
  it("consumes one forced draw only when spawning is enabled", async () => {
    const { e, live, ball, pose, d, snap } = await setup();
    live();
    pose((s) => d.setNextPod(s, "shield"));
    pose((s) => d.spawnTarget(s, 1, 0, 1));
    ball(280, 15, 240);
    await e.advance(1);
    expect(snap().nextPod).toBe("shield");
    pose((s) => d.setPodSpawn(s, true));
    pose((s) => d.spawnTarget(s, 1, 1, 1));
    pose(d.clearBalls);
    ball(280, 45, 240);
    await e.advance(1);
    expect(snap().nextPod).toBeNull();
    expect(snap().pods[0].kind).toBe("shield");
  });
  it("random draws leave posed outcomes untouched and follow the distribution", async () => {
    const { e, d, pose } = await setup();
    pose((s) => d.setNextPod(s, "none"));
    const counts: Record<string, number> = { none: 0 };
    for (let i = 0; i < 20000; i++) {
      const k = d.drawPod(e.state) ?? "none";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    expect(counts.none / 20000).toBeCloseTo(0.75, 1);
    for (const row of C.POD_KIND_TABLE)
      expect(counts[row.kind] / 20000).toBeCloseTo(0.25 * row.probability, 1);
    expect(d.snapshot(e.state).nextPod).toBe("none");
  });
  it("awards a clearing bonus, freezes the field, and refills after 180 ticks", async () => {
    const { e, live, ball, pose, d, snap, cues } = await setup();
    live();
    pose((s) => d.setWaveAdvance(s, true));
    pose((s) => d.spawnTarget(s, 1, 0, 1));
    ball(280, 15, 240);
    await e.advance(1);
    expect(snap()).toMatchObject({
      screen: "waveclear",
      score: 600,
      interstitialTicks: 180,
      balls: [],
    });
    const angle = snap().rings[1].angleDeg;
    await e.advance(179);
    expect(snap().screen).toBe("waveclear");
    expect(snap().rings[1].angleDeg).toBe(angle);
    await e.advance(1);
    expect(snap()).toMatchObject({ screen: "playing", wave: 2 });
    expect(snap().rings.map((r) => r.targets.length)).toEqual([12, 16, 20]);
    expect(snap().balls[0].parked).toBe(true);
    expect(cues).toContain(C.CUES.waveClear);
  });
  it("reconciles without moving or changing explicitly posed ring speeds", async () => {
    const { e, d, pose, snap, pod } = await setup();
    pose((s) => d.setScore(s, 500));
    pose((s) => d.setRingAngle(s, 3, 725));
    pose((s) => d.setRingSpeed(s, 3, 123));
    pose((s) => d.setEffectTicks(s, "pierce", 100));
    pose((s) => d.setShield(s, true));
    pose((s) => d.spawnBall(s, 700, 500, 0, 0));
    pod("widen", 250);
    const before = snap();
    pose(d.reconcile);
    pose(d.reconcile);
    expect(snap()).toEqual(before);
    pose(d.clearPods);
    expect(snap().pods).toEqual([]);
    pose((s) => d.setScreen(s, "waveclear"));
    pose((s) => d.setInterstitialTicks(s, 0));
    await e.advance(1);
    expect(snap().wave).toBe(2);
  });
});
