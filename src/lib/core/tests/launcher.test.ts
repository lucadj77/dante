import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { ensureLauncher, isLauncher, projectFolder } from "../launcher";

describe("launcher file", () => {
  it("is written once, named after the title", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: x\n" });
    expect(await ensureLauncher(fs, "Il nome: della rosa", "open me")).toBe("Il nome della rosa.dante");
    expect(await fs.readText("Il nome della rosa.dante")).toBe("open me");
    expect(await ensureLauncher(fs, "Another title", "open me")).toBe("");
    expect(await fs.exists("Another title.dante")).toBe(false);
  });

  it("keeps one the writer renamed", async () => {
    const fs = new MemoryFs({ "Romanzo.DANTE": "" });
    expect(await ensureLauncher(fs, "Title", "")).toBe("");
  });

  it("is recognised by its extension", () => {
    expect(isLauncher("Romanzo.dante")).toBe(true);
    expect(isLauncher(".dante")).toBe(false);
    expect(isLauncher("dante.yaml")).toBe(false);
  });

  it("leads to the folder it sits in", () => {
    expect(projectFolder("/Users/luca/Romanzi/Ferrante/Ferrante.dante")).toBe("/Users/luca/Romanzi/Ferrante");
    expect(projectFolder("C:\\Romanzi\\Ferrante\\Ferrante.dante")).toBe("C:\\Romanzi\\Ferrante");
    expect(projectFolder("/Users/luca/Romanzi/Ferrante/dante.yaml")).toBe("/Users/luca/Romanzi/Ferrante");
    expect(projectFolder("/Users/luca/Romanzi/Ferrante/")).toBe("/Users/luca/Romanzi/Ferrante");
  });
});
