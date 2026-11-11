import { describe, expect, it } from "vitest";
import type { MeDto } from "./api-types";
import { platformStates, seriesStatusLine } from "./series-status";

const conn = (platform: "tiktok" | "instagram" | "youtube", status: "active" | "expired" | "revoked" = "active") => ({
  id: platform,
  platform,
  username: "@x",
  status,
});
const me = (connections: MeDto["connections"], autoPublish = true) => ({ connections, user: { autoPublish } as MeDto["user"] });

describe("series status line", () => {
  it("says paused before anything else", () => {
    expect(seriesStatusLine({ status: "paused", platforms: ["youtube"] }, me([conn("youtube")]))).toBe("Paused: no new videos until you resume it");
  });

  it("never claims to post without platforms or before the account is loaded", () => {
    expect(seriesStatusLine({ status: "active", platforms: [] }, me([]))).toBe("Making videos without posting: no platform selected");
    expect(seriesStatusLine({ status: "active", platforms: ["youtube"] }, undefined)).toBe("Active");
  });

  it("names the platforms it posts to and the ones that aren't connected", () => {
    const m = me([conn("tiktok"), conn("youtube"), conn("instagram", "expired")]);
    expect(seriesStatusLine({ status: "active", platforms: ["tiktok", "instagram", "youtube"] }, m)).toBe(
      "Posts to TikTok and YouTube · Instagram isn't connected",
    );
    expect(seriesStatusLine({ status: "active", platforms: ["instagram", "youtube"] }, me([]))).toBe("Not posting: Instagram and YouTube aren't connected");
  });

  it("respects manual publishing", () => {
    expect(seriesStatusLine({ status: "active", platforms: ["youtube"] }, me([conn("youtube")], false))).toBe(
      "Videos wait for you to publish them to YouTube",
    );
  });

  it("treats expired and revoked connections as not connected", () => {
    expect(platformStates(["youtube", "tiktok"], [conn("youtube", "revoked"), conn("tiktok")])).toEqual([
      { id: "youtube", name: "YouTube", connected: false },
      { id: "tiktok", name: "TikTok", connected: true },
    ]);
  });
});
