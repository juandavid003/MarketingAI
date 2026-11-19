"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { findInvite } from "@/lib/members";
import { audit } from "@/lib/audit";

export async function acceptInvite(token: string) {
  const user = await requireUser();
  const invite = await findInvite(token);
  if (!invite || invite.acceptedAt) redirect(`/invite/${encodeURIComponent(token)}`);
  if (invite.business.userId === user.id) redirect(`/business/${invite.businessId}`);

  const already = await prisma.businessMember.findFirst({
    where: { businessId: invite.businessId, userId: user.id, acceptedAt: { not: null } },
  });
  if (already) {
    // Already on the team through another invite: this one is spent.
    await prisma.businessMember.delete({ where: { id: invite.id } });
  } else {
    // Conditional update: two clicks racing on the same link can't both win.
    const { count } = await prisma.businessMember.updateMany({
      where: { id: invite.id, acceptedAt: null },
      data: { userId: user.id, acceptedAt: new Date(), tokenHash: null },
    });
    if (count === 1) {
      await audit({
        action: "member.accepted",
        actor: user,
        businessId: invite.businessId,
        target: invite.id,
        details: { invitedEmail: invite.email, acceptedAs: user.email },
      });
    }
  }
  redirect(`/business/${invite.businessId}`);
}
