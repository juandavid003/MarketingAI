"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, LogOut, Plus, Menu, X, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { MODULE_GROUPS, OVERVIEW, activeModuleKey, moduleHref, type ModuleDef } from "@/components/business/modules";

type BusinessSummary = { id: string; name: string; industry: string };

// Remembered so /start (after login) opens the last business used.
const LAST_BUSINESS_COOKIE = "lastBusinessId";

export function AppShell({
  businesses,
  userEmail,
  isAdmin,
  children,
}: {
  businesses: BusinessSummary[];
  userEmail: string;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentBusinessId = pathname.match(/^\/business\/([^/]+)/)?.[1] ?? null;
  const current = businesses.find((b) => b.id === currentBusinessId) ?? null;
  const activeKey = activeModuleKey(pathname);

  useEffect(() => {
    if (currentBusinessId) {
      document.cookie = `${LAST_BUSINESS_COOKIE}=${currentBusinessId}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [currentBusinessId]);

  // Close the mobile drawer on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-full flex-1">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Link href="/start" className="min-w-0 truncate font-semibold">
          Marketing<span className="text-brand">AI</span>
          {current && <span className="ml-2 text-sm font-normal text-muted">· {current.name}</span>}
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
        className={`fixed inset-y-0 left-0 z-10 w-64 shrink-0 border-r border-border bg-surface pt-16 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 md:pt-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <Link href="/start" className="hidden px-2 pb-4 text-lg font-semibold md:block">
            Marketing<span className="text-brand">AI</span>
          </Link>

          {businesses.length > 0 && (
            <div className="mb-4">
              <label htmlFor="business-switcher" className="px-2 text-xs font-medium uppercase tracking-wide text-faint">
                Negocio
              </label>
              <div className="relative mt-1">
                <select
                  id="business-switcher"
                  value={currentBusinessId ?? ""}
                  onChange={(e) => {
                    // Stay in the same module when switching business.
                    if (e.target.value) router.push(moduleHref(e.target.value, activeKey));
                  }}
                  className="w-full appearance-none rounded-md border border-border bg-transparent py-2 pl-3 pr-8 text-sm font-medium outline-none focus:border-brand"
                >
                  {!currentBusinessId && <option value="">Selecciona un negocio</option>}
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-faint" />
              </div>
              {current && <p className="mt-1 truncate px-2 text-xs text-faint">{current.industry}</p>}
            </div>
          )}

          <nav className="flex-1 space-y-5">
            {currentBusinessId ? (
              <>
                <div className="space-y-0.5">
                  <ModuleLink businessId={currentBusinessId} mod={OVERVIEW} active={activeKey === "overview"} />
                </div>
                {MODULE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-faint">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.modules.map((mod) => (
                        <ModuleLink
                          key={mod.key}
                          businessId={currentBusinessId}
                          mod={mod}
                          active={activeKey === mod.key}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              businesses.length > 0 && (
                <p className="px-2 text-sm text-muted">Elige un negocio para ver sus módulos.</p>
              )
            )}

            <div className="space-y-0.5 border-t border-border pt-3">
              <NavLink href="/onboarding" icon={Plus} active={pathname === "/onboarding"}>
                Nuevo negocio
              </NavLink>
              {isAdmin && (
                <NavLink href="/admin" icon={Users} active={pathname === "/admin"}>
                  Clientes
                </NavLink>
              )}
            </div>
          </nav>

          <div className="mt-4 space-y-2 border-t border-border pt-3">
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

function ModuleLink({ businessId, mod, active }: { businessId: string; mod: ModuleDef; active: boolean }) {
  return (
    <NavLink href={moduleHref(businessId, mod.key)} icon={mod.icon} active={active}>
      {mod.label}
    </NavLink>
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
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium ${
        active
          ? "bg-brand-soft text-brand"
          : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
