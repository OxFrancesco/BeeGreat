import { expect, test } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { act } from 'react'
import { SelectDialog } from './dialogs'

test('filtering after navigation selects the highlighted first match', async () => {
  let picked = ''
  const ui = await testRender(
    <SelectDialog title="Tokens" close={() => {}} items={['AERO', 'ETH', 'WETH', 'USDC'].map((title) => ({
      title,
      onSelect: () => { picked = title },
    }))} />,
    { width: 80, height: 24 },
  )
  try {
    await ui.renderOnce()
    await act(async () => {
      ui.mockInput.pressArrow('down')
      ui.mockInput.pressArrow('down')
    })
    await ui.renderOnce()
    await act(async () => { await ui.mockInput.typeText('eth') })
    await ui.renderOnce()
    await act(async () => { ui.mockInput.pressEnter() })
    await ui.renderOnce()
    expect(picked).toBe('ETH')
  } finally {
    await act(async () => { ui.renderer.destroy() })
  }
})

test('typing and submitting in one input batch selects the new match', async () => {
  let picked = ''
  const ui = await testRender(
    <SelectDialog title="Tokens" close={() => {}} items={['ETH', 'WETH', 'USDC'].map((title) => ({
      title,
      onSelect: () => { picked = title },
    }))} />,
    { width: 80, height: 24 },
  )
  try {
    await ui.renderOnce()
    await act(async () => {
      await ui.mockInput.typeText('usdc')
      ui.mockInput.pressEnter()
    })
    await ui.renderOnce()
    expect(picked).toBe('USDC')
  } finally {
    await act(async () => { ui.renderer.destroy() })
  }
})
