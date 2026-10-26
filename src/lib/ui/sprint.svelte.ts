import { writing } from "./sessions.svelte";

/**
 * A writing session with a timer: so many minutes, and optionally so many words to reach.
 * The words are those this person adds to the manuscript while it runs, as the writing log
 * counts them.
 */
export interface Sprint {
  /** When it started, in milliseconds. */
  start: number;
  minutes: number;
  /** Words to reach; 0 for none. */
  target: number;
  /** Today's words when it started. */
  from: number;
}

export interface SprintResult {
  words: number;
  minutes: number;
  target: number;
}

export const sprint = $state<{ running: Sprint | null; done: SprintResult | null; now: number }>({ running: null, done: null, now: Date.now() });

let timer: ReturnType<typeof setInterval> | undefined;

/** Words written since the session started. */
export function sprintWords(): number {
  return sprint.running ? Math.max(0, writing.today - sprint.running.from) : 0;
}

/** Milliseconds left, never below zero. */
export function sprintLeft(): number {
  const running = sprint.running;
  return running ? Math.max(0, running.start + running.minutes * 60_000 - sprint.now) : 0;
}

function finish() {
  const running = sprint.running;
  if (!running) return;
  const minutes = Math.max(0, Math.round((Math.min(sprint.now, running.start + running.minutes * 60_000) - running.start) / 60_000));
  sprint.done = { words: sprintWords(), minutes, target: running.target };
  sprint.running = null;
  clearInterval(timer);
  timer = undefined;
}

export function startSprint(minutes: number, target: number) {
  sprint.done = null;
  sprint.now = Date.now();
  sprint.running = { start: sprint.now, minutes, target, from: writing.today };
  clearInterval(timer);
  timer = setInterval(() => {
    sprint.now = Date.now();
    if (sprintLeft() === 0) finish();
  }, 1000);
}

/** Ends the session before its time, keeping what was written. */
export function stopSprint() {
  sprint.now = Date.now();
  finish();
}

export function dismissSprint() {
  sprint.done = null;
}
