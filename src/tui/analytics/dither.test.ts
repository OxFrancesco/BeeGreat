import { describe, expect, test } from 'bun:test'
import { bayerThreshold, chartToString, ditherChar, groupRuns, renderArea, renderColumns, renderHBar, renderSpark, renderStackBar } from './dither'

describe('bayer dither', () => {
  test('thresholds stay in (0, 1)', () => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const threshold = bayerThreshold(x, y)
        expect(threshold).toBeGreaterThan(0)
        expect(threshold).toBeLessThan(1)
      }
    }
  })

  test('zero intensity is always blank', () => {
    expect(ditherChar(0, 0, 0, 'gradient')).toBe(' ')
    expect(ditherChar(0, 0, 0, 'dotted')).toBe(' ')
    expect(ditherChar(0, 0, 0, 'hatched')).toBe(' ')
    expect(ditherChar(0, 0, 0, 'solid')).toBe(' ')
  })

  test('full intensity paints every variant', () => {
    expect(ditherChar(0, 0, 1, 'solid')).toBe('█')
    expect(ditherChar(0, 0, 1, 'hatched')).toMatch(/[╱╲]/)
    expect(ditherChar(3, 1, 1, 'dotted')).toMatch(/[·•●]/)
    expect(ditherChar(3, 1, 1, 'gradient')).toMatch(/[░▒▓█]/)
  })

  test('hatched alternates diagonals', () => {
    expect(ditherChar(0, 0, 1, 'hatched')).toBe('╱')
    expect(ditherChar(1, 0, 1, 'hatched')).toBe('╲')
  })
})

describe('renderArea', () => {
  test('rising series fills more cells on the right', () => {
    const rows = renderArea({
      series: [{ key: 'fees', color: 'blue', values: [0, 1, 2, 4, 8] }],
      width: 20,
      height: 6,
    })
    const text = chartToString(rows)
    const lines = text.split('\n')
    expect(lines).toHaveLength(6)
    const last = lines[5] ?? ''
    const first = lines[0] ?? ''
    const painted = (line: string) => [...line].filter((ch) => ch !== ' ' && ch !== '│' && ch !== '└' && !/[0-9.KMB-]/.test(ch)).length
    expect(painted(last)).toBeGreaterThan(painted(first))
    expect(last).toContain('└')
  })

  test('stacked series keep a stable width', () => {
    const rows = renderArea({
      series: [
        { key: 'fees', color: 'blue', values: [2, 2, 2] },
        { key: 'bribes', color: 'purple', variant: 'hatched', values: [1, 1, 1] },
      ],
      width: 16,
      height: 5,
      stacked: true,
    })
    expect(rows.every((row) => row.length === 16)).toBe(true)
  })
})

describe('bars and sparks', () => {
  test('horizontal bar scales with value', () => {
    const empty = renderHBar({ value: 0, max: 10, width: 10, color: 'green' })
    const full = renderHBar({ value: 10, max: 10, width: 10, color: 'green' })
    expect(empty.every((cell) => cell.ch === ' ')).toBe(true)
    expect(full.some((cell) => cell.ch !== ' ')).toBe(true)
  })

  test('stack bar partitions the width by share', () => {
    const bar = renderStackBar({
      parts: [
        { value: 75, color: 'green' },
        { value: 25, color: 'grey' },
      ],
      width: 8,
    })
    expect(bar).toHaveLength(8)
    expect(bar.filter((cell) => cell.color !== '#7a8194').length).toBeGreaterThan(bar.filter((cell) => cell.color === '#7a8194').length)
  })

  test('sparkline is one row of the requested width', () => {
    const spark = renderSpark([1, 3, 2, 5, 4], 8, 'orange')
    expect(spark).toHaveLength(8)
  })

  test('columns keep one bar per week and a stable height', () => {
    const rows = renderColumns({ values: [1, 3, 2, 8], width: 24, height: 5, color: 'blue' })
    expect(rows).toHaveLength(5)
    const widths = new Set(rows.map((row) => row.length))
    expect(widths.size).toBe(1)
    const text = chartToString(rows)
    expect(text).toContain('│')
    expect(text).toContain('█')
  })

  test('groupRuns merges adjacent same-color cells', () => {
    const runs = groupRuns([
      { ch: '█', color: '#a' },
      { ch: '█', color: '#a' },
      { ch: '░', color: '#b' },
    ])
    expect(runs).toEqual([
      { text: '██', color: '#a' },
      { text: '░', color: '#b' },
    ])
  })
})
