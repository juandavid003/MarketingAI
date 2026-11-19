import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/links";

// Team invitations. Signup doesn't verify email addresses, so the email on
// an invite is only a label: what grants access is the secret link, which
// the owner shares (and we also email when Resend is configured). Only the
// sha256 of the token is stored.

export const MAX_MEMBERS_PER_BUSINESS = 5;
export const INVITE_FLASH_COOKIE = "invite_link_flash";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${publicBaseUrl()}/invite/${token}`;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.businessMember.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { business: { select: { id: true, name: true, userId: true } } },
  });
}
