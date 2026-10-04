import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, type LessonProgress, type User } from "./client";

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
  queryFn: async () => unwrap(await api.GET("/api/progress")),
});

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) =>
      unwrap(await api.POST("/api/auth/login", { body })),
    onSuccess: (user) => {
      qc.removeQueries({ queryKey: progressQuery.queryKey });
      qc.setQueryData(meQuery.queryKey, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; password: string; display_name: string }) =>
      unwrap(await api.POST("/api/auth/register", { body })),
    onSuccess: (user) => {
      qc.removeQueries({ queryKey: progressQuery.queryKey });
      qc.setQueryData(meQuery.queryKey, user);
    },
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
    mutationFn: async (body: { beat_index: number; completed: boolean; state: Record<string, unknown> }) =>
      unwrap(await api.PUT("/api/progress/{lesson_id}", { params: { path: { lesson_id: lessonId } }, body })),
    onSuccess: (saved) => {
      qc.setQueryData<LessonProgress[]>(progressQuery.queryKey, (old = []) => [
        ...old.filter((p) => p.lesson_id !== saved.lesson_id),
        saved,
      ]);
    },
  });
}
