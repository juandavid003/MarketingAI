import { describe, expect, it } from "vitest";
import { MODULE_GROUPS, OVERVIEW, activeLocation, moduleHref, sameTabHref, visibleTabs } from "@/components/business/modules";

// Navigation regroup: every old URL still lands in exactly one module/tab.

describe("module navigation", () => {
  const where = (path: string) => {
    const loc = activeLocation(path);
    return loc ? `${loc.module.key}/${loc.tab.key}` : null;
  };

  it("maps each route to its module and tab", () => {
    expect(where("/business/b1")).toBe("overview/overview");
    expect(where("/business/b1/campaigns/c1")).toBe("ideas/ideas");
    expect(where("/business/b1/competitors")).toBe("ideas/competitors");
    expect(where("/business/b1/pieces/p1")).toBe("content/copywriter");
    expect(where("/business/b1/pieces/p1/creatives")).toBe("content/distribution");
    expect(where("/business/b1/videos/v1")).toBe("content/videos");
    expect(where("/business/b1/publishing")).toBe("calendar/publishing");
    expect(where("/business/b1/leads")).toBe("results/leads");
    expect(where("/business/b1/team")).toBe("business/team");
    expect(where("/admin")).toBeNull();
  });

  it("no route segment is claimed by two tabs", () => {
    const segments = [OVERVIEW, ...MODULE_GROUPS.flatMap((g) => g.modules)].flatMap((m) =>
      m.tabs.flatMap((t) => [t.path, ...(t.owns ?? [])])
    );
    expect(new Set(segments).size).toBe(segments.length);
  });

  it("hides owner-only tabs from managers and keeps them out of switch links", () => {
    const business = MODULE_GROUPS.flatMap((g) => g.modules).find((m) => m.key === "business")!;
    expect(visibleTabs(business, "manager").map((t) => t.key)).toEqual(["profile"]);
    expect(moduleHref("b2", business, "manager")).toBe("/business/b2/profile");
    const team = business.tabs.find((t) => t.key === "team")!;
    expect(sameTabHref("b2", team, "manager")).toBe("/business/b2");
    expect(sameTabHref("b2", team, "owner")).toBe("/business/b2/team");
  });
});
