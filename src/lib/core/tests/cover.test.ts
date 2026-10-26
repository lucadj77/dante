import { describe, expect, it } from "vitest";
import { coverFor, coverSvg, resolveCover, wrap } from "../cover";
import { authorsOf, exportBaseName, exportStamp } from "../export/files";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { byline, parseSettings } from "../settings";

describe("cover", () => {
  it("wraps titles into balanced lines", () => {
    expect(wrap("La casa sul lago", 1)).toEqual(["La casa sul lago"]);
    expect(wrap("La casa sul lago", 2)).toEqual(["La casa", "sul lago"]);
    expect(wrap("Uno", 3)).toEqual(["Uno"]);
  });

  it("draws authors, title and subtitle with escaped text", () => {
    const svg = coverSvg({ title: "Tom & Jerry <2>", subtitle: "Un racconto", authors: ["Ada Rossi"] }, { template: "waves", palette: "sea" });
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

  it("puts each author on a line", () => {
    const svg = coverSvg({ title: "T", authors: ["Ada Rossi", "Bruno Neri"] }, { template: "dots", palette: "ink" });
    expect(svg).toContain(">ADA ROSSI</text>");
    expect(svg).toContain(">BRUNO NERI</text>");
  });

  it("is kept in the settings, and unknown values are dropped", () => {
    expect(parseSettings("cover:\n  template: blocks\n  palette: plum\n").cover).toMatchObject({ template: "blocks", palette: "plum", image: "", textColor: "" });
    expect(parseSettings("cover:\n  template: spirals\n  palette: neon\n").cover).toMatchObject({ template: "", palette: "" });
    const own = parseSettings("cover:\n  image: Ricerca/Allegati/foto.jpg\n  show:\n    subtitle: false\n  textColor: '#FFCC00'\n  outlineColor: red\n").cover;
    expect(own).toMatchObject({ image: "Ricerca/Allegati/foto.jpg", show: { title: true, subtitle: false, authors: true }, textColor: "#ffcc00", outlineColor: "" });
    expect(parseSettings("cover:\n  image: ../fuori.jpg\n").cover.image).toBe("");
    expect(parseSettings("cover:\n  image: /Users/me/foto.jpg\n").cover.image).toBe("");
  });

  it("is chosen when a project is created", async () => {
    const { project } = await Project.create(new MemoryFs(), { title: "Nebbia", authors: [], language: "it" }, null);
    expect(project.settings.cover).toMatchObject(coverFor("Nebbia"));
  });

  it("hides the texts turned off and draws them in the chosen colours", () => {
    const text = { title: "Nebbia", subtitle: "Un giallo", authors: ["Ada Rossi"] };
    const svg = coverSvg(text, { template: "waves", palette: "sea", show: { title: true, subtitle: false, authors: false }, textColor: "#ffcc00", outlineColor: "#000000" });
    expect(svg).toContain(">Nebbia</text>");
    expect(svg).not.toContain("Un giallo");
    expect(svg).not.toContain("ADA ROSSI");
    expect(svg).toContain('fill="#ffcc00" stroke="#000000"');
    expect(svg).not.toContain("#f0fbfb");
    expect(coverSvg(text, { template: "waves", palette: "sea" })).not.toContain("stroke=\"#");
  });

  it("puts a picture in place of the shapes, or leaves only the texts to lay over it", () => {
    const text = { title: "Nebbia", authors: [] };
    const picture = "data:image/png;base64,AAAA";
    const svg = coverSvg(text, { template: "waves", palette: "sea", image: "foto.png" }, { url: picture });
    expect(svg).toContain(`<image href="${picture}"`);
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(svg).not.toContain("<path");
    const texts = coverSvg(text, { template: "waves", palette: "sea", image: "foto.png" }, { url: picture, textOnly: true });
    expect(texts).not.toContain("<image");
    expect(texts).not.toContain("<rect");
    expect(texts).toContain(">Nebbia</text>");
  });
});

describe("export file names", () => {
  const date = new Date(2026, 9, 6, 9, 5);

  it("joins authors, title and local time with underscores", () => {
    expect(exportStamp(date)).toBe("2026-10-06-09-05");
    expect(exportBaseName({ title: "La casa sul lago", authors: ["Ada Rossi"] }, date)).toBe("Ada_Rossi_La_casa_sul_lago_2026-10-06-09-05");
    expect(exportBaseName({ title: "Che fare?", authors: ["Ada Rossi", "Bruno Neri", "Carla Bianchi"] }, date)).toBe(
      "Ada_Rossi_Bruno_Neri_Carla_Bianchi_Che_fare_2026-10-06-09-05",
    );
    expect(exportBaseName({ title: "L'età: 1/2", authors: [] }, date)).toBe("L'età_12_2026-10-06-09-05");
    expect(exportBaseName({ title: "", authors: [] }, date)).toBe("manuscript_2026-10-06-09-05");
  });

  it("finds each author of a byline", () => {
    expect(authorsOf("Ada Rossi & Bruno Neri")).toEqual(["Ada Rossi", "Bruno Neri"]);
    expect(authorsOf("Emanuele Rossi")).toEqual(["Emanuele Rossi"]);
  });
});

describe("authors", () => {
  it("are a list in the settings, read from the older single text too", async () => {
    expect(parseSettings("authors: [Ada Rossi, Bruno Neri]\n").authors).toEqual(["Ada Rossi", "Bruno Neri"]);
    expect(parseSettings("author: Ada Rossi e Bruno Neri\n").authors).toEqual(["Ada Rossi", "Bruno Neri"]);
    const fs = new MemoryFs({ "dante.yaml": "title: T\nauthor: Ada\n" });
    const project = await Project.open(fs);
    await project.saveSettings({ ...project.settings, authors: ["Ada", "Bruno"] });
    const text = await fs.readText("dante.yaml");
    expect(text).not.toMatch(/^author:/m);
    expect(parseSettings(text).authors).toEqual(["Ada", "Bruno"]);
  });

  it("are joined as the language joins a list", () => {
    expect(byline(["Ada", "Bruno", "Carla"], "it")).toBe("Ada, Bruno e Carla");
    expect(byline(["Ada"], "en")).toBe("Ada");
  });
});
