import type { PageUnit } from "$lib/core/settings";
import { writtenToday } from "./sessions.svelte";

/**
 * A writing session with a timer: so many minutes, and optionally so many words (or
 * characters) to reach. They are those this person adds to the manuscript while it runs, as
 * the writing log counts them.
 */
export interface Sprint {
  /** When it started, in milliseconds. */
  start: number;
  minutes: number;
  /** What the session counts, the project's unit when it started. */
  unit: PageUnit;
  /** Words or characters to reach; 0 for none. */
  target: number;
  /** What was written today when it started. */
  from: number;
}

export interface SprintResult {
  /** Words or characters written. */
  words: number;
  unit: PageUnit;
  minutes: number;
  target: number;
}

export const sprint = $state<{ running: Sprint | null; done: SprintResult | null; now: number }>({ running: null, done: null, now: Date.now() });

let timer: ReturnType<typeof setInterval> | undefined;

/** Words (or characters) written since the session started. */
export function sprintWords(): number {
  return sprint.running ? Math.max(0, writtenToday(sprint.running.unit) - sprint.running.from) : 0;
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
  sprint.done = { words: sprintWords(), unit: running.unit, minutes, target: running.target };
  sprint.running = null;
  clearInterval(timer);
  timer = undefined;
}

export function startSprint(minutes: number, target: number, unit: PageUnit) {
  sprint.done = null;
  sprint.now = Date.now();
  sprint.running = { start: sprint.now, minutes, unit, target, from: writtenToday(unit) };
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
