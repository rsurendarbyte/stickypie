import { CreditCard, Database, Globe, HardDrive } from "lucide-react";
import ResetDemoButton from "@/components/reset-demo-button";
import StoreSettingsForm from "@/components/store-settings-form";
import { getAdminDriver } from "@/lib/data";
import { supabaseConfigured, webUrl } from "@/lib/auth";
import { r2Config } from "@/lib/r2";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

function maskedHost(url: string | undefined): string {
  if (!url) return "—";
  try {
    return new URL(url).host;
  } catch {
    return "configured";
  }
}

export default async function SettingsPage() {
  const supabase = supabaseConfigured();
  const r2 = r2Config();
  const settings = await (await getAdminDriver()).getSettings();

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-fog">
        Shop rules and environment status. Secrets live in .env files, never in the UI.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StoreSettingsForm initial={settings} />

        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-fog" />
            <h2 className="text-sm font-semibold">Database</h2>
          </div>
          {supabase ? (
            <>
              <p className="mt-3 inline-block rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
                Supabase connected
              </p>
              <p className="mt-2 text-xs text-fog">{maskedHost(process.env.SUPABASE_URL)}</p>
            </>
          ) : (
            <>
              <p className="mt-3 inline-block rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                Local demo store
              </p>
              <p className="mt-2 text-xs leading-relaxed text-fog">
                Products and orders live in <code>data/dev-store.json</code>, shared with the
                storefront. Set SUPABASE_URL + SUPABASE_ANON_KEY in apps/admin/.env.local to
                switch to a real database.
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-fog" />
            <h2 className="text-sm font-semibold">Payments</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fog">
            Choose the gateway below in <span className="text-snow">Payment gateway</span>. Keys live in the{" "}
            <span className="text-snow">storefront</span> (apps/web/.env.local, and Worker secrets on the live
            site): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET for Razorpay; CASHFREE_APP_ID,
            CASHFREE_SECRET_KEY, CASHFREE_ENV for Cashfree. With neither, local checkout uses the test simulator.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-fog" />
            <h2 className="text-sm font-semibold">Storefront</h2>
          </div>
          <p className="mt-3 text-xs text-fog">
            Image previews load from{" "}
            <a
              href={webUrl()}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              {webUrl()}
            </a>{" "}
            (NEXT_PUBLIC_WEB_URL).
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-ink2 p-5">
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-fog" />
            <h2 className="text-sm font-semibold">Image uploads</h2>
          </div>
          {r2 ? (
            <>
              <p className="mt-3 inline-block rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
                Cloudflare R2 connected
              </p>
              <p className="mt-2 text-xs leading-relaxed text-fog">
                Uploads go to the <code>{r2.bucket}</code> bucket and are served from{" "}
                {r2.publicUrl} with immutable CDN caching (free egress).
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-fog">
              {supabase
                ? "Uploads go to the public “product-images” bucket in Supabase Storage. Set the R2_* vars to switch to Cloudflare R2."
                : "Demo mode: uploads are saved into apps/web/public/stickers/ so the storefront can serve them. Set the R2_* vars to upload to Cloudflare R2 instead."}
            </p>
          )}
        </section>
      </div>

      {!supabase && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <h2 className="text-sm font-semibold text-brand">Danger zone</h2>
          <p className="mt-1.5 text-xs text-fog">
            Wipe the local demo store and restore the original seed catalog.
          </p>
          <div className="mt-4">
            <ResetDemoButton />
          </div>
        </section>
      )}
    </div>
  );
}
