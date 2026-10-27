import { describe, expect, it } from "vitest";
import { compareVersions, isPrerelease, newerVersion, newsSince } from "../../updates.svelte";

describe("update news", () => {
  const raw = {
    news: {
      it: [
        { version: "0.1.31", notes: ["**Elenchi**: rientro."] },
        { version: "0.1.30", notes: ["Tabelle."] },
        { version: "0.1.29", notes: ["Già installata."] },
      ],
      en: [{ version: "0.1.31", notes: ["**Lists**: indent."] }],
    },
  };

  it("compares versions number by number", () => {
    expect(newerVersion("0.1.30", "0.1.29")).toBe(true);
    expect(newerVersion("0.1.100", "0.1.99")).toBe(true);
    expect(newerVersion("0.1.29", "0.1.29")).toBe(false);
    expect(newerVersion("1.0.0", "0.1.49")).toBe(true);
  });

  it("puts a beta before its version, as semver does", () => {
    const sorted = ["1.1.0", "1.1.0-beta.10", "1.0.3", "1.1.0-beta.2", "1.1.0-beta.1", "1.2.0-beta.1"].sort(compareVersions);
    expect(sorted).toEqual(["1.0.3", "1.1.0-beta.1", "1.1.0-beta.2", "1.1.0-beta.10", "1.1.0", "1.2.0-beta.1"]);
    expect(newerVersion("1.1.0", "1.1.0-beta.3")).toBe(true);
    expect(isPrerelease("1.1.0-beta.1")).toBe(true);
    expect(isPrerelease("1.1.0")).toBe(false);
  });

  it("lists what came after the installed version, in Italian or else English", () => {
    expect(newsSince(raw, "0.1.29", "it").map((v) => v.version)).toEqual(["0.1.31", "0.1.30"]);
    expect(newsSince(raw, "0.1.29", "es")[0].notes).toEqual(["**Lists**: indent."]);
    expect(newsSince({}, "0.1.29", "it")).toEqual([]);
  });
});
