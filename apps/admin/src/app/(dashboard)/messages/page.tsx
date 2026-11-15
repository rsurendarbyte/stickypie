import MessagesManager from "@/components/messages-manager";
import { webUrl } from "@/lib/auth";
import { getAdminDriver } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const driver = await getAdminDriver();
  const messages = await driver.listContactMessages();
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Messages</h1>
      <p className="mt-1 text-sm text-fog">From the storefront contact form. Your reply is emailed to the shopper with a link to their conversation page, where they can write back. Mark it resolved when it is sorted.</p>
      <div className="mt-6">
        <MessagesManager initial={messages} webUrl={webUrl()} />
      </div>
    </div>
  );
}
