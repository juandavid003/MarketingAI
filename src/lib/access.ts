// Who may do what on a business — pure functions, no I/O, so the rules are
// unit-tested (tests/access.test.ts) and lib/dal.ts only loads the rows.
//
// - owner: Business.userId. Everything.
// - manager ("encargado de redes"): invited by the owner (BusinessMember,
//   accepted). Day-to-day work — ideas, scripts, videos, publishing, links,
//   leads, results — but not the business's keys, social connections or
//   members.
// - The platform admin has no access to clients' businesses through this
//   path; /admin is separate.
//
// Access is paid by the owner: an owner whose account isn't enabled (no
// transfer yet) can't use the business, and neither can its managers. A
// manager's own `enabled` flag doesn't matter — they don't pay.

export type BusinessRole = "owner" | "manager";

export type Permission =
  | "work" // create/edit content, upload, publish, links, leads
  | "manage_settings" // AI keys, profile-level destructive settings
  | "manage_connections" // Meta connect/disconnect, ad account
  | "manage_members";

const ROLE_PERMISSIONS: Record<BusinessRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>(["work", "manage_settings", "manage_connections", "manage_members"]),
  manager: new Set<Permission>(["work"]),
};

export type AccessUser = { id: string; role: string; enabled: boolean };
export type AccessBusiness = { userId: string };
export type AccessMembership = { userId: string | null; acceptedAt: Date | null } | null;

export type AccessDecision =
  | { ok: true; role: BusinessRole }
  | { ok: false; reason: "not_member" | "owner_not_enabled" };

export function accountActive(user: { role: string; enabled: boolean }): boolean {
  return user.role === "admin" || user.enabled;
}

export function resolveBusinessAccess(
  user: AccessUser,
  business: AccessBusiness,
  owner: { role: string; enabled: boolean } | null,
  membership: AccessMembership
): AccessDecision {
  let role: BusinessRole | null = null;
  if (business.userId === user.id) {
    role = "owner";
  } else if (membership && membership.userId === user.id && membership.acceptedAt) {
    role = "manager";
  }
  if (!role) return { ok: false, reason: "not_member" };
  if (!owner || !accountActive(owner)) return { ok: false, reason: "owner_not_enabled" };
  return { ok: true, role };
}

export function can(role: BusinessRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export const ROLE_LABEL: Record<BusinessRole, string> = {
  owner: "Dueño",
  manager: "Encargado de redes",
};
