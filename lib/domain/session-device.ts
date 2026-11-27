import { SESSION_MAX_AGE_SECONDS } from "@/lib/config";

export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
/** lastSeenAt is rewritten only after this much time has passed. */
export const LAST_SEEN_THROTTLE_MS = 60_000;
export const REAUTH_MESSAGE = "Please sign in again.";

export type DeviceSessionRow = {
  userId: string;
  revokedAt: Date | null;
  createdAt?: Date;
};

export type DeviceDecision =
  | { ok: true }
  | { ok: false; reason: "legacy" | "version" | "missing" | "revoked" | "expired" | "other-user" };

export function sessionExpiresAt(createdAt: Date, maxAgeMs = SESSION_MAX_AGE_MS): Date {
  return new Date(createdAt.getTime() + maxAgeMs);
}

/** A row is expired at the same instant the JWT issued with it would fail verification. */
export function isSessionExpired(createdAt: Date, now: Date, maxAgeMs = SESSION_MAX_AGE_MS): boolean {
  return now.getTime() >= createdAt.getTime() + maxAgeMs;
}

/**
 * True only when lastSeenAt is strictly older than the throttle.
 * An update at exactly 60 seconds is skipped, matching `lastSeenAt < now - 60s`.
 */
export function shouldTouchLastSeen(lastSeenAt: Date, now: Date, throttleMs = LAST_SEEN_THROTTLE_MS): boolean {
  return lastSeenAt.getTime() < now.getTime() - throttleMs;
}

/** A present cookie with no session id is the legacy case that must ask for a fresh login. */
export function reauthMessageForClaims(claims: { sessionId: string | null } | null): string | null {
  if (!claims || claims.sessionId) return null;
  return REAUTH_MESSAGE;
}

/** A cookie with no session id is always rejected, even when its version still matches. */
export function deviceSessionDecision(input: {
  claimsSessionId: string | null;
  claimsVersion: number;
  userVersion: number;
  userId: string;
  session: DeviceSessionRow | null;
  now?: Date;
}): DeviceDecision {
  if (!input.claimsSessionId) return { ok: false, reason: "legacy" };
  if (input.claimsVersion !== input.userVersion) return { ok: false, reason: "version" };
  if (!input.session) return { ok: false, reason: "missing" };
  if (input.session.userId !== input.userId) return { ok: false, reason: "other-user" };
  if (input.session.revokedAt) return { ok: false, reason: "revoked" };
  if (input.now && input.session.createdAt && isSessionExpired(input.session.createdAt, input.now)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/** Store a short browser label instead of the raw user-agent string. */
export function simplifyUserAgent(raw: string): string {
  const ua = raw.replace(/\s+/g, " ").trim();
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
