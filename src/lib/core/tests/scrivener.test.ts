import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { readPicked } from "$lib/ui/scrivenerFile";
import { MemoryFs, type ProjectFs } from "../fs";
import { rtfParagraphs } from "../import/rtf";
import { readScrivener, readScrivenerZip } from "../import/scrivener";
import { defaultRoles, structure } from "../import/structure";

const rtf = (body: string) => `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2639{\\fonttbl\\f0\\fnil Palatino;}{\\colortbl;\\red255\\green255\\blue255;}{\\*\\expandedcolortbl;;}\\pard\\f0\\fs24 ${body}}`;

const SCRIVX = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Identifier="X" Version="2.0">
  <Binder>
    <BinderItem UUID="D" Type="DraftFolder"><Title>Draft</Title><Children>
      <BinderItem UUID="C1" Type="Folder"><Title>Il ritorno</Title><Children>
        <BinderItem UUID="S1" Type="Text"><Title>Arrivo</Title></BinderItem>
        <BinderItem UUID="S2" Type="Text"><Title>Casa &amp; bottega</Title></BinderItem>
      </Children></BinderItem>
      <BinderItem UUID="C2" Type="Folder"><Title>La lettera</Title><Children>
        <BinderItem UUID="S3" Type="Text"><Title>Busta</Title></BinderItem>
      </Children></BinderItem>
    </Children></BinderItem>
    <BinderItem UUID="R" Type="ResearchFolder"><Title>Research</Title><Children>
      <BinderItem UUID="N" Type="Text"><Title>Appunti</Title></BinderItem>
    </Children></BinderItem>
  </Binder>
  <ProjectProperties><ProjectTitle>Il faro</ProjectTitle><FullName>Marta Rinaldi</FullName></ProjectProperties>
</ScrivenerProject>`;

const FILES: Record<string, string> = {
  "Files/Data/S1/content.rtf": rtf("Marta arriv\\'f2 {\\i tardi}.\\par\n\\par\nPoi {\\b disse}: \\u8220?Ciao\\u8221?.\\par\n"),
  "Files/Data/S1/synopsis.txt": "Marta torna al paese.\n",
  "Files/Data/S2/content.rtf": rtf("\\qc * * *\\par\\pard La casa.\\par"),
  "Files/Data/S3/content.rtf": rtf("Una busta.{\\*\\annotation nascosto}\\par"),
  "Files/Data/N/content.rtf": rtf("Non fa parte del libro.\\par"),
};
const files = async (path: string) => (path in FILES ? new TextEncoder().encode(FILES[path]) : null);

describe("RTF", () => {
  it("reads paragraphs with their formatting, accents and quotes", () => {
    expect(rtfParagraphs(FILES["Files/Data/S1/content.rtf"])).toEqual(["Marta arrivò *tardi*.", "", "Poi **disse**: “Ciao”."]);
  });

  it("keeps centred paragraphs and leaves out what is not text", () => {
    const [first, second] = rtfParagraphs(FILES["Files/Data/S2/content.rtf"]);
    expect(first).toContain("text-align:center");
    expect(second).toBe("La casa.");
    expect(rtfParagraphs(FILES["Files/Data/S3/content.rtf"])).toEqual(["Una busta."]);
  });
});

describe("Scrivener", () => {
  it("makes the draft's folders chapters and its texts scenes, with their synopses", async () => {
    const content = await readScrivener(SCRIVX, files);
    expect(content.title).toBe("Il faro");
    expect(content.author).toBe("Marta Rinaldi");
    expect(content.blocks[0]).toEqual({ kind: "heading", level: 1, text: "Il ritorno" });
    expect(content.blocks.some((b) => b.text.includes("Non fa parte"))).toBe(false);
    const book = structure(content.blocks, { start: "Inizio", scene: (n) => `Scena ${n}` }, content.title, defaultRoles(content.blocks));
    const chapters = book.parts[0].chapters;
    expect(chapters.map((c) => c.title)).toEqual(["Il ritorno", "La lettera"]);
    expect(chapters[0].scenes.map((s) => s.title)).toEqual(["Arrivo", "Casa & bottega"]);
    expect(chapters[0].scenes[0]).toMatchObject({ synopsis: "Marta torna al paese.", text: expect.stringContaining("Marta arrivò *tardi*.") });
  });

  it("reads a zip of the .scriv folder, and Scrivener 2's file names", async () => {
    const old = SCRIVX.replace(/UUID="(\w+)"/g, (_, id) => `ID="${id}"`);
    const zip = zipSync({
      "Il faro.scriv/Il faro.scrivx": new TextEncoder().encode(old),
      "Il faro.scriv/Files/Docs/S3.rtf": new TextEncoder().encode(FILES["Files/Data/S3/content.rtf"]),
    });
    const { unzip } = await import("../import/unzip");
    const content = await readScrivenerZip(await unzip(zip));
    expect(content.blocks.filter((b) => b.kind === "paragraph").map((b) => b.text)).toEqual(["Una busta."]);
  });

  describe("chosen in the app", () => {
    /** The computer's disk, with `at` giving a view of one of its folders, as TauriFs does. */
    const disk = new MemoryFs({ "Libri/Il faro.scriv/Il faro.scrivx": SCRIVX, ...Object.fromEntries(Object.entries(FILES).map(([p, c]) => [`Libri/Il faro.scriv/${p}`, c])) });
    const at = (root: string): ProjectFs => {
      const full = (path: string) => [root.replace(/^\//, ""), path].filter(Boolean).join("/");
      return {
        list: async (path) => (await disk.list(full(path))).map((e) => ({ ...e, path: path ? `${path}/${e.name}` : e.name })),
        readText: (path) => disk.readText(full(path)),
        readBytes: (path) => disk.readBytes(full(path)),
        exists: (path) => disk.exists(full(path)),
      } as ProjectFs;
    };
    const scenes = (content: { blocks: { kind: string }[] }) => content.blocks.filter((b) => b.kind === "heading").length;

    it("reads the .scriv folder, with or without a final slash, and the .scrivx inside it", async () => {
      for (const path of ["/Libri/Il faro.scriv", "/Libri/Il faro.scriv/", "/Libri/Il faro.scriv/Il faro.scrivx"]) {
        const picked = await readPicked(at, path, "Senza titolo");
        expect(picked.name).toBe("Il faro.scriv");
        expect(scenes(picked.content)).toBe(5);
      }
    });

    it("reads a .scriv that is a single zipped file, and says why when it is empty or not a project", async () => {
      const zip = zipSync({ "Il faro.scriv/Il faro.scrivx": new TextEncoder().encode(SCRIVX) });
      await disk.writeBytes("Scaricati/Il faro.scriv", zip);
      expect(scenes((await readPicked(at, "/Scaricati/Il faro.scriv", "Senza titolo")).content)).toBe(5);
      await disk.writeText("Scaricati/Altro.scriv", "testo");
      await expect(readPicked(at, "/Scaricati/Altro.scriv", "Senza titolo")).rejects.toMatchObject({ reason: "notProject" });
      await disk.writeBytes("Scaricati/Vuoto.scriv", new Uint8Array());
      await expect(readPicked(at, "/Scaricati/Vuoto.scriv", "Senza titolo")).rejects.toMatchObject({ reason: "empty" });
      await disk.writeBytes("Scaricati/Vuoto.zip", zipSync({ "Vuoto.scriv": new Uint8Array() }));
      await expect(readPicked(at, "/Scaricati/Vuoto.zip", "Senza titolo")).rejects.toMatchObject({ reason: "notProject" });
    });
  });
});
