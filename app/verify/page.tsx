import type { Metadata } from "next";
import { ResendVerificationButton } from "@/components/resend-verification";
import { verifyEmailToken } from "@/lib/actions/email-verification";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : null;
  const user = await getCurrentUser();

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Verify email</h1>
      {result?.ok ? (
        <p className="mt-2 text-[13px]">{result.data.already ? "This email is already verified." : "Email verified."}</p>
      ) : null}
      {result && !result.ok ? (
        <p role="alert" className="mt-2 text-[13px] text-hn-danger">
          {result.error}
        </p>
      ) : null}
      {!token ? <p className="mt-2 text-[13px]">Open the verification link from your email.</p> : null}
      {user && !user.emailVerifiedAt ? <ResendVerificationButton /> : null}
    </section>
  );
}
