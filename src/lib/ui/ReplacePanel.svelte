<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import { noteTitle } from "$lib/core/notes";
  import type { NoteMatches, Project, Replaced } from "$lib/core/project";
  import type { FindOptions } from "$lib/core/replace";
  import { adapt } from "$lib/core/replace";
  import { dirname } from "$lib/core/path";
  import { num, t } from "$lib/state.svelte";
  import { documents, flushAll } from "./documents.svelte";
  import { showMatch } from "./find.svelte";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    /** Bumped when the project reloads, to search again. */
    version: number;
    /** After a match is opened in the text. */
    onOpened?: () => void;
  }
  let p: Props = $props();
  const nav = navigator();

  type Scope = "all" | "manuscript" | "codex" | "research" | "laboratory";
  // Kept between openings of the panel, like the search.
  let query = $state(last.query);
  let replacement = $state(last.replacement);
  let caseSensitive = $state(last.caseSensitive);
  let wholeWord = $state(last.wholeWord);
  let scope = $state<Scope>(last.scope);
  let results = $state.raw<NoteMatches[]>([]);
  /** Matches left out of the replacement, as "path|from". */
  let skipped = $state<Set<string>>(new Set());
  let busy = $state(false);
  let message = $state("");
  let error = $state("");
  let done = $state.raw<Replaced | null>(null);

  const options = $derived<FindOptions>({ caseSensitive, wholeWord });
  const total = $derived(results.reduce((n, r) => n + r.occurrences.length, 0));
  const chosen = $derived(total - [...skipped].filter((k) => results.some((r) => r.occurrences.some((o) => `${r.path}|${o.from}` === k))).length);
  const manuscript = $derived(p.project.settings.folders.manuscript);

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void p.version;
    const q = query;
    const o = options;
    const s = scope;
    last.query = q;
    last.replacement = replacement;
    last.caseSensitive = o.caseSensitive;
    last.wholeWord = o.wholeWord;
    last.scope = s;
    clearTimeout(timer);
    timer = setTimeout(() => void find(q, o, s), 250);
    return () => clearTimeout(timer);
  });

  async function find(q: string, o: FindOptions, s: Scope) {
    error = "";
    try {
      // What is typed and not saved yet counts too.
      await flushAll(p.project);
      const within = s === "all" ? [] : [p.project.settings.folders[s]];
      const found = await p.project.findAll(q, o, within);
      if (q !== query || s !== scope || o.caseSensitive !== caseSensitive || o.wholeWord !== wholeWord) return;
      results = found;
      skipped = new Set();
    } catch (e) {
      error = failure(e);
    }
  }

  function toggle(key: string) {
    const next = new Set(skipped);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    skipped = next;
  }

  function chooseAll(all: boolean) {
    skipped = all ? new Set() : new Set(results.flatMap((r) => r.occurrences.map((o) => `${r.path}|${o.from}`)));
  }

  function open(path: string, from: number, to: number) {
    showMatch(path, { query, caseSensitive, wholeWord, from, to });
    nav?.open(path);
    p.onOpened?.();
  }

  async function replace() {
    busy = true;
    error = "";
    message = "";
    try {
      await flushAll(p.project);
      const picked = results.map((r) => ({ path: r.path, ranges: r.occurrences.filter((o) => !skipped.has(`${r.path}|${o.from}`)) }));
      const result = await p.project.replaceAll(picked, query, replacement, options, t("replace.snapshot", { query }));
      await documents(p.project).refreshAll();
      await nav?.reload();
      done = result.count ? result : null;
      message =
        result.count === 0
          ? t("replace.doneNone")
          : result.count === 1
            ? t("replace.doneOne")
            : t("replace.doneMany", { count: num(result.count), notes: num(result.notes.length) });
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  async function undo() {
    if (!done) return;
    busy = true;
    error = "";
    try {
      await flushAll(p.project);
      const notUndone = await p.project.undoReplace(done);
      await documents(p.project).refreshAll();
      await nav?.reload();
      message = notUndone.length ? t("replace.undoSkipped", { names: notUndone.map((n) => noteTitle(n, manuscript)).join(", ") }) : t("replace.undone");
      done = null;
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  function focusOnMount(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  function summary(): string {
    const notes = results.length;
    if (total === 1) return t("replace.foundOne");
    if (notes === 1) return t("replace.foundOneNote", { count: num(total) });
    return t("replace.foundMany", { count: num(total), notes: num(notes) });
  }
</script>

<script lang="ts" module>
  const last = { query: "", replacement: "", caseSensitive: false, wholeWord: true, scope: "all" as "all" | "manuscript" | "codex" | "research" | "laboratory" };
</script>

<section class="replace">
  <label>{t("replace.find")} <input type="search" bind:value={query} use:focusOnMount /></label>
  <label>{t("replace.with")} <input bind:value={replacement} /></label>
  <div class="options">
    <label class="check"><input type="checkbox" bind:checked={caseSensitive} /> {t("replace.matchCase")}</label>
    <label class="check"><input type="checkbox" bind:checked={wholeWord} /> {t("replace.wholeWord")}</label>
  </div>
  <select bind:value={scope} aria-label={t("replace.where")}>
    <option value="all">{t("search.everywhere")}</option>
    <option value="manuscript">{t("section.manuscript")}</option>
    <option value="codex">{t("section.codex")}</option>
    <option value="research">{t("section.research")}</option>
    <option value="laboratory">{t("section.laboratory")}</option>
  </select>
  <p class="hint">{t("replace.hint")}</p>

  {#if message}
    <p class="message" role="status">
      {message}
      {#if done}<button class="link" disabled={busy} onclick={undo}>{t("replace.undo")}</button>{/if}
    </p>
  {/if}
  {#if error}<p class="error"><ErrorText text={error} /></p>{/if}

  {#if query && results.length === 0}
    <p class="muted">{t("replace.none")}</p>
  {:else if results.length}
    <div class="bar">
      <span>{summary()}</span>
      <span class="choose">
        <button class="link" onclick={() => chooseAll(true)}>{t("replace.chooseAll")}</button>
        <button class="link" onclick={() => chooseAll(false)}>{t("replace.chooseNone")}</button>
      </span>
    </div>
    <button class="primary run" disabled={busy || chosen === 0} onclick={replace}>{busy ? t("replace.running") : t("replace.run", { n: num(chosen) })}</button>
    <ul>
      {#each results as r (r.path)}
        <li>
          <div class="note" title={r.path}>
            <span class="title">{noteTitle(r.path, manuscript)}</span>
            <span class="where">{dirname(r.path)}</span>
          </div>
          {#each r.occurrences as o (o.from)}
            {@const key = `${r.path}|${o.from}`}
            <div class="match">
              <input type="checkbox" checked={!skipped.has(key)} onchange={() => toggle(key)} aria-label={o.before + o.match + o.after} />
              <button class="line" title={t("replace.show")} onclick={() => open(r.path, o.from, o.to)}>
                {o.before}<del>{o.match}</del>{#if !skipped.has(key)}<ins>{adapt(o.match, replacement, options)}</ins>{/if}{o.after}
              </button>
            </div>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .replace {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  label {
    display: grid;
    gap: 3px;
    font-size: 12px;
    color: var(--text-muted);
  }
  label input {
    font-size: 14px;
    color: var(--text);
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text);
    font-size: 13px;
  }
  select {
    width: 100%;
  }
  .hint,
  .muted {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .message {
    margin: 0;
    font-size: 13px;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 13px;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }
  .choose {
    display: flex;
    gap: 10px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
  }
  .run {
    align-self: flex-start;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border-top: 1px solid var(--border);
    padding: 6px 0;
  }
  .note {
    display: grid;
    gap: 1px;
    margin-bottom: 2px;
  }
  .title {
    font-weight: 500;
  }
  .where {
    font-size: 11px;
    color: var(--text-muted);
  }
  .match {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .line {
    flex: 1;
    border: none;
    background: none;
    padding: 2px 4px;
    border-radius: 4px;
    text-align: left;
    font-size: 13px;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .line:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }
  del {
    color: var(--danger);
  }
  ins {
    color: var(--accent);
    text-decoration: underline;
  }
</style>
