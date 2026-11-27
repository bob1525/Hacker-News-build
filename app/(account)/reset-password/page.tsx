import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const raw = typeof token === "string" ? token : "";

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Reset password</h1>
      {raw.length < 20 ? (
        <p role="alert" className="mt-2 text-[13px] text-hn-danger">
          That reset link is not valid.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-md text-[12px] text-hn-sub">Choose a new password of at least 8 characters.</p>
          <PasswordResetForm mode="complete" token={raw} />
        </>
      )}
    </section>
  );
}
