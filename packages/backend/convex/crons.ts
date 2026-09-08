import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval('resolve interrupted comment submissions', { minutes: 5 }, internal.beennectorComments.watchdog, {})

crons.cron(
  'settle continuous Brain Fatigue',
  '5 0 * * *',
  internal.economy.settleFatigueBatch,
  {
    cursor: null,
  },
)

crons.cron(
  'remove expired Beennector delivery claims',
  '25 2 * * *',
  internal.beennectors.deleteExpiredDeliveries,
  {},
)

crons.cron(
  'remove expired bookmark crawl cache entries',
  '40 2 * * *',
  internal.bookmarkCrawl.sweepExpiredCache,
  {},
)

crons.interval(
  'repair stalled bookmark crawl runs',
  { minutes: 15 },
  internal.bookmarkCrawl.watchdog,
  {},
)

crons.interval(
  'repair account deletion jobs and safety sweeps',
  { minutes: 15 },
  internal.accountDeletion.watchdog,
  {},
)

crons.interval(
  'repair stalled Agent Jobs',
  { minutes: 15 },
  internal.agentJobRuns.watchdog,
  {},
)

crons.interval('paid usage retention', { minutes: 10 }, internal.paidUsage.sweep, {})

crons.interval('recover submitted Web3 transactions', { minutes: 5 }, internal.web3Reconciliation.watchdog, {})

crons.interval('recover Beennector webhook deliveries', { minutes: 1 }, internal.beennectorDispatch.watchdog, {})

export default crons
