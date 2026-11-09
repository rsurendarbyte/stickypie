// The puzzle game is its own page, /puzzle/<slug> (app/puzzle/[slug]). A link
// meant for the game that lands on the poster page goes straight there instead,
// from <head>, before anything is drawn (no poster page first, then the game):
//   /sticker/<slug>?puzzle=1             Play & win
//   /sticker/<slug>?finish=puzzle        only when opened from outside the shop
//                                        (an ad, WhatsApp); inside, puzzle cards
//                                        open the poster page as a puzzle poster
// The rest of the address (ad tracking, ?size=) goes along.
export const PUZZLE_BOOT_SCRIPT = `try{var l=location,m=l.pathname.match(/^\\/sticker\\/([^/?#]+)/),q=new URLSearchParams(l.search),r=document.referrer,o=!r||new URL(r).host!==l.host;if(m&&(q.has("puzzle")||(q.get("finish")==="puzzle"&&o))){q.delete("puzzle");q.delete("finish");var s=q.toString();l.replace("/puzzle/"+m[1]+(s?"?"+s:""))}}catch(e){}`;
