import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, listAccessibleBusinesses } from "@/lib/dal";
import { accountActive } from "@/lib/access";

// Entry point after login: open the business used last (cookie set by the
// sidebar), else the most recent one, else create the first. A manager
// ("encargado de redes") doesn't need a paid account of their own — they
// land on the businesses they were invited to.
export default async function StartPage() {
  const user = await requireUser();
  const businesses = await listAccessibleBusinesses(user);
  if (businesses.length === 0) redirect(accountActive(user) ? "/onboarding" : "/pending");
  const last = (await cookies()).get("lastBusinessId")?.value;
  redirect(`/business/${businesses.find((b) => b.id === last)?.id ?? businesses[0].id}`);
}
