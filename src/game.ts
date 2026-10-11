import type { Game } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import { boot, span, type Assets, type KesslerState } from "./model";
import { debug, type KesslerDebugApi } from "./debug";
import { update } from "./simulation";
import { render } from "./presentation";
export { BACKGROUND } from "./presentation";
export type { KesslerState } from "./model";
export type { KesslerDebugApi } from "./debug";
export const game: Game<KesslerState, KesslerDebugApi> = {
  async initialize(api) {
    for (const a of C.ACTIONS)
      api.input.register(a, { keys: [...C.BINDINGS[a]] });
    const [planet, pods, ball, particles] = await Promise.all([
      api.assets.loadImage(C.SPRITE_PATHS.planet),
      Promise.all(
        C.POD_KINDS.map(
          async (k) =>
            [k, await api.assets.loadImage(C.SPRITE_PATHS.pods[k])] as const,
        ),
      ),
      Promise.all(C.SPRITE_PATHS.ball.map((p) => api.assets.loadImage(p))),
      Promise.all(
        Object.entries(C.PARTICLE_PATHS).map(
          async ([k, p]) =>
            [
              k,
              JSON.parse(
                await (await api.assets.load(p)).text(),
              ) as ParticleSystem,
            ] as const,
        ),
      ),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
      ...Object.values(C.BED_PATHS).map((path) => api.audio.load(path, path)),
    ]);
    const assets: Assets = {
      planet,
      pods: Object.fromEntries(pods) as Assets["pods"],
      ball,
      particles: Object.fromEntries(particles) as Assets["particles"],
    };
    for (const key of ["screen", "score", "lives", "wave"] as const)
      api.diagnostics.register(key, (s) => s[key]);
    api.diagnostics.register("paddle angle", (s) => s.paddleAngle.toFixed(1));
    api.diagnostics.register("paddle span", span);
    api.diagnostics.register("balls", (s) => s.balls.length);
    api.diagnostics.register("targets", (s) =>
      s.rings.reduce((n, r) => n + r.targets.length, 0),
    );
    api.diagnostics.register("pods", (s) => s.pods.length);
    for (const key of [
      "widenTicks",
      "narrowTicks",
      "pierceTicks",
      "shieldActive",
    ] as const)
      api.diagnostics.register(key, (s) => s.effects[key]);
    return [boot(assets), debug];
  },
  update,
  render,
};
