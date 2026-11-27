import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Forgot password</h1>
      <p className="mt-1 max-w-md text-[12px] text-hn-sub">
        Enter the email on the account. If it is registered, a reset link is sent. Email verification is not required.
      </p>
      <PasswordResetForm mode="request" />
    </section>
  );
}
