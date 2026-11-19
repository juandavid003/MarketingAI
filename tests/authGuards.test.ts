import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// Static guard for tenant isolation: every server action, every route
// handler and every business page must go through an auth check before it
// touches data. A new action that forgets requireBusinessAccess fails here
// instead of shipping. (Ownership of each child row — "this competitor
// belongs to this business" — is checked inside each action; the rules for
// who may open a business are unit-tested in access.test.ts.)

const ROOT = path.resolve(__dirname, "..", "src", "app");

// Calls that establish who the caller is and what they may touch.
const GUARDS = [
  "requireBusinessAccess",
  "requireAdmin",
  "requireUser",
  "requireEnabledAccount",
  "businessAccessForUser",
  "auth.api.getSession",
];

// Public on purpose, each with its own protection.
const PUBLIC_ROUTES = new Map([
  ["r/[slug]/route.ts", "tracked-link redirect: public by design, no private data"],
  ["api/media/route.ts", "HMAC-signed, expiring URL (lib/signedMedia.ts)"],
  ["api/auth/[...all]/route.ts", "Better Auth's own endpoints"],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

// Splits a module into its top-level functions: name → body text.
function topLevelFunctions(source: string): Map<string, { exported: boolean; body: string }> {
  const re = /^(export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/gm;
  const marks = [...source.matchAll(re)].map((m) => ({ index: m.index!, exported: Boolean(m[1]), name: m[2] }));
  const out = new Map<string, { exported: boolean; body: string }>();
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
    out.set(m.name, { exported: m.exported, body: source.slice(m.index, end) });
  });
  return out;
}

// Functions that are guarded directly, or call a local helper that is.
function guardedFunctions(fns: Map<string, { body: string }>): Set<string> {
  const guarded = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, { body }] of fns) {
      if (guarded.has(name)) continue;
      const callees = [...guarded].map((g) => `${g}(`);
      if (GUARDS.some((g) => body.includes(`${g}(`)) || callees.some((c) => body.includes(c))) {
        guarded.add(name);
        changed = true;
      }
    }
  }
  return guarded;
}

const files = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f));

describe("every server action checks access", () => {
  const actionFiles = files.filter((f) => /^\s*["']use server["']/.test(readFileSync(f, "utf8")));

  it("finds the action files", () => {
    expect(actionFiles.length).toBeGreaterThan(10);
  });

  for (const file of actionFiles) {
    it(rel(file), () => {
      const fns = topLevelFunctions(readFileSync(file, "utf8"));
      const guarded = guardedFunctions(fns);
      const unguarded = [...fns].filter(([name, f]) => f.exported && !guarded.has(name)).map(([n]) => n);
      expect(unguarded, `exported actions without an auth check in ${rel(file)}`).toEqual([]);
    });
  }
});

describe("every route handler checks access (or is public on purpose)", () => {
  const routes = files.filter((f) => f.endsWith("route.ts"));
  for (const file of routes) {
    const name = rel(file);
    it(name, () => {
      if (PUBLIC_ROUTES.has(name)) return;
      const source = readFileSync(file, "utf8");
      const fns = topLevelFunctions(source);
      const guarded = guardedFunctions(fns);
      const handlers = [...fns].filter(([n, f]) => f.exported && /^(GET|POST|PUT|PATCH|DELETE)$/.test(n));
      expect(handlers.length).toBeGreaterThan(0);
      for (const [n] of handlers) expect(guarded.has(n), `${name} ${n}`).toBe(true);
    });
  }
});

describe("every business page checks access", () => {
  const pages = files.filter((f) => rel(f).startsWith("(app)/business/[id]/") && /page\.tsx$/.test(f));
  it("finds the business pages", () => {
    expect(pages.length).toBeGreaterThan(15);
  });
  for (const file of pages) {
    it(rel(file), () => {
      expect(readFileSync(file, "utf8")).toMatch(/requireBusinessAccess\(/);
    });
  }

  it("owner-only pages ask for the owner permission", () => {
    const expectations: Record<string, string> = {
      "(app)/business/[id]/settings/page.tsx": "manage_settings",
      "(app)/business/[id]/connections/page.tsx": "manage_connections",
      "(app)/business/[id]/team/page.tsx": "manage_members",
    };
    for (const [page, permission] of Object.entries(expectations)) {
      const source = readFileSync(path.join(ROOT, page), "utf8");
      // requireBusinessAccess(id, "<perm>") or can(role, "<perm>") before rendering.
      expect(source, page).toMatch(new RegExp(`(requireBusinessAccess\\([^)]*|can\\(role, )"${permission}"`));
    }
  });
});
