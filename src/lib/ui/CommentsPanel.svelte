<script lang="ts">
  import { tick } from "svelte";
  import type { EditorView } from "@codemirror/view";
  import {
    acceptEdit,
    commentEdit,
    discussion,
    isChange,
    parseCritic,
    rejectEdit,
    replyEdit,
    resolveEdit,
    today,
    type CriticItem,
    type Edit,
  } from "$lib/core/critic";
  import { noteTitle } from "$lib/core/notes";
  import type { Project } from "$lib/core/project";
  import { CRITIC_EVENT } from "$lib/editor/critic";
  import type { MessageKey } from "$lib/i18n";
  import { app, saveAppSettings, t } from "$lib/state.svelte";
  import { editorFor, editors } from "./editors.svelte";
  import { historyEntry, recordHistory, type HistoryAction } from "$lib/core/history";
  import { historyChanged } from "./history.svelte";

  interface Props {
    project: Project;
    /** The notes or scenes whose comments are listed, in order. */
    paths: string[];
  }
  let p: Props = $props();

  interface Group {
    path: string;
    view: EditorView;
    text: string;
    items: CriticItem[];
  }

  const groups = $derived.by((): Group[] => {
    void editors.rev;
    const out: Group[] = [];
    for (const path of p.paths) {
      const view = editorFor(path);
      if (!view) continue;
      const text = view.state.doc.toString();
      out.push({ path, view, text, items: parseCritic(text) });
    }
    return out;
  });
  const total = $derived(groups.reduce((n, g) => n + g.items.length, 0));
  const changes = $derived(groups.reduce((n, g) => n + g.items.filter(isChange).length, 0));

  let name = $state("");
  let draftText = $state("");
  let replying = $state<{ path: string; from: number } | null>(null);
  let replyText = $state("");

  const draft = $derived(editors.draft && p.paths.includes(editors.draft.path) ? editors.draft : null);
  const signer = () => app.settings.userName.trim();

  function apply(view: EditorView, edits: Edit[]) {
    if (!edits.length) return;
    view.dispatch({ changes: edits, userEvent: CRITIC_EVENT });
    editors.rev++;
  }

  /** The item as it is now in the editor, found again by where it starts. */
  function fresh(group: Group, item: CriticItem): CriticItem | null {
    return parseCritic(group.view.state.doc.toString()).find((i) => i.from === item.from && i.kind === item.kind) ?? null;
  }

  /** Keeps what was settled in the record of the history, in the file of whoever settled it. */
  function record(path: string, text: string, items: CriticItem[], action: HistoryAction) {
    const by = signer() || t("history.someone");
    const entries = items.map((i) => historyEntry(text, i, action, by, path));
    if (entries.length) void recordHistory(p.project.fs, entries).then(() => historyChanged.rev++, () => {});
  }

  function act(group: Group, item: CriticItem, how: (text: string, item: CriticItem) => Edit) {
    const current = fresh(group, item);
    if (!current) return;
    const text = group.view.state.doc.toString();
    record(group.path, text, [current], how === acceptEdit ? "accept" : how === rejectEdit ? "reject" : "resolve");
    apply(group.view, [how(text, current)]);
  }

  function settle(how: "accept" | "reject") {
    const message = t(how === "accept" ? "comments.confirmAcceptAll" : "comments.confirmRejectAll", { count: changes });
    if (!window.confirm(message)) return;
    for (const group of groups) {
      const text = group.view.state.doc.toString();
      const edit = how === "accept" ? acceptEdit : rejectEdit;
      const items = parseCritic(text).filter(isChange);
      record(group.path, text, items, how);
      apply(group.view, items.map((i) => edit(text, i)));
    }
  }

  function saveDraft() {
    const d = draft;
    const view = d ? editorFor(d.path) : null;
    if (!d || !view || !draftText.trim()) return;
    const length = view.state.doc.length;
    const from = Math.min(d.from, length);
    const to = Math.min(d.to, length);
    apply(view, [commentEdit(view.state.doc.toString(), from, to, signer(), today(), draftText)]);
    draftText = "";
    editors.draft = null;
  }

  function sendReply(group: Group, item: CriticItem) {
    const current = fresh(group, item);
    if (current && replyText.trim()) apply(group.view, [replyEdit(current, signer(), today(), replyText)]);
    replyText = "";
    replying = null;
  }

  function show(group: Group, item: CriticItem) {
    const to = item.kind === "comment" ? item.from : (item.newTo ?? item.contentTo);
    group.view.dispatch({ selection: { anchor: item.kind === "comment" ? item.from : item.contentFrom, head: to }, scrollIntoView: true });
    group.view.focus();
  }

  const quote = (text: string, from: number, to: number) => {
    const s = text.slice(from, to).replace(/\s+/g, " ").trim();
    return s.length > 140 ? s.slice(0, 140) + "…" : s;
  };

  const KIND: Record<CriticItem["kind"], MessageKey> = {
    addition: "comments.kind.addition",
    deletion: "comments.kind.deletion",
    substitution: "comments.kind.substitution",
    highlight: "comments.kind.comment",
    comment: "comments.kind.comment",
  };

  function focusOnMount(el: HTMLTextAreaElement) {
    void tick().then(() => el.focus());
  }

  // A clicked bubble brings its thread into view.
  $effect(() => {
    const f = editors.focus;
    if (!f) return;
    void tick().then(() => document.getElementById(`critic-${f.path}-${f.from}`)?.scrollIntoView({ block: "nearest" }));
  });

  function onKey(e: KeyboardEvent, send: () => void, cancel: () => void) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape") cancel();
  }
</script>

<div class="comments">
  {#if !signer()}
    <form
      class="name"
      onsubmit={(e) => {
        e.preventDefault();
        if (name.trim()) saveAppSettings({ ...app.settings, userName: name.trim() });
      }}
    >
      <label>{t("comments.askName")} <input bind:value={name} placeholder={t("settings.userName")} /></label>
      <button type="submit" disabled={!name.trim()}>{t("settings.save")}</button>
    </form>
  {/if}

  <label class="mode" title={t("tip.revisions")}>
    <input
      type="checkbox"
      checked={app.settings.revisions}
      disabled={!signer()}
      onchange={(e) => saveAppSettings({ ...app.settings, revisions: e.currentTarget.checked })}
    />
    {t("comments.revisionMode")}
  </label>

  {#if draft}
    {@const view = editorFor(draft.path)}
    <div class="draft">
      {#if view && draft.to > draft.from}
        <p class="quote">{quote(view.state.doc.toString(), draft.from, draft.to)}</p>
      {/if}
      <textarea
        bind:value={draftText}
        use:focusOnMount
        rows="3"
        placeholder={t("comments.placeholder")}
        disabled={!signer()}
        onkeydown={(e) => onKey(e, saveDraft, () => (editors.draft = null))}
      ></textarea>
      <div class="buttons">
        <button onclick={() => (editors.draft = null)}>{t("welcome.cancel")}</button>
        <button class="primary" disabled={!draftText.trim() || !signer()} onclick={saveDraft}>{t("comments.add")}</button>
      </div>
    </div>
  {/if}

  {#if groups.length === 0}
    <p class="muted">{t("comments.noEditor")}</p>
  {:else if total === 0 && !draft}
    <p class="muted">{t("comments.none")}</p>
  {/if}

  {#if changes > 1}
    <div class="all">
      <button onclick={() => settle("accept")}>{t("comments.acceptAll")}</button>
      <button onclick={() => settle("reject")}>{t("comments.rejectAll")}</button>
    </div>
  {/if}

  {#each groups as group (group.path)}
    {#if group.items.length}
      {#if groups.length > 1}
        <h3>{noteTitle(group.path, p.project.settings.folders.manuscript)}</h3>
      {/if}
      <ul>
        {#each group.items as item (`${item.from}|${item.kind}`)}
          {@const words = discussion(item)}
          {@const locked = group.view.state.readOnly}
          <li id="critic-{group.path}-{item.from}" class:focused={editors.focus?.path === group.path && editors.focus.from === item.from}>
            <div class="head">
              <span class="kind {item.kind}">{t(KIND[item.kind])}</span>
              <span class="who">{[item.author, item.date].filter(Boolean).join(" · ")}</span>
            </div>
            {#if item.kind !== "comment"}
              <button class="text" onclick={() => show(group, item)}>
                {#if item.kind === "substitution"}
                  <del>{quote(group.text, item.contentFrom, item.contentTo)}</del>
                  <ins>{quote(group.text, item.newFrom!, item.newTo!)}</ins>
                {:else if item.kind === "deletion"}
                  <del>{quote(group.text, item.contentFrom, item.contentTo)}</del>
                {:else if item.kind === "addition"}
                  <ins>{quote(group.text, item.contentFrom, item.contentTo)}</ins>
                {:else}
                  <mark>{quote(group.text, item.contentFrom, item.contentTo)}</mark>
                {/if}
              </button>
            {/if}
            {#each words as c (c.from)}
              <button class="said" onclick={() => show(group, item)}>
                {#if c !== words[0] || c.author !== item.author}<b>{c.author ?? "?"}</b>{/if}
                {c.text}
              </button>
            {/each}
            {#if replying?.path === group.path && replying.from === item.from}
              <textarea
                bind:value={replyText}
                use:focusOnMount
                rows="2"
                placeholder={t("comments.replyPlaceholder")}
                onkeydown={(e) => onKey(e, () => sendReply(group, item), () => (replying = null))}
              ></textarea>
              <div class="buttons">
                <button onclick={() => (replying = null)}>{t("welcome.cancel")}</button>
                <button class="primary" disabled={!replyText.trim()} onclick={() => sendReply(group, item)}>{t("comments.reply")}</button>
              </div>
            {:else}
              <div class="buttons">
                {#if isChange(item)}
                  <button disabled={locked} title={t("tip.accept")} onclick={() => act(group, item, acceptEdit)}>✓ {t("comments.accept")}</button>
                  <button disabled={locked} title={t("tip.reject")} onclick={() => act(group, item, rejectEdit)}>✕ {t("comments.reject")}</button>
                {/if}
                <button disabled={locked || !signer()} onclick={() => { replying = { path: group.path, from: item.from }; replyText = ""; }}>{t("comments.reply")}</button>
                {#if !isChange(item) || words.length}
                  <button disabled={locked} title={t("tip.resolve")} onclick={() => act(group, item, resolveEdit)}>{t("comments.resolve")}</button>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/each}
</div>

<style>
  .comments {
    display: grid;
    gap: 10px;
    font-size: 13px;
  }
  .name {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .name label {
    display: grid;
    gap: 4px;
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .draft {
    display: grid;
    gap: 6px;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    resize: vertical;
  }
  .buttons,
  .all {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
  }
  .all {
    justify-content: flex-start;
  }
  .buttons button,
  .all button {
    font-size: 12px;
    padding: 2px 8px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: grid;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
  }
  li.focused {
    border-color: var(--accent);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .kind {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .kind.addition {
    color: var(--critic-add, #1a7f37);
  }
  .kind.deletion,
  .kind.substitution {
    color: var(--critic-del, #c62828);
  }
  .text,
  .said {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    font: inherit;
    color: inherit;
    overflow-wrap: anywhere;
  }
  .quote,
  .text {
    font-family: var(--editor-font);
  }
  .quote {
    margin: 0;
    color: var(--text-muted);
    border-left: 2px solid var(--border);
    padding-left: 6px;
  }
  del {
    color: var(--critic-del, #c62828);
  }
  ins {
    color: var(--critic-add, #1a7f37);
    margin-left: 4px;
  }
  mark {
    background: var(--critic-hl, rgba(255, 196, 0, 0.28));
    color: inherit;
  }
  .muted {
    color: var(--text-muted);
    margin: 0;
  }
</style>
