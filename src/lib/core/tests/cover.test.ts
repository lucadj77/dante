import { describe, expect, it } from "vitest";
import { coverFor, coverSvg, resolveCover, wrap } from "../cover";
import { authorsOf, exportBaseName, exportStamp } from "../export/files";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { parseSettings } from "../settings";

describe("cover", () => {
  it("wraps titles into balanced lines", () => {
    expect(wrap("La casa sul lago", 1)).toEqual(["La casa sul lago"]);
    expect(wrap("La casa sul lago", 2)).toEqual(["La casa", "sul lago"]);
    expect(wrap("Uno", 3)).toEqual(["Uno"]);
  });

  it("draws authors, title and subtitle with escaped text", () => {
    const svg = coverSvg({ title: "Tom & Jerry <2>", subtitle: "Un racconto", author: "Ada Rossi" }, { template: "waves", palette: "sea" });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("ADA ROSSI");
    expect(svg).toContain(">Tom &amp;</text>");
    expect(svg).toContain(">Jerry &lt;2&gt;</text>");
    expect(svg).toContain("Un racconto");
    expect(svg).toContain("#0f5d6e");
  });

  it("picks template and palette from the title until chosen", () => {
    const auto = coverFor("Il deserto");
    expect(resolveCover({ template: "", palette: "" }, "Il deserto")).toEqual(auto);
    expect(resolveCover({ template: "arcs", palette: "" }, "Il deserto")).toEqual({ template: "arcs", palette: auto.palette });
  });

  it("is kept in the settings, and unknown values are dropped", () => {
    expect(parseSettings("cover:\n  template: blocks\n  palette: plum\n").cover).toEqual({ template: "blocks", palette: "plum" });
    expect(parseSettings("cover:\n  template: spirals\n  palette: neon\n").cover).toEqual({ template: "", palette: "" });
  });

  it("is chosen when a project is created", async () => {
    const { project } = await Project.create(new MemoryFs(), { title: "Nebbia", author: "", language: "it" }, null);
    expect(project.settings.cover).toEqual(coverFor("Nebbia"));
  });
});

describe("export file names", () => {
  const date = new Date(2026, 9, 6, 9, 5);

  it("joins authors, title and local time with underscores", () => {
    expect(exportStamp(date)).toBe("2026-10-06-09-05");
    expect(exportBaseName({ title: "La casa sul lago", author: "Ada Rossi" }, date)).toBe("Ada_Rossi_La_casa_sul_lago_2026-10-06-09-05");
    expect(exportBaseName({ title: "Che fare?", author: "Ada Rossi, Bruno Neri e Carla Bianchi" }, date)).toBe(
      "Ada_Rossi_Bruno_Neri_Carla_Bianchi_Che_fare_2026-10-06-09-05",
    );
    expect(exportBaseName({ title: "L'età: 1/2", author: "" }, date)).toBe("L'età_12_2026-10-06-09-05");
    expect(exportBaseName({ title: "", author: "" }, date)).toBe("manuscript_2026-10-06-09-05");
  });

  it("finds each author of a byline", () => {
    expect(authorsOf("Ada Rossi & Bruno Neri")).toEqual(["Ada Rossi", "Bruno Neri"]);
    expect(authorsOf("Emanuele Rossi")).toEqual(["Emanuele Rossi"]);
  });
});
