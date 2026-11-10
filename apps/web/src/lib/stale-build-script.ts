// After a deploy, a page the phone saved earlier (service worker, see
// public/sw.js) still points at the old build's code files. Those that were
// loaded before are saved too, but code loaded later (sign-in, the puzzle
// game, …) is gone from the server, so it fails to download.
//
// This runs in <head>: when such a download fails, it drops the saved pages
// (so the next load comes fresh from the server) and reloads once. It never
// loops: at most one reload a minute, and none while offline.

/** True for the errors browsers and Next.js give when a code file can't be downloaded. */
export const STALE_CHUNK_PATTERN =
  "ChunkLoadError|Loading chunk|Failed to load chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed";

export const STALE_BUILD_SCRIPT = `(function(){var re=new RegExp(${JSON.stringify(STALE_CHUNK_PATTERN)},"i");function go(m){try{if(!m||!re.test(String(m))||navigator.onLine===false)return false;var k="stickypie.stale-reload",t=+sessionStorage.getItem(k)||0;if(Date.now()-t<60000)return false;sessionStorage.setItem(k,String(Date.now()));var r=function(){location.reload()};window.caches?caches.delete("sp-pages-v1").then(r,r):r();return true}catch(e){return false}}window.__spStaleBuild=go;addEventListener("error",function(e){go(e.message||(e.error&&e.error.message))});addEventListener("unhandledrejection",function(e){var x=e.reason;go(x&&(x.message||x.name)||x)})})();`;

/** Reloads once with fresh pages when `message` is a failed code download; true if it did. */
export function reloadIfStaleBuild(message: string | undefined): boolean {
  if (typeof window === "undefined") return false;
  const go = (window as unknown as { __spStaleBuild?: (m?: string) => boolean }).__spStaleBuild;
  return go ? go(message) : false;
}
