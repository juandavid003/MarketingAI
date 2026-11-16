import "server-only";
import path from "path";
import { createWriteStream } from "fs";
import { mkdir, readFile, writeFile, stat } from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// Private file storage for user uploads and generated media.
//
// Files used to live in public/uploads — readable by anyone with the URL and
// wiped on every Railway deploy. Now they live under STORAGE_DIR (outside
// public/; on Railway, a persistent Volume) and are served only through
// /api/files/<key>, which checks the caller owns the business.
//
// A storage *key* is a relative POSIX path whose first segment is always the
// owning businessId: "<businessId>/videos/<videoAssetId>/original.mp4".
// That first segment is what the file route authorizes against.
//
// Local-disk driver only for now: ffmpeg needs real file paths anyway, and a
// Railway Volume costs far less operational effort than an object store.
// Moving to R2/S3 later means swapping these functions (and downloading to a
// temp dir before ffmpeg), not touching callers.

const STORAGE_ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));

const KEY_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9._-]+)+$/;

export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

export function storageKey(businessId: string, ...parts: string[]): string {
  const key = [businessId, ...parts].join("/");
  assertValidKey(key);
  return key;
}

export function businessIdFromKey(key: string): string {
  return key.split("/")[0];
}

// Absolute path on disk for a key — for tools like ffmpeg that need a path.
export function localPath(key: string): string {
  assertValidKey(key);
  const full = path.resolve(STORAGE_ROOT, ...key.split("/"));
  if (!full.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error(`Storage key escapes storage root: ${key}`);
  }
  return full;
}

export async function ensureParentDir(key: string): Promise<void> {
  await mkdir(path.dirname(localPath(key)), { recursive: true });
}

export async function saveBuffer(key: string, data: Buffer): Promise<void> {
  await ensureParentDir(key);
  await writeFile(localPath(key), data);
}

// Streams an uploaded File to disk instead of buffering it all in memory.
export async function saveUpload(key: string, file: File): Promise<void> {
  await ensureParentDir(key);
  await pipeline(
    Readable.fromWeb(file.stream() as unknown as import("stream/web").ReadableStream),
    createWriteStream(localPath(key))
  );
}

// Rows created before private storage hold a public path ("/uploads/...")
// instead of a key. Both are resolved here so old campaigns/videos still work.
function isLegacyPublicPath(stored: string): boolean {
  return stored.startsWith("/uploads/");
}

export function storedToDiskPath(stored: string): string {
  if (isLegacyPublicPath(stored)) {
    return path.join(process.cwd(), "public", ...stored.split("/").filter(Boolean));
  }
  return localPath(stored);
}

export async function readStored(stored: string): Promise<Buffer> {
  return readFile(storedToDiskPath(stored));
}

// URL the browser should use to fetch a stored file.
export function fileUrl(stored: string): string {
  return isLegacyPublicPath(stored) ? stored : `/api/files/${stored}`;
}

export async function fileSize(key: string): Promise<number | null> {
  try {
    return (await stat(localPath(key))).size;
  } catch {
    return null;
  }
}
