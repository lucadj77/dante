<script lang="ts">
  // The "Libro game" section: every paragraph in a table that can be sorted and filtered,
  // the checks of the whole book (the warnings and the game state) and the register of the
  // values written in the boxes' properties.
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Project } from "$lib/core/project";
  import { gamebookMarks, gamebookOf, type ParagraphMark } from "$lib/core/gamebook/marks";
  import type { GamebookIndex, Paragraph, Warning } from "$lib/core/gamebook/paragraphs";
  import { gameState, register, stateProperties, type Register, type StateIssue } from "$lib/core/gamebook/check";
  import { num, t } from "$lib/state.svelte";
  import type { MessageKey } from "$lib/i18n";
  import { navigator } from "./navigation";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    /** The tab on screen, kept by the workspace so that the status bar can open the checks. */
    tab: "table" | "checks" | "register";
  }
  let { tab = $bindable(), ...p }: Props = $props();
  const nav = navigator();

  let book = $state.raw<GamebookIndex | null>(null);
  let marks = $state.raw<Map<string, ParagraphMark>>(new Map());
  let error = $state("");
  let scope = $state("");

  $effect(() => {
    void p.rev;
    void p.diskRev;
    void (async () => {
      try {
        const index = await p.project.index();
        const g = gamebookOf(index, p.project.settings);
        book = g;
        marks = g ? gamebookMarks(g, p.project.settings).marks : new Map();
        const scopes = g?.scopes() ?? [];
        if (!scopes.includes(scope)) scope = scopes[0] ?? "";
      } catch (e) {
        error = failure(e);
      }
    })();
  });

  const start = $derived(p.project.settings.gamebook.start);
  const paragraphs = $derived(book ? book.inScope(scope) : []);
  const properties = $derived(stateProperties(p.project.settings.gamebook.boxes));
  const issues = $derived<StateIssue[]>(book ? gameState(book, scope, start, properties) : []);
  const registers = $derived<Register[]>(properties.map((x) => register(paragraphs, x)));
  const byPath = $derived(new Map(paragraphs.map((x) => [x.path, x])));


  // The table.
  type Column = "number" | "title" | "type" | "length" | "incoming" | "outgoing" | "warnings";
  let sortBy = $state<Column>("number");
  let ascending = $state(true);
  let query = $state("");
  type Filter = "all" | "warnings" | "empty" | "ending" | "fixed" | "relative" | Warning;
  let filter = $state<Filter>("all");
  const WARNINGS: Warning[] = ["orphan", "deadEnd", "unreachable", "duplicate", "broken", "bareLink", "staleLabel", "endingBox"];

  function value(x: Paragraph, m: ParagraphMark | undefined, c: Column): number | string {
    if (c === "number") return x.number;
    if (c === "title") return x.title.toLocaleLowerCase();
    if (c === "type") return `${x.numberType}${x.ending ? "~" : ""}`;
    if (c === "length") return x.length;
    if (c === "incoming") return m?.incoming.length ?? 0;
    if (c === "outgoing") return m?.outgoing.length ?? 0;
    return m?.warnings.length ?? 0;
  }

  const rows = $derived.by(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = paragraphs.filter((x) => {
      const m = marks.get(x.path);
      if (q && !x.title.toLocaleLowerCase().includes(q) && String(x.number) !== q && !x.note.toLocaleLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "warnings") return (m?.warnings.length ?? 0) > 0;
      if (filter === "empty") return x.empty;
      if (filter === "ending") return x.ending;
      if (filter === "fixed") return x.numberType === "fixed";
      if (filter === "relative") return x.numberType === "relative";
      return m?.warnings.includes(filter) ?? false;
    });
    const sign = ascending ? 1 : -1;
    return list.sort((a, b) => {
      const va = value(a, marks.get(a.path), sortBy);
      const vb = value(b, marks.get(b.path), sortBy);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "it");
      return sign * c || a.number - b.number;
    });
  });

  function sort(c: Column) {
    if (sortBy === c) ascending = !ascending;
    else {
      sortBy = c;
      ascending = c === "number" || c === "title" || c === "type";
    }
  }

  const COLUMNS: { id: Column; key: MessageKey; numeric?: boolean }[] = [
    { id: "number", key: "gamebookView.col.number", numeric: true },
    { id: "title", key: "gamebookView.col.title" },
    { id: "type", key: "gamebookView.col.type" },
    { id: "length", key: "gamebookView.col.length", numeric: true },
    { id: "incoming", key: "gamebookView.col.incoming", numeric: true },
    { id: "outgoing", key: "gamebookView.col.outgoing", numeric: true },
    { id: "warnings", key: "gamebookView.col.warnings" },
  ];

  const warned = $derived(WARNINGS.map((w) => ({ w, list: paragraphs.filter((x) => marks.get(x.path)?.warnings.includes(w)) })).filter((x) => x.list.length));
  const problems = $derived(warned.reduce((n, x) => n + x.list.length, 0) + issues.filter((s) => s.kind !== "neverAsked").length);
  const unit = $derived(p.project.settings.pages.unit);

  function open(path: string) {
    nav?.open(path);
  }

  function typeLabel(x: Paragraph): string {
    if (x.numberType === "fixed") return t("gamebookView.fixed");
    if (x.numberType === "relative") return x.anchor ? `↳ ${x.anchor}${x.offset ? ` ${x.offset > 0 ? "+" : ""}${x.offset}` : ""}` : t("gamebookView.relative");
    return "";
  }
</script>

<div class="gamebook-view">
  {#if error}<p class="error" role="alert"><ErrorText text={error} /></p>{/if}
  {#if !book}
    <p class="muted">{p.project.settings.gamebook.enabled ? "…" : t("gamebookView.off")}</p>
  {:else}
    <div class="top">
      <div class="segmented" role="tablist" aria-label={t("gamebook.title")}>
        <button role="tab" aria-selected={tab === "table"} onclick={() => (tab = "table")}>{t("gamebookView.table", { n: num(paragraphs.length) })}</button>
        <button role="tab" aria-selected={tab === "checks"} onclick={() => (tab = "checks")}>{t("gamebookView.checks", { n: num(problems) })}</button>
        <button role="tab" aria-selected={tab === "register"} onclick={() => (tab = "register")}>{t("gamebookView.register")}</button>
      </div>
      {#if book.scopes().length > 1}
        <label class="scope">
          {t("gamebookView.folder")}
          <select bind:value={scope}>
            {#each book.scopes() as s (s)}<option value={s}>{s || "/"}</option>{/each}
          </select>
        </label>
      {/if}
    </div>

    {#if tab === "table"}
      <div class="filters">
        <input type="search" placeholder={t("gamebookView.search")} bind:value={query} aria-label={t("gamebookView.search")} />
        <select bind:value={filter} aria-label={t("gamebookView.filter")}>
          <option value="all">{t("gamebookView.filter.all")}</option>
          <option value="warnings">{t("gamebookView.filter.warnings")}</option>
          <option value="empty">{t("gamebookView.filter.empty")}</option>
          <option value="ending">{t("gamebookView.filter.ending")}</option>
          <option value="fixed">{t("gamebookView.filter.fixed")}</option>
          <option value="relative">{t("gamebookView.filter.relative")}</option>
          <optgroup label={t("gamebookView.filter.byWarning")}>
            {#each WARNINGS as w (w)}<option value={w}>{t(`gamebookView.warning.${w}` as MessageKey)}</option>{/each}
          </optgroup>
        </select>
        <span class="muted">{t("gamebookView.shown", { n: num(rows.length), total: num(paragraphs.length) })}</span>
      </div>
      <div class="table">
        <table>
          <thead>
            <tr>
              {#each COLUMNS as c (c.id)}
                <th class:numeric={c.numeric} aria-sort={sortBy === c.id ? (ascending ? "ascending" : "descending") : "none"}>
                  <button onclick={() => sort(c.id)}>{t(c.key)}{sortBy === c.id ? (ascending ? " ▲" : " ▼") : ""}</button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as x (x.path)}
              {@const m = marks.get(x.path)}
              <tr>
                <td class="numeric">{x.number}</td>
                <td>
                  <button class="link" onclick={() => open(x.path)}>{x.title}</button>
                  {#if x.note && x.note !== x.title}<span class="muted note">{x.note}</span>{/if}
                </td>
                <td class="kind">
                  {#if x.ending}<span class="tag ending">{t("gamebook.ending")}</span>{/if}
                  {#if x.empty}<span class="tag empty">{t("gamebook.empty")}</span>{/if}
                  {#if typeLabel(x)}<span class="tag">{typeLabel(x)}</span>{/if}
                </td>
                <td class="numeric" class:short={m?.band === "short"} class:long={m?.band === "long"}>{num(x.length)}</td>
                <td class="numeric">
                  {#if m?.incoming.length}
                    <span class="refs">{#each m.incoming as r, i (i)}<button class="link" onclick={() => open(r.path)} class:hidden-ref={r.hidden}>{r.number}</button>{/each}</span>
                  {:else}<span class="muted">0</span>{/if}
                </td>
                <td class="numeric">
                  {#if m?.outgoing.length}
                    <span class="refs">{#each m.outgoing as r, i (i)}{#if r.path}<button class="link" onclick={() => open(r.path)} class:hidden-ref={r.hidden}>{r.label}</button>{:else}<span class="broken">{r.label}</span>{/if}{/each}</span>
                  {:else}<span class="muted">0</span>{/if}
                </td>
                <td class="warn">
                  {#each m?.warnings ?? [] as w (w)}<span class="tag bad" data-tip={t(`gamebook.warning.${w}` as MessageKey)}>{t(`gamebookView.warning.${w}` as MessageKey)}</span>{/each}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="muted small">{t(unit === "characters" ? "gamebookView.lengthCharacters" : "gamebookView.lengthWords")} {t("gamebookView.hiddenHint")}</p>
    {:else if tab === "checks"}
      <div class="checks">
        {#if !warned.length && !issues.length}<p class="muted">{t("gamebookView.allGood")}</p>{/if}
        {#each warned as { w, list } (w)}
          <section>
            <h2>{t(`gamebookView.warning.${w}` as MessageKey)} ({num(list.length)})</h2>
            <p class="muted small">{t(`gamebook.warning.${w}` as MessageKey)}</p>
            <ul class="list">
              {#each list as x (x.path)}<li><button class="link" onclick={() => open(x.path)}>{x.number} · {x.title}</button></li>{/each}
            </ul>
          </section>
        {/each}
        <section>
          <h2>{t("gamebookView.state")}</h2>
          <p class="muted small">{t("gamebookView.stateHint", { properties: properties.map((x) => t("gamebookView.quoted", { x })).join(", ") })}</p>
          {#each ["neverGiven", "unobtainable", "neverAsked"] as const as kind (kind)}
            {@const list = issues.filter((s) => s.kind === kind)}
            {#if list.length}
              <h3>{t(`gamebookView.state.${kind}` as MessageKey)} ({num(list.length)})</h3>
              <p class="muted small">{t(`gamebookView.state.${kind}Hint` as MessageKey)}</p>
              <ul class="list">
                {#each list as s, i (i)}
                  {@const x = byPath.get(s.path)}
                  <li>
                    <span class="value">{s.value}</span> <span class="muted">({s.property || t("gamebookView.inText")})</span> ·
                    <button class="link" onclick={() => open(s.path)}>{x?.number} · {x?.title}</button>
                  </li>
                {/each}
              </ul>
            {/if}
          {/each}
          {#if !issues.length}<p class="muted small">{t("gamebookView.stateGood")}</p>{/if}
        </section>
      </div>
    {:else}
      <div class="checks">
        {#if !registers.length}<p class="muted">{t("gamebookView.noProperties")}</p>{/if}
        {#each registers as r (r.property)}
          <section>
            <h2>{r.property} ({num(r.entries.length)})</h2>
            {#if r.duplicates.length}
              <div class="duplicates">
                <strong>{t("gamebookView.duplicates")}</strong>
                <ul>
                  {#each r.duplicates as d, i (i)}<li>{t("gamebookView.quoted", { x: d.a })} / {t("gamebookView.quoted", { x: d.b })}</li>{/each}
                </ul>
              </div>
            {/if}
            {#if !r.entries.length}<p class="muted small">{t("gamebookView.noValues")}</p>{/if}
            <ul class="list">
              {#each r.entries as e (e.value)}
                <li>
                  <details>
                    <summary><span class="value">{e.value}</span> <span class="muted">({num(e.paragraphs.length)})</span></summary>
                    <span class="refs">
                      {#each e.paragraphs as x (x.path)}<button class="link" onclick={() => open(x.path)}>{x.number} · {x.title}</button>{/each}
                    </span>
                  </details>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .gamebook-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 24px;
    overflow: hidden;
    font-size: 13px;
  }
  .top,
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .segmented button {
    border: none;
    border-right: 1px solid var(--border);
    background: var(--bg);
    color: inherit;
    padding: 4px 12px;
    font: inherit;
    cursor: pointer;
  }
  .segmented button:last-child {
    border-right: none;
  }
  .segmented button[aria-selected="true"] {
    background: var(--bg-panel);
    font-weight: 600;
  }
  .scope {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .filters input {
    min-width: 200px;
  }
  .table {
    flex: 1;
    min-height: 0;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-panel);
    text-align: left;
    font-size: 11px;
    color: var(--text-muted);
    padding: 0;
  }
  th button {
    width: 100%;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-align: inherit;
    padding: 5px 8px;
    cursor: pointer;
    white-space: nowrap;
  }
  td {
    padding: 3px 8px;
    border-top: 1px solid var(--border);
    vertical-align: top;
  }
  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td.short {
    color: #3b82c4;
  }
  td.long {
    color: var(--danger);
  }
  .note {
    margin-left: 6px;
    font-size: 12px;
  }
  .refs {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px 6px;
    justify-content: flex-end;
  }
  .checks .refs {
    justify-content: flex-start;
    margin: 4px 0 4px 16px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--wikilink);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  .hidden-ref {
    font-style: italic;
    opacity: 0.75;
  }
  .broken {
    color: var(--danger);
    text-decoration: line-through;
  }
  .tag {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 6px;
    border-radius: 8px;
    border: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .tag.ending {
    color: #7a6a8f;
  }
  .tag.bad {
    color: var(--danger);
    border-color: var(--danger);
  }
  .checks {
    overflow: auto;
    display: grid;
    gap: 18px;
    align-content: start;
    max-width: 900px;
    padding-bottom: 32px;
  }
  section {
    display: grid;
    gap: 4px;
  }
  h2 {
    font-size: 15px;
    margin: 0;
  }
  h3 {
    font-size: 13px;
    margin: 8px 0 0;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 3px;
  }
  .value {
    font-weight: 600;
  }
  .duplicates {
    border: 1px solid var(--border);
    border-left: 3px solid #d9822b;
    border-radius: 6px;
    padding: 6px 10px;
  }
  .duplicates ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  summary {
    cursor: pointer;
  }
  .muted {
    color: var(--text-muted);
  }
  .small {
    font-size: 12px;
    margin: 0;
  }
  .error {
    color: var(--danger);
  }
</style>
