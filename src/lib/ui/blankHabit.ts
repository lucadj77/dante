import { blankHabit } from "$lib/core/blankLines";
import { isWithin } from "$lib/core/path";
import type { Project } from "$lib/core/project";
import type { BlankLineAsk } from "$lib/editor/blankAsk";
import { app, saveAppSettings, t } from "$lib/state.svelte";

// How the novel spaces its paragraphs, read from every scene once per reading of the
// project: a scene of a few lines says too little on its own.
const habits = new WeakMap<object, 0 | 1 | null>();

function habitOf(project: Project): 0 | 1 | null {
  void project.index().then((index) => {
    if (habits.has(index)) return;
    const scenes = [...index.notes.values()].filter((n) => isWithin(n.path, project.settings.folders.manuscript)).map((n) => n.body);
    habits.set(index, blankHabit(scenes));
    known.set(project, habits.get(index)!);
  });
  return known.get(project) ?? null;
}
const known = new WeakMap<Project, 0 | 1 | null>();

/** The question about an empty line more than usual, for the scenes of `project`. */
export function blankLineAskFor(project: Project): BlankLineAsk {
  // Read now, so the first paragraph typed already knows the habit.
  habitOf(project);
  return {
    habit: () => habitOf(project),
    // With paragraphs as in a word processor the empty lines in more are not shown, nor asked about.
    enabled: () => app.settings.askBlankLines && !app.settings.paragraphs,
    onNever: () => saveAppSettings({ ...app.settings, askBlankLines: false }),
    get labels() {
      return { question: t("blankAsk.question"), why: t("blankAsk.why"), insert: t("blankAsk.insert"), no: t("blankAsk.no"), never: t("blankAsk.never") };
    },
  };
}
