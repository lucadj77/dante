<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { Project } from "$lib/core/project";
  import { sampleProject } from "$lib/sample";
  import { t } from "$lib/state.svelte";
  import { inTauri, TauriFs } from "$lib/tauriFs";

  let { onOpen }: { onOpen: (project: Project) => void } = $props();
  let error = $state("");
  const desktop = inTauri();

  async function openFolder() {
    error = "";
    try {
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder === "string") onOpen(await Project.open(new TauriFs(folder)));
    } catch (e) {
      error = t("error.generic", { message: String(e) });
    }
  }

  async function openSample() {
    onOpen(await Project.open(sampleProject()));
  }
</script>

<main>
  <h1>{t("app.name")}</h1>
  <h2>{t("welcome.title")}</h2>
  <p>{t("welcome.body")}</p>
  <div class="actions">
    {#if desktop}
      <button class="primary" onclick={openFolder}>{t("welcome.open")}</button>
    {/if}
    <button onclick={openSample}>{t("welcome.sample")}</button>
  </div>
  {#if !desktop}
    <p class="note">{t("welcome.browser")}</p>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
</main>

<style>
  main {
    max-width: 480px;
    margin: 18vh auto 0;
    padding: 0 16px;
  }
  h1 {
    font-family: Georgia, serif;
    font-weight: 400;
    font-size: 40px;
    margin: 0 0 24px;
  }
  h2 {
    font-size: 18px;
    margin: 0 0 8px;
  }
  p {
    color: var(--text-muted);
    line-height: 1.5;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .note {
    font-size: 13px;
  }
  .error {
    color: var(--danger);
  }
</style>
