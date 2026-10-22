import { isProductionSite, jsonLd } from "@/lib/site";

/** Google structured data — only on the production site (dev is noindex anyway). */
export default function JsonLd({ data }: { data: unknown }) {
  if (!isProductionSite()) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}
