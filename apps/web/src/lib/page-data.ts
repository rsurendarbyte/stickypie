// Server-only: catalogue reads shared by a page and its metadata. React's
// cache() runs each one once per render, so a page refresh (ISR) asks
// Supabase once instead of twice for the same product or list.
import { cache } from "react";
import { getDriver } from "./data";

export const productBySlug = cache((slug: string) => getDriver().getProductBySlug(slug));
export const activeProducts = cache(() => getDriver().listProducts({ activeOnly: true }));
export const allCategories = cache(() => getDriver().listCategories());
