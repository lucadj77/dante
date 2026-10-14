export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/**
 * Word-level difference between two texts, for comparing a scene with a snapshot.
 * Whitespace stays attached to the word before it, so joining the parts of one side
 * gives back that side's text.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.match(/\S+\s*|\s+/g) ?? [];
  const b = after.match(/\S+\s*|\s+/g) ?? [];
  // Common prefix and suffix first: most edits touch a small part of a scene.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  // Longest common subsequence on the middle.
  const rows = midA.length + 1;
  const cols = midB.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = midA.length - 1; i >= 0; i--) {
    for (let j = midB.length - 1; j >= 0; j--) {
      table[i * cols + j] = midA[i] === midB[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  for (const w of a.slice(0, start)) push("same", w);
  let i = 0;
  let j = 0;
  while (i < midA.length && j < midB.length) {
    if (midA[i] === midB[j]) {
      push("same", midA[i]);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      push("removed", midA[i++]);
    } else {
      push("added", midB[j++]);
    }
  }
  while (i < midA.length) push("removed", midA[i++]);
  while (j < midB.length) push("added", midB[j++]);
  for (const w of a.slice(endA)) push("same", w);
  return parts;
}
