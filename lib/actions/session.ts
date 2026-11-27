"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearSession, readSessionClaimsFromCookie, requestUserAgent, setSession } from "@/lib/session";
import { revokeOneSession } from "@/lib/session-devices";
import { revokeOtherSessions } from "@/lib/session-management";
import type { FormState } from "@/lib/types";
import { formString } from "@/lib/validators";

export async function signOutOtherDevicesAction(): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to sign out other devices." };
  try {
    const result = await revokeOtherSessions(prisma, user.id);
    if (!result.ok) return { error: result.error };
    await setSession(user.id, result.sessionVersion, await requestUserAgent());
    return { notice: "Other devices were signed out. This browser stays signed in." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not sign out other devices. Please try again." };
  }
}

export async function revokeDeviceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const claims = await readSessionClaimsFromCookie();
  if (!user || !claims?.sessionId) return { error: "Log in to manage devices." };
  const sessionId = formString(formData, "sessionId").trim();
  if (!sessionId) return { error: "That device is not signed in." };
  try {
    const result = await revokeOneSession(prisma, user.id, sessionId);
    if (!result.ok) return { error: result.error };
    if (sessionId === claims.sessionId) {
      await clearSession();
      redirect("/");
    }
    return { notice: "That device was signed out." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not sign out that device. Please try again." };
  }
}
