import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { assertValidKey, localPath } from "@/lib/storage";
import { verifyMediaSignature } from "@/lib/signedMedia";

// Serves one private file to whoever holds a valid, unexpired signed link
// (lib/signedMedia.ts) — used by Instagram to fetch videos we publish.
const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const key = q.get("k") ?? "";
  try {
    assertValidKey(key);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!verifyMediaSignature(key, q.get("e") ?? "", q.get("s") ?? "")) {
    return new NextResponse(null, { status: 403 });
  }
  const type = TYPES[path.extname(key).toLowerCase()];
  if (!type) return new NextResponse(null, { status: 404 });

  const filePath = localPath(key);
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  const match = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    const start = match[1] ? Number(match[1]) : Math.max(size - Number(match[2]), 0);
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
