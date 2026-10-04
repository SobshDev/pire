import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type User = components["schemas"]["User"];
export type LessonProgress = components["schemas"]["LessonProgress"];

/** Must match CSRF_HEADER in api/src/app.rs. */
const csrf: Middleware = {
  onRequest({ request }) {
    if (request.method !== "GET") request.headers.set("x-pire-request", "1");
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: window.location.origin });
api.use(csrf);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Turn an openapi-fetch result into data or a thrown ApiError with the server's message. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = result.error as { error?: string } | undefined;
    throw new ApiError(body?.error ?? "Something went wrong. Try again.", result.response.status);
  }
  return result.data;
}
