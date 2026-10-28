import { describe, expect, it } from "vitest";
import { MemoryFs } from "../fs";
import { Project } from "../project";
import { arrange, collect, dateKey, defaultView, excerpt, group, moveBefore, parseView, propertiesTarget, serializeView, shiftEnd, timeline, values, type ViewSpec } from "../views";

function sample() {
  return new MemoryFs({
    "dante.yaml": "title: Test\nlanguage: en\n",
    "Story Bible/Characters/Marta.md": "---\nrole: protagonist\nborn: 1950-04-02\n---\nShe returns.\n",
    "Story Bible/Characters/Paolo.md": "---\nrole: brother\nborn: 1948\n---\n",
    "Story Bible/Places/House.md": "---\ntype: place\n---\nA stone house.\n",
    "Research/Harbours.md": "Fishing harbours.\n",
    "Templates/Character.md": "---\ntype: character\n---\n",
    "Views/Board.yaml": "type: kanban\n",
    "Manuscript/010 Return/010 Return.md": "---\nstatus: draft\n---\n",
    "Manuscript/010 Return/010 Arrival.md": "---\nstatus: draft\npov: \"[[Marta|M.]]\"\nday: 2\n---\nThe train arrives late.",
    "Manuscript/010 Return/020 House.md": "---\nstatus: done\npov: \"[[Paolo]]\"\nday: 1\n---\nOne two three four.",
    "Manuscript/020 Letter/010 Envelope.md": "---\npov: [\"[[Marta]]\", \"[[Paolo]]\"]\nday: 10\n---\nA letter.",
  });
}

async function rows(spec: Partial<ViewSpec>) {
  const p = await Project.open(sample());
  const view = { ...defaultView(), ...spec };
  return { view, rows: collect(view, await p.index(), p.manuscript, p.settings) };
}

describe("view files", () => {
  it("read with defaults and aliases, and write back what differs", () => {
    const view = parseView("type: board\nsource: /Manuscript/\nitems: scene\nfilter:\n  status: draft\ncard:\n  fields: [pov]\ngroup_by: status\ngroups: [idea, draft]\n");
    expect(view).toMatchObject({ type: "kanban", source: ["Manuscript"], items: "scene", filter: { status: ["draft"] }, fields: ["pov"], groups: ["idea", "draft"] });
    expect(parseView(serializeView(view))).toEqual(view);
    expect(serializeView(defaultView("cards"))).toBe("type: cards\n");
    expect(parseView("type: [oops")).toEqual(defaultView());
  });

  it("are created in the Views folder and saved", async () => {
    const p = await Project.open(sample());
    const path = await p.createView("Board", defaultView("list"));
    expect(path).toBe("Views/Board 2.yaml");
    await p.saveView(path, { ...defaultView("cards"), items: "scene" });
    await expect(p.fs.readText(path)).resolves.toBe("type: cards\nitems: scene\n");
    expect(p.views).toEqual(["Views/Board 2.yaml", "Views/Board.yaml"]);
  });
});

describe("collecting notes", () => {
  it("lists scenes in manuscript order with their chapter and words", async () => {
    const { rows: scenes } = await rows({ items: "scene" });
    expect(scenes.map((r) => [r.name, r.chapter, r.words])).toEqual([
      ["Arrival", "Chapter 1: Return", 4],
      ["House", "Chapter 1: Return", 4],
      ["Envelope", "Chapter 2: Letter", 2],
    ]);
    expect(values(scenes[0], "pov")).toEqual(["M."]);
    expect(values(scenes[2], "pov")).toEqual(["Marta", "Paolo"]);
  });

  it("lists chapters with the words of their scenes and their folder note", async () => {
    const { rows: chapters } = await rows({ items: "chapter" });
    expect(chapters.map((r) => [r.name, r.words, r.properties.status ?? null])).toEqual([
      ["Chapter 1: Return", 8, "draft"],
      ["Chapter 2: Letter", 2, null],
    ]);
    expect(propertiesTarget(chapters[1])).toBe("Manuscript/020 Letter/020 Letter.md");
  });

  it("lists notes of a type, leaving out templates, views and folder notes", async () => {
    const { rows: characters } = await rows({ items: "character" });
    expect(characters.map((r) => r.name).sort()).toEqual(["Marta", "Paolo"]);
    const { rows: all } = await rows({});
    const names = all.map((r) => r.path);
    expect(names).not.toContain("Templates/Character.md");
    expect(names).not.toContain("Manuscript/010 Return/010 Return.md");
    expect(names).toContain("Research/Harbours.md");
    const { rows: research } = await rows({ source: ["Research"] });
    expect(research.map((r) => r.name)).toEqual(["Harbours"]);
  });
});

describe("excerpts", () => {
  it("read as plain text", () => {
    expect(excerpt("# Title\nThe {--old--}{++new++} *door* to [[Rinaldi House|the house]]{>>@a: x<<}.")).toBe("Title The new door to the house.");
    expect(excerpt("one two three", 9)).toBe("one two…");
    // A picture at the start is not words: no "!" and no file name.
    expect(excerpt("![[faro.jpg|Il faro]]\nLucia guarda il lago. ![una barca](img/barca.png) Vedi [il sito](https://x.it).")).toBe("Lucia guarda il lago. Vedi il sito.");
  });
});

describe("arranging", () => {
  it("filters on any accepted value, empty meaning none", async () => {
    const { view, rows: scenes } = await rows({ items: "scene", filter: { pov: ["paolo"] } });
    expect(arrange(view, scenes).map((r) => r.name)).toEqual(["House", "Envelope"]);
    expect(arrange({ ...view, filter: { status: [""] } }, scenes).map((r) => r.name)).toEqual(["Envelope"]);
  });

  it("sorts numbers as numbers, in reverse with a minus, empties last", async () => {
    const { view, rows: scenes } = await rows({ items: "scene" });
    expect(arrange(view, scenes, "day").map((r) => r.name)).toEqual(["House", "Arrival", "Envelope"]);
    expect(arrange(view, scenes, "-day").map((r) => r.name)).toEqual(["Envelope", "Arrival", "House"]);
    expect(arrange(view, scenes, "status").map((r) => r.name)).toEqual(["House", "Arrival", "Envelope"]);
  });

  it("groups by value, declared groups first, items without one last", async () => {
    const { view, rows: scenes } = await rows({ type: "kanban", items: "scene", group_by: "status", groups: ["idea", "Draft"] });
    expect(group(view, arrange(view, scenes)).map((g) => [g.key, g.rows.map((r) => r.name)])).toEqual([
      ["idea", []],
      ["Draft", ["Arrival"]],
      ["done", ["House"]],
      ["", ["Envelope"]],
    ]);
  });

  it("puts dated items on a timeline", async () => {
    const { view, rows: characters } = await rows({ type: "timeline", items: "character", date: "born" });
    const { moments, undated } = timeline(view, characters);
    expect(moments.map((m) => [m.label, m.rows[0].name])).toEqual([
      ["1948", "Paolo"],
      ["1950-04-02", "Marta"],
    ]);
    expect(undated).toEqual([]);
    expect([dateKey("-300")! < dateKey("12")!, dateKey("1950-4")! < dateKey("1950-04-02")!, dateKey("later")]).toEqual([true, true, null]);
  });
});

describe("synopsis in views", () => {
  it("is shown unless the view says otherwise", () => {
    expect(parseView("type: cards\n").synopsis).toBe(true);
    const off = parseView("type: cards\nsynopsis: false\n");
    expect(off.synopsis).toBe(false);
    expect(serializeView(off)).toContain("synopsis: false");
    expect(serializeView(parseView("type: cards\n"))).not.toContain("synopsis");
  });
});

describe("chapters as board columns", () => {
  it("lists chapters by their heading, in reading order", async () => {
    const { chapterPaths } = await import("../views");
    const fs = new MemoryFs({
      "dante.yaml": "title: T\nlanguage: en\n",
      "Manuscript/010 Return/010 Arrival.md": "A.",
      "Manuscript/020 Letter/010 Envelope.md": "B.",
    });
    const p = await Project.open(fs);
    expect([...chapterPaths(p.manuscript, p.settings)]).toEqual([
      ["Chapter 1: Return", "Manuscript/010 Return"],
      ["Chapter 2: Letter", "Manuscript/020 Letter"],
    ]);
  });
});

describe("order by hand", () => {
  it("puts listed items first in their order, unless the view sorts", async () => {
    const { view, rows: all } = await rows({ items: "scene", order: ["Manuscript/020 Letter/010 Envelope.md", "Manuscript/010 Return/020 House.md"] });
    expect(arrange(view, all).map((r) => r.name)).toEqual(["Envelope", "House", "Arrival"]);
    expect(arrange({ ...view, sort: "name" }, all).map((r) => r.name)).toEqual(["Arrival", "Envelope", "House"]);
    expect(parseView(serializeView(view)).order).toEqual(view.order);
  });

  it("moves an item before another, or after the last of its group", () => {
    expect(moveBefore(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveBefore(["a", "b", "c", "d"], "a", null, ["b", "c"])).toEqual(["b", "c", "a", "d"]);
    expect(moveBefore(["a", "b"], "a", null)).toEqual(["b", "a"]);
  });

  it("moves an end date with its start", () => {
    expect(shiftEnd("1950-04-02", "1950-04-05", "1950-05-30")).toBe("1950-06-02");
    expect(shiftEnd("1950", "1951", "1960")).toBe("1951");
  });
});
