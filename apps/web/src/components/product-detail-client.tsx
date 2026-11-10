"use client";

import SmartImg from "./smart-img";
import PageLink from "./page-link";
import ImageZoom from "./image-zoom";
import { isInternalTag, isMiniPoster, isPosterPack, isSinglePoster, isWallSetup, posterSetName, sizeChipLabel, wallSize } from "@/lib/poster";
import { puzzleBuildInches, PUZZLE_POSTER_PRICES } from "@stickypie/shared";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Car, ChevronsUpDown, Frame, Gift, PackageX, Ruler, Share2, Sparkles, Truck } from "lucide-react";
import type { Product } from "@stickypie/shared";
import { LOW_STOCK_THRESHOLD, OWN_POSTER_NAME, PUZZLE_CARDS, discountPercent, formatINR, isOwnPoster, packPosterSizes, packSizeSummary, posterSizeLabel } from "@stickypie/shared";
import { pickPoster, swapPosters, useWallLine } from "@/lib/wall-picks";
import { cardSkinFor, rotationFor } from "@/lib/palette";
import { useSkinSeed } from "@/lib/skin-seed";
import { recordProductView, useFeatures, useLiveProduct, useRelatedProducts, useStoreSettings, watchImageSaves, usePuzzlePercent } from "@/lib/live-catalog";
import { useWindowScrollMemory } from "@/lib/scroll-memory";
import { visitSeed as currentVisitSeed } from "@/lib/skin-seed";
import { rememberInterest } from "@/lib/interest";
import BackButton from "./back-button";
import StickerStepper, { type Steps, useRelatedSteps, useStepSwipe } from "./sticker-stepper";
import ProductCard from "./product-card";
import ProductCardSkeleton from "./product-card-skeleton";
import ProductDetails from "./product-details";
import ProductReviews, { RatingSummary } from "./product-reviews";
import ProductPurchase from "./product-purchase";
import LazyRail, { WALL_CARD_WIDTH } from "./lazy-rail";
import { wallEffect } from "@/lib/wall-effects";
import { posterImage, rememberPackPosters } from "@/lib/poster-images";
import FinishPicker from "./finish-picker";
import WallSizeMap, { OwnPosterButton, WallPosterSheet, WallViewSwitch, usePosterCatalog, type WallView } from "./wall-size-map";
import WallStage from "./wall-stage";
import WallTip from "./wall-tip";
import SizePicker, { puzzleChipLabel, toCartProduct, useLineFinish, useSizeChoice } from "./size-picker";
import { useCart } from "./cart-context";
import SizeRuler from "./size-ruler";
import TrueSizePreview from "./true-size-preview";
import { PuzzleButton, PuzzleLoop, PuzzleSplit, PuzzleTicket } from "./poster-puzzle";
import { launchOf, launchPuzzle, puzzleHref } from "@/lib/puzzle-launch";
import { setFinish } from "@/lib/poster-finish";
import { posterShare, puzzleShare, share } from "@/lib/share";
import { usePuzzleLead } from "@/lib/puzzle-mix";

/** A poster in a poster pack, as shown under "What's inside". */
export type PackPosterLink = { id: string; slug: string; name: string; imageUrl: string; active: boolean; /** printed size, longest side */ inches: number };

export default function ProductDetailClient({
  initial,
  category,
  related,
  steps,
  packPosters = [],
  standIn = false,
}: {
  initial: Product;
  category: { name: string; slug: string } | null;
  related: Product[];
  steps: Steps | null;
  packPosters?: PackPosterLink[];
  /** Drawn by the loading screen until the server's page takes over (that one opens the game). */
  standIn?: boolean;
}) {
  const puzzlePercent = usePuzzlePercent();
  // Static snapshot first paint; live stock/price/availability from Supabase.
  const { product, unavailable, checked } = useLiveProduct(initial.slug, initial);
  useWindowScrollMemory(true);
  rememberPackPosters(packPosters);
  // Remember (in this browser only) what kind of stickers they look at, for the home hero.
  useEffect(() => rememberInterest(initial.slug, initial.categoryIds?.length ? initial.categoryIds : [initial.categoryId]), [initial.slug]);
  useEffect(() => recordProductView(initial.id), [initial.id]);
  useEffect(() => watchImageSaves(initial.id), [initial.id]);
  // Live and on-sale only (never the build-time list).
  // a fresh related order on every visit (More like this and the Next button)
  const [visitSeed] = useState(() => currentVisitSeed());
  const { products: moreLikeThis, loaded: relatedLoaded } = useRelatedProducts(
    product.categoryId,
    product.id,
    related,
    visitSeed
  );
  // page view Next: the most alike poster; Previous: the one Next came from
  const relatedSteps = useRelatedSteps(steps, moreLikeThis[0] ?? null, product);

  const rotate = rotationFor(product.slug);
  // Same sticker sheet / cutting mat look as the home hero — new every load.
  const seed = useSkinSeed();
  const skin = cardSkinFor(product.slug, seed);
  const finish = useLineFinish(product);
  const isPuzzle = finish === "puzzle";
  const { sizes, size, setSize, price, compareAtPrice } = useSizeChoice(product, finish);
  const off = discountPercent(price, compareAtPrice);
  const out = product.stock === 0;
  const settings = useStoreSettings();
  const [trueSize, setTrueSize] = useState(false);
  const [artEl, setArtEl] = useState<HTMLImageElement | null>(null);
  const features = useFeatures();
  const swipe = useStepSwipe(relatedSteps);
  const low = product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  // A pack's picture is the whole wall, so "actual size" would mislead — its posters are listed instead.
  const isPack = isPosterPack(product) || packPosters.length > 0;
  const poster = isPack || (isMiniPoster(product) && finish !== "sticker");
  const [zoom, setZoom] = useState(false);
  // Single posters: the picture solves itself now and then, and the shopper can play it for 10% off.
  const puzzle = isSinglePoster(product) && !out && !unavailable;
  // every Play here opens the site-wide game (components/puzzle-launcher), which
  // lives on through the loading screen handing over to the page
  const play = () => launchPuzzle({ ...launchOf(product), size: isPuzzle ? size : null });
  const { add, openCart } = useCart();
  const mixPuzzles = usePuzzleLead();
  // ?finish=puzzle (puzzle poster cards) opens it as a puzzle poster. A Play &
  // win link (?puzzle=1) goes to the game's own page, normally from <head>
  // already (lib/puzzle-boot.ts); this is the fallback.
  useEffect(() => {
    if (standIn || !isSinglePoster(initial)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("puzzle")) return void window.location.replace(puzzleHref(initial.slug));
    if (params.get("finish") === "puzzle") setFinish("puzzle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [wallView, setWallView] = useState<WallView>("wall");
  const [spot, setSpot] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const ownFile = useRef<HTMLInputElement>(null);
  const { posters: picks } = useWallLine(product, price);
  const posterCatalog = usePosterCatalog();
  // What's inside follows the shopper's picks.
  const shownPosters = picks
    ? picks.flatMap((id, i) => {
        const own = packPosters.find((p) => p.id === id);
        const p = posterCatalog.find((c) => c.id === id);
        const inches = packPosterSizes(product)[i] ?? 6;
        if (isOwnPoster(id)) {
          const imageUrl = posterImage(id);
          return imageUrl ? [{ id, slug: id, name: OWN_POSTER_NAME, imageUrl, active: false, inches }] : [];
        }
        if (own) return [{ ...own, inches }];
        return p ? [{ id: p.id, slug: p.slug, name: p.name, imageUrl: p.thumbUrl ?? p.imageUrl, active: true, inches }] : [];
      })
    : // The pack as it is now: the page's own list dates from its last deploy.
      product.packItems.flatMap((id, i) => {
        const p = posterCatalog.find((c) => c.id === id);
        const inches = packPosterSizes(product)[i] ?? 6;
        if (p) return [{ id: p.id, slug: p.slug, name: p.name, imageUrl: p.thumbUrl ?? p.imageUrl, active: true, inches }];
        return packPosters.filter((own) => own.id === id);
      });
  const shownTags = product.tags.filter((t) => !isInternalTag(t));
  const wall = isWallSetup(product);
  // portrait art (posters): on wide screens the stage grows with the window height instead of a fixed 440px box
  const tall = !wall && (product.aspectRatio ?? 1) < 0.95;
  // A wall's posters have their own buttons, so the picture around them can't be one.
  const ArtBlock = wall ? "div" : "button";

  const inside = isPack && (
      <div className={wall ? "mt-8" : "mt-5"}>
        <h2 className="font-display text-lg font-semibold">
          What&apos;s inside · {product.packItems.length} posters
        </h2>
        <p className="text-xs text-fog">
          {packSizeSummary(packPosterSizes(product))}. Lay them out like the picture.
        </p>
        <ol className={`mt-2 grid gap-2 ${wall ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" : "max-w-md grid-cols-3 sm:grid-cols-4"}`}>
          {!checked && product.packItems.map((id) => <li key={id} className="aspect-[2/3] animate-pulse rounded-md bg-panel" />)}
          {checked && shownPosters.map((p, n) => {
            const tile = (
              <>
                <SmartImg full={p.imageUrl} thumb={null} alt={p.name} className="aspect-[2/3] w-full rounded-md object-cover" />
                <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-fog">
                  {n + 1}. {p.name.replace(/ — Mini Poster$| Mini Poster$/, "")}
                </span>
                {/* outside the two-line name, so a long name can't hide it */}
                <span className={`block text-[11px] leading-tight font-semibold ${p.inches > 6 ? "text-brand" : "text-fog"}`}>{posterSizeLabel(p.inches)}</span>
              </>
            );
            return (
              <li key={p.slug}>
                {p.active ? (
                  <PageLink href={`/sticker/${p.slug}`} className="block transition-opacity hover:opacity-80">
                    {tile}
                  </PageLink>
                ) : (
                  tile
                )}
              </li>
            );
          })}
        </ol>
      </div>
  );

  return (
    <>
      {/* Mat across the top of the page, fading softly into the page below */}
      <div
        aria-hidden
        style={skin.art}
        className="detail-mat pointer-events-none absolute inset-x-0 top-0 -z-10 h-[820px]"
      />
      <div className="flex items-center gap-3">
        {/* came from a shop page: back there; straight from a link (an ad, a share): home */}
        <BackButton fallback="/" />
        {/* phones show the Swipe view switch here instead of the breadcrumb */}
        <nav className="min-w-0 truncate text-xs text-fog max-sm:hidden">
          <PageLink href="/stickers" className="hover:text-snow">
            Stickers
          </PageLink>
          {category && (
            <>
              <span className="mx-1.5">/</span>
              <PageLink href={`/stickers/${category.slug}`} className="hover:text-snow">
                {category.name}
              </PageLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Phones: back to the full-screen swipe view (components/sticker-reel.tsx) */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("stickypie:swipe-view"))}
            className="peel-btn peel-btn--light inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-brand sm:hidden"
          >
            <ChevronsUpDown className="size-4" /> Swipe view
          </button>
          <button
            type="button"
            onClick={() =>
              void share(
                isPuzzle
                  ? puzzleShare({ slug: product.slug, name: product.name, image: product.thumbUrl ?? product.imageUrl }, undefined, puzzlePercent)
                  : posterShare(product, `/sticker/${product.slug}`)
              )
            }
            aria-label={isPuzzle ? "Share this puzzle" : "Share"}
            className="peel-btn peel-btn--light inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold max-sm:hidden"
          >
            <Share2 className="size-4" /> {isPuzzle ? "Challenge a friend" : "Share"}
          </button>
          {relatedSteps && <StickerStepper steps={relatedSteps} />}
        </div>
      </div>

      <div className={`mt-3 grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-10 ${wall ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : tall && !isPack ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"}`}>
        {/* Art — stays in view on wide screens while the details (e.g. a pack's posters) scroll */}
        <div className="lg:sticky lg:top-24 lg:self-start">
        <div
          className={`relative w-full ${
            wall
              ? "aspect-square"
              : isPack
                ? "aspect-[4/5] max-h-[620px]"
                : tall
                  ? // as tall as the window allows (header, breadcrumb and the "See actual size" button still in view), 420px at least, 860px at most
                    "aspect-[5/4] max-h-[440px] sm:aspect-square lg:aspect-auto lg:max-h-none lg:h-[clamp(420px,calc(100dvh-13rem),860px)]"
                  : "aspect-[5/4] max-h-[440px] sm:aspect-square"
          }`}
          {...swipe}
        >
          <ArtBlock
            {...(wall ? {} : { type: "button" as const })}
            // A pack's picture is a collage of all its posters — no "actual size" for it.
            onClick={() => (isPack ? setZoom(true) : setTrueSize(true))}
            aria-label={isPack ? `Zoom into ${product.name}` : "See actual size"}
            // one fixed-size cell, so max-h-full has a height to fit tall art (posters) into
            className={`absolute inset-0 grid cursor-zoom-in grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center ${wall && wallView !== "wall" ? "invisible" : ""} ${wall ? "" : isPack ? "p-2" : tall ? "p-6 sm:p-10 lg:px-10 lg:pt-10 lg:pb-6" : "p-6 sm:p-10"}`}
            style={{ transform: isPack ? undefined : `rotate(${rotate / 2}deg)` }}
          >
            {wall && picks && !checked ? (
              <span className="size-[92%] animate-pulse rounded-2xl bg-panel" />
            ) : wall ? (
              <WallStage
                bare
                priority
                product={product}
                posters={picks}
                onRemove={checked ? (i) => pickPoster(product, i, "") : undefined}
                onAdd={checked ? setSpot : undefined}
                onSwap={checked ? (a, b) => swapPosters(product, a, b) : undefined}
                onFit={checked ? setSpot : undefined}
                onChoose={
                  choosing
                    ? (i) => {
                        setChoosing(false);
                        setSpot(i);
                        ownFile.current?.click();
                      }
                    : undefined
                }
                src={product.displayUrl ?? product.imageUrl}
                alt={product.name}
                className={out || unavailable ? "opacity-50 saturate-50" : ""}
              />
            ) : (
              <SmartImg
                full={product.displayUrl ?? product.imageUrl}
                thumb={product.thumbUrl}
                alt={product.name}
                priority
                imgRef={setArtEl}
                className={`sticker-cut max-h-full max-w-full object-contain ${puzzle && isPuzzle ? "puzzle-cut-mask" : ""} ${
                  out || unavailable ? "opacity-50 saturate-50" : ""
                }`}
              />
            )}
            {puzzle && isPuzzle && <PuzzleSplit src={product.displayUrl ?? product.imageUrl} img={artEl} />}
            {puzzle && isPuzzle && <PuzzleLoop priority src={product.displayUrl ?? product.imageUrl} img={artEl} />}
            {features.sizeRuler && !isPack && <SizeRuler img={artEl} inches={sizes.length > 0 && size !== null ? (isPuzzle ? puzzleBuildInches(size) : size) : null} aspectRatio={product.aspectRatio} />}
          </ArtBlock>
          {wall && wallView !== "wall" && (
            <div className="absolute inset-0">
              <WallSizeMap product={product} posters={picks} />
            </div>
          )}
          {wall && checked && !out && !unavailable && wallView === "wall" && <WallTip />}
          {puzzle && <PuzzleButton src={product.thumbUrl ?? product.imageUrl} onClick={play} className="absolute bottom-2 left-2" />}
          {off !== null && !unavailable && wallView === "wall" && (
            <span className="pie-gradient absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-bold text-white">
              SAVE {off}%
            </span>
          )}
        </div>
        {wall && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <WallViewSwitch
              view={wallView}
              onChange={(view) => {
                setWallView(view);
                setChoosing(false);
              }}
            />
            {checked && !out && !unavailable && wallView === "wall" && <OwnPosterButton choosing={choosing} onChange={setChoosing} />}
            <WallPosterSheet product={product} posters={picks} spot={spot} onClose={() => setSpot(null)} fileInput={ownFile} />
          </div>
        )}
        {/* Below the art, so it never covers it or the size ruler. Phones skip it to keep
            the price in the first screen — the "see it at actual size" link under the
            size picker does the same there. */}
        <div className={`mt-1 hidden justify-center ${isPack ? "" : "sm:flex"}`}>
          <button
            type="button"
            onClick={() => setTrueSize(true)}
            className="peel-btn peel-btn--light inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold"
          >
            <Ruler className="size-4" /> See actual size
          </button>
        </div>
        </div>

        {/* Details */}
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{isPack ? posterSetName(product.name) : product.name}</h1>
          <RatingSummary productId={product.id} />

          <div className="mt-1.5 flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold text-gold">
              {formatINR(price)}
            </span>
            {compareAtPrice !== null && compareAtPrice > price && (
              <span className="text-lg text-fog line-through">
                {formatINR(compareAtPrice)}
              </span>
            )}
            <span className="text-xs text-fog">
              {settings.business.gstRate > 0 ? "+ GST + shipping" : "+ shipping"}
            </span>
          </div>

          {unavailable ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-ink2 px-4 py-3 text-sm text-fog">
              <PackageX className="size-4 shrink-0 text-brand" />
              This sticker is currently not available for sale.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm">
                {out ? (
                  <span className="font-semibold text-brand">Out of stock — check back soon</span>
                ) : low ? (
                  <span className="font-semibold text-gold">
                    Only {product.stock} left — going fast
                  </span>
                ) : (
                  <span className="font-medium text-mint">In stock</span>
                )}
              </p>

              <p className="mt-2 line-clamp-3 max-w-lg text-sm leading-relaxed text-fog">
                {wall ? `A ready wall of ${product.packItems.length} posters, laid out to go up together.` : product.description}
              </p>

              {wall && <WallFacts product={product} />}

              {puzzle && (
                <PuzzleTicket
                  src={product.thumbUrl ?? product.imageUrl}
                  onPlay={play}
                  // the prize is for puzzle posters, so the ticket shows the puzzle poster's price
                  price={PUZZLE_POSTER_PRICES[size ?? 6] ?? PUZZLE_POSTER_PRICES[6]}
                  className="mt-4"
                />
              )}

              {isMiniPoster(product) && !isPack && !out && (
                <div className="mt-4">
                  <FinishPicker />
                </div>
              )}
              {sizes.length > (isPack ? 1 : 0) && !out && (
                <div className="mt-4">
                  <SizePicker
                    sizes={sizes}
                    value={size}
                    onChange={setSize}
                    label={(inches) => (isPuzzle ? puzzleChipLabel(product, inches) : sizeChipLabel(product, inches))}
                  />
                  {isPuzzle && size !== null && (
                    <p className="mt-2 text-xs text-fog">
                      {PUZZLE_CARDS} cards of {sizeChipLabel(product, size)} in that fit together into one {puzzleChipLabel(product, size)} in poster. Glue dots included.
                    </p>
                  )}
                </div>
              )}

              <ProductPurchase product={product} stickerSize={size} price={price} />
              {sizes.length > 0 && !isPack && (
                <button
                  type="button"
                  onClick={() => setTrueSize(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-fog transition-colors hover:text-brand"
                >
                  <Ruler className="size-3.5" /> Not sure about the size? See it at actual size
                </button>
              )}
            </>
          )}

          <ul className="mt-4 grid max-w-md grid-cols-2 gap-2 text-xs text-fog">
            <li className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-mint" /> {poster ? "Premium poster paper" : <>Die-cut, peel &amp; stick</>}
            </li>
            <li className="flex items-center gap-2">
              {poster ? (
                <>
                  <Frame className="size-4 text-mint" /> Walls, doors &amp; cupboards
                </>
              ) : (
                <>
                  <Car className="size-4 text-mint" /> Car, bike &amp; laptop
                </>
              )}
            </li>
            <li className="flex items-center gap-2">
              {poster ? (
                <>
                  <Gift className="size-4 text-mint" /> Glue dots or tape included
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-mint" /> Clean with a dry cloth
                </>
              )}
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 text-mint" /> Ships in 2–4 days
            </li>
          </ul>

          {wall && (
            <div className="mt-5 max-w-md">
              <h2 className="font-display text-base font-semibold">How to put it up</h2>
              <ol className="mt-2 space-y-1.5 text-sm text-fog">
                {["Lay the posters out like the picture.", "Add glue dots or tape to the back of each poster.", "Press them onto a clean, dry wall."].map((step, n) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">{n + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!wall && inside}

          {!unavailable && !wall && <ProductDetails size={sizes.length > 0 ? size : null} />}

          {shownTags.length > 0 && !wall && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {shownTags.slice(0, 5).map((tag) => (
                <PageLink
                  key={tag}
                  href={`/stickers?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-panel px-3 py-1 text-xs text-fog transition-colors hover:text-snow"
                >
                  #{tag}
                </PageLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {wall && inside}

      {(!relatedLoaded || moreLikeThis.length > 0) && (
        <div className="mt-6 -mx-4 sm:-mx-8">
          <LazyRail
            eager={false}
            wide={isPack}
            title="More like this"
            href={category ? `/stickers/${category.slug}` : "/stickers"}
          >
            {relatedLoaded
              ? (isPack ? mixPuzzles(moreLikeThis) : moreLikeThis).map((p) =>
                  isPack ? (
                    <ProductCard key={p.id} product={p} width={WALL_CARD_WIDTH} wallEffect={wallEffect(0, seed)} />
                  ) : (
                    <ProductCard key={p.id} product={p} />
                  ),
                )
              : Array.from({ length: 5 }, (_, i) => <ProductCardSkeleton key={i} index={i} {...(isPack ? { width: WALL_CARD_WIDTH } : {})} />)}
          </LazyRail>
        </div>
      )}
      <ProductReviews productId={product.id} />

      {isPack && (
        <ImageZoom open={zoom} onClose={() => setZoom(false)} src={product.imageUrl} title={product.name} ratio={product.aspectRatio ?? undefined} />
      )}
      <TrueSizePreview
        open={trueSize && !isPack}
        onClose={() => setTrueSize(false)}
        name={product.name}
        imageUrl={product.imageUrl}
        aspectRatio={product.aspectRatio}
        sizes={isPuzzle ? sizes.map((s) => ({ ...s, inches: puzzleBuildInches(s.inches) })) : sizes}
        size={isPuzzle && size !== null ? puzzleBuildInches(size) : size}
        onSizeChange={(inches) => setSize(isPuzzle ? inches / 3 : inches)}
      />
    </>
  );
}

/** A wall set at a glance: how many posters of each size, and the wall it needs. */
function WallFacts({ product }: { product: Product }) {
  const sizes = packPosterSizes(product);
  const space = wallSize(product);
  const facts = [
    ...[9, 6].flatMap((inches) => {
      const count = sizes.filter((s) => s === inches).length;
      return count ? [{ value: `${count} ${count === 1 ? "pc" : "pcs"}`, label: posterSizeLabel(inches) }] : [];
    }),
    ...(space ? [{ value: space, label: "Wall space" }] : []),
  ];
  return (
    <dl className={`mt-3 grid max-w-md gap-2 ${facts.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-xl border border-line bg-white px-3 py-2">
          <dt className="text-[11px] text-fog">{fact.label}</dt>
          <dd className="font-display text-lg leading-tight font-bold text-snow">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
