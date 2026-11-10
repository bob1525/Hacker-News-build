export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function siteLabel(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/** Only allow same-origin relative paths as post-login redirects. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return "/";
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "/";
  if (trimmed.includes("://") || trimmed.includes("\\")) return "/";
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return "/";
  return trimmed;
}
