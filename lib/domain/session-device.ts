export type DeviceSessionRow = {
  userId: string;
  revokedAt: Date | null;
};

export type DeviceDecision =
  | { ok: true }
  | { ok: false; reason: "legacy" | "version" | "missing" | "revoked" | "other-user" };

/** A cookie with no session id is always rejected, even when its version still matches. */
export function deviceSessionDecision(input: {
  claimsSessionId: string | null;
  claimsVersion: number;
  userVersion: number;
  userId: string;
  session: DeviceSessionRow | null;
}): DeviceDecision {
  if (!input.claimsSessionId) return { ok: false, reason: "legacy" };
  if (input.claimsVersion !== input.userVersion) return { ok: false, reason: "version" };
  if (!input.session) return { ok: false, reason: "missing" };
  if (input.session.userId !== input.userId) return { ok: false, reason: "other-user" };
  if (input.session.revokedAt) return { ok: false, reason: "revoked" };
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
