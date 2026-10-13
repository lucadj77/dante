import { describe, expect, it } from "vitest";
import { readProperties, replaceBody, splitNote, writeProperties } from "../frontmatter";

const note = "---\n# point of view\npov: \"[[Marta]]\"\nstatus: draft\n---\nThe train was late.\n";

describe("frontmatter", () => {
  it("splits and reads", () => {
    expect(splitNote(note).body).toBe("The train was late.\n");
    expect(readProperties(note)).toEqual({ pov: "[[Marta]]", status: "draft" });
    expect(splitNote("No properties").frontmatter).toBeNull();
  });

  it("changes one property keeping comments and the body", () => {
    const out = writeProperties(note, { status: "revised" });
    expect(out).toBe("---\n# point of view\npov: \"[[Marta]]\"\nstatus: revised\n---\nThe train was late.\n");
  });

  it("adds frontmatter to a note without it, and removes it when empty", () => {
    const added = writeProperties("Text", { status: "draft" });
    expect(added).toBe("---\nstatus: draft\n---\nText");
    expect(writeProperties(added, { status: undefined })).toBe("Text");
  });

  it("replaces the body only", () => {
    expect(replaceBody(note, "New.")).toBe("---\n# point of view\npov: \"[[Marta]]\"\nstatus: draft\n---\nNew.");
  });

  it("handles an empty frontmatter", () => {
    expect(splitNote("---\n---\nBody").body).toBe("Body");
  });
});
