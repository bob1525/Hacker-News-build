import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/domain/url";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Create account</h1>
      <p className="mt-1 max-w-md text-[12px] text-hn-sub">
        Usernames are public. Passwords need at least 8 characters. Already registered?{" "}
        <a className="underline" href={`/login?next=${encodeURIComponent(nextPath)}`}>
          Log in
        </a>
        .
      </p>
      <AuthForm mode="register" nextPath={nextPath} />
    </section>
  );
}
