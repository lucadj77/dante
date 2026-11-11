import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { backupFiles, backupStamp, zipProject } from "../backup";
import { MemoryFs } from "../fs";

describe("backup", () => {
  const fs = new MemoryFs({
    "dante.yaml": "title: Prova\n",
    "Manoscritto/010 Uno/010 Inizio.md": "C'era una volta.\n",
    ".dante/snapshots/Manoscritto/010 Uno/010 Inizio/2026-10-26T10-00-00.md": "C'era.\n",
    ".dante/presence/Anna.json": "{}",
    ".trash/Vecchia.md": "via",
    "export/Prova.docx": "x",
  });

  it("saves the project without exports, trash and presence", async () => {
    expect(await backupFiles(fs)).toEqual([
      ".dante/snapshots/Manoscritto/010 Uno/010 Inizio/2026-10-26T10-00-00.md",
      "Manoscritto/010 Uno/010 Inizio.md",
      "dante.yaml",
    ]);
  });

  it("zips it inside a folder with the project's name", async () => {
    const files = unzipSync(await zipProject(fs, "Prova"));
    expect(new TextDecoder().decode(files["Prova/Manoscritto/010 Uno/010 Inizio.md"])).toBe("C'era una volta.\n");
    expect(Object.keys(files)).toHaveLength(3);
  });

  it("names backups by local time", () => {
    expect(backupStamp(new Date(2026, 9, 26, 9, 5, 3))).toBe("2026-10-26 09-05-03");
  });
});

describe("taking a backup out of its zip", () => {
  it("writes the same files in an empty folder, without the zip's own folder", async () => {
    const { MemoryFs } = await import("../fs");
    const { unzipProject } = await import("../backup");
    const fs = new MemoryFs({ "dante.yaml": "title: Prova\n", "Manoscritto/010 Uno/010 Scena.md": "Testo.", ".dante/id": "abc\n", "Ricerca/foto.png": "PNG" });
    const copy = new MemoryFs({});
    expect(await unzipProject(copy, await zipProject(fs, "Prova"))).toBe(4);
    expect([...copy.files.keys()].sort()).toEqual([...fs.files.keys()].sort());
    for (const path of fs.files.keys()) expect(new TextDecoder().decode(await copy.readBytes(path))).toBe(fs.files.get(path));
  });

  it("writes nothing outside the folder", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const { MemoryFs } = await import("../fs");
    const { unzipProject } = await import("../backup");
    const copy = new MemoryFs({});
    const zip = zipSync({ "Prova/../fuori.md": strToU8("x"), "Prova/dentro.md": strToU8("y"), "Prova//vuoto.md": strToU8("z") });
    expect(await unzipProject(copy, zip)).toBe(1);
    expect([...copy.files.keys()]).toEqual(["dentro.md"]);
  });
});
