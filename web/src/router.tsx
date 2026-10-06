import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import { getLesson } from "@pire/content";
import { meQuery, progressQuery } from "./api/queries";
import { CatalogPage } from "./routes/catalog";
import { LoginPage, RegisterPage } from "./routes/auth";
import { LearnPage } from "./routes/learn";
import { SettingsPage } from "./routes/settings";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: () => (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-muted">That page doesn't exist.</p>
      <Link to="/" className="text-amber hover:underline">
        Back to the course
      </Link>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: CatalogPage,
});

/** Only same-site paths are allowed as a post-login destination. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

const authSearch = (search: Record<string, unknown>): { redirect?: string } => {
  const to = safeRedirect(search.redirect);
  return to ? { redirect: to } : {};
};

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: authSearch,
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: authSearch,
  component: RegisterPage,
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$lessonId",
  // No account needed: guests play and their progress stays in this browser until they sign up.
  loader: async ({ context, params }) => {
    if (!getLesson(params.lessonId)) throw notFound();
    await Promise.all([context.queryClient.ensureQueryData(meQuery), context.queryClient.ensureQueryData(progressQuery)]);
  },
  component: LearnPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  // back: the lesson that opened Settings, so its back link returns there.
  validateSearch: (search: Record<string, unknown>): { back?: string } => {
    const back = safeRedirect(search.back);
    return back ? { back } : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, registerRoute, learnRoute, settingsRoute]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
