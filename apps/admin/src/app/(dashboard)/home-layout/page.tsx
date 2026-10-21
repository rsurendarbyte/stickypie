import HomeRailsEditor from "@/components/home-rails-editor";
import { getAdminDriver } from "@/lib/data";
import { webUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home page" };

export default async function HomeLayoutPage() {
  const driver = await getAdminDriver();
  const [rails, products, categories] = await Promise.all([
    driver.getHomeRails(),
    driver.listProducts(),
    driver.listCategories(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Home page</h1>
      <p className="mt-1 text-sm text-fog">
        Choose the rails on the storefront home page, their order and what goes in them. Saved
        changes show on the live shop straight away. Only stickers that are open for sale appear.
      </p>
      <div className="mt-6">
        <HomeRailsEditor
          initial={rails}
          products={products}
          categories={categories}
          shopUrl={webUrl()}
        />
      </div>
    </div>
  );
}
