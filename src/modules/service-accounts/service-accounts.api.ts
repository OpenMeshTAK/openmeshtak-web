import { api, unwrap } from "@/shared/api/client";
import type { Schemas } from "@/shared/api/types";

export type ServiceAccountDto = Schemas["ServiceAccountDto"];
export type ApiKeyDto = Schemas["ApiKeyDto"];

export async function listServiceAccounts(): Promise<ServiceAccountDto[]> {
  const page = await unwrap(api.GET("/service-accounts", { params: { query: { limit: 100 } } }));
  return page.items;
}

export function getServiceAccount(serviceAccountId: string): Promise<ServiceAccountDto> {
  return unwrap(api.GET("/service-accounts/{serviceAccountId}", { params: { path: { serviceAccountId } } }));
}

export function createServiceAccount(body: Schemas["CreateServiceAccountRequest"]): Promise<ServiceAccountDto> {
  return unwrap(api.POST("/service-accounts", { body }));
}

export function updateServiceAccount(
  serviceAccountId: string,
  body: Schemas["UpdateServiceAccountRequest"],
): Promise<ServiceAccountDto> {
  return unwrap(api.PUT("/service-accounts/{serviceAccountId}", { params: { path: { serviceAccountId } }, body }));
}

export async function listApiKeys(serviceAccountId: string): Promise<ApiKeyDto[]> {
  const page = await unwrap(
    api.GET("/service-accounts/{serviceAccountId}/api-keys", {
      params: { path: { serviceAccountId }, query: { limit: 100 } },
    }),
  );
  return page.items;
}

/** The response contains the complete key; callers keep it only in the reveal component. */
export function createApiKey(
  serviceAccountId: string,
  body: Schemas["CreateApiKeyRequest"],
): Promise<Schemas["CreatedApiKeyResponse"]> {
  return unwrap(
    api.POST("/service-accounts/{serviceAccountId}/api-keys", { params: { path: { serviceAccountId } }, body }),
  );
}

export function revokeApiKey(serviceAccountId: string, apiKeyId: string): Promise<ApiKeyDto> {
  return unwrap(
    api.POST("/service-accounts/{serviceAccountId}/api-keys/{apiKeyId}/revoke", {
      params: { path: { serviceAccountId, apiKeyId } },
    }),
  );
}
