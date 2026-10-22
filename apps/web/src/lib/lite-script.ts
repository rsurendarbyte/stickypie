// "Lite mode" for weak devices and slow networks: heavy visual effects
// (blurred glows, shadow filters, looping animations) are switched off and
// big artwork is skipped in favour of the small WebP card images.
//
// Decided as early as possible by an inline <head> script (LITE_SCRIPT) so the
// first paint is already light, and refined by a short frame-rate check
// (PerfProbe) that remembers a slow device for next time.
export const LITE_KEY = "stickypie.lite";

/**
 * Runs before first paint. Sets <html data-lite="cpu|fps|motion|net">: the
 * first three turn heavy effects off; "net" (slow connection only) just skips
 * big image downloads. Every lite value keeps big artwork from loading.
 */
export const LITE_SCRIPT = `(function(){try{
var d=document.documentElement,n=navigator,c=n.connection||{},m=n.deviceMemory,h=n.hardwareConcurrency;
var r=null;
if((m&&m<=2)||(h&&h<=2))r="cpu";
else if(localStorage.getItem("${LITE_KEY}")==="fps")r="fps";
else if(matchMedia("(prefers-reduced-motion: reduce)").matches)r="motion";
else if(c.saveData||/(^|-)(2g|3g)$/.test(c.effectiveType||""))r="net";
if(r)d.dataset.lite=r;
}catch(e){}})();`;
