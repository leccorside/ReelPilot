import { describe, expect, it } from "vitest";
import { timezoneOptions } from "./options";

describe("time zone options", () => {
  it("offers every IANA zone, UTC first, with the current one always present", () => {
    const zones = timezoneOptions("America/Argentina/ComodRivadavia");
    expect(zones[0]).toBe("UTC");
    expect(zones.length).toBeGreaterThan(300);
    expect(zones).toContain("Europe/Lisbon");
    expect(zones).toContain("Australia/Sydney");
    expect(zones).toContain("America/Argentina/ComodRivadavia"); // a valid alias outside the canonical list
    expect(new Set(zones).size).toBe(zones.length);
  });
});
