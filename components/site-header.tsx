import { Suspense } from "react";
import { getCurrentUser, getKarma } from "@/lib/auth";
import { HeaderBar } from "@/components/header-bar";

export function HeaderFallback() {
  return <div className="h-10 bg-hn-orange" aria-hidden="true" />;
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const karma = user ? await getKarma(user.id) : 0;

  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderBar user={user ? { username: user.username, karma } : null} />
    </Suspense>
  );
}
