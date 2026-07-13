type Achievement = {
  id: string
  title: string
  kind: 'goliebee' | 'hive'
  rank?: number
}

type Badge = {
  id: string
  title: string
  caption: string
  symbol: string
  tier: 'comb' | 'honey' | 'gold'
  secret?: boolean
  unlocked: (achievements: Array<Achievement>) => boolean
}

const taskRank = (rank: number) => (achievements: Array<Achievement>) =>
  achievements.some(
    (achievement) =>
      achievement.id.includes(':tasks:') && achievement.rank === rank,
  )

const BADGES: Array<Badge> = [
  {
    id: 'tasks-1',
    title: 'Busy Bee',
    caption: 'First task done',
    symbol: '✓',
    tier: 'comb',
    unlocked: taskRank(1),
  },
  {
    id: 'tasks-5',
    title: 'Worker Bee',
    caption: '5 tasks on one Goal',
    symbol: 'ϟ',
    tier: 'honey',
    unlocked: taskRank(5),
  },
  {
    id: 'tasks-25',
    title: 'Queen’s Guard',
    caption: '25 tasks on one Goal',
    symbol: '◆',
    tier: 'gold',
    unlocked: taskRank(25),
  },
  {
    id: 'goals-1',
    title: 'First Harvest',
    caption: 'Complete a Goal',
    symbol: '❧',
    tier: 'comb',
    unlocked: (items) =>
      items.some((item) => item.id === 'hive:completed-goals:1'),
  },
  {
    id: 'goals-2',
    title: 'Full Comb',
    caption: 'Complete 2 Goals',
    symbol: '⬡',
    tier: 'honey',
    unlocked: (items) =>
      items.some((item) => item.id === 'hive:completed-goals:2'),
  },
  {
    id: 'goals-3',
    title: 'Golden Hive',
    caption: 'Complete 3 Goals',
    symbol: '♛',
    tier: 'gold',
    unlocked: (items) =>
      items.some((item) => item.id === 'hive:completed-goals:3'),
  },
  {
    id: 'genius',
    title: 'Genius Swarm',
    caption: 'Every Goal buzzing at once',
    symbol: '✦',
    tier: 'gold',
    secret: true,
    unlocked: (items) => items.some((item) => item.id === 'hive:first-genius'),
  },
]

export function Achievements({
  achievements,
}: {
  achievements: Array<Achievement>
}) {
  const count = BADGES.filter((badge) => badge.unlocked(achievements)).length
  return (
    <section className="achievement-case">
      <header>
        <div>
          <p className="utility-label">Collection</p>
          <h2>Achievements</h2>
        </div>
        <strong>
          {count}/{BADGES.length}
        </strong>
      </header>
      <div className="achievement-grid">
        {BADGES.map((badge) => {
          const unlocked = badge.unlocked(achievements)
          const hidden = badge.secret && !unlocked
          return (
            <article
              key={badge.id}
              className={`achievement${unlocked ? ` is-unlocked is-${badge.tier}` : ''}`}
              aria-label={
                hidden
                  ? 'Secret achievement, still locked'
                  : `${badge.title}, ${unlocked ? 'unlocked' : 'locked'}`
              }
            >
              <div className="achievement__medallion">
                <span>{hidden ? '?' : unlocked ? badge.symbol : '⌾'}</span>
              </div>
              <strong>{hidden ? '???' : badge.title}</strong>
              <small>{hidden ? 'Keep buzzing to reveal' : badge.caption}</small>
            </article>
          )
        })}
      </div>
    </section>
  )
}
