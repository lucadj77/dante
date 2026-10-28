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
  import PanelSection from "./PanelSection.svelte";
  import PropertyAdd from "./PropertyAdd.svelte";
  import PropertyRows from "./PropertyRows.svelte";
  import { displayValue } from "./propertyText";

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
  /** What the template of new scenes holds: the properties every scene is offered. */
  let offeredProperties = $state<Properties>({});
  let adding = $state(false);
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
    if (target.kind === "scene") p.project.sceneProperties().then((value) => (offeredProperties = value), () => (offeredProperties = {}));
  });

  // `kind` and `numbered` live in folder notes and are set with the controls above the list.
  // Title and synopsis have their own fields above the list.
  const entries = $derived(
    Object.entries(properties).filter(([key]) => key !== TITLE && key !== SYNOPSIS && key !== GOAL && !(node?.kind !== "scene" && (key === "kind" || key === NUMBERED))),
  );
  /** The properties of every scene this scene has not been given yet. */
  const offered = $derived(
    node?.kind === "scene"
      ? Object.keys(offeredProperties).filter((k) => k !== TITLE && k !== SYNOPSIS && k !== GOAL && k !== "type" && !Object.keys(properties).some((own) => own.toLowerCase() === k.toLowerCase()))
      : [],
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

  async function add(name: string, value: unknown, everywhere: boolean) {
    if (everywhere) await p.project.addSceneProperty(name, value);
    else await p.project.setProperties(node!.path, { [name]: value });
    await p.onChanged();
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
  {#if node && node.kind !== "manuscript"}
    <PanelSection id="details" title={t(`kind.${node.kind}` as MessageKey)}>
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
    </PanelSection>

    <PanelSection id="properties" title={t("panel.properties")}>
      {#snippet actions()}
        <button class="plus" aria-expanded={adding} title={t("panel.newPropertyTip")} aria-label={t("panel.newProperty")} onclick={() => (adding = !adding)}
          >+ {t("panel.newProperty")}</button
        >
      {/snippet}
      {#if adding}
        <PropertyAdd project={p.project} existing={Object.keys(properties)} scene={node.kind === "scene"} onAdd={add} onClose={() => (adding = false)} />
      {/if}
      {#if entries.length === 0 && offered.length === 0 && !adding}
        <p class="muted">{t("panel.noProperties")}</p>
      {/if}
      <PropertyRows project={p.project} {entries} {offered} from={propertiesPath(node.path)} onUpdate={update} onChanged={p.onChanged} onError={(m) => (error = m)} />
    </PanelSection>
    {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
  {/if}

  {#if node && node.kind === "scene"}
    <PanelSection id="snapshots" title={t("snap.title")}>
      <SnapshotsPanel project={p.project} path={node.path} beforeRead={p.beforeRead} onRestored={p.onRestored} />
    </PanelSection>
  {/if}

  <PanelSection id="statistics" title={t("panel.statistics")}>
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
  </PanelSection>
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
  .muted {
    color: var(--text-muted);
  }
  .plus {
    font-size: 11px;
    padding: 1px 8px;
  }
  .plus[aria-expanded="true"] {
    background: var(--bg-active);
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
