# Daily trend walls

The Claude scheduled task runs this every morning on the Mac (Claude subscription, no other cost).
Walls are made only from posters already in the shop, saved hidden, and wait on the admin
**Approve** page until released.

**What to make** (how many, what to skip, the stop limit) is the **Daily prompt** on admin →
Approve. Edit it there; the next run uses it. The default is `DEFAULT_TREND_WALLS_PROMPT` in
`packages/shared/src/trend-walls.ts`. The last run's walls show under the prompt.

## Scheduled task prompt (fixed steps)

Work in /Users/bft/Documents/Stickypie. Make today's trend walls for StickyPie:

1. Run `node scripts/trend-brief.mjs --prod`, then read `prod_stickers/trend-walls/brief.json`.
2. Follow `instructions` in the brief (the owner's Daily prompt) to pick today's walls from
   `trends` and `posters`. Write them in the brief's `format` and `setShape` to
   `prod_stickers/trend-walls/sets-<YYYY-MM-DD>.json`. If the instructions say to make nothing today,
   stop and say why.
3. Run `node scripts/make-wall-setups.mjs --prod --sets=prod_stickers/trend-walls/sets-<YYYY-MM-DD>.json --save --draft`.
   It saves them hidden and records the run for the Approve page.
4. Look at each picture in `prod_stickers/wall-setups/<theme>/<name>.jpg` and note any that look wrong.
5. Report in 3–5 short lines: which searches, which walls, anything skipped and why. End with:
   "Release them in admin → Approve."

Never release, change or delete existing products. Never commit, push or deploy.

## By hand (dev database)

```bash
node scripts/trend-brief.mjs
node scripts/make-wall-setups.mjs --sets=prod_stickers/trend-walls/sets-test.json --save --draft
```
