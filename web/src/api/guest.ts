import type { LessonProgress } from "./client";

/**
 * Progress for learners who play without an account. It lives in this browser's localStorage and
 * moves to the account when they sign up or sign in.
 */
const KEY = "pire.guest-progress";

type Store = Record<string, LessonProgress>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage is full or blocked (private mode): the lesson still plays, it just won't resume.
  }
}

export function guestProgress(): LessonProgress[] {
  return Object.values(read()).sort((a, b) => a.lesson_id.localeCompare(b.lesson_id));
}

/** Saves like the server does: the first completion time is kept. */
export function saveGuestProgress(
  lessonId: string,
  body: { beat_index: number; completed: boolean; state: Record<string, unknown> },
): LessonProgress {
  const store = read();
  const now = new Date().toISOString();
  const saved: LessonProgress = {
    lesson_id: lessonId,
    beat_index: body.beat_index,
    completed_at: store[lessonId]?.completed_at ?? (body.completed ? now : null),
    state: body.state,
    updated_at: now,
  };
  store[lessonId] = saved;
  write(store);
  return saved;
}

/** Forgets the given lessons, once they are safely in the account. */
export function forgetGuestProgress(lessonIds: string[]) {
  const store = read();
  for (const id of lessonIds) delete store[id];
  write(store);
}
