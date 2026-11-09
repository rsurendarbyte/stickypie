// A link that opens a poster's puzzle game (an ad, a shared /puzzle/ link,
// Play & win) shows the game screen at once, not the poster page first and the
// game seconds later when the page's code has loaded on a slow phone.
//
// Runs in <head> before anything is drawn and sets html[data-puzzle-boot]:
//   /puzzle/<slug>                       a shared puzzle link
//   /sticker/<slug>?puzzle=1             Play & win
//   /sticker/<slug>?finish=puzzle        only when opened from outside the shop
//                                        (an ad, WhatsApp); inside, puzzle cards
//                                        open the poster page as a puzzle poster
// While it's set, the page's still copy of the game screen covers everything
// (components/puzzle-boot.tsx, globals.css); the real game removes it when it opens,
// and it goes by itself after 20s if the page's code never loads.
export const PUZZLE_BOOT_SCRIPT = `try{var l=location,q=new URLSearchParams(l.search),r=document.referrer,o=!r||new URL(r).host!==l.host;if(l.pathname.indexOf("/puzzle/")===0||(l.pathname.indexOf("/sticker/")===0&&(q.has("puzzle")||(q.get("finish")==="puzzle"&&o)))){var h=document.documentElement;h.dataset.puzzleBoot="";setTimeout(function(){delete h.dataset.puzzleBoot},20000)}}catch(e){}`;

/** This load came from a link that opens the game (see PUZZLE_BOOT_SCRIPT). */
export function puzzleBooting(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.puzzleBoot !== undefined;
}

/** The game is open (or won't open): the still copy goes. */
export function endPuzzleBoot() {
  if (typeof document !== "undefined") delete document.documentElement.dataset.puzzleBoot;
}
