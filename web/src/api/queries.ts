import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { bestMedal, savedMedal } from "../engine/lesson";
import { api, ApiError, unwrap, type LessonProgress, type User } from "./client";
import { forgetGuestProgress, guestProgress, saveGuestProgress } from "./guest";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<User | null> => {
    const result = await api.GET("/api/auth/me");
    if (result.response.status === 401) return null;
    return unwrap(result);
  },
  staleTime: 5 * 60_000,
});

export const progressQuery = queryOptions({
  queryKey: ["progress"],
  queryFn: async (): Promise<LessonProgress[]> => {
    const result = await api.GET("/api/progress");
    // Signed out: play as a guest with progress kept in this browser.
    if (result.response.status === 401) return guestProgress();
    return unwrap(result);
  },
});

type SaveBody = { beat_index: number; completed: boolean; state: Record<string, unknown> };

const putProgress = async (lessonId: string, body: SaveBody) =>
  unwrap(await api.PUT("/api/progress/{lesson_id}", { params: { path: { lesson_id: lessonId } }, body }));

/**
 * Moves guest progress into the account that just signed in. Where the account already has the
 * lesson, the further along or more recent save wins, and the better challenge medal is kept.
 * Anything that fails to upload stays in the browser for the next sign in.
 */
async function adoptGuestProgress() {
  const guest = guestProgress();
  if (guest.length === 0) return;
  const account = new Map(unwrap(await api.GET("/api/progress")).map((p) => [p.lesson_id, p]));
  const moved: string[] = [];
  await Promise.all(
    guest.map(async (g) => {
      const a = account.get(g.lesson_id);
      const gDone = !!g.completed_at;
      const aDone = !!a?.completed_at;
      const useGuest = !a || (gDone && !aDone) || (gDone === aDone && g.updated_at > a.updated_at);
      const keep = useGuest || !a ? g : a;
      const best = bestMedal(savedMedal(g.state, gDone), a && savedMedal(a.state, aDone));
      const medalChanged = best !== undefined && best !== savedMedal(keep.state, !!keep.completed_at);
      try {
        if (useGuest || medalChanged) {
          await putProgress(g.lesson_id, {
            beat_index: keep.beat_index,
            completed: gDone || aDone,
            state: best ? { ...keep.state, medal: best } : keep.state,
          });
        }
        moved.push(g.lesson_id);
      } catch {
        // Keep it locally and try again next time.
      }
    }),
  );
  forgetGuestProgress(moved);
}

/** Brings along anything played as a guest before the next page loads. */
async function afterAuth(user: User) {
  try {
    await adoptGuestProgress();
  } catch {
    // Signing in still worked; the guest progress stays in the browser.
  }
  return user;
}

function onAuthed(qc: QueryClient, user: User) {
  qc.removeQueries({ queryKey: progressQuery.queryKey });
  qc.setQueryData(meQuery.queryKey, user);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) =>
      afterAuth(unwrap(await api.POST("/api/auth/login", { body }))),
    onSuccess: (user) => onAuthed(qc, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string; display_name: string }) =>
      afterAuth(unwrap(await api.POST("/api/auth/register", { body }))),
    onSuccess: (user) => onAuthed(qc, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await api.POST("/api/auth/logout");
      if (!result.response.ok) throw new Error("Sign out failed.");
    },
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(meQuery.queryKey, null);
    },
  });
}

export function useSaveProgress(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SaveBody) => {
      const me = await qc.ensureQueryData(meQuery);
      if (!me) return saveGuestProgress(lessonId, body);
      try {
        return await putProgress(lessonId, body);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e;
        // The session ended mid-lesson: keep playing as a guest so nothing is lost.
        qc.setQueryData(meQuery.queryKey, null);
        return saveGuestProgress(lessonId, body);
      }
    },
    onSuccess: (saved) => {
      qc.setQueryData<LessonProgress[]>(progressQuery.queryKey, (old = []) => [
        ...old.filter((p) => p.lesson_id !== saved.lesson_id),
        saved,
      ]);
    },
  });
}
