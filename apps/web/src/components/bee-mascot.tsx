import idleAnimated from '../../../mobile/assets/images/bee/idle.webp?url'
import idleStill from '../../../mobile/assets/images/bee/idle-still.png?url'
import flyAnimated from '../../../mobile/assets/images/bee/fly.webp?url'
import flyStill from '../../../mobile/assets/images/bee/fly-still.png?url'
import happyAnimated from '../../../mobile/assets/images/bee/happy.webp?url'
import happyStill from '../../../mobile/assets/images/bee/happy-still.png?url'
import sadAnimated from '../../../mobile/assets/images/bee/sad.webp?url'
import sadStill from '../../../mobile/assets/images/bee/sad-still.png?url'
import thinkingAnimated from '../../../mobile/assets/images/bee/thinking.webp?url'
import thinkingStill from '../../../mobile/assets/images/bee/thinking-still.png?url'
import failAnimated from '../../../mobile/assets/images/bee/fail.webp?url'
import failStill from '../../../mobile/assets/images/bee/fail-still.png?url'
import succeedAnimated from '../../../mobile/assets/images/bee/succeed.webp?url'
import succeedStill from '../../../mobile/assets/images/bee/succeed-still.png?url'
import type { BeeAnimation } from '@beegreat/tool-presentation'

const sources = {
  idle: { animated: idleAnimated, still: idleStill },
  fly: { animated: flyAnimated, still: flyStill },
  happy: { animated: happyAnimated, still: happyStill },
  sad: { animated: sadAnimated, still: sadStill },
  thinking: { animated: thinkingAnimated, still: thinkingStill },
  fail: { animated: failAnimated, still: failStill },
  succeed: { animated: succeedAnimated, still: succeedStill },
} satisfies Record<BeeAnimation, { animated: string; still: string }>

export function BeeMascot({
  animation = 'idle',
  animate = true,
  className,
  alt = '',
}: {
  animation?: BeeAnimation
  animate?: boolean
  className?: string
  alt?: string
}) {
  const source = sources[animation]
  return (
    <picture style={{ display: 'contents' }}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={source.still} />
      <img
        key={`${animation}-${animate}`}
        src={animate ? source.animated : source.still}
        alt={alt}
        className={className}
      />
    </picture>
  )
}
