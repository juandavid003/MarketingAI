import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { destinationWithUtm, deviceType, isBot, publicBaseUrl, referrerHost } from "@/lib/links";

// Public tracked-link redirect: count the click (people only, no personal
// data), then send the visitor to the destination with UTM parameters.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = /^[a-z0-9-]{3,40}$/.test(slug)
    ? await prisma.trackedLink.findUnique({ where: { slug } })
    : null;
  if (!link || link.archived) {
    return NextResponse.redirect(new URL("/", publicBaseUrl()), 302);
  }

  const ua = request.headers.get("user-agent");
  if (!isBot(ua)) {
    await prisma.linkClick
      .create({
        data: { linkId: link.id, device: deviceType(ua), referrerHost: referrerHost(request.headers.get("referer")) },
      })
      .catch((err) => console.error("[r/slug] click not recorded", err));
  }

  const target = destinationWithUtm(link.destinationUrl, {
    source: link.utmSource,
    medium: link.utmMedium,
    campaign: link.utmCampaign,
    content: link.utmContent,
  });
  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer-when-downgrade");
  return res;
}
