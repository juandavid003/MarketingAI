// Where to go after login/signup. Only internal invite links are allowed —
// anything else (other paths, "//evil.com", full URLs) falls back to /start,
// so ?next= can never become an open redirect.
export function safeNextPath(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  return /^\/invite\/[A-Za-z0-9_-]{20,64}$/.test(raw) ? raw : undefined;
}
