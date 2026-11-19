import { describe, expect, it } from "vitest";
import { accountActive, can, resolveBusinessAccess } from "@/lib/access";

const owner = { id: "u-owner", role: "client", enabled: true };
const manager = { id: "u-manager", role: "client", enabled: false };
const stranger = { id: "u-stranger", role: "client", enabled: true };
const admin = { id: "u-admin", role: "admin", enabled: false };
const business = { userId: owner.id };
const accepted = { userId: manager.id, acceptedAt: new Date() };

describe("resolveBusinessAccess — isolation between businesses", () => {
  it("lets the owner in", () => {
    expect(resolveBusinessAccess(owner, business, owner, null)).toEqual({ ok: true, role: "owner" });
  });

  it("rejects another client, even an enabled one", () => {
    expect(resolveBusinessAccess(stranger, business, owner, null)).toEqual({ ok: false, reason: "not_member" });
  });

  it("rejects the platform admin (no backdoor into clients' businesses)", () => {
    expect(resolveBusinessAccess(admin, business, owner, null)).toEqual({ ok: false, reason: "not_member" });
  });

  it("rejects a membership row that belongs to someone else", () => {
    expect(resolveBusinessAccess(stranger, business, owner, accepted)).toEqual({ ok: false, reason: "not_member" });
  });

  it("lets an accepted manager in even if their own account is not enabled", () => {
    expect(resolveBusinessAccess(manager, business, owner, accepted)).toEqual({ ok: true, role: "manager" });
  });

  it("rejects a pending (not accepted) invitation", () => {
    const pending = { userId: manager.id, acceptedAt: null };
    expect(resolveBusinessAccess(manager, business, owner, pending)).toEqual({ ok: false, reason: "not_member" });
  });

  it("closes the business for everyone while the owner hasn't paid", () => {
    const unpaid = { ...owner, enabled: false };
    expect(resolveBusinessAccess(unpaid, business, unpaid, null)).toEqual({ ok: false, reason: "owner_not_enabled" });
    expect(resolveBusinessAccess(manager, business, unpaid, accepted)).toEqual({
      ok: false,
      reason: "owner_not_enabled",
    });
  });

  it("treats an admin-owned business as active", () => {
    const adminBusiness = { userId: admin.id };
    expect(resolveBusinessAccess(admin, adminBusiness, admin, null)).toEqual({ ok: true, role: "owner" });
  });
});

describe("role permissions", () => {
  it("owners can do everything", () => {
    for (const p of ["work", "manage_settings", "manage_connections", "manage_members"] as const) {
      expect(can("owner", p)).toBe(true);
    }
  });

  it("managers can work but not touch keys, connections or the team", () => {
    expect(can("manager", "work")).toBe(true);
    expect(can("manager", "manage_settings")).toBe(false);
    expect(can("manager", "manage_connections")).toBe(false);
    expect(can("manager", "manage_members")).toBe(false);
  });

  it("accountActive: admins always, clients only when enabled", () => {
    expect(accountActive({ role: "admin", enabled: false })).toBe(true);
    expect(accountActive({ role: "client", enabled: true })).toBe(true);
    expect(accountActive({ role: "client", enabled: false })).toBe(false);
  });
});
