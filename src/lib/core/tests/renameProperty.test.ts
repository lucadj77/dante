import { describe, expect, it } from "vitest";
import { renameProperty } from "../frontmatter";
import { MemoryFs } from "../fs";
import { canRenameProperty, Project } from "../project";
import { parseView } from "../views";

describe("renaming a property", () => {
  it("keeps its place, its value and the rest of the note", () => {
    const text = "---\nstato: bozza\n# il punto di vista\npov: \"[[Lucia]]\"\nluogo: Lecco\n---\nTesto.";
    expect(renameProperty(text, "pov", "punto di vista")).toBe("---\nstato: bozza\n# il punto di vista\npunto di vista: \"[[Lucia]]\"\nluogo: Lecco\n---\nTesto.");
    expect(renameProperty(text, "assente", "x")).toBeNull();
    expect(renameProperty(text, "pov", "luogo")).toBeNull();
    expect(renameProperty("Solo testo.", "pov", "x")).toBeNull();
  });

  it("renames it in every note, in its definition, in the types, the dot and the views", async () => {
    const fs = new MemoryFs({
      "dante.yaml": "title: T\nlanguage: it\nproperties:\n  luogo:\n    kind: link\n    note_type: place\ntree:\n  dot: luogo\n",
      "Manoscritto/010 Uno/010 A.md": "---\nluogo: \"[[Lecco]]\"\n---\nA.",
      "Manoscritto/010 Uno/020 B.md": "---\nluogo: Milano\nposto: già\n---\nB.",
      "Manoscritto/010 Uno/030 C.md": "C.",
      "Bibbia/Personaggi/Lucia.md": "---\ntype: character\nluogo: Lecco\n---\n",
      "Viste/Scene.yaml": "type: table\nsort: -luogo\ngroup_by: luogo\nfields: [luogo, pov]\nfilter:\n  luogo: Lecco\n",
    });
    const project = await Project.open(fs, "it");
    const { notes, skipped } = await project.renameProperty("luogo", "posto");
    expect(notes).toBe(2);
    expect(skipped).toEqual(["Manoscritto/010 Uno/020 B.md"]);
    expect(await fs.readText("Manoscritto/010 Uno/010 A.md")).toBe("---\nposto: \"[[Lecco]]\"\n---\nA.");
    expect(await fs.readText("Bibbia/Personaggi/Lucia.md")).toContain("posto: Lecco");
    expect(project.settings.properties.posto).toMatchObject({ kind: "link", note_type: "place" });
    expect(project.settings.properties.luogo).toBeUndefined();
    expect(project.settings.tree.dot).toBe("posto");
    const view = parseView(await fs.readText("Viste/Scene.yaml"));
    expect(view).toMatchObject({ sort: "-posto", group_by: "posto", fields: ["posto", "pov"], filter: { posto: ["Lecco"] } });
  });

  it("is not offered for the properties Dante reads by name", async () => {
    const project = await Project.open(new MemoryFs({ "dante.yaml": "title: T\nlanguage: it\n" }), "it");
    expect(canRenameProperty(project.settings, "stato")).toBe(false);
    expect(canRenameProperty(project.settings, "synopsis")).toBe(false);
    expect(canRenameProperty(project.settings, "pov")).toBe(true);
    await expect(project.renameProperty("pov", "type")).rejects.toThrow();
  });
});

describe("properties of every scene", () => {
  it("go into the template of new scenes", async () => {
    const fs = new MemoryFs({ "dante.yaml": "title: T\nlanguage: it\n" });
    const project = await Project.open(fs, "it");
    expect(await project.sceneProperties()).toEqual({});
    await project.addSceneProperty("luogo", "");
    expect(await project.sceneProperties()).toMatchObject({ stato: "idea", luogo: "" });
    expect(await fs.readText("Modelli/Scena.md")).toContain("luogo:");
  });
});
