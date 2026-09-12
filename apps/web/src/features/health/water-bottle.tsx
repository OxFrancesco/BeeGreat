import { BOTTLE_HTML } from '@beegreat/hive-3d'
import { useEffect, useRef } from 'react'
export function WaterBottle({ valueMl }: { valueMl: number }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const update = () => frame.current?.contentWindow?.postMessage({ type: 'hive-state', balance: valueMl }, '*')
  useEffect(update, [valueMl])
  return <iframe className="water-bottle-3d" ref={frame} title={`${valueMl} of 2000 millilitres. Drag to rotate bottle.`} srcDoc={BOTTLE_HTML} sandbox="allow-scripts" onLoad={update} />
}
