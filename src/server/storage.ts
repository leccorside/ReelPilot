import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

// Object storage (SeaweedFS in Docker; any S3-compatible service works by changing the env vars).
// The bucket is private and only reachable from inside the Docker network: browsers get files
// through the app (src/app/api/media), never from the storage directly.
//
// Key layout (everything of a user lives under one prefix, so deleting an account is one call):
//   users/{userId}/music/{trackId}.{mp3|wav}
//   users/{userId}/videos/{videoId}/...        (script, audio, images, final MP4 from Passo 6 on)

export type Storage = {
  client: S3Client;
  bucket: string;
};

export function createStorage(cfg: { endpoint: string; region: string; accessKey: string; secretKey: string; bucket: string }): Storage {
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
    forcePathStyle: true, // http://s3:8333/<bucket>/<key> (SeaweedFS, MinIO-style services)
    // Recent SDKs add CRC checksums to every request by default; not every S3-compatible
    // server understands them. Only send/validate them when the operation requires it.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: cfg.bucket };
}

const globalForStorage = globalThis as unknown as { __reelpilotStorage?: Storage };

export function storage(): Storage {
  if (!globalForStorage.__reelpilotStorage) {
    const e = env();
    globalForStorage.__reelpilotStorage = createStorage({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      accessKey: e.S3_ACCESS_KEY,
      secretKey: e.S3_SECRET_KEY,
      bucket: e.S3_BUCKET,
    });
  }
  return globalForStorage.__reelpilotStorage;
}

export const keys = {
  user: (userId: string) => `users/${userId}/`,
  music: (userId: string, trackId: string, ext: "mp3" | "wav") => `users/${userId}/music/${trackId}.${ext}`,
  video: (userId: string, videoId: string) => `users/${userId}/videos/${videoId}/`,
};

export async function putObject(s: Storage, key: string, body: Uint8Array, contentType: string): Promise<void> {
  await s.client.send(new PutObjectCommand({ Bucket: s.bucket, Key: key, Body: body, ContentType: contentType }));
}

/** Reads an object, optionally a byte range ("bytes=0-1023"). Returns null when it doesn't exist. */
export async function getObject(s: Storage, key: string, range?: string): Promise<GetObjectCommandOutput | null> {
  try {
    return await s.client.send(new GetObjectCommand({ Bucket: s.bucket, Key: key, Range: range }));
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw e;
  }
}

export async function deleteObjects(s: Storage, keyList: string[]): Promise<void> {
  for (let i = 0; i < keyList.length; i += 1000) {
    const chunk = keyList.slice(i, i + 1000);
    if (chunk.length === 0) continue;
    await s.client.send(new DeleteObjectsCommand({ Bucket: s.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
  }
}

export async function listKeys(s: Storage, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let token: string | undefined;
  do {
    const page = await s.client.send(new ListObjectsV2Command({ Bucket: s.bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) out.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

/** Deletes every object under a prefix ("users/<id>/videos/<id>/"). The prefix must end with "/". */
export async function deletePrefix(s: Storage, prefix: string): Promise<number> {
  if (!prefix.endsWith("/") || prefix.split("/").filter(Boolean).length < 2) throw new Error(`refusing to delete prefix "${prefix}"`);
  const found = await listKeys(s, prefix);
  await deleteObjects(s, found);
  return found.length;
}

/**
 * Removes files after the database change was committed. A storage failure must not undo or fail
 * the user's action (the rows are already gone), so it is logged; the leftovers can be swept later.
 */
export async function cleanupAfterCommit(task: () => Promise<unknown>, what: string): Promise<void> {
  try {
    await task();
  } catch (e) {
    console.error(`[storage] cleanup failed (${what}):`, e instanceof Error ? e.message : e);
  }
}
