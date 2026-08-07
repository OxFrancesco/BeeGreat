import createQr from 'qrcode-generator'
import { useMemo } from 'react'

export function HoneyQrCode({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const matrix = useMemo(() => {
    const qr = createQr(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    const cells: Array<{ x: number; y: number }> = []
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (qr.isDark(row, column)) cells.push({ x: column + 4, y: row + 4 })
      }
    }
    return { count: count + 8, cells }
  }, [value])

  return (
    <svg
      className={className}
      viewBox={`0 0 ${matrix.count} ${matrix.count}`}
      role="img"
      aria-label={label}
    >
      <rect
        width={matrix.count}
        height={matrix.count}
        rx="1.5"
        fill="#fff9ec"
      />
      {matrix.cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width="1.04"
          height="1.04"
          rx="0.25"
          fill="#43230f"
        />
      ))}
    </svg>
  )
}
