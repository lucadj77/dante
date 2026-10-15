import type { Project } from "$lib/core/project";
import { SessionRecorder } from "$lib/core/sessions";
import { app } from "$lib/state.svelte";

/** What this person wrote today, for the progress shown next to the text. */
export const writing = $state({ today: 0, minutes: 0 });

let recorder: SessionRecorder | null = null;

/** Logs the words written in the project's scenes under the user's name. */
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
    writing.today = day.added - day.removed;
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
