import createClient from "openapi-fetch";
import type { paths } from "@/generated/api/schema";
import { ApiProblem } from "@/shared/errors/api-problem";

/**
 * Typed client generated from Core's OpenAPI contract. Requests stay same-origin so the
 * HttpOnly Better Auth session cookie is sent automatically; no token ever lives in JavaScript.
 */
export const api = createClient<paths>({
  baseUrl: "/api/v1",
  credentials: "same-origin",
});

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Returns the data of a successful call or throws the problem Core returned. */
export async function unwrap<T>(call: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok || error !== undefined) {
    throw new ApiProblem(response.status, error);
  }
  return data as T;
}
