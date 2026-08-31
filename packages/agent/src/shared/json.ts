import type { JsonValue } from '@flue/runtime'
import * as v from 'valibot'

/**
 * Boundary parsers for untrusted JSON request bodies: routes decode a body
 * once with these schemas and branch on the resulting domain values instead
 * of re-narrowing loose `unknown` shapes inline.
 */
export const jsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.null(),
    v.boolean(),
    v.number(),
    v.string(),
    v.array(jsonValueSchema),
    v.record(v.string(), jsonValueSchema),
  ]),
)

export const jsonRecordSchema = v.record(v.string(), jsonValueSchema)

/** One parsed JSON object body. */
export type JsonRecord = v.InferOutput<typeof jsonRecordSchema>
