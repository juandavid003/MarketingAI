import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { AppShell } from "@/components/AppShell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const businesses = await prisma.business.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, industry: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell businesses={businesses} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
