import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type ApiClientDto = Schemas["ApiClientDto"];
export type ApiKeyDto = Schemas["ApiKeyDto"];

export async function listApiClients(): Promise<ApiClientDto[]> {
  const page = await unwrap(api.GET("/api-clients", { params: { query: { limit: 100 } } }));
  return page.items;
}

export function getApiClient(apiClientId: string): Promise<ApiClientDto> {
  return unwrap(api.GET("/api-clients/{apiClientId}", { params: { path: { apiClientId } } }));
}

export function createApiClient(body: Schemas["CreateApiClientRequest"]): Promise<ApiClientDto> {
  return unwrap(api.POST("/api-clients", { body }));
}

export function updateApiClient(
  apiClientId: string,
  body: Schemas["UpdateApiClientRequest"],
): Promise<ApiClientDto> {
  return unwrap(api.PUT("/api-clients/{apiClientId}", { params: { path: { apiClientId } }, body }));
}

export async function listApiKeys(apiClientId: string): Promise<ApiKeyDto[]> {
  const page = await unwrap(
    api.GET("/api-clients/{apiClientId}/api-keys", {
      params: { path: { apiClientId }, query: { limit: 100 } },
    }),
  );
  return page.items;
}

/** The response contains the complete key; callers keep it only in the reveal component. */
export function createApiKey(
  apiClientId: string,
  body: Schemas["CreateApiKeyRequest"],
): Promise<Schemas["CreatedApiKeyResponse"]> {
  return unwrap(
    api.POST("/api-clients/{apiClientId}/api-keys", { params: { path: { apiClientId } }, body }),
  );
}

export function revokeApiKey(apiClientId: string, apiKeyId: string): Promise<ApiKeyDto> {
  return unwrap(
    api.POST("/api-clients/{apiClientId}/api-keys/{apiKeyId}/revoke", {
      params: { path: { apiClientId, apiKeyId } },
    }),
  );
}
