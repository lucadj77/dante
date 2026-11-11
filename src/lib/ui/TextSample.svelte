<script lang="ts">
  import { t, type Look } from "$lib/state.svelte";

  // Two paragraphs laid out as the editor would with this look. The editor's own classes
  // and variables are used, set on the sample itself, so it shows a look other than the
  // one Dante is using now (the computer's, while the open novel has its own).

  let { value }: { value: Look } = $props();
</script>

<div
  class="sample cm-content"
  aria-label={t("appearance.sample")}
  style:max-width="{value.lineWidth}ch"
  style:--editor-font={value.fontFamily}
  style:--editor-size="{value.fontSize}px"
  style:--editor-line-height={value.lineHeight}
  style:--editor-gap={value.paragraphGap}
  style:--editor-indent="{value.indent}em"
  style:--editor-align={value.justify ? "justify" : "left"}
  style:--editor-hyphens={value.justify ? "auto" : "manual"}
>
  <div class="cm-line md-para">{t("appearance.sample1")}</div>
  <div class="cm-line md-gap"><br /></div>
  <div class="cm-line md-para">{t("appearance.sample2")}</div>
</div>

<style>
  .sample {
    padding: 16px 20px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--editor-bg);
    color: var(--text);
  }
</style>
