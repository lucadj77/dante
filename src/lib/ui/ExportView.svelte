<script lang="ts">
  import { buildBook } from "$lib/core/export/book";
  import { bookToDocx, docxBytes } from "$lib/core/export/docx";
  import type { Project } from "$lib/core/project";
  import type { DocxSettings } from "$lib/core/settings";
  import { t } from "$lib/state.svelte";
  import { inTauri } from "$lib/tauriFs";

  let { project, onSaved }: { project: Project; onSaved: () => Promise<void> } = $props();

  // svelte-ignore state_referenced_locally
  let options = $state<DocxSettings>(structuredClone($state.snapshot(project.settings.export.docx)));
  let revisions = $state<"accept" | "reject">("accept");
  let message = $state("");
  let error = $state("");
  let busy = $state(false);

  function fileName() {
    const base = (project.settings.title || "manuscript").replace(/[\\/:*?"<>|]/g, " ").trim();
    return `${base}.docx`;
  }

  async function save(bytes: Uint8Array): Promise<boolean> {
    if (inTauri()) {
      const { save: saveDialog } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const path = await saveDialog({ defaultPath: fileName(), filters: [{ name: "Word", extensions: ["docx"] }] });
      if (!path) return false;
      await writeFile(path, bytes);
      return true;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function run() {
    error = "";
    message = "";
    busy = true;
    try {
      // The chosen options become the project's defaults for the next export.
      const settings = $state.snapshot(project.settings);
      settings.export.docx = $state.snapshot(options);
      await project.saveSettings(settings);
      await onSaved();
      const book = await buildBook(project, { revisions });
      const bytes = await docxBytes(bookToDocx(book, project.settings.export.docx, { words: t("export.words") }));
      if (await save(bytes)) message = t("export.done", { words: book.words.toLocaleString() });
    } catch (e) {
      error = t("error.generic", { message: e instanceof Error ? e.message : String(e) });
    } finally {
      busy = false;
    }
  }
</script>

<div class="export">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      void run();
    }}
  >
    <h2>{t("export.title")}</h2>
    <h3>{t("export.docx")}</h3>
    <label>{t("export.font")} <input bind:value={options.font} /></label>
    <div class="row">
      <label>{t("export.fontSize")} <input type="number" min="8" max="20" bind:value={options.fontSize} /></label>
      <label
        >{t("export.lineSpacing")}
        <select bind:value={options.lineSpacing}>
          <option value={1}>1</option>
          <option value={1.5}>1,5</option>
          <option value={2}>2</option>
        </select>
      </label>
      <label>{t("export.indent")} <input type="number" min="0" max="3" step="0.01" bind:value={options.indent} /></label>
    </div>
    <label>{t("export.separator")} <input bind:value={options.sceneSeparator} /></label>
    <label class="check"><input type="checkbox" bind:checked={options.titlePage} /> {t("export.titlePage")}</label>
    <label class="check"><input type="checkbox" bind:checked={options.header} /> {t("export.header")}</label>
    <label class="check"><input type="checkbox" bind:checked={options.chapterNewPage} /> {t("export.chapterNewPage")}</label>
    <label
      >{t("export.revisions")}
      <select bind:value={revisions}>
        <option value="accept">{t("export.accept")}</option>
        <option value="reject">{t("export.reject")}</option>
      </select>
    </label>
    <div class="actions">
      <button class="primary" type="submit" disabled={busy}>{t("export.run")}</button>
      {#if message}<span>{message}</span>{/if}
      {#if error}<span class="error">{error}</span>{/if}
    </div>
    <p class="muted">{t("export.later")}</p>
  </form>
</div>

<style>
  .export {
    height: 100vh;
    overflow: auto;
    padding: 24px 32px 64px;
  }
  form {
    max-width: 560px;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 16px;
  }
  h3 {
    font-size: 15px;
    margin: 0 0 12px;
  }
  label {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    color: var(--text-muted);
    font-size: 13px;
  }
  label input:not([type="checkbox"]),
  label select {
    color: var(--text);
    font-size: 14px;
  }
  label.check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  .row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
  }
  .muted {
    color: var(--text-muted);
    margin-top: 24px;
  }
  .error {
    color: var(--danger);
  }
</style>
