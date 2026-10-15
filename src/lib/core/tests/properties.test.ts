import { describe, expect, it } from "vitest";
import { coerce, emptyValue, parsePropertyDefs, problem, propertyDef, withDef } from "../properties";
import { parseSettings, serializeSettings } from "../settings";

describe("property definitions", () => {
  it("reads definitions, short and long", () => {
    const defs = parsePropertyDefs({ date: "date", status: { kind: "text", values: ["idea", "draft", "idea", 3] }, pov: { kind: "link", note_type: "character" }, odd: { kind: "colour" } });
    expect(defs.date).toEqual({ kind: "date", values: [], note_type: "" });
    expect(defs.status.values).toEqual(["idea", "draft", "3"]);
    expect(defs.pov.note_type).toBe("character");
    expect(defs.odd.kind).toBe("text");
  });

  it("finds a definition whatever the case, and replaces it under its written name", () => {
    const defs = parsePropertyDefs({ Place: "link" });
    expect(propertyDef(defs, "place")?.kind).toBe("link");
    expect(Object.keys(withDef(defs, "place", { kind: "text", values: [], note_type: "" }))).toEqual(["Place"]);
    expect(withDef(defs, "PLACE", null)).toEqual({});
  });

  it("reads values into their kind", () => {
    const def = (kind: "number" | "checkbox" | "list" | "text") => ({ kind, values: [], note_type: "" });
    expect(coerce("3,5", def("number"))).toBe(3.5);
    expect(coerce("many", def("number"))).toBe("many");
    expect(coerce("sì", def("checkbox"))).toBe(true);
    expect(coerce("a, b,", def("list"))).toEqual(["a", "b"]);
    expect(coerce(["a", "b"], def("text"))).toBe("a, b");
    expect(emptyValue(def("list"))).toEqual([]);
  });

  it("tells values that do not fit", () => {
    const status = { kind: "text" as const, values: ["idea", "draft"], note_type: "" };
    expect(problem("Draft", status)).toBeNull();
    expect(problem("done", status)).toBe("value");
    expect(problem("", status)).toBeNull();
    expect(problem("1987-03", { kind: "date", values: [], note_type: "" })).toBe("kind");
    expect(problem(["x"], { kind: "list", values: ["a"], note_type: "" })).toBe("value");
  });

  it("keeps definitions in dante.yaml", () => {
    const settings = parseSettings("title: T\nproperties:\n  status:\n    kind: text\n    values: [idea, draft]\n");
    settings.properties = withDef(settings.properties, "age", { kind: "number", values: ["ignored"], note_type: "" });
    const text = serializeSettings(settings, "title: T\nproperties:\n  status:\n    kind: text\n    values: [idea, draft]\n");
    const again = parseSettings(text);
    expect(again.properties.status.values).toEqual(["idea", "draft"]);
    expect(again.properties.age).toEqual({ kind: "number", values: [], note_type: "" });
    // A project written before definitions existed has none.
    expect(parseSettings("title: T\n").properties).toEqual({});
  });
});
