import { TextAttributes } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useEffect, useMemo, useState } from 'react'
import { formatCliError } from '../../cli'
import { formatNumber, formatPercent, formatRatio, formatUsd, pad, weekLabel } from '../format'
import { renderColumns, renderHBar, type DitherColor } from '../analytics/dither'
import { loadAnalytics, type AnalyticsReport } from '../analytics/load'
import { isSaneTurnover, laneLabel, type AssetLane, type PoolScore } from '../analytics/metrics'
import { SOURCE } from '../analytics/sources'
import { ChartBox, DitherLines, Kpi, Panel } from '../analytics/view'
import { theme } from '../theme'
import { useApp } from '../store'
import { ScreenFrame, Spinner } from '../widgets'

const TABS = ['health', 'flywheel', 'trade', 'token', 'arena'] as const
type Tab = (typeof TABS)[number]
type TradeLens = 'tvl' | 'volume' | 'fees' | 'efficiency' | 'rpv'
const MIN_TRADE_TVL = 100_000

const LANE_COLOR = {
  'eth-stable': 'blue',
  btc: 'orange',
  stables: 'green',
  aero: 'purple',
  'long-tail': 'grey',
} satisfies Record<AssetLane, DitherColor>

function erColor(ratio: number | undefined): string {
  if (ratio === undefined) return theme.textMuted
  if (ratio < 1) return theme.success
  if (ratio < 1.5) return theme.warning
  return theme.error
}

function signedUsd(value: number): string {
  const text = formatUsd(Math.abs(value))
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text
}

export function AnalyticsScreen() {
  const app = useApp()
  const dimensions = useTerminalDimensions()
  const [tab, setTab] = useState<Tab>('health')
  const [report, setReport] = useState<AnalyticsReport>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [nonce, setNonce] = useState(0)
  const [selected, setSelected] = useState(0)
  const [lens, setLens] = useState<TradeLens>('tvl')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    loadAnalytics(app.chain, (next) => {
      if (!cancelled) {
        setReport(next)
        setLoading(false)
      }
    }).then((next) => {
      if (!cancelled) {
        setReport(next)
        setLoading(false)
      }
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setError(formatCliError(cause))
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [app.chain, nonce])

  const rows = useMemo(() => {
    const onchain = report?.onchain
    if (!onchain) return []
    if (tab === 'flywheel') return onchain.rpvLeaders
    if (tab === 'trade') {
      const list = onchain.pools.filter((pool) => pool.tvl >= MIN_TRADE_TVL)
      if (lens === 'fees') list.sort((left, right) => right.fees - left.fees)
      else if (lens === 'efficiency') list.sort((left, right) => right.efficiency - left.efficiency)
      else if (lens === 'rpv') list.sort((left, right) => (right.rpv ?? 0) - (left.rpv ?? 0))
      else if (lens === 'volume') list.sort((left, right) => right.volume - left.volume)
      else list.sort((left, right) => right.tvl - left.tvl)
      return list.slice(0, 20)
    }
    return []
  }, [report, tab, lens])

  const active = Math.min(selected, Math.max(0, rows.length - 1))

  useKeyboard((key) => {
    if (app.dialogOpen) return
    if (key.name === 'escape') return app.pop()
    if (key.ctrl && key.name === 'r') return setNonce((current) => current + 1)
    if (key.name === 'left' || key.name === 'h') return setTab(TABS[(TABS.indexOf(tab) + TABS.length - 1) % TABS.length])
    if (key.name === 'right' || key.name === 'l') return setTab(TABS[(TABS.indexOf(tab) + 1) % TABS.length])
    if (key.name >= '1' && key.name <= '5') return setTab(TABS[Number(key.name) - 1] ?? tab)
    if (tab === 'trade' && (key.name === 't' || key.name === 'v' || key.name === 'f' || key.name === 'e' || key.name === 'p')) {
      const next = key.name === 't' ? 'tvl' : key.name === 'v' ? 'volume' : key.name === 'f' ? 'fees' : key.name === 'e' ? 'efficiency' : 'rpv'
      setLens(next)
      setSelected(0)
      return
    }
    if (key.name === 'up' || key.name === 'k') return setSelected(Math.max(0, active - 1))
    if (key.name === 'down' || key.name === 'j') return setSelected(Math.min(rows.length - 1, active + 1))
    if ((key.name === 'return' || key.name === 'enter' || key.name === 'linefeed') && rows[active]) {
      const pool = rows[active]
      app.push({ name: 'action', action: 'epochs', preset: { lp: pool.lp } })
    }
  })

  const wide = dimensions.width >= 110
  const inner = Math.max(48, dimensions.width - 8)
  const chartWidth = wide ? Math.max(34, Math.floor(inner / 2) - 5) : inner - 4
  const chartHeight = 7
  const settled = report?.onchain?.settled
  const dune = report?.dune
  const llama = report?.llama
  const onchain = report?.onchain
  const hasEpoch = settled !== undefined && ((settled.revenue ?? 0) > 1_000 || (settled.emissionsUsd ?? 0) > 1_000)

  const hints = [
    { key: '←→', label: 'tab' },
    { key: '1-5', label: 'jump' },
    ...(tab === 'trade' ? [{ key: 'tvfep', label: 'sort' }] : []),
    ...(rows.length > 0 ? [{ key: 'enter', label: 'epoch' }] : []),
    { key: 'ctrl+r', label: 'refresh' },
    { key: 'esc', label: 'back' },
  ]

  return (
    <ScreenFrame title="Analytics" hints={hints}>
      <box flexGrow={1} minHeight={0} flexDirection="column">
        <TabBar tab={tab} />
        {loading && !report ? (
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <Spinner label="Loading Sugar, Dune, and DefiLlama…" />
          </box>
        ) : error && !report ? (
          <box paddingTop={1} paddingLeft={1}>
            <text fg={theme.error}>{error}</text>
          </box>
        ) : (
          <scrollbox flexGrow={1} minHeight={0}>
            {tab === 'health' ? (
              <box flexDirection="row" gap={1} flexShrink={0} paddingBottom={1}>
                <Kpi label="TVL" value={formatUsd(onchain?.tvl ?? llama?.tvlNow ?? 0)} source="sugar" />
                <Kpi label="VOL 24H" value={formatUsd(dune?.volume24h ?? llama?.volume24h ?? 0)} source="dune" />
                <Kpi label="FEES 24H" value={formatUsd(llama?.fees24h ?? 0)} source="llama" />
                <Kpi
                  label="BASE SHARE"
                  value={formatPercent(dune?.baseShare24h)}
                  source="dune"
                  color={theme.primary}
                />
                <Kpi
                  label="E/R"
                  value={hasEpoch ? formatRatio(settled?.erRatio) : '—'}
                  source="sugar"
                  color={hasEpoch ? erColor(settled?.erRatio) : theme.textMuted}
                />
              </box>
            ) : null}
            {tab === 'health' ? <HealthTab report={report} wide={wide} chartWidth={chartWidth} chartHeight={chartHeight} /> : null}
            {tab === 'flywheel' ? <FlywheelTab report={report} rows={rows} active={active} wide={wide} chartWidth={chartWidth} hasEpoch={hasEpoch} /> : null}
            {tab === 'trade' ? <TradeTab report={report} rows={rows} active={active} lens={lens} wide={wide} chartWidth={chartWidth} chartHeight={chartHeight} /> : null}
            {tab === 'token' ? <TokenTab report={report} wide={wide} chartWidth={chartWidth} chartHeight={chartHeight} /> : null}
            {tab === 'arena' ? <ArenaTab report={report} /> : null}
            <SourcesBar report={report} />
          </scrollbox>
        )}
      </box>
    </ScreenFrame>
  )
}

function TabBar(props: { tab: Tab }) {
  return (
    <box height={1} flexDirection="row" gap={2} flexShrink={0} paddingLeft={1}>
      {TABS.map((name, index) => {
        const active = name === props.tab
        return (
          <text key={name} fg={active ? theme.primary : theme.textMuted} attributes={active ? TextAttributes.BOLD : undefined}>
            {active ? '[' : ' '}
            {index + 1}:{name}
            {active ? ']' : ' '}
          </text>
        )
      })}
    </box>
  )
}

function turnsLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 40) return '>40x'
  return `${value.toFixed(value >= 10 ? 0 : 1)}x`
}

function HealthTab(props: { report?: AnalyticsReport; wide: boolean; chartWidth: number; chartHeight: number }) {
  const dune = props.report?.dune
  const llama = props.report?.llama
  const onchain = props.report?.onchain
  const weeks = (dune?.weeks ?? []).filter((week) => week.volume > 0)
  const llamaFees = (llama?.weeks ?? []).filter((week) => week.fees > 0)
  const volumeBars = renderColumns({
    values: weeks.map((week) => week.volume),
    width: props.chartWidth,
    height: props.chartHeight,
    color: 'blue',
  })
  const feeBars = renderColumns({
    values: llamaFees.map((week) => week.fees),
    width: props.chartWidth,
    height: props.chartHeight,
    color: 'orange',
  })
  const firstWeek = weeks[0] ? weekLabel(weeks[0].ts) : ''
  const lastWeek = weeks[weeks.length - 1] ? weekLabel(weeks[weeks.length - 1].ts) : ''
  const rivals = (dune?.rivals ?? []).slice(0, 5)
  const rivalMax = rivals[0]?.volume24h ?? 1
  return (
    <box gap={1}>
      <box flexDirection={props.wide ? 'row' : 'column'} gap={1} flexShrink={0}>
        <Panel title="Weekly volume" source="dune">
          {weeks.length === 0 ? <EmptyChart /> : (
            <ChartBox width={props.chartWidth}>
              <DitherLines rows={volumeBars} />
              <text fg={theme.textMuted}>{firstWeek}{''.padEnd(Math.max(2, props.chartWidth - firstWeek.length - lastWeek.length - 6))}{lastWeek}</text>
            </ChartBox>
          )}
        </Panel>
        <Panel title="Base 24h share" source="dune">
          {rivals.length === 0 ? <EmptyChart /> : (
            <box>
              {rivals.map((rival, index) => (
                <ShareRow
                  key={rival.name}
                  name={rival.name}
                  value={rival.volume24h}
                  max={rivalMax}
                  width={Math.max(12, props.chartWidth - 24)}
                  accent={/aerodrome/i.test(rival.name)}
                  y={index}
                />
              ))}
            </box>
          )}
        </Panel>
      </box>
      <box flexDirection={props.wide ? 'row' : 'column'} gap={1} flexShrink={0}>
        <Panel title="TVL mix" source="sugar">
          {onchain ? <Composition onchain={onchain} width={Math.max(14, props.chartWidth - 22)} /> : <EmptyChart />}
        </Panel>
        {llamaFees.length > 0 ? (
          <Panel title="Fees · Slipstream vs v1" source="llama">
            <ChartBox width={props.chartWidth}>
              <DitherLines rows={feeBars} />
              <text fg={theme.textMuted}>
                24h {formatUsd(llama?.fees24h ?? 0)}
                {'   '}7d {formatUsd(llama?.fees7d ?? 0)}
                {'   '}all-time {formatUsd(llama?.feesAllTime ?? 0)}
              </text>
            </ChartBox>
          </Panel>
        ) : (
          <Panel title="Turnover" source="sugar">
            {onchain ? <Efficiency onchain={onchain} width={Math.max(12, props.chartWidth - 24)} /> : <EmptyChart />}
          </Panel>
        )}
      </box>
    </box>
  )
}

function ShareRow(props: {
  name: string
  value: number
  max: number
  width: number
  accent?: boolean
  y: number
  label?: string
}) {
  return (
    <box flexDirection="row" height={1}>
      <box width={14} flexShrink={0}>
        <text fg={props.accent ? theme.primary : theme.text}>{pad(props.name, 14)}</text>
      </box>
      <DitherLines rows={[renderHBar({ value: props.value, max: props.max, width: props.width, color: props.accent ? 'green' : 'grey', y: props.y })]} />
      <text fg={theme.textMuted}> {props.label ?? formatUsd(props.value)}</text>
    </box>
  )
}

function MixRow(props: { label: string; value: number; total: number; width: number; color: DitherColor; y: number }) {
  const pct = props.total > 0 ? props.value / props.total : 0
  return (
    <box flexDirection="row" height={1}>
      <box width={12} flexShrink={0}>
        <text fg={theme.text}>{pad(props.label, 12)}</text>
      </box>
      <DitherLines rows={[renderHBar({ value: pct, max: 1, width: props.width, color: props.color, y: props.y })]} />
      <text fg={theme.textMuted}> {formatPercent(pct)}</text>
    </box>
  )
}

function Composition(props: { onchain: NonNullable<AnalyticsReport['onchain']>; width: number }) {
  const typeColors = { slipstream: 'green', volatile: 'blue', stable: 'grey' } as const
  return (
    <box>
      {props.onchain.composition.byType.filter((slice) => slice.value > 0).map((slice, index) => (
        <MixRow
          key={slice.key}
          label={slice.label}
          value={slice.value}
          total={props.onchain.tvl}
          width={props.width}
          color={typeColors[slice.key]}
          y={index}
        />
      ))}
      <box height={1} />
      {props.onchain.composition.byLane.filter((slice) => slice.value > 0).map((slice, index) => (
        <MixRow
          key={slice.key}
          label={laneLabel(slice.key)}
          value={slice.value}
          total={props.onchain.tvl}
          width={props.width}
          color={LANE_COLOR[slice.key]}
          y={index + 3}
        />
      ))}
    </box>
  )
}

function Efficiency(props: { onchain: NonNullable<AnalyticsReport['onchain']>; width: number }) {
  const leaders = [...props.onchain.pools]
    .filter((pool) => isSaneTurnover(pool.tvl, pool.volume))
    .sort((left, right) => right.efficiency - left.efficiency)
    .slice(0, 5)
  const max = leaders[0]?.efficiency ?? 1
  return (
    <box>
      <text fg={theme.textMuted}>
        all {turnsLabel(props.onchain.efficiency.overall)}
        {'   '}CL {turnsLabel(props.onchain.efficiency.slipstream)}
        {'   '}legacy {turnsLabel(props.onchain.efficiency.legacy)}
      </text>
      {leaders.length === 0 ? <text fg={theme.textMuted}>no pools with a readable turnover</text> : leaders.map((pool, index) => (
        <box key={pool.lp} flexDirection="row" height={1}>
          <box width={18} flexShrink={0}>
            <text fg={theme.text}>{pad(shortPool(pool.symbol), 18)}</text>
          </box>
          <DitherLines rows={[renderHBar({ value: pool.efficiency, max, width: props.width, color: pool.isCl ? 'green' : 'blue', y: index })]} />
          <text fg={theme.textMuted}> {turnsLabel(pool.efficiency)}</text>
        </box>
      ))}
    </box>
  )
}

function shortPool(symbol: string): string {
  return symbol.replace(/^CL\d+-/, '').replace(/^(v|s)AMM-/, '')
}

function FlywheelTab(props: {
  report?: AnalyticsReport
  rows: PoolScore[]
  active: number
  wide: boolean
  chartWidth: number
  hasEpoch: boolean
}) {
  const onchain = props.report?.onchain
  const dune = props.report?.dune
  const settled = onchain?.settled
  const doors = onchain?.threeDoors
  const votePools = props.rows.filter((pool) => (pool.rpv ?? 0) > 0).slice(0, 10)
  const bribes = (onchain?.bribeLeaders ?? []).filter((pool) => (pool.bribeRoi ?? 0) > 0).slice(0, 5)
  const barWidth = Math.max(12, props.chartWidth - 26)
  const doorMax = Math.max(doors?.lpWeeklyUsd ?? 0, doors?.voteWeeklyUsd ?? 0, 1)
  return (
    <box flexDirection={props.wide ? 'row' : 'column'} gap={1}>
      <Panel title="Best pools to vote" source="sugar">
        <text fg={theme.textMuted}>{`${pad('POOL', 20)} ${pad('RPV', 8)} ${pad('FEES', 8)} BRIBES`}</text>
        {votePools.length === 0 ? (
          <text fg={theme.textMuted}>No settled voter rewards yet</text>
        ) : votePools.map((pool, index) => (
          <box key={pool.lp} height={1} backgroundColor={index === props.active ? theme.primary : undefined}>
            <text fg={index === props.active ? theme.selectedText : theme.text}>
              {pad(shortPool(pool.symbol), 20)}
              {' '}
              {pad(formatUsd(pool.rpv ?? 0), 8)}
              {' '}
              {pad(formatUsd(pool.fees), 8)}
              {' '}
              {formatUsd(pool.incentives)}
            </text>
          </box>
        ))}
      </Panel>
      <box flexGrow={1} gap={1}>
        <Panel title="This epoch" source="sugar" flexGrow={0}>
          {props.hasEpoch && settled ? (
            <box>
              <text fg={theme.text}>
                fees {formatUsd(settled.fees)}
                {'   '}bribes {formatUsd(settled.incentives)}
                {'   '}emit {formatUsd(settled.emissionsUsd)}
              </text>
              <text fg={settled.netIncome >= 0 ? theme.success : theme.warning}>
                net {signedUsd(settled.netIncome)}
                {'   '}E/R {formatRatio(settled.erRatio)}
              </text>
              {settled.topByVotes[0] ? (
                <text fg={theme.textMuted}>most votes  {settled.topByVotes.slice(0, 3).map((pool) => shortPool(pool.symbol)).join('  ·  ')}</text>
              ) : null}
            </box>
          ) : (
            <text fg={theme.textMuted}>Latest epoch has not settled on-chain yet</text>
          )}
        </Panel>
        <Panel title="Same $10k" source="sugar" flexGrow={0}>
          {doors ? (
            <box>
              <ShareRow name="Hold" value={0} max={doorMax} width={barWidth} y={0} label="price" />
              <ShareRow name={`LP ${shortPool(doors.lpPool ?? '')}`} value={doors.lpWeeklyUsd} max={doorMax} width={barWidth} y={1} label={`${formatUsd(doors.lpWeeklyUsd)}/w`} />
              <ShareRow name={`Vote ${shortPool(doors.votePool ?? '')}`} value={doors.voteWeeklyUsd} max={doorMax} width={barWidth} accent y={2} label={`${formatUsd(doors.voteWeeklyUsd)}/w`} />
              <text fg={theme.textMuted}>
                LP {doors.lpApr.toFixed(1)}% APR
                {'   '}vote {doors.voteApr.toFixed(1)}% APR
              </text>
            </box>
          ) : (
            <text fg={theme.textMuted}>Need a priced pool to compare</text>
          )}
        </Panel>
        {dune?.rpvLeaders.length ? (
          <Panel title="Voters" source="dune" flexGrow={0}>
            <text fg={theme.textMuted}>Hoodie Crew query #7907454</text>
            {dune.rpvLeaders.slice(0, 6).map((row) => (
              <box key={row.wallet || row.name} height={1}>
                <text fg={theme.text}>
                  {pad(row.name, 16)}
                  {' '}
                  {pad(formatUsd(row.rpvPer10k), 8)}
                  {' '}
                  <span fg={theme.textMuted}>{formatNumber(row.veaero, 0)} ve</span>
                </text>
              </box>
            ))}
          </Panel>
        ) : bribes.length > 0 ? (
          <Panel title="Bribe ROI" source="sugar" flexGrow={0}>
            {bribes.map((pool, index) => (
              <ShareRow
                key={pool.lp}
                name={shortPool(pool.symbol)}
                value={pool.bribeRoi ?? 0}
                max={bribes[0]?.bribeRoi ?? 1}
                width={barWidth}
                y={index}
                label={`${(pool.bribeRoi ?? 0).toFixed(1)} ve/$`}
              />
            ))}
          </Panel>
        ) : null}
      </box>
    </box>
  )
}

function TradeTab(props: {
  report?: AnalyticsReport
  rows: PoolScore[]
  active: number
  lens: TradeLens
  wide: boolean
  chartWidth: number
  chartHeight: number
}) {
  const dune = props.report?.dune
  const weeks = (dune?.weeks ?? []).filter((week) => week.volume > 0)
  const bars = renderColumns({
    values: weeks.map((week) => week.volume),
    width: Math.min(props.chartWidth, 56),
    height: 6,
    color: 'blue',
  })
  const firstWeek = weeks[0] ? weekLabel(weeks[0].ts) : ''
  const lastWeek = weeks[weeks.length - 1] ? weekLabel(weeks[weeks.length - 1].ts) : ''
  return (
    <box gap={1}>
      <Panel title="Pools" source="sugar">
        <text fg={theme.textMuted}>{`${pad('POOL', 22)} ${pad('TYPE', 6)} ${pad('TVL', 10)} ${pad('FEES', 8)}  LANE`}</text>
        {props.rows.length === 0 ? (
          <text fg={theme.textMuted}>No pools above $100k TVL</text>
        ) : props.rows.map((pool, index) => (
          <box key={pool.lp} height={1} backgroundColor={index === props.active ? theme.primary : undefined}>
            <text fg={index === props.active ? theme.selectedText : theme.text}>
              {pad(shortPool(pool.symbol), 22)}
              {' '}
              {pad(pool.typeLabel, 6)}
              {' '}
              {pad(formatUsd(pool.tvl), 10)}
              {' '}
              {pad(pool.fees > 0 ? formatUsd(pool.fees) : '—', 8)}
              {'  '}
              <span fg={index === props.active ? theme.selectedText : theme.textMuted}>{laneLabel(pool.lane)}</span>
            </text>
          </box>
        ))}
      </Panel>
      {weeks.length > 0 ? (
        <Panel title="Weekly volume" source="dune" flexGrow={0}>
          <ChartBox width={Math.min(props.chartWidth, 56)}>
            <DitherLines rows={bars} />
            <text fg={theme.textMuted}>{firstWeek}  →  {lastWeek}</text>
          </ChartBox>
        </Panel>
      ) : null}
    </box>
  )
}

function TokenTab(props: { report?: AnalyticsReport; wide: boolean; chartWidth: number; chartHeight: number }) {
  const ve = props.report?.ve
  const llama = props.report?.llama
  const onchain = props.report?.onchain
  const settled = onchain?.settled
  const mcap = llama?.mcap ?? (ve && ve.price > 0 ? ve.tokenSupply * ve.price : 0)
  const realYield = ve && ve.votingPower > 0 && settled && settled.revenue > 1_000
    ? (settled.revenue / ve.votingPower) * 52
    : undefined
  const per10k = realYield === undefined ? undefined : realYield * 10_000
  const annualFees = (llama?.fees30d ?? 0) * 12
  return (
    <box flexDirection={props.wide ? 'row' : 'column'} gap={1}>
      <Panel title="Supply & locks" source="sugar">
        {ve ? (
          <box>
            <text fg={theme.text}>
              {formatPercent(ve.lockRate)} of {formatNumber(ve.tokenSupply, 2)} {ve.symbol} locked
            </text>
            <text fg={theme.textMuted}>
              {formatNumber(ve.locked, 2)} locked · {formatNumber(ve.votingPower, 2)} ve · {formatNumber(ve.nftCount, 0)} veNFTs
            </text>
            <text fg={theme.textMuted}>spot {formatUsd(ve.price)}</text>
            <text fg={theme.text}>
              real yield {realYield === undefined ? '—' : `${(realYield * 100).toFixed(1)}%`}
              {per10k === undefined ? '' : `   ${formatUsd(per10k)} / 10k ve / yr`}
            </text>
          </box>
        ) : (
          <text fg={theme.textMuted}>No veNFT contracts on this chain</text>
        )}
      </Panel>
      <Panel title="Valuation" source="llama">
        <text fg={theme.text}>mcap {formatUsd(mcap)}</text>
        <text fg={theme.textMuted}>
          fees 24h {formatUsd(llama?.fees24h ?? 0)}
          {'   '}30d {formatUsd(llama?.fees30d ?? 0)}
        </text>
        <text fg={theme.textMuted}>
          P/S {annualFees > 0 && mcap > 0 ? `${(mcap / annualFees).toFixed(1)}x` : '—'}
          {'   '}P/F 30d {llama?.fees30d && mcap ? `${(mcap / llama.fees30d).toFixed(1)}x` : '—'}
        </text>
      </Panel>
    </box>
  )
}

function ArenaTab(props: { report?: AnalyticsReport }) {
  const dune = props.report?.dune
  const rivals = dune?.rivals ?? []
  return (
    <Panel title="Base arena" source="dune">
      <text fg={theme.textMuted}>dex.trades · last 24h</text>
      <text fg={theme.textMuted}>{`${pad('PROTOCOL', 16)} ${pad('VOL 24H', 12)} SHARE`}</text>
      {rivals.length === 0 ? <text fg={theme.textMuted}>no Dune share snapshot yet</text> : rivals.map((rival) => (
        <box key={rival.name} height={1}>
          <text fg={/aerodrome|velodrome/i.test(rival.name) ? theme.primary : theme.text}>
            {pad(rival.name, 16)}
            {' '}
            {pad(formatUsd(rival.volume24h), 12)}
            {' '}
            {formatPercent(dune?.baseVolume24h ? rival.volume24h / dune.baseVolume24h : undefined)}
          </text>
        </box>
      ))}
    </Panel>
  )
}

function EmptyChart() {
  return <text fg={theme.textMuted}>Waiting for this source…</text>
}

function SourcesBar(props: { report?: AnalyticsReport }) {
  const sugar = props.report?.onchain !== undefined
  const dune = props.report?.dune !== undefined
  const llama = props.report?.llama !== undefined
  return (
    <box flexShrink={0} paddingLeft={1} paddingTop={1} gap={0}>
      <text fg={theme.textMuted}>
        <span fg={theme.text}>Sources</span>
        {'  '}
        <span fg={sugar ? SOURCE.sugar.color : theme.textMuted}>{sugar ? '●' : '○'} Sugar</span>
        <span> on-chain</span>
        {'   '}
        <span fg={dune ? SOURCE.dune.color : theme.textMuted}>{dune ? '●' : '○'} Dune</span>
        <span> dune.com · Hoodie Crew #7907454 · dex.trades</span>
        {'   '}
        <span fg={llama ? SOURCE.llama.color : theme.textMuted}>{llama ? '●' : '○'} DefiLlama</span>
        <span> defillama.com · fees/TVL</span>
      </text>
      {props.report?.errors[0] ? <text fg={theme.warning}>{props.report.errors[0]}</text> : null}
    </box>
  )
}
