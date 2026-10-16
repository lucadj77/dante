<script lang="ts">
  import { fold } from "$lib/core/notes";
  import { findLinks, readableLinks } from "$lib/core/wikilinks";
  import type { LinkSuggestion } from "$lib/editor/links";
  import { navigator } from "./navigation";

  interface Props {
    /** The value as text, lists separated by commas. */
    value: string;
    label: string;
    /** The note the property belongs to, for resolving and suggesting links. */
    from: string;
    placeholder?: string;
    /** The value is one link: suggestions come while typing, without "[[". */
    link?: boolean;
    /** Only notes of this type are suggested. */
    noteType?: string;
    onCommit: (text: string) => void;
  }
  let p: Props = $props();
  const nav = navigator();

  let input: HTMLInputElement;
  let text = $state("");
  let open = $state<{ start: number; options: LinkSuggestion[] } | null>(null);
  let active = $state(0);
  /** The text last handed to onCommit, so a blur right after choosing does not send it again. */
  let sent: string | null = null;

  // A link field shows the linked note's name and stores "[[Name]]".
  const showText = (value: string) => (p.link ? readableLinks(value) : value);
  function stored(input: string): string {
    const value = input.trim();
    if (!p.link || !value || value.includes("[[")) return input;
    if (value === readableLinks(p.value)) return p.value;
    return `[[${value}]]`;
  }

  // The field follows the stored value whenever it changes outside.
  $effect(() => {
    text = showText(p.value);
    sent = null;
  });

  const handler = $derived(nav?.links(p.from) ?? null);
  /** Links in the value, shown under the field to be followed. */
  const links = $derived(findLinks(p.value).map((l) => ({ target: l.target, shown: l.alias ?? l.target.split("#")[0] })));

  /** Suggestions while the cursor is right after "[[" and some letters. */
  function suggest() {
    if (!handler) return;
    const cursor = input.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const m = p.link ? /^(?:\[\[)?([^\[\]|]*)$/.exec(before) : /\[\[([^\[\]|]*)$/.exec(before);
    if (!m) {
      open = null;
      return;
    }
    const query = fold(m[1]);
    const all = handler.suggestions().filter((s) => !p.noteType || s.type === p.noteType);
    const label = (s: LinkSuggestion) => fold(s.alias ?? s.target);
    const options = [
      ...all.filter((s) => label(s).startsWith(query)),
      ...all.filter((s) => !label(s).startsWith(query) && label(s).includes(query)),
    ].slice(0, 8);
    open = options.length ? { start: cursor - m[1].length, options } : null;
    active = 0;
  }

  function choose(s: LinkSuggestion) {
    if (!open) return;
    if (p.link) {
      const value = `[[${s.alias ? `${s.target}|${s.alias}` : s.target}]]`;
      text = showText(value);
      open = null;
      sent = value;
      if (value !== p.value) p.onCommit(value);
      return;
    }
    const cursor = input.selectionStart ?? text.length;
    const insert = (s.alias ? `${s.target}|${s.alias}` : s.target) + "]]";
    const rest = text.slice(cursor).replace(/^[^\[\],]*\]\]/, "");
    text = text.slice(0, open.start) + insert + rest;
    const at = open.start + insert.length;
    open = null;
    queueMicrotask(() => {
      input.focus();
      input.setSelectionRange(at, at);
    });
  }

  function key(event: KeyboardEvent) {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const n = open.options.length;
        active = (active + (event.key === "ArrowDown" ? 1 : n - 1)) % n;
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(open.options[active]);
        return;
      }
      if (event.key === "Escape") {
        open = null;
        return;
      }
    }
    if (event.key === "Enter") input.blur();
  }

  function commit() {
    open = null;
    const value = stored(text);
    if (value !== p.value && value !== sent) {
      sent = value;
      p.onCommit(value);
    }
  }
</script>

<div class="field">
  <input
    bind:this={input}
    bind:value={text}
    aria-label={p.label}
    placeholder={p.placeholder}
    title={p.placeholder || undefined}
    oninput={suggest}
    onfocus={() => {
      if (p.link) suggest();
    }}
    onkeydown={key}
    onblur={() => setTimeout(commit, 120)}
  />
  {#if open}
    <ul class="suggestions" role="listbox">
      {#each open.options as s, i (s.target + "|" + (s.alias ?? ""))}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            onmousedown={(e) => {
              e.preventDefault();
              choose(s);
            }}
          >
            <span>{s.alias ?? s.target}</span>
            <span class="detail">{s.alias ? `→ ${s.target}` : (s.detail ?? "")}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if links.length}
    <div class="links">
      {#each links as link, i (i)}
        {@const found = handler?.resolves(link.target)}
        <button type="button" class="link" class:missing={!found} disabled={!found} onclick={(e) => handler?.open(link.target, e.altKey)}>{link.shown}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .field {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  input {
    width: 100%;
  }
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 15;
    margin: 2px 0 0;
    padding: 4px;
    list-style: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  .suggestions button {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 3px 8px;
    border: none;
    text-align: left;
    font-size: 13px;
  }
  .suggestions button[aria-selected="true"] {
    background: var(--bg-active);
  }
  .detail {
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;
  }
  .link {
    border: none;
    padding: 0 4px;
    font-size: 12px;
    color: var(--wikilink);
  }
  .link.missing {
    color: var(--text-muted);
    text-decoration: underline dotted;
    cursor: default;
  }
</style>
