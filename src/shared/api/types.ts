import type { components } from "@/generated/api/schema";

/** Short aliases for generated DTOs so feature code does not repeat the long lookup type. */
export type Schemas = components["schemas"];
export type Permission = Schemas["Permission"];
