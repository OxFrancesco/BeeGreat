import { z } from "zod";

export const agentQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1500),
  options: z.array(z.string().trim().min(1).max(150)).max(6),
});
export type AgentQuestion = z.infer<typeof agentQuestionSchema>;
