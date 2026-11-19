"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  INVITE_FLASH_COOKIE,
  MAX_MEMBERS_PER_BUSINESS,
  hashInviteToken,
  inviteUrl,
  newInviteToken,
  normalizeEmail,
} from "@/lib/members";

// The fresh link is shown once on the Team page through a short-lived
// httpOnly cookie (never in the URL, where it would land in history/logs).
async function flashLink(businessId: string, email: string, token: string) {
  (await cookies()).set(INVITE_FLASH_COOKIE, JSON.stringify({ email, url: inviteUrl(token) }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: `/business/${businessId}/team`,
  });
}

function teamUrl(businessId: string, error?: string) {
  return `/business/${businessId}/team${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function inviteMember(businessId: string, formData: FormData) {
  const { user, business } = await requireBusinessAccess(businessId, "manage_members");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) redirect(teamUrl(businessId, "Escribe un correo válido."));
  if (email === user.email.toLowerCase()) redirect(teamUrl(businessId, "Ese es tu propio correo."));

  const [count, existing] = await Promise.all([
    prisma.businessMember.count({ where: { businessId } }),
    prisma.businessMember.findUnique({ where: { businessId_email: { businessId, email } } }),
  ]);
  if (existing?.acceptedAt) redirect(teamUrl(businessId, "Esa persona ya es parte del equipo."));
  if (!existing && count >= MAX_MEMBERS_PER_BUSINESS) {
    redirect(teamUrl(businessId, `Máximo ${MAX_MEMBERS_PER_BUSINESS} personas por negocio.`));
  }

  // Re-inviting a pending email just issues a new link (the old one dies).
  const token = newInviteToken();
  const member = await prisma.businessMember.upsert({
    where: { businessId_email: { businessId, email } },
    create: { businessId, email, invitedById: user.id, tokenHash: hashInviteToken(token) },
    update: { tokenHash: hashInviteToken(token), invitedById: user.id },
  });
  await audit({ action: "member.invited", actor: user, businessId, target: member.id, details: { email } });

  if (process.env.RESEND_API_KEY) {
    sendEmail({
      to: email,
      subject: `Te invitaron a ${business.name} en MarketingAI`,
      html: `<p>${escapeHtml(user.name || user.email)} te invitó a trabajar en <strong>${escapeHtml(business.name)}</strong> como encargado de redes.</p><p><a href="${inviteUrl(token)}">Aceptar la invitación</a></p>`,
    }).catch((err) => console.error("[inviteMember] email failed", err));
  }

  await flashLink(businessId, email, token);
  revalidatePath(teamUrl(businessId));
  redirect(teamUrl(businessId));
}

export async function removeMember(businessId: string, memberId: string) {
  const { user } = await requireBusinessAccess(businessId, "manage_members");
  const member = await prisma.businessMember.findFirst({ where: { id: memberId, businessId } });
  if (member) {
    await prisma.businessMember.delete({ where: { id: member.id } });
    await audit({
      action: "member.removed",
      actor: user,
      businessId,
      target: member.id,
      details: { email: member.email },
    });
  }
  revalidatePath(teamUrl(businessId));
  redirect(teamUrl(businessId));
}
