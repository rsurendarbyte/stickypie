import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-pie font-display text-8xl font-bold">404</p>
      <p className="font-display text-2xl font-semibold">This sticker peeled away</p>
      <p className="max-w-sm text-sm text-fog">
        The page you&apos;re looking for doesn&apos;t exist — or it&apos;s stuck under someone&apos;s
        laptop lid.
      </p>
      <Link
        href="/"
        className="pie-gradient mt-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
      >
        Back home
      </Link>
    </div>
  );
}
