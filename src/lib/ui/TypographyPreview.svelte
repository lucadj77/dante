<script lang="ts">
  // The typographic choices shown on the first dialogue of the novel: as written, and as in the book.
  import { cleanSource } from "$lib/core/export/book";
  import { splitNote } from "$lib/core/frontmatter";
  import { scenesOf } from "$lib/core/manuscript";
  import type { Project } from "$lib/core/project";
  import type { TypographySettings } from "$lib/core/settings";
  import { applyTypography, dialogueSample } from "$lib/core/typography";
  import { t } from "$lib/state.svelte";

  let { project, typography }: { project: Project; typography: TypographySettings } = $props();

  let spoken = $state<{ text: string; scene: string } | null>(null);
  $effect(() => {
    void (async () => {
      for (const node of scenesOf(project.manuscript).slice(0, 300)) {
        try {
          const text = dialogueSample(cleanSource(splitNote(await project.fs.readText(node.path)).body, project.settings.export.revisions));
          if (text) {
            spoken = { text, scene: node.title };
            return;
          }
        } catch {
          // A scene that cannot be read is skipped: the sample is only a preview.
        }
      }
    })();
  });

  const RAW = $derived(
    project.settings.language.startsWith("it")
      ? `"E' tardi" disse Anna...  Nessuno rispose .\n"Non c'e' piu' tempo", aggiunse piano.`
      : `"It's late" said Anna...  Nobody answered .\n"There's no time left", she added quietly.`,
  );
  const written = $derived(spoken?.text ?? RAW);
  const typed = $derived(applyTypography(written, typography));
</script>

<div class="compare">
  <span class="label">{t("export.previewWritten")}</span>
  <p class="raw">{written}</p>
  <span class="label">{t("export.previewBook")}</span>
  <p class="made">{typed}</p>
</div>
<span class="note">{spoken ? t("export.previewDialogue", { scene: spoken.scene }) : t("export.previewNoDialogue")}</span>

<style>
  .compare {
    display: grid;
    gap: 4px;
    width: 280px;
    max-width: 100%;
  }
  .label,
  .note {
    font-size: 12px;
    color: var(--text-muted);
  }
  .note {
    max-width: 260px;
  }
  p {
    margin: 0 0 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.5;
  }
  .raw {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .made {
    font-family: Georgia, serif;
    background: var(--editor-bg);
  }
</style>
