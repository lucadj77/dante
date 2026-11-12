<script lang="ts">
  // The list of the writing shortcuts in Settings: each one can be changed by pressing the new keys.
  import { comboOf, refusal, SHORTCUT_DEFAULTS, SHORTCUT_IDS, shortcutOf, type ShortcutId } from "$lib/editor/shortcuts";
  import { shortcutText } from "./formatLabels";
  import type { MessageKey } from "$lib/i18n";
  import { app, saveAppSettings, t } from "$lib/state.svelte";

  // The writing shortcuts: the one being changed waits for the next keys.
  let capturing = $state<ShortcutId | null>(null);
  let shortcutError = $state("");
  const ownShortcuts = $derived(app.settings.shortcuts);
  const comboNow = (id: ShortcutId) => (void ownShortcuts, shortcutOf(id));
  function setShortcut(id: ShortcutId, combo: string | null) {
    const next = { ...app.settings.shortcuts };
    if (combo === null || combo === SHORTCUT_DEFAULTS[id]) delete next[id];
    else next[id] = combo;
    saveAppSettings({ ...app.settings, shortcuts: next });
  }
  function captureKey(e: KeyboardEvent) {
    const id = capturing;
    if (!id) return;
    if (["Meta", "Control", "Alt", "Shift", "CapsLock", "Dead"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturing = null;
      shortcutError = "";
      return;
    }
    const combo = comboOf(e);
    if (!combo) {
      shortcutError = t("shortcuts.unusable");
      return;
    }
    const no = refusal(combo, id, app.settings.shortcuts);
    if (no) {
      const keys = shortcutText(combo);
      shortcutError = no.kind === "weak" ? t("shortcuts.weak") : no.kind === "reserved" ? t("shortcuts.reserved", { keys }) : t("shortcuts.taken", { keys, name: t(`shortcut.${no.by}` as MessageKey) });
      return;
    }
    setShortcut(id, combo);
    capturing = null;
    shortcutError = "";
  }
  $effect(() => {
    if (!capturing) return;
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  });
</script>

<ul class="shortcuts">
  {#each SHORTCUT_IDS as id (id)}
    {@const own = id in ownShortcuts}
    <li data-shortcut={id}>
      <span class="name">{t(`shortcut.${id}` as MessageKey)}</span>
      {#if capturing === id}
        <span class="press" role="status">{t("shortcuts.press")}</span>
      {:else}
        <kbd class:own>{shortcutText(comboNow(id))}</kbd>
        {#if own}<span class="own-note">{t("shortcuts.own")}</span>{/if}
      {/if}
      <span class="buttons">
        {#if own && capturing !== id}<button type="button" onclick={() => setShortcut(id, null)}>{t("shortcuts.reset")}</button>{/if}
        <button
          type="button"
          aria-pressed={capturing === id}
          onclick={(e) => {
            shortcutError = "";
            capturing = capturing === id ? null : id;
            e.currentTarget.blur();
          }}>{t("shortcuts.change")}</button
        >
      </span>
    </li>
    {#if capturing === id && shortcutError}<li class="refused" role="alert">{shortcutError}</li>{/if}
  {/each}
</ul>

<style>
  .shortcuts {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    max-width: 720px;
  }
  .shortcuts li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
  }
  .shortcuts .name {
    flex: 1;
    min-width: 0;
  }
  .shortcuts kbd {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-hover);
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
  }
  .shortcuts kbd.own {
    border-color: var(--accent);
  }
  .shortcuts .own-note,
  .shortcuts .press {
    font-size: 12px;
    color: var(--text-muted);
  }
  .shortcuts .press {
    color: var(--accent);
  }
  .shortcuts .buttons {
    display: flex;
    gap: 6px;
    min-width: 170px;
    justify-content: flex-end;
  }
  .shortcuts .refused {
    min-height: 0;
    color: var(--danger);
    font-size: 13px;
  }
</style>
