import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { DEMO_PASSWORD, DEMO_USERNAMES } from "@/lib/config";
import { safeNextPath } from "@/lib/domain/url";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <section className="px-2 py-3">
      <h1 className="text-[14px]">Login</h1>
      <p className="mt-1 max-w-md text-[12px] text-hn-sub">
        No account yet?{" "}
        <a className="underline" href={`/register?next=${encodeURIComponent(nextPath)}`}>
          Create one
        </a>
        .
      </p>
      <AuthForm mode="login" nextPath={nextPath} />
      <div className="mt-5 max-w-md border border-hn-line bg-white/40 px-3 py-2 text-[12px]">
        <p>Seeded accounts all use the password <span className="font-bold">{DEMO_PASSWORD}</span>.</p>
        <p className="mt-1 text-hn-sub">Try {DEMO_USERNAMES.join(", ")}.</p>
      </div>
    </section>
  );
}
