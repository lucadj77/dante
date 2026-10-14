<script lang="ts">
  import type { Properties } from "$lib/core/frontmatter";
  import { findNode } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { readingMinutes, textStats } from "$lib/core/stats";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import SnapshotsPanel from "./SnapshotsPanel.svelte";

  interface Props {
    project: Project;
    path: string | null;
    rev: number;
    localRev: number;
    /** Text of every scene in the editor, for the totals of the current view. */
    sceneTexts: string[];
    activeText: string | null;
    onChanged: () => Promise<void>;
    beforeRead: (path: string) => Promise<void>;
    onRestored: () => void;
    onRename: (path: string, title: string) => void;
  }
  let p: Props = $props();

  let properties = $state<Properties>({});
  let newName = $state("");
  let error = $state("");

  const node = $derived.by(() => {
    void p.rev;
    void p.localRev;
    return p.path ? findNode(p.project.manuscript, p.path) : null;
  });

  $effect(() => {
    void p.rev;
    void p.localRev;
    const target = node;
    if (!target || target.kind === "manuscript") {
      properties = {};
      return;
    }
    p.project.properties(target.path).then((value) => {
      if (node === target) properties = value;
    }, () => (properties = {}));
  });

  // `kind` lives in folder notes and is managed by the app.
  const entries = $derived(Object.entries(properties).filter(([key]) => !(node?.kind !== "scene" && key === "kind")));

  /** Lists are edited as comma-separated text. */
  function display(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join(", ");
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function parse(text: string, previous: unknown): unknown {
    if (Array.isArray(previous)) return text.split(",").map((s) => s.trim()).filter(Boolean);
    if (typeof previous === "number" && text.trim() !== "" && !Number.isNaN(Number(text))) return Number(text);
    if (typeof previous === "boolean") return text.trim() === "true";
    return text;
  }

  async function update(changes: Properties) {
    if (!node) return;
    error = "";
    try {
      await p.project.setProperties(node.path, changes);
      await p.onChanged();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  function commit(key: string, text: string) {
    const value = parse(text, properties[key]);
    if (display(value) !== display(properties[key])) void update({ [key]: value });
  }

  function add() {
    const key = newName.trim();
    if (!key || key in properties) return;
    newName = "";
    void update({ [key]: "" });
  }

  function sum(texts: string[]) {
    return texts.map(textStats).reduce(
      (a, b) => ({ words: a.words + b.words, characters: a.characters + b.characters, charactersNoSpaces: a.charactersNoSpaces + b.charactersNoSpaces }),
      { words: 0, characters: 0, charactersNoSpaces: 0 },
    );
  }
  const sceneStats = $derived(p.activeText !== null ? textStats(p.activeText) : null);
  const viewStats = $derived(sum(p.sceneTexts));
  const format = (n: number) => n.toLocaleString();
</script>

<aside class="panel">
  <section>
    <h3>{t("panel.properties")}</h3>
    {#if node && node.kind !== "manuscript"}
      <p class="what">{t(`kind.${node.kind}` as MessageKey)}</p>
      <label class="title-field">
        <span>{t("panel.title")}</span>
        {#key node.path}
          <input
            value={node.title}
            onchange={(e) => {
              const value = (e.currentTarget as HTMLInputElement).value;
              if (value.trim() && value !== node.title) p.onRename(node.path, value);
            }}
            onkeydown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
          />
        {/key}
      </label>
      {#if entries.length === 0}
        <p class="muted">{t("panel.noProperties")}</p>
      {/if}
      <dl>
        {#each entries as [key, value] (key)}
          <div class="prop">
            <dt>{key}</dt>
            <dd>
              <input
                value={display(value)}
                aria-label={key}
                onchange={(e) => commit(key, (e.currentTarget as HTMLInputElement).value)}
              />
              <button class="remove" aria-label={t("panel.remove", { name: key })} onclick={() => update({ [key]: undefined })}>×</button>
            </dd>
          </div>
        {/each}
      </dl>
      <form
        class="add"
        onsubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input bind:value={newName} placeholder={t("panel.propertyName")} aria-label={t("panel.propertyName")} />
        <button type="submit">{t("panel.addProperty")}</button>
      </form>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
  </section>

  {#if node && node.kind === "scene"}
    <SnapshotsPanel project={p.project} path={node.path} beforeRead={p.beforeRead} onRestored={p.onRestored} />
  {/if}

  <section>
    <h3>{t("panel.statistics")}</h3>
    <table>
      <thead>
        <tr><th></th><th>{t("kind.scene")}</th><th>{t("panel.view")}</th></tr>
      </thead>
      <tbody>
        <tr>
          <th>{t("stats.words")}</th>
          <td>{sceneStats ? format(sceneStats.words) : "–"}</td>
          <td>{format(viewStats.words)}</td>
        </tr>
        <tr>
          <th>{t("stats.characters")}</th>
          <td>{sceneStats ? format(sceneStats.characters) : "–"}</td>
          <td>{format(viewStats.characters)}</td>
        </tr>
        <tr>
          <th>{t("stats.charactersNoSpaces")}</th>
          <td>{sceneStats ? format(sceneStats.charactersNoSpaces) : "–"}</td>
          <td>{format(viewStats.charactersNoSpaces)}</td>
        </tr>
        <tr>
          <th>{t("stats.readingTime")}</th>
          <td>{sceneStats ? t("stats.minutes", { n: readingMinutes(sceneStats.words) }) : "–"}</td>
          <td>{t("stats.minutes", { n: readingMinutes(viewStats.words) })}</td>
        </tr>
      </tbody>
    </table>
  </section>
</aside>

<style>
  .title-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .title-field input {
    font-size: 14px;
  }
  .panel {
    border-left: 1px solid var(--border);
    background: var(--bg-panel);
    overflow: auto;
    padding: 12px;
  }
  .panel > :global(section + section) {
    margin-top: 24px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  .what {
    margin: 0 0 8px;
    font-weight: 500;
  }
  .muted {
    color: var(--text-muted);
  }
  dl {
    margin: 0;
  }
  .prop {
    margin-bottom: 8px;
  }
  dt {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  dd {
    margin: 0;
    display: flex;
    gap: 4px;
  }
  dd input {
    flex: 1;
    min-width: 0;
  }
  .remove {
    border: none;
    padding: 0 6px;
    color: var(--text-muted);
  }
  .add {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .add input {
    flex: 1;
    min-width: 0;
  }
  .add button {
    font-size: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    text-align: right;
    padding: 3px 0;
    font-variant-numeric: tabular-nums;
  }
  tbody th {
    text-align: left;
    font-weight: 400;
    color: var(--text-muted);
  }
  thead th {
    font-weight: 500;
    font-size: 12px;
  }
  .error {
    color: var(--danger);
  }
</style>
