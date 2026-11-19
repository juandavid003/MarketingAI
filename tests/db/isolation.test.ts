import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { businessAccessForUser, listAccessibleBusinesses } from "@/lib/dal";

// Tenant isolation against the real database, through the same queries the
// app uses (lib/dal.ts). This is the single production DB: every row is a
// clearly fake "__test__" user/business and is deleted in afterAll (users
// cascade to their businesses and memberships).

const run = randomUUID().slice(0, 8);
const email = (who: string) => `__test__${who}-${run}@example.invalid`;
type U = { id: string; email: string; role: string; enabled: boolean };
let owner: U, manager: U, stranger: U, otherOwner: U;
let businessId = "";
let otherBusinessId = "";

async function makeUser(who: string, enabled: boolean): Promise<U> {
  return prisma.user.create({
    data: { id: `__test__${who}-${run}`, name: `__test__ ${who}`, email: email(who), enabled, role: "client" },
    select: { id: true, email: true, role: true, enabled: true },
  });
}

const businessData = (name: string) => ({
  name: `__test__ ${name} ${run}`,
  industry: "test",
  description: "test",
  targetAudience: "test",
  location: "Quito, Ecuador",
  objective: "test",
});

beforeAll(async () => {
  owner = await makeUser("owner", true);
  manager = await makeUser("manager", false); // managers don't pay
  stranger = await makeUser("stranger", true);
  otherOwner = await makeUser("other", true);
  businessId = (await prisma.business.create({ data: { userId: owner.id, ...businessData("A") } })).id;
  otherBusinessId = (await prisma.business.create({ data: { userId: otherOwner.id, ...businessData("B") } })).id;
  await prisma.businessMember.create({
    data: { businessId, email: manager.email, userId: manager.id, acceptedAt: new Date(), invitedById: owner.id },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, manager, stranger, otherOwner].filter(Boolean).map((u) => u.id) } } });
  await prisma.$disconnect();
});

describe("business isolation (real database)", () => {
  it("owners see only their own business", async () => {
    expect((await listAccessibleBusinesses(owner)).map((b) => b.id)).toEqual([businessId]);
    expect((await listAccessibleBusinesses(otherOwner)).map((b) => b.id)).toEqual([otherBusinessId]);
  });

  it("another client can't open the business", async () => {
    expect(await businessAccessForUser(stranger, businessId)).toBeNull();
    expect(await businessAccessForUser(otherOwner, businessId)).toBeNull();
    expect(await listAccessibleBusinesses(stranger)).toEqual([]);
  });

  it("the manager gets work access only, and only to that business", async () => {
    expect(await businessAccessForUser(manager, businessId)).toEqual({ role: "manager" });
    expect(await businessAccessForUser(manager, businessId, "manage_settings")).toBeNull();
    expect(await businessAccessForUser(manager, businessId, "manage_connections")).toBeNull();
    expect(await businessAccessForUser(manager, otherBusinessId)).toBeNull();
    expect((await listAccessibleBusinesses(manager)).map((b) => [b.id, b.role])).toEqual([[businessId, "manager"]]);
  });

  it("a pending invitation grants nothing", async () => {
    await prisma.businessMember.create({
      data: { businessId: otherBusinessId, email: stranger.email, userId: stranger.id, acceptedAt: null, invitedById: otherOwner.id },
    });
    expect(await businessAccessForUser(stranger, otherBusinessId)).toBeNull();
  });

  it("disabling the owner closes the business for the owner and the manager", async () => {
    await prisma.user.update({ where: { id: owner.id }, data: { enabled: false } });
    const unpaidOwner = { ...owner, enabled: false };
    expect(await businessAccessForUser(unpaidOwner, businessId)).toBeNull();
    expect(await businessAccessForUser(manager, businessId)).toBeNull();
    expect(await listAccessibleBusinesses(manager)).toEqual([]);
    await prisma.user.update({ where: { id: owner.id }, data: { enabled: true } });
  });

  it("unknown business ids are just not found", async () => {
    expect(await businessAccessForUser(owner, "does-not-exist")).toBeNull();
  });
});
