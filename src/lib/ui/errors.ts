import type { MessageKey } from "$lib/i18n";
import { t } from "$lib/state.svelte";

/** What the system says for the failures that happen most, and the sentence the writer reads instead. */
const CASES: [RegExp, MessageKey][] = [
  [/permission denied|os error 13\b|EACCES|EPERM|operation not permitted|NotAllowedError|SecurityError/i, "error.permission"],
  [/read-only|os error 30\b|EROFS/i, "error.readOnly"],
  [/no space left|disk full|os error 28\b|ENOSPC|QuotaExceeded/i, "error.full"],
  [/file exists|already exists|os error 17\b|EEXIST/i, "error.exists"],
  [/no such file|os error 2\b|ENOENT|NotFoundError|cannot find the (file|path)/i, "error.missing"],
  [/failed to fetch|networkerror|network error|timed out|dns error|connection (refused|reset)/i, "error.network"],
];

/** Between the sentence for the writer and the system's own words, which ErrorText folds away. */
export const DETAIL = "\n\n";

/**
 * A failure in words for the writer: a sentence of its own for the usual cases, with the
 * technical message after DETAIL; otherwise the message itself, which may say what to do.
 */
export function failure(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name?: unknown }).name ?? "") : "";
  for (const [pattern, key] of CASES) if (pattern.test(message) || (name && pattern.test(name))) return t(key) + DETAIL + message;
  return t("error.generic", { message });
}
