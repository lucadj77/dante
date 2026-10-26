import type { Project } from "$lib/core/project";
import { netOf, SessionRecorder } from "$lib/core/sessions";
import type { PageUnit } from "$lib/core/settings";
import { app } from "$lib/state.svelte";

/** What this person wrote today, in words and characters, for the progress shown next to the text. */
export const writing = $state({ today: 0, todayCharacters: 0, minutes: 0 });

/** What this person wrote today in the unit given. */
export function writtenToday(unit: PageUnit): number {
  return unit === "characters" ? writing.todayCharacters : writing.today;
}

let recorder: SessionRecorder | null = null;

/** Logs the words and characters written in the project's scenes under the user's name. */
export function startSessions(project: Project): () => void {
  const current = (): SessionRecorder => {
    const user = app.settings.userName.trim();
    if (!recorder || recorder.user !== user) {
      void recorder?.flush().catch(() => {});
      recorder = new SessionRecorder(project.fs, user);
    }
    return recorder;
  };
  const refresh = async () => {
    const day = await current().today();
    writing.today = netOf(day, "words");
    writing.todayCharacters = netOf(day, "characters");
    writing.minutes = day.minutes;
  };
  project.onSceneWritten = (_path, before, after) => {
    void current()
      .record(before, after)
      .then(refresh)
      .catch(() => {});
  };
  void refresh().catch(() => {});
  const flush = () => void recorder?.flush().catch(() => {});
  window.addEventListener("beforeunload", flush);
  return () => {
    project.onSceneWritten = null;
    window.removeEventListener("beforeunload", flush);
    flush();
    recorder = null;
  };
}

/** Writes the log now, so a summary read from disk includes the last changes. */
export async function flushSessions(): Promise<void> {
  await recorder?.flush();
}
