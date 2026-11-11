<script lang="ts">
  // A small "?" that opens the guide at the chapter about the panel it sits in.
  import { t } from "$lib/state.svelte";
  import { GUIDE_CHAPTERS, openHelp } from "./help.svelte";

  let { chapter }: { chapter: keyof typeof GUIDE_CHAPTERS } = $props();
</script>

<button type="button" class="help-link" title={t("help.chapterLink")} aria-label={t("help.chapterLink")} onclick={() => openHelp("guide", GUIDE_CHAPTERS[chapter])}>?</button>

<style>
  .help-link {
    flex: none;
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    color: var(--text-muted);
    vertical-align: middle;
  }
  .help-link:hover {
    color: var(--text);
  }
</style>
