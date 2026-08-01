import { describe, expect, test } from 'bun:test'

import { getToolCopy } from './tool-labels'

describe('tool labels', () => {
  test('keeps specialist identity separate from completion state', () => {
    expect(getToolCopy('task', 'done', { agent: 'google-health' })).toMatchObject({
      label: 'Finished',
      powerup: 'Google Health',
    })
  })

  test('uses user-facing language for goal tools', () => {
    expect(getToolCopy('create_goal', 'running').label).toBe(
      'Creating your goal…',
    )
  })

  test('identifies Devin task activity as a Power-up', () => {
    expect(getToolCopy('task', 'running', { agent: 'devin' })).toMatchObject({
      label: 'At work…',
      powerup: 'Devin',
    })
    expect(getToolCopy('inspect_devin_task', 'done').powerup).toBe('Devin')
  })

  test('identifies Imagine as a built-in specialist', () => {
    expect(getToolCopy('task', 'running', { agent: 'imagine' })).toEqual({
      label: 'At work…',
      powerup: null,
      specialist: 'Imagine',
    })
    expect(getToolCopy('generate_video', 'done')).toEqual({
      label: 'Created your video',
      powerup: null,
      specialist: 'Imagine',
    })
  })
})
