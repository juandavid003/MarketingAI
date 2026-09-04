import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Temporary one-off admin utility — deleted right after use.
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { email } = (await request.json()) as { email: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ deleted: false });

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.business.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ deleted: true, id: user.id });
}
