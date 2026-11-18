import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { zipSync, strToU8, type Zippable } from "fflate";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStored } from "@/lib/storage";
import { parsePlatformCopy, COPY_PLATFORMS } from "@/lib/platformCopy";
import { buildPackageReadme, packageFileName } from "@/lib/exportPackage";

// "Paquete de publicación": every format of one video + its thumbnail + the
// texts to paste (general and per network), zipped, for publishing by hand
// on TikTok, YouTube or anywhere we can't post directly. Owner only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asset = await prisma.videoAsset.findUnique({
    where: { id: assetId },
    include: {
      business: { select: { userId: true, name: true } },
      versions: { orderBy: { createdAt: "asc" } },
      contentPiece: { select: { platformCopy: true } },
    },
  });
  if (!asset || asset.business.userId !== session.user.id || asset.status !== "ready") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files: Zippable = {};
  for (const v of asset.versions) {
    const name = packageFileName(v.label);
    files[`${name}.mp4`] = [new Uint8Array(await readStored(v.outputPath)), { level: 0 }];
    if (v.thumbnailPath) files[`${name}-portada${path.extname(v.thumbnailPath)}`] = [new Uint8Array(await readStored(v.thumbnailPath)), { level: 0 }];
  }
  const first = asset.versions[0];
  files["textos.txt"] = strToU8(
    buildPackageReadme({
      title: asset.originalFilename,
      business: asset.business.name,
      caption: first?.caption ?? [first?.hook, first?.cta].filter(Boolean).join("\n\n"),
      versions: asset.versions.map((v) => ({ file: `${packageFileName(v.label)}.mp4`, label: v.label })),
      platformCopy: parsePlatformCopy(asset.contentPiece?.platformCopy ?? null).map((c) => ({
        ...c,
        label: COPY_PLATFORMS[c.plataforma]?.label ?? c.plataforma,
      })),
    })
  );

  const zip = zipSync(files);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="paquete-${assetId.slice(0, 8)}.zip"`,
      "Content-Length": String(zip.length),
    },
  });
}
