import { createFileRoute } from '@tanstack/react-router'
import { HealthStreaks } from '~/features/health/health-streaks'
import { useCurrentLocalDay } from '~/features/health/use-current-local-day'
function StreaksPage() {
  const { localDate } = useCurrentLocalDay()
  return <section className="health-content"><div className="health-section-heading"><div><h2>Streaks</h2></div></div><HealthStreaks localDate={localDate} /></section>
}
export const Route = createFileRoute('/_app/health/streaks')({ component: StreaksPage })
