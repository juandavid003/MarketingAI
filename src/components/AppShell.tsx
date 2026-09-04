"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CreditCard, LogOut, Plus, Menu, X } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type BusinessSummary = { id: string; name: string; industry: string };

export function AppShell({
  businesses,
  userEmail,
  children,
}: {
  businesses: BusinessSummary[];
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentBusinessId = pathname.match(/^\/business\/([^/]+)/)?.[1] ?? null;

  return (
    <div className="flex min-h-full flex-1">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Link href="/" className="font-semibold">
          Marketing<span className="text-brand">AI</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
          className="text-muted"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-10 w-64 shrink-0 border-r border-border bg-surface pt-16 transition-transform md:static md:translate-x-0 md:pt-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <Link href="/" className="hidden px-2 pb-4 text-lg font-semibold md:block">
            Marketing<span className="text-brand">AI</span>
          </Link>

          {businesses.length > 0 && (
            <div className="mb-4">
              <label className="px-2 text-xs font-medium uppercase tracking-wide text-faint">
                Negocio
              </label>
              <select
                value={currentBusinessId ?? ""}
                onChange={(e) => router.push(`/business/${e.target.value}`)}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                {!currentBusinessId && <option value="">Selecciona uno</option>}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="flex-1 space-y-1">
            {currentBusinessId && (
              <NavLink
                href={`/business/${currentBusinessId}`}
                icon={LayoutDashboard}
                active={pathname === `/business/${currentBusinessId}`}
              >
                Resumen
              </NavLink>
            )}
            <NavLink href="/onboarding" icon={Plus} active={pathname === "/onboarding"}>
              Nuevo negocio
            </NavLink>
            <NavLink href="/billing" icon={CreditCard} active={pathname === "/billing"}>
              Facturación
            </NavLink>
          </nav>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="truncate px-2 text-xs text-faint">{userEmail}</p>
            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[5] bg-black/30 md:hidden"
        />
      )}

      <div className="min-w-0 flex-1 pt-14 md:pt-0">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium ${
        active
          ? "bg-brand-soft text-brand"
          : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}
