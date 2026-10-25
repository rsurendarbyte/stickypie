// Sticker pages on phones always open in swipe view (components/sticker-reel.tsx).
// "Page view" applies to the sticker on screen only — never remembered — except
// for the one page load it takes to open the page view of a sticker the
// shopper swiped to (a one-time flag in sessionStorage).
export const PAGE_VIEW_ONCE_KEY = "stickypie.view.once";

/**
 * Runs in <head> before anything is drawn: when this load is that one page-view
 * hand-over, the swipe view is hidden straight away (html[data-view="classic"],
 * see globals.css), so it never flashes. Also drops the old remembered choice.
 */
export const VIEW_SCRIPT = `try{localStorage.removeItem("stickypie.view");if(sessionStorage.getItem("${PAGE_VIEW_ONCE_KEY}")===location.pathname)document.documentElement.dataset.view="classic"}catch(e){}`;
