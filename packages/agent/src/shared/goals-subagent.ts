import { defineSubagent, useTool, type SubagentDefinition } from '@flue/runtime'
import { createBeeTools } from './bee-tools.ts'
import type { FocusServiceOptions } from './focus-client.ts'

// The goals specialist: reads everything under goal → project → task. Bee (the
// orchestrator) delegates here via `task`; the specialist never sees the user's
// conversation, so every delegated request must be self-contained.

const INSTRUCTIONS = `You are the goals specialist inside BeeGreat, working for Bee
(the coordinator). You inspect the user's goals, projects, and tasks with your tools.
You never talk to the user directly: your reply goes back to Bee, so be compact and
data-first — include real ids, exact titles, counts, statuses, and due dates so Bee
can render UI from your answer. No advice or chit-chat unless the request asks.

- Do exactly what the delegated read request asks, then report the outcome.
- Work is organized as goal → project → task.
- Three active Goals is the healthy threshold. Goals four through six create Brain
  Fatigue, and seven is the hard maximum. Creating an eighth fails; report the limit
  and never work around it.
- Create Goals, Projects, and Tasks only after an explicit user request. A Project or
  Task may include a recurrence rule; use a concrete ISO timestamp with the user's
  timezone from Bee's delegation. Report the exact created id and recurrence result.
- Updates, completion, parking, abandonment, and deletion remain app-only. Never imply
  those changes succeeded. Bee's first-focus preview remains the creation path for a
  new user who has not finished Hive setup.
- When a request names a goal, project, or task without an id, resolve it with
  \`get_goals\`/\`list_tasks\` first. If it is still ambiguous, do nothing and
  return the candidates so Bee can ask the user.
- Highlight completion and every non-creation change must use the signed-in app.`

export function goalsSubagent(
  userId: string,
  convexUrl: string,
  options: FocusServiceOptions,
): SubagentDefinition {
  return defineSubagent({
    name: 'goals',
    description:
      'Read goals, projects, and tasks; create one-time or recurring Goals, Projects, and Tasks. Other changes remain app-only.',
    agent: () => {
      for (const tool of createBeeTools(userId, convexUrl, options)) {
        useTool(tool)
      }
      return INSTRUCTIONS
    },
  })
}
