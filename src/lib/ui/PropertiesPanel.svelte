<script lang="ts">
  import type { Properties } from "$lib/core/frontmatter";
  import { findNode, folderNotePath, NUMBERED, type ContainerKind } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import { readingMinutes, textStats } from "$lib/core/stats";
  import { writing } from "./sessions.svelte";
  import type { MessageKey } from "$lib/i18n";
  import { t } from "$lib/state.svelte";
  import SnapshotsPanel from "./SnapshotsPanel.svelte";
  import PropertyInput from "./PropertyInput.svelte";
  import { displayValue, isList, parseValue } from "./propertyText";

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

  // `kind` and `numbered` live in folder notes and are set with the controls above the list.
  const entries = $derived(Object.entries(properties).filter(([key]) => !(node?.kind !== "scene" && (key === "kind" || key === NUMBERED))));
  const isContainer = $derived(!!node && node.kind !== "scene" && node.kind !== "manuscript");
  const kinds = $derived<ContainerKind[]>(p.project.settings.structure.parts ? ["part", "chapter", "prologue", "epilogue"] : ["chapter", "prologue", "epilogue"]);

  /** The file that holds the properties: the scene, or a container's folder note. */
  function propertiesPath(path: string): string {
    return node && node.kind !== "scene" ? folderNotePath(path) : path;
  }

  const display = displayValue;
  const parse = parseValue;

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
    const value = parse(text, properties[key], key);
    if (display(value) !== display(properties[key])) void update({ [key]: value });
  }

  function add() {
    const key = newName.trim();
    if (!key || key in properties) return;
    newName = "";
    void update({ [key]: isList(key, undefined) ? [] : "" });
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

<div class="panel">
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
      {#if isContainer && node}
        <label class="title-field">
          <span>{t("panel.kind")}</span>
          <select value={node.kind} onchange={(e) => update({ kind: (e.currentTarget as HTMLSelectElement).value })}>
            {#each kinds as kind (kind)}
              <option value={kind}>{t(`kind.${kind}` as MessageKey)}</option>
            {/each}
          </select>
        </label>
        {#if node.kind === "chapter" || node.kind === "part"}
          <label class="check">
            <input type="checkbox" checked={!!node.unnumbered} onchange={(e) => update({ [NUMBERED]: (e.currentTarget as HTMLInputElement).checked ? false : undefined })} />
            {t("panel.unnumbered")}
          </label>
        {/if}
        <p class="muted">{t("panel.kindHint")}</p>
      {/if}
      {#if entries.length === 0}
        <p class="muted">{t("panel.noProperties")}</p>
      {/if}
      <dl>
        {#each entries as [key, value] (key)}
          <div class="prop">
            <dt>{key}</dt>
            <dd>
              <PropertyInput
                value={display(value)}
                label={key}
                from={propertiesPath(node.path)}
                placeholder={isList(key, value) ? t("panel.listHint") : ""}
                onCommit={(text) => commit(key, text)}
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
    <p class="today">
      {p.project.settings.goals.daily > 0
        ? t("panel.todayGoal", { words: format(writing.today), goal: format(p.project.settings.goals.daily) })
        : t("panel.today", { words: format(writing.today) })}
    </p>
  </section>
</div>

<style>
  .today {
    font-size: 12px;
    color: var(--text-muted);
    margin: 6px 0 0;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin-bottom: 8px;
  }
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
    align-items: flex-start;
    gap: 4px;
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
