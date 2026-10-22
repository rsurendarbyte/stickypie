import FeatureToggles from "@/components/feature-toggles";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Features" };

export default async function FeaturesPage() {
  const driver = await getAdminDriver();
  const features = await driver.getFeatures();

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Features</h1>
      <p className="mt-1 text-sm text-fog">
        Switch storefront features on or off. Changes save straight away and show on the live
        shop the next time a page loads.
      </p>
      <div className="mt-6">
        <FeatureToggles initial={features} />
      </div>
    </div>
  );
}
