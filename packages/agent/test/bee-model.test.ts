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
  test('uses GPT-5.6 Terra with medium reasoning through OpenRouter', () => {
    expect(BEE_ORCHESTRATOR_MODEL_ID).toBe('gpt-5.6-terra')
    expect(BEE_ORCHESTRATOR_THINKING_LEVEL).toBe('medium')
    expect(resolveBeeOrchestratorModel()).toBe(
      'openrouter/openai/gpt-5.6-terra',
    )
  })

  test('uses the same Terra model for a user-scoped Codex provider', () => {
    expect(resolveBeeOrchestratorModel('openai-codex-user')).toBe(
      'openai-codex-user/gpt-5.6-terra',
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
    const definition = solEscalationSubagent({
      model: 'openai-codex-user/gpt-5.6-sol',
      tools: [],
      subagents: [],
    })

    expect(definition.name).toBe('sol')
    expect(definition.model).toBe('openai-codex-user/gpt-5.6-sol')
    expect(definition.thinkingLevel).toBe('medium')
    // Tools and nested delegates mount when the delegate renders at task time.
    expect(typeof definition.agent).toBe('function')
  })
})
