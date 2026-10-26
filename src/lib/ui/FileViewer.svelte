<script lang="ts" module>
  const IMAGES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".avif": "image/avif",
  };
  const TEXT = new Set([".txt", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".log", ".css", ".js", ".ts"]);

  export type FileKind = "note" | "image" | "pdf" | "html" | "text" | "other";

  export function fileKind(path: string): FileKind {
    const dot = path.lastIndexOf(".");
    const ext = dot > path.lastIndexOf("/") ? path.slice(dot).toLowerCase() : "";
    if (ext === ".md") return "note";
    if (ext in IMAGES) return "image";
    if (ext === ".pdf") return "pdf";
    if (ext === ".html" || ext === ".htm") return "html";
    if (TEXT.has(ext)) return "text";
    return "other";
  }

  export function fileIcon(path: string): string {
    return { note: "📄", image: "🖼", pdf: "📕", html: "🌐", text: "📃", other: "📎" }[fileKind(path)];
  }

  export function mimeType(path: string): string {
    const kind = fileKind(path);
    if (kind === "image") return IMAGES[path.slice(path.lastIndexOf(".")).toLowerCase()];
    if (kind === "pdf") return "application/pdf";
    return "application/octet-stream";
  }
</script>

<script lang="ts">
  import ErrorText from "./ErrorText.svelte";
  import { failure } from "$lib/ui/errors";
  import type { Project } from "$lib/core/project";
  import { basename } from "$lib/core/path";
  import { t } from "$lib/state.svelte";
  import { TauriFs } from "$lib/tauriFs";
  import { BrowserFs } from "$lib/browserFs";
  import { whereIs } from "$lib/platform";

  let { project, path, compact = false }: { project: Project; path: string; compact?: boolean } = $props();

  const kind = $derived(fileKind(path));
  let url = $state<string | null>(null);
  let text = $state<string | null>(null);
  let error = $state("");

  $effect(() => {
    const current = path;
    const k = kind;
    url = null;
    text = null;
    error = "";
    let created: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (k === "image" || k === "pdf") {
          const bytes = await project.fs.readBytes(current);
          if (cancelled) return;
          created = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType(current) }));
          url = created;
        } else if (k === "html" || k === "text") {
          const value = await project.fs.readText(current);
          if (!cancelled) text = value;
        }
      } catch (e) {
        if (!cancelled) error = e instanceof Error ? e.message : String(e);
      }
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  });

  const canOpen = $derived(project.fs instanceof TauriFs);
  /** A browser cannot hand the file to another program: it says where it is, or gives a copy. */
  const inBrowser = $derived(project.fs instanceof BrowserFs);

  async function download() {
    error = "";
    try {
      const bytes = await project.fs.readBytes(path);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType(path) }));
      link.download = basename(path);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function openWithSystem() {
    error = "";
    try {
      await (project.fs as TauriFs).openWithSystem(path);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<div class="viewer" class:compact>
  {#if !compact}
    <div class="bar">
      <span class="name">{basename(path)}</span>
      {#if canOpen}
        <button onclick={openWithSystem}>{t("files.openWithSystem")}</button>
      {:else if inBrowser}
        <button onclick={download}>{t("files.download")}</button>
      {/if}
    </div>
  {/if}
  {#if error}
    <p class="message error"><ErrorText text={failure(error)} /></p>
  {:else if kind === "image"}
    {#if url}<div class="image"><img src={url} alt={basename(path)} /></div>{/if}
  {:else if kind === "pdf"}
    {#if url}<iframe class="frame" src={url} title={basename(path)}></iframe>{/if}
  {:else if kind === "html"}
    <!-- An empty sandbox: the page shows, but its scripts and forms never run. -->
    {#if text !== null}<iframe class="frame page" sandbox="" srcdoc={text} title={basename(path)}></iframe>{/if}
  {:else if kind === "text"}
    {#if text !== null}<pre>{text}</pre>{/if}
  {:else}
    <div class="message">
      <p>{t("files.noPreview")}</p>
      {#if canOpen}<button onclick={openWithSystem}>{t("files.openWithSystem")}</button>{/if}
      {#if inBrowser}
        <p class="where">{t("files.whereIs", { path: whereIs(project.fs, path) })}</p>
        <button onclick={download}>{t("files.download")}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
  }
  .name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar button {
    font-size: 12px;
  }
  .image {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 16px;
  }
  .image img {
    max-width: 100%;
    height: auto;
  }
  .frame {
    flex: 1;
    width: 100%;
    border: none;
  }
  .frame.page {
    background: #fff;
  }
  pre {
    flex: 1;
    overflow: auto;
    margin: 0;
    padding: 16px;
    font-size: 13px;
    white-space: pre-wrap;
  }
  .message {
    padding: 24px;
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
  .compact .image {
    padding: 0;
  }
  .compact .frame {
    min-height: 360px;
  }
</style>
