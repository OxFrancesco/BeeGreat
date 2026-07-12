export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { ok: true, service: 'Flue-Codex' },
    { headers: { 'cache-control': 'no-store' } },
  )
}
