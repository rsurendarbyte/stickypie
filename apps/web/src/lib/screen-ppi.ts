// How many CSS pixels make one real inch on this screen. Browsers don't expose
// the physical screen size, so known devices are matched by their CSS screen
// size + pixel ratio (their panel density is public), and everything else gets
// a platform estimate. Shoppers can still calibrate against a bank card.

type Known = { w: number; h: number; dpr: number; ppi: number; name: string; os?: "apple" | "android" };

// ppi = the panel's physical pixels per inch.
const KNOWN: Known[] = [
  // iPhone
  { w: 320, h: 568, dpr: 2, ppi: 326, os: "apple", name: "iPhone SE" },
  { w: 375, h: 667, dpr: 2, ppi: 326, os: "apple", name: "iPhone 6/7/8/SE" },
  { w: 414, h: 736, dpr: 3, ppi: 401, os: "apple", name: "iPhone Plus" },
  { w: 375, h: 812, dpr: 3, ppi: 458, os: "apple", name: "iPhone X/XS/11 Pro" },
  { w: 414, h: 896, dpr: 2, ppi: 326, os: "apple", name: "iPhone XR/11" },
  { w: 414, h: 896, dpr: 3, ppi: 458, os: "apple", name: "iPhone XS Max/11 Pro Max" },
  { w: 360, h: 780, dpr: 3, ppi: 476, os: "apple", name: "iPhone mini" },
  { w: 390, h: 844, dpr: 3, ppi: 460, os: "apple", name: "iPhone 12/13/14" },
  { w: 428, h: 926, dpr: 3, ppi: 458, os: "apple", name: "iPhone Pro Max/Plus" },
  { w: 393, h: 852, dpr: 3, ppi: 460, os: "apple", name: "iPhone 14 Pro/15/16" },
  { w: 430, h: 932, dpr: 3, ppi: 460, os: "apple", name: "iPhone Pro Max/Plus" },
  { w: 402, h: 874, dpr: 3, ppi: 460, os: "apple", name: "iPhone 16 Pro" },
  { w: 440, h: 956, dpr: 3, ppi: 460, os: "apple", name: "iPhone 16 Pro Max" },
  // iPad
  { w: 768, h: 1024, dpr: 2, ppi: 264, os: "apple", name: "iPad" },
  { w: 810, h: 1080, dpr: 2, ppi: 264, os: "apple", name: "iPad" },
  { w: 820, h: 1180, dpr: 2, ppi: 264, os: "apple", name: "iPad Air" },
  { w: 834, h: 1112, dpr: 2, ppi: 264, os: "apple", name: "iPad Pro 10.5" },
  { w: 834, h: 1194, dpr: 2, ppi: 264, os: "apple", name: "iPad Pro 11" },
  { w: 1024, h: 1366, dpr: 2, ppi: 264, os: "apple", name: "iPad Pro 12.9" },
  { w: 744, h: 1133, dpr: 2, ppi: 326, os: "apple", name: "iPad mini" },
  // MacBook (default "looks like" resolutions)
  { w: 1440, h: 900, dpr: 2, ppi: 227, os: "apple", name: "MacBook Air/Pro 13″" },
  { w: 1470, h: 956, dpr: 2, ppi: 224, os: "apple", name: "MacBook Air 13″" },
  { w: 1710, h: 1112, dpr: 2, ppi: 224, os: "apple", name: "MacBook Air 15″" },
  { w: 1512, h: 982, dpr: 2, ppi: 254, os: "apple", name: "MacBook Pro 14″" },
  { w: 1728, h: 1117, dpr: 2, ppi: 254, os: "apple", name: "MacBook Pro 16″" },
  { w: 1536, h: 960, dpr: 2, ppi: 226, os: "apple", name: "MacBook Pro 15″" },
  { w: 1280, h: 800, dpr: 2, ppi: 227, os: "apple", name: "MacBook 13″ (more space off)" },
  // Popular Android phones
  { w: 360, h: 780, dpr: 3, ppi: 425, os: "android", name: "Samsung Galaxy S" },
  { w: 384, h: 832, dpr: 2.81, ppi: 416, os: "android", name: "Samsung Galaxy S+" },
  { w: 412, h: 915, dpr: 2.63, ppi: 416, os: "android", name: "Google Pixel" },
  { w: 412, h: 892, dpr: 2.63, ppi: 428, os: "android", name: "Google Pixel 8" },
  { w: 393, h: 873, dpr: 2.75, ppi: 400, os: "android", name: "Xiaomi / Redmi" },
];

export type PpiEstimate = { pxPerInch: number; source: "device" | "estimate"; device?: string };

export function estimatePxPerInch(): PpiEstimate {
  if (typeof window === "undefined") return { pxPerInch: 96, source: "estimate" };
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  const a = Math.min(screen.width, screen.height);
  const b = Math.max(screen.width, screen.height);
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const os = apple ? "apple" : /Android/.test(ua) ? "android" : "other";
  const hit = KNOWN.find(
    (d) => Math.min(d.w, d.h) === a && Math.max(d.w, d.h) === b && Math.abs(d.dpr - dpr) < 0.02 && d.os === os
  );
  if (hit) return { pxPerInch: hit.ppi / dpr, source: "device", device: hit.name };

  const touch = window.matchMedia("(pointer: coarse)").matches;
  const iOS = /iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const phone = touch && a < 500;
  if (iOS) return { pxPerInch: phone ? 153 : 132, source: "estimate" };
  // Android lays out in dp ≈ 1/160 inch; real phones land around 140–160.
  if (phone) return { pxPerInch: 150, source: "estimate" };
  if (touch) return { pxPerInch: 130, source: "estimate" };
  // Retina Macs at other scalings ≈ 110–130; Windows laptops at 125–150% ≈ 100–115;
  // plain 1× monitors ≈ 90–100.
  if (/Macintosh/.test(ua) && dpr >= 2) return { pxPerInch: 118, source: "estimate" };
  if (dpr >= 1.5) return { pxPerInch: 106, source: "estimate" };
  if (dpr > 1) return { pxPerInch: 104, source: "estimate" };
  return { pxPerInch: 96, source: "estimate" };
}
