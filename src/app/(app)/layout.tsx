import { requireUser, listAccessibleBusinesses } from "@/lib/dal";
import { accountActive } from "@/lib/access";
import { AppShell } from "@/components/AppShell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const businesses = await listAccessibleBusinesses(user);

  return (
    <AppShell
      businesses={businesses}
      userEmail={user.email}
      isAdmin={user.role === "admin"}
      canCreateBusiness={accountActive(user)}
    >
      {children}
    </AppShell>
  );
}
