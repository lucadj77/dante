// A small XML reader for the parts of Word documents: elements, attributes and text.
// No DTDs or namespaces resolution: names keep their prefix, as in "w:p".

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

const ATTR = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

export function parseXml(source: string): XmlElement {
  const root: XmlElement = { name: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let pos = 0;
  while (pos < source.length) {
    const lt = source.indexOf("<", pos);
    if (lt < 0) break;
    if (lt > pos) stack[stack.length - 1].children.push(decode(source.slice(pos, lt)));
    if (source.startsWith("<!--", lt)) {
      const close = source.indexOf("-->", lt);
      pos = close < 0 ? source.length : close + 3;
    } else if (source.startsWith("<![CDATA[", lt)) {
      const close = source.indexOf("]]>", lt);
      stack[stack.length - 1].children.push(source.slice(lt + 9, close < 0 ? source.length : close));
      pos = close < 0 ? source.length : close + 3;
    } else if (source[lt + 1] === "?" || source[lt + 1] === "!") {
      const close = source.indexOf(">", lt);
      pos = close < 0 ? source.length : close + 1;
    } else if (source[lt + 1] === "/") {
      const close = source.indexOf(">", lt);
      const name = source.slice(lt + 2, close).trim();
      // Closes up to the matching element, tolerating stray tags.
      const at = stack.map((e) => e.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
      pos = close < 0 ? source.length : close + 1;
    } else {
      // Attribute values may hold ">", so the tag ends at the first ">" outside quotes.
      let i = lt + 1;
      let quote = "";
      while (i < source.length) {
        const c = source[i];
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        i++;
      }
      const selfClosing = source[i - 1] === "/";
      const inner = source.slice(lt + 1, selfClosing ? i - 1 : i);
      const space = inner.search(/\s/);
      const name = space < 0 ? inner : inner.slice(0, space);
      const attrs: Record<string, string> = {};
      if (space >= 0) {
        for (const m of inner.slice(space).matchAll(ATTR)) attrs[m[1]] = decode(m[3] ?? m[4] ?? "");
      }
      const element: XmlElement = { name, attrs, children: [] };
      stack[stack.length - 1].children.push(element);
      if (!selfClosing) stack.push(element);
      pos = i + 1;
    }
  }
  return root;
}

export function isElement(node: XmlNode): node is XmlElement {
  return typeof node !== "string";
}

/** Child elements with the given name. */
export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((c): c is XmlElement => isElement(c) && c.name === name);
}

export function child(element: XmlElement | undefined, name: string): XmlElement | undefined {
  return element?.children.find((c): c is XmlElement => isElement(c) && c.name === name);
}

/** Every descendant element with the given name, in document order. */
export function descendants(element: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  const visit = (e: XmlElement) => {
    for (const c of e.children) {
      if (!isElement(c)) continue;
      if (c.name === name) out.push(c);
      visit(c);
    }
  };
  visit(element);
  return out;
}

/** The text of the element and its descendants. */
export function textOf(element: XmlElement): string {
  return element.children.map((c) => (isElement(c) ? textOf(c) : c)).join("");
}
