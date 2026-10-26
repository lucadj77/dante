<script lang="ts">
  import { isWritingDay } from "$lib/core/sessions";
  import { app, num, saveAppSettings, t } from "$lib/state.svelte";
  import Icon from "./Icon.svelte";
  import { writing } from "./sessions.svelte";
  import { dismissSprint, sprint, sprintLeft, sprintWords, startSprint, stopSprint } from "./sprint.svelte";

  interface Props {
    /** Words of the scene with the cursor, and its goal (0 for none); null without one. */
    scene: { words: number; goal: number } | null;
    /** Words selected in it; 0 when nothing is. */
    selected: number;
    /** What is on screen when it is more than a scene: its kind and words. */
    view: { label: string; words: number; goal: number } | null;
    /** The novel's daily goal, and whether today is a writing day. */
    daily: number;
    days: number[];
  }
  let p: Props = $props();

  let choosing = $state(false);
  let minutes = $state(app.settings.sprintMinutes);
  let target = $state(app.settings.sprintWords || ("" as number | ""));

  const OPTIONS = [10, 15, 20, 25, 30, 45, 60, 90];
  const rest = $derived(!isWritingDay(new Date(), p.days));

  function clock(ms: number): string {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  function begin() {
    const m = Math.min(240, Math.max(1, Math.round(Number(minutes) || 25)));
    const w = Math.max(0, Math.round(Number(target) || 0));
    saveAppSettings({ ...app.settings, sprintMinutes: m, sprintWords: w });
    choosing = false;
    startSprint(m, w);
  }

  const amount = (words: number, goal: number) => (goal ? t("status.ofGoal", { words: num(words), goal: num(goal) }) : t("status.words", { words: num(words) }));
</script>

<footer class="status-bar" aria-label={t("status.bar")}>
  {#if p.scene}
    <span class="item" data-tip={t("tip.status.scene")}>
      <span class="what">{t("kind.scene")}</span>
      {amount(p.scene.words, p.scene.goal)}
      {#if p.scene.goal}<span class="meter" class:reached={p.scene.words >= p.scene.goal}><span style:width="{Math.min(1, p.scene.words / p.scene.goal) * 100}%"></span></span>{/if}
    </span>
  {/if}
  {#if p.selected > 0}
    <span class="item"><span class="what">{t("status.selected")}</span> {t("status.words", { words: num(p.selected) })}</span>
  {/if}
  {#if p.view}
    <span class="item"><span class="what label" title={p.view.label}>{p.view.label}</span> {amount(p.view.words, p.view.goal)}</span>
  {/if}
  <span class="item" data-tip={t("tip.status.today")}>
    <span class="what">{t("status.today")}</span>
    {p.daily > 0 && !rest ? t("status.ofGoal", { words: num(writing.today), goal: num(p.daily) }) : t("status.words", { words: num(writing.today) })}
  </span>
  <span class="grow"></span>

  {#if sprint.running}
    {@const words = sprintWords()}
    <span class="item sprint running" role="timer" aria-live="off">
      <Icon name="timer" />
      <strong>{clock(sprintLeft())}</strong>
      {sprint.running.target ? t("status.ofGoal", { words: num(words), goal: num(sprint.running.target) }) : t("status.words", { words: num(words) })}
      <button class="small" title={t("tip.sprint.stop")} onclick={stopSprint}>{t("sprint.stop")}</button>
    </span>
  {:else if sprint.done}
    <span class="item sprint done" role="status">
      {t(sprint.done.target && sprint.done.words >= sprint.done.target ? "sprint.reached" : "sprint.done", { words: num(sprint.done.words), minutes: sprint.done.minutes })}
      <button class="small icon-only" aria-label={t("help.close")} onclick={dismissSprint}>×</button>
    </span>
  {/if}
  {#if !sprint.running}
    <div class="sprint-start">
      <button class="small" aria-expanded={choosing} title={t("tip.sprint")} onclick={() => (choosing = !choosing)}><Icon name="timer" /><span>{t("sprint.title")}</span></button>
      {#if choosing}
        <div class="menu-backdrop" role="presentation" onmousedown={() => (choosing = false)}></div>
        <form
          class="popover"
          onsubmit={(e) => {
            e.preventDefault();
            begin();
          }}
        >
          <p class="hint">{t("sprint.hint")}</p>
          <label
            >{t("sprint.minutes")}
            <select bind:value={minutes}>
              {#each OPTIONS as m (m)}<option value={m}>{t("sprint.minutesValue", { n: m })}</option>{/each}
            </select>
          </label>
          <label>{t("sprint.target")} <input type="number" min="0" placeholder={t("panel.goalNone")} bind:value={target} /></label>
          <div class="actions">
            <button class="primary" type="submit">{t("sprint.start")}</button>
            <button type="button" onclick={() => (choosing = false)}>{t("tree.cancel")}</button>
          </div>
        </form>
      {/if}
    </div>
  {/if}
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 4px 16px;
    flex-wrap: wrap;
    min-height: 28px;
    padding: 3px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-panel);
    color: var(--text-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }
  .what {
    font-weight: 600;
  }
  .what.label {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .grow {
    flex: 1;
  }
  .meter {
    display: inline-block;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .meter.reached span {
    background: var(--status-3);
  }
  .sprint.running strong {
    color: var(--text);
  }
  .sprint.done {
    color: var(--text);
  }
  button.small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    font-size: 12px;
  }
  .sprint-start {
    position: relative;
  }
  .popover {
    position: absolute;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 30;
    display: grid;
    gap: 8px;
    width: 260px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    font-size: 13px;
  }
  .popover .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    white-space: normal;
  }
  .popover label {
    display: grid;
    gap: 3px;
  }
  .popover .actions {
    display: flex;
    gap: 6px;
  }
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 29;
  }
</style>
