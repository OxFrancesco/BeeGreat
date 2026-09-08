import * as v from 'valibot'

export type PaidUsageRuntime = { convexSiteUrl?: string; convexUrl?: string; brokerSecret?: string }
const leaseSchema = v.object({ leaseId: v.string(), expiresAt: v.number() })
const voicePermitSchema = v.object({ userId: v.string(), leaseId: v.string(), expiresAt: v.number() })
const errorSchema = v.object({ error: v.string() })
export type PaidService = 'voice_transcribe' | 'voice_speak' | 'voice_realtime' | 'firecrawl'

export async function usageRequest(runtime: PaidUsageRuntime, body: Record<string, string | number>, signal?: AbortSignal) {
  const secret = runtime.brokerSecret?.trim()
  let site = runtime.convexSiteUrl?.replace(/\/$/, '')
  if (!site && runtime.convexUrl) {
    const url = new URL(runtime.convexUrl)
    if (url.hostname.endsWith('.convex.cloud')) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      site = url.origin
    }
  }
  if (!site || !secret) throw new Error('Paid service limits are not configured.')
  const response = await fetch(`${site}/internal/paid-usage`, {
    method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  })
  const result = await response.json()
  if (!response.ok) throw Object.assign(new Error(v.is(errorSchema, result) ? result.error : 'Paid service admission failed.'), { status: response.status })
  return result
}

export async function reserveUsage(userId: string, operation: PaidService, units: number, runtime: PaidUsageRuntime, signal?: AbortSignal, ticketHash?: string) {
  const result = await usageRequest(runtime, { action: 'reserve', userId, operation, units, ...(ticketHash ? { ticketHash } : {}) }, signal)
  return v.parse(leaseSchema, result)
}

export async function releaseUsage(userId: string, leaseId: string, runtime: PaidUsageRuntime) {
  await usageRequest(runtime, { action: 'release', userId, leaseId })
}

export async function claimVoiceTicket(ticketHash: string, runtime: PaidUsageRuntime) {
  return v.parse(voicePermitSchema, await usageRequest(runtime, { action: 'claim_voice', ticketHash }))
}

export async function ticketHash(ticket: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ticket))
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}
