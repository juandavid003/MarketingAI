import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary one-off admin utility — deleted right after use. Bootstraps the
// very first admin account (role: "admin" doesn't exist yet for anyone).
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { email } = (await request.json()) as { email: string };

  const result = await prisma.user.update({
    where: { email },
    data: { role: "admin", enabled: true },
  });

  return NextResponse.json({ id: result.id, email: result.email, role: result.role });
}
