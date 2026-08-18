/**
 * Whether a URL belongs to BoardGameArena, matching the same origin scope as
 * the extension's `host_permissions` (https, apex domain or a subdomain of it).
 */
export function isBgaUrl(url: string | undefined): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  return (
    parsed.hostname === "boardgamearena.com" ||
    parsed.hostname.endsWith(".boardgamearena.com")
  );
}
