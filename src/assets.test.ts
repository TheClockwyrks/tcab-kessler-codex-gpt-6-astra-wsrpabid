/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { describe, it, expect } from "vitest";
import * as C from "./constants";
async function wav(path: string) {
  const bytes = await readFile(`assets/${path}`);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  let rate = 0,
    channels = 0,
    data = Buffer.alloc(0);
  for (let p = 12; p + 8 <= bytes.length;) {
    const tag = bytes.toString("ascii", p, p + 4),
      size = bytes.readUInt32LE(p + 4);
    if (tag === "fmt ") {
      expect(bytes.readUInt16LE(p + 8)).toBe(1);
      channels = bytes.readUInt16LE(p + 10);
      rate = bytes.readUInt32LE(p + 12);
      expect(bytes.readUInt16LE(p + 22)).toBe(16);
    }
    if (tag === "data") data = bytes.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  const samples = Array.from({ length: data.length / 2 / channels }, (_, i) =>
    data.readInt16LE(i * channels * 2),
  );
  return { samples, rate, duration: samples.length / rate };
}
const rms = (samples: number[]): number =>
  Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length);
describe("committed production assets", () => {
  it("ships native-size transparent sprites and six distinct spin frames", async () => {
    const paths = [
      C.SPRITE_PATHS.planet,
      ...Object.values(C.SPRITE_PATHS.pods),
      ...C.SPRITE_PATHS.ball,
    ];
    const hashes = new Set<string>();
    for (const path of paths) {
      const bytes = await readFile(`assets/${path}`),
        image = await loadImage(bytes),
        size =
          path === C.SPRITE_PATHS.planet
            ? C.PLANET_SPRITE_SIZE
            : C.BALL_SPRITE_SIZE;
      expect([image.width, image.height]).toEqual([size, size]);
      const ctx = createCanvas(size, size).getContext("2d");
      ctx.drawImage(image, 0, 0);
      expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
      expect(ctx.getImageData(size / 2, size / 2, 1, 1).data[3]).toBe(255);
      hashes.add(createHash("sha256").update(bytes).digest("hex"));
    }
    expect(hashes.size).toBe(paths.length);
  });
  it("ships thirteen distinct audible cues with the longest game-over cue", async () => {
    const durations: Record<string, number> = {};
    const hashes = new Set<string>();
    for (const [cue, path] of Object.entries(C.CUE_PATHS)) {
      const audio = await wav(path);
      expect(rms(audio.samples)).toBeGreaterThan(50);
      durations[cue] = audio.duration;
      hashes.add(
        createHash("sha256")
          .update(await readFile(`assets/${path}`))
          .digest("hex"),
      );
    }
    expect(hashes.size).toBe(Object.keys(C.CUES).length);
    for (const cue of Object.values(C.CUES))
      if (cue !== C.CUES.gameOver)
        expect(durations[C.CUES.gameOver]).toBeGreaterThan(durations[cue]);
  });
  for (const [name, path] of Object.entries(C.BED_PATHS))
    it(`${name} music has a continuous, non-silent loop junction`, async () => {
      const { samples, rate, duration } = await wav(path);
      expect(duration).toBeGreaterThanOrEqual(C.MUSIC_MIN_SECONDS);
      let maxStep = 0;
      for (let i = 1; i < samples.length; i++)
        maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
      expect(
        Math.abs(samples[0] - samples[samples.length - 1]),
      ).toBeLessThanOrEqual(maxStep);
      const level = rms(samples);
      expect(rms(samples.slice(0, rate / 2))).toBeGreaterThanOrEqual(
        level * 0.1,
      );
      expect(rms(samples.slice(-rate / 2))).toBeGreaterThanOrEqual(level * 0.1);
      expect(
        Math.abs(
          20 *
            Math.log10(rms(samples.slice(0, rate)) / rms(samples.slice(-rate))),
        ),
      ).toBeLessThanOrEqual(6);
    });
});
