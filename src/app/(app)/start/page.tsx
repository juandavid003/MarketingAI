import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEnabledAccount } from "@/lib/dal";

// Entry point after login: open the business used last (cookie set by the
// sidebar), else the most recent one, else create the first.
export default async function StartPage() {
  const user = await requireEnabledAccount();
  const businesses = await prisma.business.findMany({
    where: { userId: user.id },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (businesses.length === 0) redirect("/onboarding");
  const last = (await cookies()).get("lastBusinessId")?.value;
  redirect(`/business/${businesses.find((b) => b.id === last)?.id ?? businesses[0].id}`);
}
