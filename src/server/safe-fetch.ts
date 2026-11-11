import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

// Downloads a file from a URL the user typed, without letting it reach our own network (SSRF):
// - https only; at most 3 redirects, each one checked again;
// - the host name is resolved here and the connection goes to that exact address, after
//   refusing private, loopback, link-local (cloud metadata), multicast and reserved ranges;
// - time limit and a byte limit enforced while downloading (Content-Length is not trusted).

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["2001:db8::", 32], // documentation
  ["64:ff9b::", 96], // NAT64 (could reach IPv4 private ranges)
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True for addresses that must never be fetched (our own network, metadata services...). */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(address, "ipv6");
  }
  return blocked.check(address, "ipv4");
}

export class FetchRefused extends Error {}

type Lookup = (hostname: string, options: object, cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) => void;

/** DNS lookup that refuses blocked addresses (used for the actual connection, so no rebinding window). */
export const safeLookup: Lookup = (hostname, options, cb) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, []);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) return cb(new FetchRefused("This address isn't allowed."), []);
    if ((options as { all?: boolean }).all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

export type SafeFetchOptions = {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Tests only: allow plain http and a custom resolver (to reach a local test server). */
  testing?: { allowHttp: boolean; lookup: Lookup };
};

export type SafeFetchResult = { bytes: Uint8Array; contentType: string | null; finalUrl: string };

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchRefused("That isn't a valid link.");
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const allowed = opts.testing?.allowHttp ? ["https:", "http:"] : ["https:"];
    if (!allowed.includes(url.protocol)) throw new FetchRefused("Only https links can be imported.");
    if (url.username || url.password) throw new FetchRefused("Links with a user name or password can't be imported.");
    if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw new FetchRefused("This address isn't allowed.");
    }

    const res = await requestOnce(url, opts);
    if (res.redirect) {
      url = new URL(res.redirect, url);
      continue;
    }
    return { bytes: res.bytes!, contentType: res.contentType, finalUrl: url.toString() };
  }
  throw new FetchRefused("Too many redirects.");
}

function requestOnce(url: URL, opts: SafeFetchOptions): Promise<{ redirect?: string; bytes?: Uint8Array; contentType: string | null }> {
  const lib = url.protocol === "https:" ? https : http;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      {
        lookup: (opts.testing?.lookup ?? safeLookup) as never,
        headers: { "User-Agent": "ReelPilot-MusicImport/1.0", Accept: "audio/*,*/*;q=0.5" },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location, contentType: null });
        }
        if (status !== 200) {
          res.resume();
          return reject(new FetchRefused(`The link answered with HTTP ${status}.`));
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > opts.maxBytes) {
          res.destroy();
          return reject(new FetchRefused("The file is larger than 10 MB."));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > opts.maxBytes) {
            res.destroy();
            reject(new FetchRefused("The file is larger than 10 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ bytes: new Uint8Array(Buffer.concat(chunks)), contentType: res.headers["content-type"] ?? null }));
        res.on("error", reject);
      },
    );
    // Overall deadline, on top of the socket idle timeout (slow-drip servers).
    const deadline = setTimeout(() => req.destroy(new FetchRefused("The link took too long to answer.")), timeoutMs);
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new FetchRefused("The link took too long to answer.")));
    req.on("error", (e) => reject(e instanceof FetchRefused ? e : new FetchRefused(friendly(e))));
  });
}

function friendly(e: Error & { code?: string }): string {
  if (e.code === "ENOTFOUND") return "That address couldn't be found.";
  if (e.code === "ECONNREFUSED" || e.code === "ECONNRESET") return "The link couldn't be reached.";
  if (e.code?.startsWith("ERR_TLS") || e.code?.includes("CERT")) return "The link's security certificate isn't valid.";
  return "The link couldn't be downloaded.";
}
