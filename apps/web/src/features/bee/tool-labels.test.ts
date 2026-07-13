import { describe, expect, test } from 'bun:test'

import { getToolCopy } from './tool-labels'

describe('tool labels', () => {
  test('keeps specialist identity separate from completion state', () => {
    expect(getToolCopy('task', 'done', { agent: 'google-health' })).toEqual({
      label: 'Finished',
      powerup: 'Google Health',
    })
  })

  test('uses user-facing language for goal tools', () => {
    expect(getToolCopy('create_goal', 'running').label).toBe(
      'Creating your goal…',
    )
  })
})
