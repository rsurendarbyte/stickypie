import FestivalsEditor from "@/components/festivals-editor";
import { getAdminDriver } from "@/lib/data";
import { webUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Festivals" };

export default async function FestivalsPage() {
  const driver = await getAdminDriver();
  const [festivals, products, categories] = await Promise.all([
    driver.getFestivals(),
    driver.listProducts(),
    driver.listCategories(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Festivals</h1>
      <p className="mt-1 text-sm text-fog">
        Festivals and special days. Around each date its stickers become the first row of the home
        page — that switches on and off by itself and shows as soon as you save. Every festival also
        has its own page for Google and AI search, kept all year; a new festival&apos;s page goes live
        with the next deploy.
      </p>
      <div className="mt-6">
        <FestivalsEditor
          initial={festivals}
          products={products}
          categories={categories}
          shopUrl={webUrl()}
        />
      </div>
    </div>
  );
}
