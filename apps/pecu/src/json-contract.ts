import { z } from "zod";

/** Values accepted on Pecu's JSON HTTP and persisted event boundaries. */
export const jsonValueSchema = z.json();
export type JsonValue = z.infer<typeof jsonValueSchema>;
export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
export type JsonObject = z.infer<typeof jsonObjectSchema>;

/** JSON.stringify accepts optional object fields and readonly input arrays. */
export type JsonInput = string | number | boolean | null | undefined
  | readonly JsonInput[] | { readonly [key: string]: JsonInput };
export type JsonFields = Record<string, JsonInput>;
export const jsonInputSchema: z.ZodType<JsonInput> = z.lazy(() => z.union([
  z.string(), z.number(), z.boolean(), z.null(), z.undefined(),
  z.array(jsonInputSchema), z.record(z.string(), jsonInputSchema),
]));
export const jsonFieldsSchema = z.record(z.string(), jsonInputSchema);

/** Narrow an already validated JSON tree without cloning or walking it again. */
export function isJsonObject(value: JsonInput): value is JsonFields {
  return value !== null && Object(value) === value && !Array.isArray(value);
}
