"use server";

import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/session";
import { revokeOtherSessions } from "@/lib/session-management";
import type { FormState } from "@/lib/types";

export async function signOutOtherDevicesAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to sign out other devices." };
  try {
    const result = await revokeOtherSessions(prisma, user.id);
    if (!result.ok) return { error: result.error };
    await setSession(user.id, result.sessionVersion);
    return { notice: "Other devices were signed out. This browser stays signed in." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not sign out other devices. Please try again." };
  }
}
