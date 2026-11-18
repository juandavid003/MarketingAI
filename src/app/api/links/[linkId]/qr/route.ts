import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shortUrl } from "@/lib/links";

// Downloadable QR (PNG or SVG) for a tracked link. Owner only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.trackedLink.findUnique({
    where: { id: linkId },
    include: { business: { select: { userId: true } } },
  });
  if (!link || link.business.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = shortUrl(link.slug);
  const filename = `qr-${link.slug}`;
  if (request.nextUrl.searchParams.get("format") === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${filename}.svg"`,
      },
    });
  }
  const png = await QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}.png"`,
    },
  });
}
