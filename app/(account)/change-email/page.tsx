import type { Metadata } from "next";
import { EmailChangeForm } from "@/components/email-change-form";

export const metadata: Metadata = { title: "Confirm email" };

export default async function ChangeEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const raw = typeof token === "string" ? token : "";

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Confirm email</h1>
      {raw.length < 20 ? (
        <p role="alert" className="mt-2 text-[13px] text-hn-danger">
          That confirmation link is not valid.
        </p>
      ) : (
        <div className="mt-2">
          <EmailChangeForm mode="confirm" token={raw} />
        </div>
      )}
    </section>
  );
}