// Records a real shopper journey on the shop (dev or live) as a 1080 × 1920
// phone video: Chrome on this Mac plays the steps (open a page, scroll, tap,
// solve the puzzle) while every screen frame is captured, then ffmpeg makes
// the MP4 and lays the hook / call-to-action cards over the start and end.
// Runs only where the admin runs on a Mac with Chrome and ffmpeg installed
// (the local admin); the hosted admin (a Cloudflare Worker) can't do this.

import type { JourneyId } from "./journeys";
export { JOURNEYS, type JourneyId } from "./journeys";

export type RecordOptions = {
  journey: JourneyId;
  slug: string;
  site: string;
  /** Card pictures (PNG, 1080 × 1920, transparent) shown over the first and last seconds. */
  hookPng?: Buffer | null;
  ctaPng?: Buffer | null;
};

const CHROME = process.env.REEL_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = process.env.REEL_FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Node modules loaded at run time, so the Worker build never bundles them. */
async function node() {
  const names = ["puppeteer-core", "node:fs/promises", "node:path", "node:os", "node:child_process", "node:fs"];
  const [pptr, fs, path, os, cp, fsSync] = await Promise.all(names.map((n) => import(/* webpackIgnore: true */ n)));
  return { puppeteer: pptr.default ?? pptr, fs, path, os, cp, fsSync };
}

export async function recorderReady(): Promise<string | null> {
  try {
    const { fsSync } = await node();
    if (!fsSync.existsSync(CHROME)) return "Google Chrome isn't installed on this computer.";
    if (!fsSync.existsSync(FFMPEG)) return "ffmpeg isn't installed (brew install ffmpeg).";
    return null;
  } catch {
    return "Recording only works in the admin running on your Mac.";
  }
}

export async function recordJourney(opts: RecordOptions): Promise<Buffer> {
  const { puppeteer, fs, path, os, cp } = await node();
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "sp-reel-"));
  const frames = path.join(work, "f");
  await fs.mkdir(frames);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", defaultViewport: null, args: ["--window-size=1080,1920", "--hide-scrollbars", "--mute-audio"] });
  try {
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();
    // a 1080 × 1920 screen showing the 360 px phone layout at 3×: full-resolution frames
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: true });
    await page.setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 StickyPieReel");
    await page.evaluateOnNewDocument(() => {
      const fix = () =>
        document.querySelectorAll("meta[name=viewport]").forEach((m) => {
          const meta = m as HTMLMetaElement;
          if (!meta.content.includes("width=360")) meta.content = "width=360, initial-scale=3, maximum-scale=3, user-scalable=no";
        });
      new MutationObserver(fix).observe(document, { childList: true, subtree: true });
      // the shop's own "install the app" card would sit over the video
      try {
        localStorage.setItem("sp-reel", "1");
      } catch {}
      addEventListener(
        "pointerdown",
        (e) => {
          const d = document.createElement("div");
          d.style.cssText = `position:fixed;left:${e.clientX - 20}px;top:${e.clientY - 20}px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.6);border:3px solid rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;transition:transform .45s,opacity .45s`;
          document.documentElement.appendChild(d);
          requestAnimationFrame(() => requestAnimationFrame(() => ((d.style.transform = "scale(1.7)"), (d.style.opacity = "0"))));
          setTimeout(() => d.remove(), 600);
        },
        true
      );
    });

    const log: [string, number][] = [];
    let n = 0;
    let recording = false;
    const writes: Promise<unknown>[] = [];
    cdp.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp: number } }) => {
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      if (!recording) return;
      const name = `f${String(n++).padStart(5, "0")}.jpg`;
      writes.push(fs.writeFile(path.join(frames, name), Buffer.from(f.data, "base64")));
      log.push([name, f.metadata.timestamp]);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1080, maxHeight: 1920 });

    const steps = makeSteps(page, cdp, opts.site);
    const startRecording = async () => {
      await sleep(300);
      recording = true;
    };
    await runJourney(opts.journey, opts.slug, opts.site, steps, startRecording);
    await sleep(400);
    recording = false;
    await cdp.send("Page.stopScreencast");
    await Promise.all(writes);
    if (log.length < 10) throw new Error("The recording came out empty. Is the shop reachable?");

    // frames → MP4 at their real timing
    let list = "";
    for (let i = 0; i < log.length; i++) {
      const dur = i + 1 < log.length ? Math.max(0.001, log[i + 1][1] - log[i][1]) : 0.5;
      list += `file '${path.join(frames, log[i][0])}'\nduration ${dur.toFixed(4)}\n`;
    }
    list += `file '${path.join(frames, log[log.length - 1][0])}'\n`;
    await fs.writeFile(path.join(work, "list.txt"), list);
    const total = log[log.length - 1][1] - log[0][1] + 0.5;
    const base = path.join(work, "base.mp4");
    await run(cp, [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(work, "list.txt"), "-vf", "scale=1080:1920,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "19", "-preset", "medium", base]);

    // cards over the first 2.5 s and the last 3 s, plus a silent sound track
    const inputs = ["-i", base];
    let filter = "[0:v]null[v0]";
    let last = "v0";
    let k = 1;
    const overlay = async (png: Buffer | null | undefined, from: number, to: number) => {
      if (!png) return;
      const file = path.join(work, `card${k}.png`);
      await fs.writeFile(file, png);
      inputs.push("-loop", "1", "-t", String(total + 1), "-i", file);
      filter += `;[${k}:v]format=rgba,fade=in:st=${from.toFixed(2)}:d=0.2:alpha=1[c${k}];[${last}][c${k}]overlay=0:0:enable='between(t,${from.toFixed(2)},${to.toFixed(2)})'[v${k}]`;
      last = `v${k}`;
      k++;
    };
    await overlay(opts.hookPng, 0, Math.min(2.6, total / 3));
    await overlay(opts.ctaPng, Math.max(0, total - 3.2), total + 1);
    const out = path.join(work, "reel.mp4");
    await run(cp, [
      FFMPEG, "-hide_banner", "-loglevel", "error", "-y", ...inputs,
      "-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo",
      "-filter_complex", filter, "-map", `[${last}]`, "-map", `${k}:a`, "-t", total.toFixed(2),
      "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-profile:v", "high",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
    ]);
    return await fs.readFile(out);
  } finally {
    await browser.close().catch(() => {});
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

function run(cp: typeof import("node:child_process"), argv: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = cp.spawn(argv[0], argv.slice(1));
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code: number) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.slice(-400)}`))));
  });
}

/* ---------- steps a shopper takes ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cdp = any;

function makeSteps(page: Page, cdp: Cdp, site: string) {
  const mouse = async (type: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
    cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" || type === "mouseWheel" ? "none" : "left", clickCount: 1, ...extra });

  /** Taps the point (CSS px of the 360 px layout). */
  const tapAt = async (x: number, y: number) => {
    await mouse("mouseMoved", x, y);
    await mouse("mousePressed", x, y);
    await sleep(70);
    await mouse("mouseReleased", x, y);
  };

  /** The visible, on-top element whose text or label matches, as a point to tap. */
  const find = (match: string | RegExp, within = "a,button,[role=button],label") =>
    page.evaluate(
      (src: string, flags: string, sel: string) => {
        const re = new RegExp(src, flags);
        const els = [...document.querySelectorAll(sel)] as HTMLElement[];
        for (const el of els) {
          const label = `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim();
          if (!re.test(label)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4 || r.bottom < 40 || r.top > innerHeight - 10 || r.right < 0 || r.left > innerWidth) continue;
          const x = Math.min(Math.max(r.left + r.width / 2, 4), innerWidth - 4);
          const y = Math.min(Math.max(r.top + r.height / 2, 44), innerHeight - 8);
          const hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return { x, y };
        }
        return null;
      },
      typeof match === "string" ? match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : match.source,
      typeof match === "string" ? "i" : match.flags,
      within
    ) as Promise<{ x: number; y: number } | null>;

  const steps = {
    site,
    async goto(url: string) {
      await page.goto(url.startsWith("http") ? url : `${site}${url}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(600);
      await steps.dismiss();
    },
    /** Closes the install-app card or a cookie note when it shows. */
    async dismiss() {
      for (const label of [/^close$/i, /^not now$/i, /^dismiss$/i]) {
        const at = await find(label, "button");
        if (at) {
          await tapAt(at.x, at.y);
          await sleep(300);
        }
      }
    },
    wait: (ms: number) => sleep(ms),
    /** Scrolls like a thumb: a smooth run of small wheel moves. */
    async scroll(dy: number, ms = 900) {
      const parts = Math.max(6, Math.round(ms / 30));
      for (let i = 0; i < parts; i++) {
        const e = Math.sin(((i + 0.5) / parts) * Math.PI);
        await mouse("mouseWheel", 180, 380, { deltaX: 0, deltaY: (dy / parts) * e * (Math.PI / 2) });
        await sleep(ms / parts);
      }
      await sleep(250);
    },
    /** Taps the first visible match; scrolls down to look for it if needed. Returns false if never found. */
    async tap(match: string | RegExp, opts: { scrollFor?: number; within?: string } = {}) {
      for (let i = 0; i <= (opts.scrollFor ?? 0); i++) {
        const at = await find(match, opts.within);
        if (at) {
          await sleep(250);
          await tapAt(at.x, at.y);
          await sleep(500);
          return true;
        }
        await steps.scroll(320, 600);
      }
      return false;
    },
    /** Taps a link to this path (a product card), scrolling to find it; false if it never shows. */
    async tapLink(pathEnd: string, scrollFor = 8) {
      for (let i = 0; i <= scrollFor; i++) {
        const at = (await page.evaluate((end: string) => {
          for (const a of document.querySelectorAll("a[href]") as NodeListOf<HTMLAnchorElement>) {
            const href = a.getAttribute("href") ?? "";
            if (!href.split("?")[0].endsWith(end)) continue;
            const r = a.getBoundingClientRect();
            if (r.width < 20 || r.top < 60 || r.bottom > innerHeight - 20) continue;
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === a || a.contains(hit))) return { x, y };
          }
          return null;
        }, pathEnd)) as { x: number; y: number } | null;
        if (at) {
          await sleep(350);
          await tapAt(at.x, at.y);
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
          await sleep(800);
          return true;
        }
        await steps.scroll(420, 700);
      }
      return false;
    },
    /** Solves the puzzle the way a person would: tap a tile, tap where it belongs. */
    async solve() {
      const nine = () => page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Tile "]').length === 9, { timeout: 30000, polling: 100 });
      await nine();
      await sleep(1700); // the poster shows, splits and shuffles
      for (let guard = 0; guard < 12; guard++) {
        const state = (await page.$$eval('button[aria-label^="Tile "]', (els: Element[]) =>
          els.map((e) => {
            const el = e as HTMLElement;
            const m = el.style.transform.match(/translate\((\d+)%, (\d+)%\)/);
            const r = el.getBoundingClientRect();
            return { slot: m ? (+m[2] / 100) * 3 + +m[1] / 100 : -1, x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })
        )) as { slot: number; x: number; y: number }[];
        if (state.length !== 9 || state.every((s, i) => s.slot === i)) break;
        const t = state.findIndex((s, i) => s.slot !== i);
        const other = state.findIndex((s) => s.slot === t);
        await tapAt(state[t].x, state[t].y);
        await sleep(420);
        await tapAt(state[other].x, state[other].y);
        await sleep(950);
      }
      await sleep(2600); // win popup and the prize
    },
  };
  return steps;
}

type Steps = ReturnType<typeof makeSteps>;

async function runJourney(id: JourneyId, slug: string, site: string, s: Steps, start: () => Promise<void>) {
  const poster = `/sticker/${slug}`;
  switch (id) {
    case "play-win-cart":
      await s.goto(`/puzzle/${slug}`);
      await start();
      await s.solve();
      await s.tap(/add to cart/i);
      await s.wait(3000);
      break;
    case "share-win":
      await s.goto(`/puzzle/${slug}`);
      await start();
      await s.solve();
      await s.tap(/challenge friends/i);
      await s.wait(3500);
      break;
    case "browse-play":
      await s.goto(`/stickers/poster-packs?theme=puzzle`);
      await start();
      await s.wait(900);
      await s.scroll(500, 1200);
      if (!(await s.tapLink(`/sticker/${slug}/puzzle`, 6)) && !(await s.tapLink(poster, 2))) await s.goto(`${poster}/puzzle`);
      await s.wait(1500);
      if (!(await s.tap(/play & win/i))) await s.tap(/play the puzzle/i);
      await s.solve();
      await s.tap(/add to cart/i);
      await s.wait(2500);
      break;
    case "product-cart":
      await s.goto(`${poster}/puzzle`);
      await start();
      await s.wait(1500);
      await s.tap(/^puzzle\b/i);
      await s.wait(700);
      await s.tap(/18×27/);
      await s.wait(700);
      await s.tap(/12×18/);
      await s.wait(600);
      await s.tap(/add to cart/i, { scrollFor: 2 });
      await s.wait(3000);
      break;
    case "poster-cart":
      await s.goto(poster);
      await start();
      await s.wait(1500);
      await s.tap(/^wall poster/i);
      await s.wait(700);
      await s.tap(/6×9|6 × 9/);
      await s.wait(700);
      await s.tap(/add to cart/i, { scrollFor: 2 });
      await s.wait(3000);
      break;
    case "wall-cart":
      await s.goto(poster);
      await start();
      await s.wait(1800);
      await s.scroll(500, 1200);
      await s.scroll(-200, 800);
      await s.tap(/add to cart/i, { scrollFor: 3 });
      await s.wait(3000);
      break;
    case "browse-walls":
      await s.goto(`/stickers/poster-packs`);
      await start();
      await s.wait(900);
      await s.scroll(600, 1300);
      if (!(await s.tapLink(poster, 8))) await s.goto(poster);
      await s.wait(1500);
      await s.scroll(400, 900);
      await s.tap(/add to cart/i, { scrollFor: 3 });
      await s.wait(3000);
      break;
  }
  void site;
}
