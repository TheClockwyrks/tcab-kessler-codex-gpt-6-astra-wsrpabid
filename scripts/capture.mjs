import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.route("**/src/main.ts", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.route("http://localhost:5173/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}#stage{display:block;width:100vw;height:100vh}</style></head><body><canvas id="stage"></canvas></body></html>',
    }),
  );
  await page.goto("http://localhost:5173/");
  await mkdir("showcase", { recursive: true });
  await page.evaluate(async () => {
    const driver = await import("/scripts/capture-driver.ts");
    await driver.title();
  });
  await page.screenshot({ path: "showcase/title.png" });
  const recording = await page.evaluate(async () => {
    const driver = await import("/scripts/capture-driver.ts");
    return driver.action();
  });
  await writeFile(
    "showcase/orbital-sweep.json.gz",
    gzipSync(JSON.stringify(recording)),
  );
  await page.evaluate(async () => {
    const driver = await import("/scripts/capture-driver.ts");
    await driver.liveStill();
  });
  await page.screenshot({ path: "showcase/live.png" });
} finally {
  await browser.close();
}
