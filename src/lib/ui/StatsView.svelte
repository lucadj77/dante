<script lang="ts">
  import type { Project } from "$lib/core/project";
  import { dayKey, isWritingDay, readLogs, streak, wordsByDay, type WritingLog } from "$lib/core/sessions";
  import { frequentWords, goalProgress, lengthAnalysis, manuscriptStats, mentions, pageCount, type LengthLevel, type LengthUnit, type ManuscriptStats, type Mention, type WordCount } from "$lib/core/statistics";
  import { readingMinutes } from "$lib/core/stats";
  import { app, num, saveAppSettings, t } from "$lib/state.svelte";
  import { navigator } from "./navigation";
  import { flushSessions, writing } from "./sessions.svelte";

  interface Props {
    project: Project;
    rev: number;
    diskRev: number;
    onSaved: () => Promise<void>;
  }
  let p: Props = $props();
  const nav = navigator();

  let stats = $state.raw<ManuscriptStats | null>(null);
  let named = $state.raw<Mention[]>([]);
  let words = $state.raw<WordCount[]>([]);
  let logs = $state.raw<WritingLog[]>([]);
  let error = $state("");

  $effect(() => {
    void p.rev;
    void p.diskRev;
    void writing.today;
    void (async () => {
      try {
        await flushSessions();
        const index = await p.project.index();
        const s = manuscriptStats(p.project.manuscript, index, p.project.settings);
        stats = s;
        named = mentions(s, index, p.project.settings);
        words = frequentWords(s.scenes.map((x) => x.text), p.project.settings.language, 40);
        logs = await readLogs(p.project.fs);
      } catch (e) {
        error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
      }
    })();
  });

  const n = num;

  // Goals, kept in dante.yaml for everyone working on the novel.
  // svelte-ignore state_referenced_locally
  let goals = $state({ ...p.project.settings.goals, days: [...p.project.settings.goals.days] });
  async function saveGoals() {
    error = "";
    try {
      const clean = { words: Math.max(0, Math.round(Number(goals.words) || 0)), deadline: goals.deadline || "", daily: Math.max(0, Math.round(Number(goals.daily) || 0)), days: [...goals.days].sort() };
      await p.project.saveSettings({ ...p.project.settings, goals: clean });
      await p.onSaved();
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Monday to Sunday, 1 to 7, with their short names in the interface language. */
  const weekdays = $derived(
    [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: d, name: new Date(2024, 0, d).toLocaleDateString(app.settings.language, { weekday: "short" }) })),
  );
  function toggleDay(day: number) {
    goals.days = goals.days.includes(day) ? goals.days.filter((d) => d !== day) : [...goals.days, day];
    void saveGoals();
  }

  // The project's settings are not reactive: read them again whenever the numbers are.
  const goalsSet = $derived.by(() => {
    void stats;
    return p.project.settings.goals;
  });
  const progress = $derived(stats ? goalProgress(stats.words, goalsSet.words, goalsSet.deadline, new Date(), goalsSet.days) : null);
  const restDay = $derived(!isWritingDay(new Date(), goalsSet.days));
  const byDay = $derived(wordsByDay(logs));
  const user = $derived(app.settings.userName.trim());
  const mine = $derived(wordsByDay(logs.filter((l) => l.user === user)));
  const today = dayKey(new Date());
  const days = $derived(streak(mine, goalsSet.daily, new Date(), goalsSet.days));

  /** The last 30 days, oldest first, with everyone's net words. */
  const recent = $derived.by(() => {
    const out: { key: string; label: string; words: number }[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const key = dayKey(d);
      out.push({ key, label: d.toLocaleDateString(app.settings.language, { day: "numeric", month: "short" }), words: byDay.get(key) ?? 0 });
      d.setDate(d.getDate() + 1);
    }
    return out;
  });
  const chartMax = $derived(Math.max(1, p.project.settings.goals.daily, ...recent.map((r) => r.words)));
  let hovered = $state<number | null>(null);

  /** Each person's writing: today, the last seven days, and time spent. */
  const people = $derived.by(() => {
    const week = new Set(recent.slice(-7).map((r) => r.key));
    return logs
      .map((log) => {
        let last7 = 0;
        let minutes = 0;
        for (const [key, d] of Object.entries(log.days)) {
          if (week.has(key)) {
            last7 += d.added - d.removed;
            minutes += d.minutes;
          }
        }
        const t0 = log.days[today];
        return { user: log.user || "–", today: t0 ? t0.added - t0.removed : 0, last7, minutes };
      })
      .sort((a, b) => b.last7 - a.last7);
  });

  // Length of scenes, chapters or parts, in words or characters: a choice of this computer.
  const levels = $derived<LengthLevel[]>(stats?.parts.length ? ["scene", "chapter", "part"] : stats?.chapters.length ? ["scene", "chapter"] : ["scene"]);
  const level = $derived(levels.includes(app.settings.statsLevel) ? app.settings.statsLevel : levels[levels.length - 1]);
  const unit = $derived(app.settings.statsUnit);
  const lengths = $derived(stats ? lengthAnalysis(stats, level, unit) : null);
  const longest = $derived(Math.max(1, lengths?.longest?.length ?? 0, ...(lengths?.rows ?? []).map((r) => r.length)));
  const levelName: Record<LengthLevel, "level.scene" | "level.chapter" | "level.part"> = { scene: "level.scene", chapter: "level.chapter", part: "level.part" };
  const levelPlural: Record<LengthLevel, "statsView.scenes" | "statsView.chapters" | "statsView.parts"> = { scene: "statsView.scenes", chapter: "statsView.chapters", part: "statsView.parts" };
  const setLength = (change: { statsUnit?: LengthUnit; statsLevel?: LengthLevel }) => saveAppSettings({ ...app.settings, ...change });
  const typeName = (id: string) => {
    const type = p.project.settings.types[id];
    return type ? `${type.icon} ${type.name}`.trim() : id;
  };
  const sceneTitle = (path: string) => stats?.scenes.find((s) => s.path === path)?.title ?? path;
  let showUnnamed = $state(false);
</script>

<div class="stats">
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !stats}
    <p class="muted">…</p>
  {:else}
    <section class="tiles" aria-label={t("statsView.totals")}>
      {#each [
        { label: t("stats.words"), value: n(stats.words) },
        { label: t("statsView.pages"), value: n(pageCount(stats, p.project.settings.pages), 1), hint: t(p.project.settings.pages.unit === "words" ? "statsView.pagesWords" : "statsView.pagesCharacters", { size: n(p.project.settings.pages.size) }) },
        { label: t("stats.characters"), value: n(stats.characters) },
        { label: t("statsView.chapters"), value: n(stats.chapters.length) },
        { label: t("statsView.scenes"), value: n(stats.scenes.length) },
        { label: t("stats.readingTime"), value: t("statsView.hours", { h: n(readingMinutes(stats.words) / 60, 1) }) },
      ] as tile (tile.label)}
        <div class="tile" data-tip={tile.hint}>
          <span class="value">{tile.value}</span>
          <span class="label">{tile.label}</span>
        </div>
      {/each}
    </section>

    <section>
      <h2>{t("statsView.goals")}</h2>
      <form
        class="goals"
        onsubmit={(e) => {
          e.preventDefault();
          void saveGoals();
        }}
      >
        <label>{t("statsView.goalWords")} <input type="number" min="0" step="1000" bind:value={goals.words} onchange={saveGoals} /></label>
        <label>{t("statsView.deadline")} <input type="date" bind:value={goals.deadline} onchange={saveGoals} /></label>
        <label>{t("statsView.daily")} <input type="number" min="0" step="50" bind:value={goals.daily} onchange={saveGoals} /></label>
        <fieldset class="weekdays">
          <legend>{t("statsView.writingDays")}</legend>
          {#each weekdays as w (w.day)}
            <label class="day"><input type="checkbox" checked={goals.days.includes(w.day)} onchange={() => toggleDay(w.day)} /> {w.name}</label>
          {/each}
        </fieldset>
      </form>
      {#if progress && p.project.settings.goals.words > 0}
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress.share * 100)} aria-label={t("statsView.goalWords")}>
          <span style:width="{progress.share * 100}%"></span>
        </div>
        <p class="line">
          {t("statsView.progress", { done: n(stats.words), goal: n(p.project.settings.goals.words), share: n(progress.share * 100) })}
          {#if progress.remaining === 0}
            {t("statsView.reached")}
          {:else if progress.daysLeft !== null && progress.daysLeft > 0 && progress.perDay !== null}
            {t("statsView.perDay", { words: n(progress.perDay), days: n(progress.writingDaysLeft ?? progress.daysLeft) })}
          {:else if progress.daysLeft !== null}
            {t("statsView.late", { words: n(progress.remaining) })}
          {/if}
        </p>
      {/if}
      <p class="line">
        {#if !user}
          {t("statsView.noName")}
        {:else}
          {t("statsView.today", { words: n(mine.get(today) ?? 0) })}{#if goalsSet.daily > 0 && !restDay}{" "}{t("statsView.ofDaily", { goal: n(goalsSet.daily) })}{/if}.
          {#if restDay}{t("statsView.restDay")}{/if}
          {#if days > 0}{t(days === 1 ? "statsView.streakOne" : "statsView.streak", { days })}{/if}
        {/if}
      </p>
    </section>

    <section>
      <h2>{t("statsView.recent")}</h2>
      <p class="muted small">{t("statsView.recentHint")}</p>
      <div class="chart" role="img" aria-label={t("statsView.recent")}>
        {#if p.project.settings.goals.daily > 0}
          <div class="goal-line" style:bottom="{(p.project.settings.goals.daily / chartMax) * 100}%" data-label={t("statsView.dailyShort", { goal: n(p.project.settings.goals.daily) })}></div>
        {/if}
        {#each recent as day, i (day.key)}
          <div
            class="col"
            role="presentation"
            onmouseenter={() => (hovered = i)}
            onmouseleave={() => (hovered = null)}
          >
            {#if day.words > 0}<span class="mark" style:height="{(day.words / chartMax) * 100}%"></span>{/if}
            {#if hovered === i}
              <span class="tooltip" class:left={i > 22}>{day.label}: <b>{n(day.words)}</b></span>
            {/if}
          </div>
        {/each}
      </div>
      <div class="axis"><span>{recent[0].label}</span><span>{recent[29].label}</span></div>
      {#if people.length}
        <table>
          <thead>
            <tr><th>{t("statsView.person")}</th><th class="num">{t("statsView.todayShort")}</th><th class="num">{t("statsView.week")}</th><th class="num">{t("statsView.minutes")}</th></tr>
          </thead>
          <tbody>
            {#each people as person (person.user)}
              <tr><td>{person.user}</td><td class="num">{n(person.today)}</td><td class="num">{n(person.last7)}</td><td class="num">{n(person.minutes)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    {#if lengths && lengths.rows.length}
      <section>
        <h2>{t("statsView.length")}</h2>
        <div class="choices">
          <div class="segmented" role="group" aria-label={t("statsView.measure")}>
            {#each [["words", "stats.words"], ["characters", "stats.characters"]] as const as [id, key] (id)}
              <button aria-pressed={unit === id} onclick={() => setLength({ statsUnit: id })}>{t(key)}</button>
            {/each}
          </div>
          {#if levels.length > 1}
            <div class="segmented" role="group" aria-label={t("statsView.level")}>
              {#each levels as id (id)}
                <button aria-pressed={level === id} onclick={() => setLength({ statsLevel: id })}>{t(levelPlural[id])}</button>
              {/each}
            </div>
          {/if}
        </div>
        <p class="line">
          {t("statsView.lengthSummary", { average: n(lengths.average), median: n(lengths.median) })}
          {#if lengths.shortest && lengths.longest && lengths.shortest !== lengths.longest}
            {t("statsView.lengthRange", { shortest: lengths.shortest.title, short: n(lengths.shortest.length), longest: lengths.longest.title, long: n(lengths.longest.length) })}
          {/if}
        </p>
        <table class="chapters">
          <thead>
            <tr>
              <th>{t(levelName[level])}</th>
              {#if level !== "part" && lengths.rows.some((r) => r.within)}<th>{t(level === "scene" ? "statsView.within" : "level.part")}</th>{/if}
              {#if level !== "scene"}<th class="num">{t("statsView.scenes")}</th>{/if}
              <th class="num">{t(unit === "words" ? "stats.words" : "stats.characters")}</th>
              <th class="num">%</th>
              <th class="share"></th>
            </tr>
          </thead>
          <tbody>
            {#each lengths.rows as row (row.path)}
              <tr class:outside={row.path === ""}>
                <td>
                  {#if row.path}
                    <button class="link" onclick={() => nav?.open(row.path)}>{row.title}</button>
                  {:else}
                    {t("statsView.outsideParts")}
                  {/if}
                </td>
                {#if level !== "part" && lengths.rows.some((r) => r.within)}<td class="small">{row.within}</td>{/if}
                {#if level !== "scene"}<td class="num">{n(row.scenes)}</td>{/if}
                <td class="num">{n(row.length)}</td>
                <td class="num">{n(row.share * 100, 1)}</td>
                <td class="share"><span style:width="{(row.length / longest) * 100}%"></span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    <section>
      <h2>{t("statsView.mentions")}</h2>
      <p class="muted small">{t("statsView.mentionsHint")}</p>
      {#if named.some((m) => m.count > 0)}
        <table>
          <thead>
            <tr><th>{t("statsView.note")}</th><th>{t("views.field.type")}</th><th class="num">{t("statsView.times")}</th><th class="num">{t("statsView.scenes")}</th><th>{t("statsView.firstLast")}</th></tr>
          </thead>
          <tbody>
            {#each named.filter((m) => m.count > 0) as m (m.path)}
              <tr>
                <td><button class="link" onclick={() => nav?.open(m.path)}>{m.title}</button></td>
                <td>{typeName(m.type)}</td>
                <td class="num">{n(m.count)}</td>
                <td class="num">{n(m.scenes.length)}</td>
                <td class="small">{sceneTitle(m.scenes[0])}{#if m.scenes.length > 1} … {sceneTitle(m.scenes[m.scenes.length - 1])}{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      {#if named.some((m) => m.count === 0)}
        <button class="small-button" aria-expanded={showUnnamed} onclick={() => (showUnnamed = !showUnnamed)}>
          {t("statsView.unnamed", { count: named.filter((m) => m.count === 0).length })}
        </button>
        {#if showUnnamed}
          <p class="chips">
            {#each named.filter((m) => m.count === 0) as m (m.path)}
              <button class="chip" onclick={() => nav?.open(m.path)}>{m.title}</button>
            {/each}
          </p>
        {/if}
      {/if}
    </section>

    <section>
      <h2>{t("statsView.frequent")}</h2>
      <p class="muted small">{t("statsView.frequentHint")}</p>
      <ol class="words">
        {#each words as w (w.word)}
          <li><span>{w.word}</span> <span class="count">{n(w.count)}</span></li>
        {/each}
      </ol>
    </section>
  {/if}
</div>

<style>
  .stats {
    overflow: auto;
    height: 100%;
    padding: 16px 24px 48px;
    display: grid;
    gap: 24px;
    align-content: start;
    max-width: 980px;
  }
  section {
    display: grid;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .tile {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
  }
  .tile .value {
    font-size: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .tile .label,
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .small {
    font-size: 12px;
  }
  .error {
    color: var(--danger);
  }
  .goals {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 13px;
  }
  .goals label {
    display: grid;
    gap: 4px;
  }
  .goals input {
    width: 160px;
  }
  .weekdays {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    border: none;
    padding: 0;
    margin: 0;
  }
  .weekdays legend {
    padding: 0;
    margin-bottom: 4px;
  }
  .goals .day {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .goals .day input {
    width: auto;
    margin: 0;
  }
  .bar {
    height: 10px;
    border-radius: 5px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
  }
  .line {
    margin: 0;
    font-size: 14px;
  }
  .chart {
    position: relative;
    display: grid;
    grid-template-columns: repeat(30, 1fr);
    align-items: end;
    height: 140px;
    border-bottom: 1px solid var(--border);
  }
  .col {
    position: relative;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 1px;
  }
  .col:hover {
    background: rgba(47, 95, 158, 0.06);
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }
  .mark {
    display: block;
    width: 100%;
    max-width: 18px;
    min-height: 2px;
    background: var(--accent);
    border-radius: 4px 4px 0 0;
  }
  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.12);
    z-index: 2;
  }
  .tooltip.left {
    left: auto;
    right: 0;
    transform: none;
  }
  .goal-line {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--text-muted);
    pointer-events: none;
  }
  .goal-line::after {
    content: attr(data-label);
    position: absolute;
    right: 0;
    bottom: 2px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted);
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 14px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-weight: 600;
    font-size: 13px;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .share {
    width: 30%;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .segmented button {
    border: none;
    border-radius: 0;
    font-size: 13px;
    padding: 4px 10px;
    background: none;
  }
  .segmented button + button {
    border-left: 1px solid var(--border);
  }
  .segmented button[aria-pressed="true"] {
    background: rgba(47, 95, 158, 0.16);
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
  }
  tr.outside td {
    color: var(--text-muted);
    font-style: italic;
  }
  .share span {
    display: block;
    height: 8px;
    background: var(--accent);
    border-radius: 0 4px 4px 0;
    opacity: 0.7;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    font: inherit;
    text-align: left;
  }
  .small-button {
    justify-self: start;
    font-size: 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
  }
  .chip {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
  }
  .words {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 2px 16px;
    margin: 0;
    padding-left: 24px;
    font-size: 14px;
  }
  .words .count {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
