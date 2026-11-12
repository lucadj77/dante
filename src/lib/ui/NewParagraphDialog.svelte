<script lang="ts">
  import Dialog from "./Dialog.svelte";
  // In a gamebook: a new paragraph with all the plugin's choices in one window: the first
  // free number, a fixed number or one relative to another paragraph, and a reference in
  // the text or among the hidden ones.
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "./errors";
  import type { ParagraphChoice } from "$lib/editor/links";
  import { t } from "$lib/state.svelte";

  interface Props {
    title: string;
    hidden: boolean;
    /** Created from the tree: there is no paragraph to write the reference in. */
    noReference?: boolean;
    paragraphs: ParagraphChoice[];
    firstFree: number;
    /** Creates the paragraph and writes the reference; throws to keep the window open with the reason. */
    onCreate: (title: string, spec: { numberType: "free" | "fixed" | "relative"; number?: number; anchor?: string; offset?: number }, hidden: boolean) => Promise<void>;
    onClose: () => void;
  }
  let p: Props = $props();

  // svelte-ignore state_referenced_locally
  let title = $state(p.title);
  // svelte-ignore state_referenced_locally
  let hidden = $state(p.hidden);
  let kind = $state<"free" | "fixed" | "relative">("free");
  // svelte-ignore state_referenced_locally
  let fixed = $state(p.firstFree);
  let anchor = $state("");
  let offset = $state(1);
  let error = $state("");
  let busy = $state(false);

  const anchorNumber = $derived(p.paragraphs.find((x) => x.title === anchor)?.number ?? null);
  const relativeNumber = $derived(anchorNumber === null ? null : anchorNumber + offset);

  async function create() {
    if (busy || !title.trim()) return;
    if (kind === "relative" && !anchor) return;
    busy = true;
    error = "";
    try {
      await p.onCreate(title.trim(), kind === "fixed" ? { numberType: "fixed", number: fixed } : kind === "relative" ? { numberType: "relative", anchor, offset } : { numberType: "free" }, hidden);
      p.onClose();
    } catch (e) {
      error = failure(e);
    } finally {
      busy = false;
    }
  }

  function focus(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
</script>

<Dialog label={t("gamebook.new.title")} onClose={p.onClose} width={520}>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void create();
    }}
  >
    <h2>{t("gamebook.new.title")}</h2>
    <label class="field">
      <span>{t("gamebook.new.name")}</span>
      <input bind:value={title} use:focus placeholder={t("gamebook.new.namePlaceholder")} />
    </label>

    <fieldset>
      <legend>{t("gamebook.new.number")}</legend>
      <label><input type="radio" bind:group={kind} value="free" /> {t("gamebook.new.free", { n: p.firstFree })}</label>
      <label class="row">
        <input type="radio" bind:group={kind} value="fixed" />
        {t("gamebook.new.fixed")}
        <input class="num" type="number" min="1" bind:value={fixed} onfocus={() => (kind = "fixed")} />
      </label>
      <label class="row">
        <input type="radio" bind:group={kind} value="relative" />
        {t("gamebook.new.relative")}
        <select bind:value={anchor} onfocus={() => (kind = "relative")}>
          <option value="">{t("gamebook.new.chooseAnchor")}</option>
          {#each p.paragraphs as x (x.title)}
            <option value={x.title}>{x.number} · {x.title}</option>
          {/each}
        </select>
        +
        <input class="num" type="number" bind:value={offset} onfocus={() => (kind = "relative")} />
        {#if kind === "relative" && relativeNumber !== null}<span class="muted">= {relativeNumber}</span>{/if}
      </label>
    </fieldset>

    {#if !p.noReference}
      <label class="row"><input type="checkbox" bind:checked={hidden} /> {t("gamebook.new.hidden")}</label>
      <p class="muted">{t(hidden ? "gamebook.new.hiddenHint" : "gamebook.new.textHint")}</p>
    {/if}

    {#if error}<p class="error"><ErrorText text={error} /></p>{/if}
    <div class="actions">
      <button type="button" onclick={p.onClose}>{t("tree.cancel")}</button>
      <button type="submit" class="primary" disabled={busy || !title.trim() || (kind === "relative" && !anchor)}>{t("gamebook.new.create")}</button>
    </div>
  </form>
</Dialog>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
  }
  .field {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
    display: grid;
    gap: 6px;
    padding: 8px 10px;
    font-size: 13px;
  }
  legend {
    padding: 0 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
  }
  .num {
    width: 72px;
  }
  select {
    max-width: 220px;
  }
  .muted {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
