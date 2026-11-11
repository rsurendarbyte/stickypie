import ApproveManager, { type Draft } from "@/components/approve-manager";
import TrendPrompt from "@/components/trend-prompt";
import { getAdminDriver } from "@/lib/data";
import { DRAFT_TAG } from "@/lib/drafts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approve" };

export default async function ApprovePage() {
  const driver = await getAdminDriver();
  const [products, trendWalls] = await Promise.all([driver.listProducts(), driver.getTrendWalls()]);
  const drafts: Draft[] = products
    .filter((p) => p.tags.includes(DRAFT_TAG))
    .map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.displayUrl ?? p.imageUrl,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      posters: p.packItems.length,
      trend: p.tags.find((t) => t.startsWith("trend:"))?.slice(6) ?? null,
      tags: p.tags,
    }));
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Approve</h1>
      <p className="mt-1 text-sm text-fog">
        New walls made every morning from what India is searching, out of posters already in the shop. They stay hidden until you
        release them.
      </p>
      <div className="mt-6">
        <TrendPrompt initial={trendWalls} />
        <ApproveManager initial={drafts} />
      </div>
    </div>
  );
}
