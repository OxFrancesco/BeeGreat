import { useEffect, useState } from 'react'
import { currentLocalDay } from './health-utils'

export function useCurrentLocalDay() {
  const [day, setDay] = useState(currentLocalDay)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      const next = currentLocalDay()
      setDay((current) => current.localDate === next.localDate && current.timeZone === next.timeZone ? current : next)
      clearTimeout(timer)
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, Math.max(1, midnight.getTime() - now.getTime()))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return day
}
