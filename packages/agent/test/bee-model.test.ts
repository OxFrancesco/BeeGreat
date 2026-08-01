import { describe, expect, test } from 'bun:test'
import {
  BEE_ESCALATION_MODEL_ID,
  BEE_ESCALATION_THINKING_LEVEL,
  BEE_ORCHESTRATOR_MODEL_ID,
  BEE_ORCHESTRATOR_THINKING_LEVEL,
  BEE_SITE_CREATOR_MODEL_ID,
  BEE_SITE_CREATOR_THINKING_LEVEL,
  resolveBeeEscalationModel,
  resolveBeeOrchestratorModel,
  resolveBeeSiteCreatorModel,
} from '../src/agents/bee.ts'
import { solEscalationSubagent } from '../src/shared/sol-escalation-subagent.ts'

describe('Bee orchestrator model', () => {
  test('uses GPT-5.6 Luna with medium reasoning through OpenRouter', () => {
    expect(BEE_ORCHESTRATOR_MODEL_ID).toBe('gpt-5.6-luna')
    expect(BEE_ORCHESTRATOR_THINKING_LEVEL).toBe('medium')
    expect(resolveBeeOrchestratorModel()).toBe(
      'openrouter/openai/gpt-5.6-luna',
    )
  })

  test('uses the same Luna model for a user-scoped Codex provider', () => {
    expect(resolveBeeOrchestratorModel('openai-codex-user')).toBe(
      'openai-codex-user/gpt-5.6-luna',
    )
  })

  test('escalates unresolved work to GPT-5.6 Sol medium', () => {
    expect(BEE_ESCALATION_MODEL_ID).toBe('gpt-5.6-sol')
    expect(BEE_ESCALATION_THINKING_LEVEL).toBe('medium')
    expect(resolveBeeEscalationModel()).toBe(
      'openrouter/openai/gpt-5.6-sol',
    )
    expect(resolveBeeEscalationModel('openai-codex-user')).toBe(
      'openai-codex-user/gpt-5.6-sol',
    )
  })

  test('uses GPT-5.6 Terra High for Astro Creator', () => {
    expect(BEE_SITE_CREATOR_MODEL_ID).toBe('gpt-5.6-terra')
    expect(BEE_SITE_CREATOR_THINKING_LEVEL).toBe('high')
    expect(resolveBeeSiteCreatorModel()).toBe(
      'openrouter/openai/gpt-5.6-terra',
    )
    expect(resolveBeeSiteCreatorModel('openai-codex-user')).toBe(
      'openai-codex-user/gpt-5.6-terra',
    )
  })

  test('gives the Sol fallback the capabilities needed to retry the request', () => {
    const goals = { name: 'goals' }
    const profile = solEscalationSubagent({
      model: 'openai-codex-user/gpt-5.6-sol',
      tools: [],
      subagents: [goals],
    })

    expect(profile.name).toBe('sol')
    expect(profile.model).toBe('openai-codex-user/gpt-5.6-sol')
    expect(profile.thinkingLevel).toBe('medium')
    expect(profile.tools).toEqual([])
    expect(profile.subagents).toEqual([goals])
  })
})
