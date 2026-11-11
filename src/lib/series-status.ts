import type { MeDto, SeriesDto } from "./api-types";
import { optionName, PLATFORMS } from "./options";

// What a series really does, in one line (break-ui on the series detail): "Posting automatically"
// was shown even with no platform selected or with an expired connection.

export type PlatformState = { id: string; name: string; connected: boolean };

/** Each selected platform, and whether its account is connected and working. */
export function platformStates(platforms: string[], connections: MeDto["connections"]): PlatformState[] {
  return platforms.map((id) => ({
    id,
    name: optionName(PLATFORMS, id),
    connected: connections.some((c) => c.platform === id && c.status === "active"),
  }));
}

const list = (names: string[]) => new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(names);
const notConnected = (names: string[]) => `${list(names)} ${names.length === 1 ? "isn't" : "aren't"} connected`;

/**
 * The series' status line. Without `me` (still loading) it only says active or paused, rather than
 * guessing about connections.
 */
export function seriesStatusLine(s: Pick<SeriesDto, "status" | "platforms">, me: Pick<MeDto, "connections" | "user"> | undefined): string {
  if (s.status === "paused") return "Paused: no new videos until you resume it";
  if (!me) return "Active";
  if (s.platforms.length === 0) return "Making videos without posting: no platform selected";
  const states = platformStates(s.platforms, me.connections);
  const ok = states.filter((p) => p.connected).map((p) => p.name);
  const off = states.filter((p) => !p.connected).map((p) => p.name);
  if (ok.length === 0) return `Not posting: ${notConnected(off)}`;
  const main = me.user.autoPublish ? `Posts to ${list(ok)}` : `Videos wait for you to publish them to ${list(ok)}`;
  return off.length ? `${main} · ${notConnected(off)}` : main;
}
