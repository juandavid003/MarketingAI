import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Temporary one-off admin utility — deleted right after use. Not linked
// from anywhere in the app. Gated by BETTER_AUTH_SECRET so only someone
// with server env access can call it.
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { email, password, name } = (await request.json()) as {
    email: string;
    password: string;
    name: string;
  };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.business.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const result = await auth.api.signUpEmail({ body: { email, password, name } });
  return NextResponse.json({ id: result.user.id, email: result.user.email });
}
