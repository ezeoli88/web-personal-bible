/**
 * Accepts only a same-origin relative path. Anything else becomes `/`.
 * `//evil.com` and absolute URLs are rejected.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }

  if (!decoded.startsWith("/")) return "/";
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return "/";
  if (decoded.includes("\\") || decoded.includes("://")) return "/";
  if (decoded.includes("\0") || decoded.includes("\r") || decoded.includes("\n")) return "/";
  return decoded;
}
