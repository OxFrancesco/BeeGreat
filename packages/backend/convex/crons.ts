import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.cron(
  'settle continuous Brain Fatigue',
  '5 0 * * *',
  internal.economy.settleFatigueBatch,
  { cursor: null },
)

export default crons
