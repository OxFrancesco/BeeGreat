import { useKeyboard } from '@opentui/react'
import { useState } from 'react'
import { theme } from '../theme'
import { useApp, type Route } from '../store'
import { StatusBar } from '../widgets'

type MenuItem = { title: string; description: string; route?: Route; act?: 'palette' | 'quit' }

const MENU: MenuItem[] = [
  { title: 'Swap', description: 'trade through the best route', route: { name: 'action', action: 'swap' } },
  { title: 'Quote', description: 'price a swap without sending', route: { name: 'action', action: 'quote' } },
  { title: 'Pools', description: 'browse liquidity pools', route: { name: 'pools' } },
  { title: 'Positions', description: 'your liquidity, staking, and claims', route: { name: 'positions' } },
  { title: 'Epochs', description: 'votes, emissions, and bribes', route: { name: 'epochs' } },
  { title: 'Analytics', description: 'Dune Analytics: E/R, RPV, and Base share', route: { name: 'analytics' } },
  { title: 'Lock veNFT', description: 'lock AERO/VELO for voting power', route: { name: 'action', action: 'create_venft' } },
  { title: 'Wallet', description: 'connect, create, or remove wallets', route: { name: 'wallet' } },
  { title: 'All commands', description: 'every action in one palette', act: 'palette' },
  { title: 'Quit', description: 'leave the TUI', act: 'quit' },
]

export function HomeScreen(props: { openPalette: () => void }) {
  const app = useApp()
  const [selected, setSelected] = useState(0)

  const activate = (item: MenuItem) => {
    if (item.route) return app.push(item.route)
    if (item.act === 'palette') return props.openPalette()
    if (item.act === 'quit') return app.quit()
  }

  useKeyboard((key) => {
    if (app.dialogOpen) return
    if (key.name === 'up' || key.name === 'k') return setSelected((at) => (at + MENU.length - 1) % MENU.length)
    if (key.name === 'down' || key.name === 'j') return setSelected((at) => (at + 1) % MENU.length)
    if (key.name === 'return' || key.name === 'enter' || key.name === 'linefeed') return activate(MENU[selected])
    if (key.name === 'q') return app.quit()
  })

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column">
      <box flexGrow={1} minHeight={0} alignItems="center">
        <box flexGrow={1} maxHeight={3} minHeight={0} />
        <box flexShrink={0} alignItems="center">
          <ascii-font font="tiny" text="AERO" color={theme.primary} />
          <text fg={theme.textMuted}>Aerodrome & Velodrome from your terminal</text>
          <text fg={theme.warning}>⚠ vibecoded & early beta — never risk funds you cannot afford to lose</text>
        </box>
        <box height={1} flexShrink={0} />
        <box flexShrink={0} width={64}>
          {MENU.map((item, index) => {
            const active = index === selected
            return (
              <box
                key={item.title}
                height={1}
                flexDirection="row"
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={active ? theme.primary : undefined}
              >
                <text fg={active ? theme.selectedText : theme.text}>
                  {item.title}
                  <span fg={active ? theme.selectedText : theme.textMuted}>  {item.description}</span>
                </text>
              </box>
            )
          })}
        </box>
        <box flexGrow={1} minHeight={0} />
      </box>
      <StatusBar
        hints={[
          { key: '↑↓', label: 'move' },
          { key: 'enter', label: 'open' },
          { key: 'ctrl+k', label: 'commands' },
          { key: 'c', label: 'chain' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </box>
  )
}
