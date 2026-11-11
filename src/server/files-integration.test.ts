import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { env } from "@/lib/env";
import { makeWav } from "@/test/audio-fixtures";
import { MAX_MUSIC_BYTES } from "./audio-file";
import { createDb } from "./db";
import { musicTracks, users } from "./db/schema";
import { NotFoundError, RateLimitedError, TooLargeError, ValidationError } from "./errors";
import { deleteMusic, importMusic, listMusic, MAX_TRACKS_PER_USER, type MusicDeps, uploadMusic } from "./music";
import { createSeries, getSeries, updateSeries } from "./series";
import { createStorage, deletePrefix, getObject, keys, listKeys, putObject } from "./storage";

// Integration tests: test database, Redis logical db 2 and the real S3 (SeaweedFS) of docker-compose.
const { db, client } = createDb(inject("testDatabaseUrl"), { max: 4 });
const e = env();
const storage = createStorage({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, accessKey: e.S3_ACCESS_KEY, secretKey: e.S3_SECRET_KEY, bucket: e.S3_BUCKET });
const redisUrl = new URL(e.REDIS_URL);
redisUrl.pathname = "/2";
const redis = new Redis(redisUrl.toString());
const deps: MusicDeps = { db, storage, redis, secret: "t".repeat(40), rateLimitScale: 1 };

const createdUsers: string[] = [];
async function newUser() {
  const [u] = await db.insert(users).values({ email: `files-${randomUUID()}@test.dev` }).returning();
  createdUsers.push(u.id);
  return u.id;
}

async function readAll(key: string) {
  const obj = await getObject(storage, key);
  return obj?.Body ? new Uint8Array(await obj.Body.transformToByteArray()) : null;
}

// Local server for the import tests (the only way to import from http/loopback is the test hook).
let server: http.Server;
let base = "";
const wav = makeWav(4000);
const testing = {
  allowHttp: true,
  lookup: ((_h: string, o: { all?: boolean }, cb: (err: null, a: unknown, f?: number) => void) =>
    o.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4)) as never,
};

beforeAll(async () => {
  await redis.flushdb();
  server = http.createServer((req, res) => {
    if (req.url === "/song.wav") return res.writeHead(200, { "Content-Type": "audio/wav" }).end(Buffer.from(wav));
    if (req.url === "/redirect") return res.writeHead(302, { Location: "/song.wav" }).end();
    if (req.url === "/page") return res.writeHead(200, { "Content-Type": "text/html" }).end("<html>TikTok sound page</html>");
    if (req.url === "/huge") {
      // No Content-Length: the limit must be enforced while reading.
      res.writeHead(200, { "Content-Type": "audio/wav" });
      res.write(Buffer.from(makeWav(10)));
      const chunk = Buffer.alloc(1024 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent < 12 && res.write(chunk)) sent++;
        if (sent < 12) res.once("drain", pump);
        else res.end();
      };
      return pump();
    }
    if (req.url === "/loop") return res.writeHead(302, { Location: "/loop" }).end();
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://test-host:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const id of createdUsers) await deletePrefix(storage, keys.user(id)).catch(() => undefined);
  server.close();
  redis.disconnect();
  await client.end({ timeout: 5 });
});

describe("music upload", () => {
  it("stores a real WAV privately and returns a signed playback link", async () => {
    const userId = await newUser();
    const track = await uploadMusic(deps, userId, { bytes: wav, fileName: "C:\\Users\\me\\Calm Piano.wav" });
    expect(track).toMatchObject({ name: "Calm Piano.wav", source: "upload", mimeType: "audio/wav", sizeBytes: wav.length });
    expect(track.url).toMatch(new RegExp(`^/api/media/users/${userId}/music/${track.id}\\.wav\\?exp=\\d+&sig=`));

    const [row] = await db.select().from(musicTracks).where(eq(musicTracks.id, track.id));
    expect(row.storageKey).toBe(`users/${userId}/music/${track.id}.wav`);
    expect(await readAll(row.storageKey)).toEqual(wav);
    expect((await listMusic(deps, userId)).map((t) => t.id)).toEqual([track.id]);
  });

  it("refuses files that only look like audio by name, empty files and files over 10 MB", async () => {
    const userId = await newUser();
    const fake = new TextEncoder().encode("this is a text file renamed to .mp3, not audio");
    await expect(uploadMusic(deps, userId, { bytes: fake, fileName: "song.mp3" })).rejects.toThrow("isn't an MP3 or WAV");
    await expect(uploadMusic(deps, userId, { bytes: new Uint8Array(), fileName: "a.mp3" })).rejects.toBeInstanceOf(ValidationError);
    const big = new Uint8Array(MAX_MUSIC_BYTES + 1);
    big.set(makeWav(10));
    await expect(uploadMusic(deps, userId, { bytes: big, fileName: "big.wav" })).rejects.toBeInstanceOf(TooLargeError);
    expect(await listMusic(deps, userId)).toEqual([]);
    expect(await listKeys(storage, keys.user(userId))).toEqual([]); // nothing stored
  });

  it("limits uploads per hour and the size of the library", async () => {
    const userId = await newUser();
    const tight = { ...deps, rateLimitScale: 2 / 30 }; // 2 per hour
    await uploadMusic(tight, userId, { bytes: wav, fileName: "1.wav" });
    await uploadMusic(tight, userId, { bytes: wav, fileName: "2.wav" });
    await expect(uploadMusic(tight, userId, { bytes: wav, fileName: "3.wav" })).rejects.toBeInstanceOf(RateLimitedError);

    const full = await newUser();
    await db.insert(musicTracks).values(
      Array.from({ length: MAX_TRACKS_PER_USER }, (_, i) => ({
        userId: full,
        source: "upload" as const,
        name: `t${i}`,
        storageKey: `users/${full}/music/fake-${i}.wav`,
        mimeType: "audio/wav",
        sizeBytes: 1,
      })),
    );
    await expect(uploadMusic(deps, full, { bytes: wav, fileName: "x.wav" })).rejects.toThrow("library is full");
  });
});

describe("music import by URL", () => {
  it("imports a direct audio link, following a redirect", async () => {
    const userId = await newUser();
    const track = await importMusic(deps, userId, { url: `${base}/redirect` }, { testing });
    expect(track).toMatchObject({ name: "song.wav", source: "url", sourceUrl: `${base}/redirect`, mimeType: "audio/wav" });
    expect(await readAll(`users/${userId}/music/${track.id}.wav`)).toEqual(wav);
  });

  it("explains when the link is a web page instead of an audio file", async () => {
    const userId = await newUser();
    await expect(importMusic(deps, userId, { url: `${base}/page` }, { testing })).rejects.toThrow("Paste a direct link to the audio file");
  });

  it("stops downloading at 10 MB even without Content-Length, and gives up on redirect loops and errors", async () => {
    const userId = await newUser();
    await expect(importMusic(deps, userId, { url: `${base}/huge` }, { testing })).rejects.toThrow("larger than 10 MB");
    await expect(importMusic(deps, userId, { url: `${base}/loop` }, { testing })).rejects.toThrow("Too many redirects");
    await expect(importMusic(deps, userId, { url: `${base}/missing` }, { testing })).rejects.toThrow("HTTP 404");
    await expect(importMusic(deps, userId, { url: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(await listMusic(deps, userId)).toEqual([]);
  });

  it("without the test hook, a link to our own network is refused", async () => {
    const userId = await newUser();
    await expect(importMusic(deps, userId, { url: "https://s3:8333/" })).rejects.toThrow("isn't allowed");
  });
});

describe("music in series and deletion", () => {
  const wizard = {
    name: "With music",
    formats: ["storytelling"],
    niche: "Calm stories",
    language: "en",
    voice: "adam",
    artStyle: "realism",
    captionStyle: "bold",
    frequency: "daily",
    postTime: "18:00",
  };

  it("links only the user's own tracks to a series", async () => {
    const userId = await newUser();
    const other = await newUser();
    const mine = await uploadMusic(deps, userId, { bytes: wav, fileName: "mine.wav" });
    const theirs = await uploadMusic(deps, other, { bytes: wav, fileName: "theirs.wav" });

    const s = await createSeries(db, userId, { ...wizard, musicTrackIds: [mine.id, mine.id] });
    expect(s.musicTrackIds).toEqual([mine.id]);
    await expect(createSeries(db, userId, { ...wizard, musicTrackIds: [theirs.id] })).rejects.toThrow("Unknown music track");
    await expect(updateSeries(db, userId, s.id, { musicTrackIds: ["not-a-uuid"] })).rejects.toThrow("Unknown music track");
    expect((await updateSeries(db, userId, s.id, { musicTrackIds: [] })).musicTrackIds).toEqual([]);
  });

  it("deleting a track removes its file and takes it out of every series", async () => {
    const userId = await newUser();
    const t = await uploadMusic(deps, userId, { bytes: wav, fileName: "a.wav" });
    const s = await createSeries(db, userId, { ...wizard, musicTrackIds: [t.id] });

    await expect(deleteMusic(deps, await newUser(), t.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteMusic(deps, userId, t.id);
    expect(await readAll(`users/${userId}/music/${t.id}.wav`)).toBeNull();
    expect((await getSeries(db, userId, s.id)).musicTrackIds).toEqual([]);
  });

  it("deletePrefix removes every file of a video and refuses dangerous prefixes", async () => {
    const userId = await newUser();
    const videoId = randomUUID();
    const prefix = keys.video(userId, videoId);
    for (const name of ["script.json", "voice.wav", "images/1.png", "final.mp4"]) await putObject(storage, prefix + name, new Uint8Array([1]), "application/octet-stream");
    await putObject(storage, keys.video(userId, randomUUID()) + "keep.mp4", new Uint8Array([1]), "video/mp4");

    expect(await deletePrefix(storage, prefix)).toBe(4);
    expect(await listKeys(storage, prefix)).toEqual([]);
    expect(await listKeys(storage, keys.user(userId))).toHaveLength(1); // the other video is untouched

    await expect(deletePrefix(storage, "users/")).rejects.toThrow("refusing");
    await expect(deletePrefix(storage, "users")).rejects.toThrow("refusing");
  });
});
