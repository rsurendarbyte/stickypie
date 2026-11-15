import type { Metadata } from "next";
import Link from "@/components/page-link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { CONTACT_TOPICS, SUPPORT_EMAIL, contactThreadPath } from "@stickypie/shared";
import ContactThreadReply from "@/components/contact-thread-reply";
import RememberThread from "@/components/remember-thread";
import { threadForKey } from "@/lib/contact-thread";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your conversation", robots: PRIVATE_PAGE_ROBOTS };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function ContactThreadPage({ params, searchParams }: Props) {
  const [{ id }, { k = "" }] = await Promise.all([params, searchParams]);
  const thread = await threadForKey(id, k);

  if (!thread) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pt-28 pb-16 text-center">
        <h1 className="font-display text-2xl font-bold">Conversation not found</h1>
        <p className="mt-2 text-sm text-fog">
          This link isn&apos;t valid any more. Open the link from our email again, or write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <Link href="/contact" className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">
          Contact us
        </Link>
      </div>
    );
  }

  const bubbles = [
    { id: thread.id, author: "customer" as const, body: thread.message, createdAt: thread.createdAt },
    ...thread.replies,
  ];
  const resolved = thread.status === "resolved";
  const waiting = thread.status === "new";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-[84px] pb-16 sm:px-8 lg:pt-28">
      <RememberThread id={thread.id} path={contactThreadPath(thread)} lastAt={thread.replies.at(-1)?.createdAt ?? thread.createdAt} />
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <MessageCircle className="size-6 text-brand" /> Your conversation
      </h1>
      <p className="mt-1 text-sm text-fog">
        {CONTACT_TOPICS[thread.topic] ?? thread.topic}
        {thread.orderCode ? ` · ${thread.orderCode}` : ""} · started {when(thread.createdAt)}
      </p>

      <ol className="mt-6 space-y-3">
        {bubbles.map((b) => {
          const ours = b.author === "admin";
          return (
            <li key={b.id} className={`flex ${ours ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  ours
                    ? "rounded-tl-md border border-line bg-ink2 text-snow"
                    : "rounded-tr-md bg-brand/10 text-snow"
                }`}
              >
                <p className="mb-1 text-[11px] font-bold tracking-wide text-fog uppercase">
                  {ours ? "StickyPie" : "You"} · {when(b.createdAt)}
                </p>
                <p className="whitespace-pre-line select-text">{b.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {resolved ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-sm text-fog">
          <CheckCircle2 className="size-4 shrink-0 text-mint" />
          We marked this as sorted. Need anything else? Write below and we&apos;ll pick it up again.
        </p>
      ) : waiting ? (
        <p className="mt-6 text-center text-xs text-fog">We usually reply within 1–2 business days. We&apos;ll email you.</p>
      ) : null}

      <ContactThreadReply id={thread.id} accessKey={k} />

      <p className="mt-6 text-center text-xs text-fog">Keep this link private: anyone with it can read this conversation.</p>
    </div>
  );
}
