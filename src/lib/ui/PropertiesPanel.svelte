<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Properties } from "$lib/core/frontmatter";
  import { findNode, folderNotePath, GOAL, NUMBERED, SYNOPSIS, TITLE, type ContainerKind } from "$lib/core/manuscript";
  import { goalOf } from "$lib/core/statistics";
  import type { Project } from "$lib/core/project";
  import { readingMinutes, textStats } from "$lib/core/stats";
  import { isWritingDay } from "$lib/core/sessions";
  import { writtenToday } from "./sessions.svelte";
  import type { MessageKey } from "$lib/i18n";
  import { num, t, tu } from "$lib/state.svelte";
  import SnapshotsPanel from "./SnapshotsPanel.svelte";
  import PropertyField from "./PropertyField.svelte";
  import { emptyValue, KIND_ICONS, propertyDef, withDef, type PropertyDef } from "$lib/core/properties";
  import PropertyDefEditor from "./PropertyDefEditor.svelte";
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
    onRename: (path: string, title: string, file?: boolean) => void;
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
  // Title and synopsis have their own fields above the list.
  const entries = $derived(
    Object.entries(properties).filter(([key]) => key !== TITLE && key !== SYNOPSIS && key !== GOAL && !(node?.kind !== "scene" && (key === "kind" || key === NUMBERED))),
  );
  const goal = $derived(goalOf(properties));
  const unit = $derived(p.project.settings.goals.unit);
  const today = $derived(writtenToday(unit));
  const synopsis = $derived(typeof properties[SYNOPSIS] === "string" ? (properties[SYNOPSIS] as string) : displayValue(properties[SYNOPSIS]));

  async function retitle(title: string) {
    if (!node || title.trim() === node.title) return;
    error = "";
    try {
      await p.project.retitle(node.path, title);
      await p.onChanged();
    } catch (e) {
      error = failure(e);
    }
  }
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
      error = failure(e);
    }
  }

  /** The property whose definition is being edited. */
  let defining = $state<string | null>(null);

  async function define(key: string, def: PropertyDef | null) {
    error = "";
    try {
      await p.project.saveSettings({ ...p.project.settings, properties: withDef(p.project.settings.properties, key, def) });
      await p.onChanged();
    } catch (e) {
      error = failure(e);
    }
  }

  function change(key: string, value: unknown) {
    if (JSON.stringify(value) !== JSON.stringify(properties[key])) void update({ [key]: value });
  }

  function add() {
    const key = newName.trim();
    if (!key || key in properties) return;
    newName = "";
    const def = propertyDef(p.project.settings.properties, key);
    void update({ [key]: def ? emptyValue(def) : isList(key, undefined) ? [] : "" });
  }

  function sum(texts: string[]) {
    return texts.map(textStats).reduce(
      (a, b) => ({ words: a.words + b.words, characters: a.characters + b.characters, charactersNoSpaces: a.charactersNoSpaces + b.charactersNoSpaces }),
      { words: 0, characters: 0, charactersNoSpaces: 0 },
    );
  }
  const sceneStats = $derived(p.activeText !== null ? textStats(p.activeText) : null);
  const viewStats = $derived(sum(p.sceneTexts));
  const format = (n: number) => num(n);
</script>

<div class="panel">
  <section>
    <h3>{t("panel.properties")}</h3>
    {#if node && node.kind !== "manuscript"}
      <p class="what">{t(`kind.${node.kind}` as MessageKey)}</p>
      <label class="title-field">
        <span>{t("panel.title")}</span>
        {#key node.path + node.title}
          <input
            value={node.title}
            placeholder={node.fileTitle}
            data-tip={t("panel.titleHint")}
            onchange={(e) => void retitle((e.currentTarget as HTMLInputElement).value)}
            onkeydown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
          />
        {/key}
      </label>
      <label class="title-field">
        <span>{t("panel.fileName")}</span>
        {#key node.path}
          <input
            value={node.fileTitle}
            onchange={(e) => {
              const value = (e.currentTarget as HTMLInputElement).value;
              if (value.trim() && value !== node.fileTitle) p.onRename(node.path, value, true);
            }}
            onkeydown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
          />
        {/key}
      </label>
      <label class="title-field">
        <span>{t("panel.synopsis")}</span>
        {#key node.path + synopsis}
          <textarea
            rows="4"
            value={synopsis}
            placeholder={t("panel.synopsisHint")}
            onchange={(e) => {
              const value = (e.currentTarget as HTMLTextAreaElement).value.trim();
              if (value !== synopsis) void update({ [SYNOPSIS]: value === "" ? undefined : value });
            }}
          ></textarea>
        {/key}
      </label>
      <label class="title-field goal-field">
        <span>{tu("panel.goal", unit)}</span>
        {#key node.path + goal}
          <input
            type="number"
            min="0"
            step="100"
            value={goal || ""}
            placeholder={t("panel.goalNone")}
            data-tip={tu("panel.goalHint", unit)}
            onchange={(e) => {
              const value = Math.max(0, Math.round(Number((e.currentTarget as HTMLInputElement).value) || 0));
              if (value !== goal) void update({ [GOAL]: value || undefined });
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
          {@const def = propertyDef(p.project.settings.properties, key)}
          <div class="prop">
            <dt>
              <button
                class="kind"
                aria-expanded={defining === key}
                data-tip={t("property.defineTip", { kind: def ? t(`property.kind.${def.kind}` as MessageKey) : t("property.free") })}
                onclick={() => (defining = defining === key ? null : key)}>{KIND_ICONS[def?.kind ?? ""]}</button
              >
              {key}
            </dt>
            <dd>
              <PropertyField
                name={key}
                {value}
                {def}
                from={propertiesPath(node.path)}
                onChange={(v) => change(key, v)}
              />
              <button class="remove" aria-label={t("panel.remove", { name: key })} onclick={() => update({ [key]: undefined })}>×</button>
            </dd>
            {#if defining === key}
              <PropertyDefEditor name={key} {def} types={p.project.settings.types} onSave={(d) => define(key, d)} />
            {/if}
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
    {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
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
      {!isWritingDay(new Date(), p.project.settings.goals.days)
        ? today
          ? tu("panel.todayRest", unit, { words: format(today) })
          : t("panel.rest")
        : p.project.settings.goals.daily > 0
          ? tu("panel.todayGoal", unit, { words: format(today), goal: format(p.project.settings.goals.daily) })
          : tu("panel.today", unit, { words: format(today) })}
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
  .title-field textarea {
    font: inherit;
    font-size: 13px;
    color: var(--text);
    resize: vertical;
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
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kind {
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    font-size: 11px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .kind:hover,
  .kind[aria-expanded="true"] {
    background: var(--bg-active);
    color: var(--text);
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
