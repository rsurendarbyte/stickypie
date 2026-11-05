import HomePageEditor from "@/components/home-page-editor";
import HomeRailsEditor from "@/components/home-rails-editor";
import { getAdminDriver } from "@/lib/data";
import { webUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home page" };

export default async function HomeLayoutPage() {
  const driver = await getAdminDriver();
  const [homePage, rails, products, categories] = await Promise.all([
    driver.getHomePage(),
    driver.getHomeRails(),
    driver.listProducts(),
    driver.listCategories(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Home page</h1>
      <p className="mt-1 text-sm text-fog">Saved changes show on the live shop straight away.</p>
      <div className="mt-5">
        <HomePageEditor
          initial={homePage}
          shopUrl={webUrl()}
          walls={products
            .filter((p) => p.packItems.length > 0)
            .map((p) => ({
              slug: p.slug,
              name: p.name,
              image: p.thumbUrl ?? p.imageUrl,
              theme: p.tags.find((t) => t.startsWith("wall theme:"))?.slice(11) ?? null,
              paint: p.tags.find((t) => t.startsWith("wall paint:"))?.slice(11) ?? null,
              posters: p.packItems.length,
            }))}
        >
          <HomeRailsEditor initial={rails} products={products} categories={categories} shopUrl={webUrl()} />
        </HomePageEditor>
      </div>
    </div>
  );
}
