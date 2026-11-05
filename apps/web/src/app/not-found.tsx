import Link from "@/components/page-link";
import ShopLinks from "@/components/shop-links";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-pie font-display text-8xl font-bold">404</p>
      <p className="font-display text-2xl font-semibold">This sticker peeled away</p>
      <p className="max-w-sm text-sm text-fog">
        The page you&apos;re looking for doesn&apos;t exist — or it&apos;s stuck under someone&apos;s
        laptop lid.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <ShopLinks />
      </div>
      <Link href="/" className="text-sm font-semibold text-fog hover:text-snow">
        Back home
      </Link>
    </div>
  );
}
