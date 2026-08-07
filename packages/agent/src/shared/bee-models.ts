export const BEE_ORCHESTRATOR_MODEL_ID = 'gpt-5.6-terra'
// Terra medium keeps the first response capable without paying the Sol cost.
// Sol remains the escalation path for genuinely hard requests.
export const BEE_ORCHESTRATOR_THINKING_LEVEL = 'medium' as const
export const BEE_ESCALATION_MODEL_ID = 'gpt-5.6-sol'
export const BEE_ESCALATION_THINKING_LEVEL = 'medium' as const
export const BEE_SITE_CREATOR_MODEL_ID = 'gpt-5.6-terra'
export const BEE_SITE_CREATOR_THINKING_LEVEL = 'high' as const

function resolveBeeModel(modelId: string, providerId?: string): string {
  return providerId
    ? `${providerId}/${modelId}`
    : `openrouter/openai/${modelId}`
}

export function resolveBeeOrchestratorModel(providerId?: string): string {
  return resolveBeeModel(BEE_ORCHESTRATOR_MODEL_ID, providerId)
}

export function resolveBeeEscalationModel(providerId?: string): string {
  return resolveBeeModel(BEE_ESCALATION_MODEL_ID, providerId)
}

export function resolveBeeSiteCreatorModel(providerId?: string): string {
  return resolveBeeModel(BEE_SITE_CREATOR_MODEL_ID, providerId)
}
