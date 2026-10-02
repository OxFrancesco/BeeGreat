import { z } from "zod";
import { jsonObjectSchema } from "./json-contract";
import { webIdentitySchema } from "./web-contract";

export const mcpScopeSchema = z.enum(["pecu:read", "pecu:write"]);
export const mcpToolCallSchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/),
  arguments: jsonObjectSchema,
  requestId: z.string().uuid(),
});
export const mcpBackendRequestSchema = mcpToolCallSchema.extend({
  identity: webIdentitySchema,
  clientId: z.string().min(1).max(2048),
  scopes: z.array(mcpScopeSchema).min(1).max(2),
}).strict();
export const mcpCallResultSchema = z.strictObject({
  text: z.string(),
  isError: z.boolean().default(false),
});
export type McpToolCall = z.infer<typeof mcpToolCallSchema>;
export type McpBackendRequest = z.infer<typeof mcpBackendRequestSchema>;
export type McpCallResult = z.infer<typeof mcpCallResultSchema>;
