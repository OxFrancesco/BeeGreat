import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { executeSugarAction } from '../../actions'
import { formatCliError } from '../../cli'
import { isSugarTxAction, type SugarAction, type SugarParameters, type SugarTxAction } from '../../contracts'
import { toTokenChoice } from '../../token-catalog'
import { extractPlanSteps, localMnemonicSigner, renderPlanSummary, sendPlan, type PlanSigner, type PlanStep } from '../../send'
import type { SugarJson, Token } from '../../types'
import { loadLocalWallet, loadWalletConnectRecord, openSecret } from '../../wallet'
import { SelectDialog, PromptDialog } from '../dialogs'
import { ACTION_FORMS, ACTION_TITLES, buildParameters, initialValues, type FieldSpec, type FormValues } from '../fields'
import { humanizeResult } from '../humanize'
import { clearTuiPrefetch, runTuiAction, tuiExecution, tuiTokenCatalog } from '../sugar'
import { theme } from '../theme'
import { useApp } from '../store'
import { ScreenFrame, Spinner } from '../widgets'

type Plan = { result: SugarJson; steps: PlanStep[]; summary: string }
type Phase =
  | { kind: 'form' }
  | { kind: 'running'; label: string }
  | { kind: 'result'; data: SugarJson; showJson: boolean }
  | { kind: 'plan'; plan: Plan; showJson: boolean }
  | { kind: 'broadcast' }
  | { kind: 'sent'; hashes: string[] }

function presetValues(fields: FieldSpec[], preset?: SugarParameters): FormValues {
  const values = initialValues(fields)
  for (const field of fields) {
    const value = preset?.[field.name]
    if (value === undefined) continue
    values[field.name] = field.kind === 'boolean' ? value === true : String(value)
  }
  return values
}

function FieldRow(props: { field: FieldSpec; value: string | boolean; active: boolean; editable: boolean; onInput: (value: string) => void }) {
  const { field, value, active } = props
  const label = `${field.label}${field.required ? ' *' : ''}`
  return (
    <box height={1} flexDirection="row" backgroundColor={active ? theme.backgroundElement : undefined}>
      <box width={18} paddingLeft={1} flexShrink={0}>
        <text fg={active ? theme.primary : theme.textMuted}>{label}</text>
      </box>
      <box flexGrow={1}>
        {field.kind === 'boolean' ? (
          <text fg={value === true ? theme.success : theme.textMuted}>{value === true ? '● on' : '○ off'}</text>
        ) : field.kind === 'choice' ? (
          <text fg={active ? theme.text : theme.textMuted}>{active ? `◂ ${String(value)} ▸` : String(value)}</text>
        ) : active && props.editable ? (
          <input
            focused
            value={String(value)}
            placeholder={field.kind === 'token' ? 'type a symbol, or ⏎ to browse' : field.placeholder}
            onInput={props.onInput}
            backgroundColor={theme.backgroundElement}
            focusedBackgroundColor={theme.backgroundElement}
            textColor={theme.text}
            focusedTextColor={theme.text}
            placeholderColor={theme.textMuted}
          />
        ) : String(value) !== '' ? (
          <text fg={theme.text}>{String(value)}</text>
        ) : (
          <text fg={theme.textMuted}>{field.placeholder ?? ''}</text>
        )}
      </box>
    </box>
  )
}

function JsonView(props: { data: SugarJson; focused: boolean }) {
  const lines = useMemo(() => JSON.stringify(props.data, null, 2).split('\n'), [props.data])
  return (
    <scrollbox focused={props.focused} flexGrow={1} minHeight={0}>
      {lines.map((line, index) => (
        <text key={index} fg={theme.text} wrapMode="none" selectable>{line === '' ? ' ' : line}</text>
      ))}
    </scrollbox>
  )
}

function HumanResultView(props: { action: SugarAction; data: SugarJson; focused: boolean }) {
  const result = useMemo(() => humanizeResult(props.action, props.data), [props.action, props.data])
  return (
    <scrollbox focused={props.focused} flexGrow={1} minHeight={0}>
      {result.lines.map((line, index) => (
        <text
          key={index}
          fg={result.hasHeader && index === 0 ? theme.textMuted : theme.text}
          wrapMode="none"
          selectable
        >
          {line === '' ? ' ' : line}
        </text>
      ))}
    </scrollbox>
  )
}

export function ActionScreen(props: { action: SugarAction; preset?: SugarParameters }) {
  const app = useApp()
  const fields: FieldSpec[] = ACTION_FORMS[props.action]
  const [values, setValues] = useState<FormValues>(() => presetValues(fields, props.preset))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const [log, setLog] = useState<string[]>([])
  const [catalog, setCatalog] = useState<Token[] | null>(null)
  const alive = useRef(true)
  useEffect(() => () => {
    alive.current = false
  }, [])
  useEffect(() => {
    let mounted = true
    setCatalog(null)
    // Best-effort warm-up for the token picker; failures surface when the
    // user actually opens it.
    tuiTokenCatalog(app.chain)
      .then((tokens) => {
        if (mounted) setCatalog(tokens)
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [app.chain])
  const title = ACTION_TITLES[props.action]
  const isTx = isSugarTxAction(props.action)
  const field = fields[index]

  const setValue = (name: string, value: string | boolean) => setValues((current) => ({ ...current, [name]: value }))

  const openTokenPicker = (tokenField: FieldSpec) => {
    if (!catalog) {
      return app.toast('info', 'Loading tokens', 'The whitelisted token catalog is still scanning the chain')
    }
    app.openDialog((close) => (
      <SelectDialog
        title={`Select ${tokenField.label.toLowerCase()}`}
        items={catalog.map((token) => {
          const choice = toTokenChoice(token)
          return {
            id: `${token.tokenAddress}:${token.symbol}`,
            title: choice.title,
            description: choice.description,
            onSelect: () => {
              // Ambiguous symbols fall back to the address so the picked
              // token is the one that gets swapped.
              const sameSymbol = catalog.some((other) => other !== token && other.symbol.toLowerCase() === token.symbol.toLowerCase())
              setValue(tokenField.name, sameSymbol ? token.tokenAddress : token.symbol)
            },
          }
        })}
        initialFilter={String(values[tokenField.name])}
        placeholder='Type to filter...'
        close={close}
      />
    ))
  }

  const cycleChoice = (step: number) => {
    if (!field || field.kind !== 'choice') return
    const choices = field.choices!
    const at = choices.indexOf(String(values[field.name]))
    setValue(field.name, choices[(at + step + choices.length) % choices.length])
  }

  const run = async () => {
    let parameters: SugarParameters
    try {
      parameters = buildParameters(fields, values, app.chain)
    } catch (cause) {
      return app.toast('error', 'Invalid input', formatCliError(cause))
    }
    if ((isTx || props.action === 'positions') && parameters.wallet === undefined && app.wallet) {
      parameters.wallet = app.wallet.address
    }
    if (isTx && parameters.wallet === undefined) {
      return app.toast('error', 'No wallet', 'Connect or create a wallet first (Wallet screen)')
    }
    const rerun = phase.kind === 'result'
    setPhase({ kind: 'running', label: isTx ? 'Building the transaction plan...' : 'Fetching...' })
    try {
      // Plans must always be built fresh; reads may reuse a warm prefetch.
      const result = isTx
        ? await executeSugarAction(props.action, parameters, tuiExecution)
        : await runTuiAction(props.action, parameters, { fresh: rerun })
      if (!alive.current) return
      if (isTx) {
        const steps = extractPlanSteps(result)
        // SAFETY: isTx above is isSugarTxAction(props.action), so the action
        // is one of the transaction-building members of SugarAction.
        setPhase({ kind: 'plan', plan: { result, steps, summary: renderPlanSummary(props.action as SugarTxAction, result, steps) }, showJson: false })
      } else {
        setPhase({ kind: 'result', data: result, showJson: false })
      }
    } catch (cause) {
      if (!alive.current) return
      app.toast('error', `${title} failed`, formatCliError(cause))
      setPhase({ kind: 'form' })
    }
  }

  const broadcast = async (signer: PlanSigner, plan: Plan) => {
    setLog([])
    setPhase({ kind: 'broadcast' })
    const append = (line: string) => setLog((lines) => [...lines, line])
    try {
      const hashes = await sendPlan({ steps: plan.steps, chainId: app.chain, signer, log: append })
      clearTuiPrefetch()
      if (!alive.current) return
      app.toast('success', 'Broadcast complete', `${hashes.length} transaction${hashes.length === 1 ? '' : 's'} confirmed`)
      setPhase({ kind: 'sent', hashes })
    } catch (cause) {
      if (!alive.current) return
      app.toast('error', 'Broadcast failed', formatCliError(cause))
      setPhase({ kind: 'plan', plan, showJson: false })
    }
  }

  const sign = (plan: Plan) => {
    const wc = loadWalletConnectRecord()
    if (wc) {
      const signer: PlanSigner = {
        address: wc.address,
        describe: `WalletConnect (${wc.peer ?? 'wallet'})`,
        send: async (transaction, chainId) => {
          const { walletConnectSendTransaction } = await import('../../walletconnect')
          return walletConnectSendTransaction(transaction, chainId, (line) => setLog((lines) => [...lines, line]))
        },
      }
      return void broadcast(signer, plan)
    }
    const local = loadLocalWallet()
    if (!local) return app.toast('error', 'No wallet', 'Connect or create a wallet first (Wallet screen)')
    app.openDialog((close) => (
      <PromptDialog
        title="Wallet passphrase"
        label={`Unlock ${local.address}`}
        mask
        close={close}
        onSubmit={(passphrase) => {
          try {
            void broadcast(localMnemonicSigner(openSecret(local.sealed, passphrase)), plan)
          } catch (cause) {
            app.toast('error', 'Unlock failed', formatCliError(cause))
          }
        }}
      />
    ))
  }

  useKeyboard((key) => {
    if (app.dialogOpen) return
    if (phase.kind === 'form') {
      if (key.name === 'escape') return app.pop()
      if (key.name === 'up' || (key.name === 'tab' && key.shift)) return setIndex((at) => Math.max(0, at - 1))
      if (key.name === 'down' || (key.name === 'tab' && !key.shift)) return setIndex((at) => Math.min(fields.length - 1, at + 1))
      if (field?.kind === 'boolean' && (key.name === 'space' || key.name === 'left' || key.name === 'right')) {
        return setValue(field.name, values[field.name] !== true)
      }
      if (field?.kind === 'choice' && (key.name === 'left' || key.name === 'right' || key.name === 'space')) {
        return cycleChoice(key.name === 'left' ? -1 : 1)
      }
      if (field?.kind === 'token' && (key.name === 'return' || key.name === 'enter' || key.name === 'linefeed')) {
        return openTokenPicker(field)
      }
      if (key.name === 'return' || key.name === 'enter' || key.name === 'linefeed') {
        if (index < fields.length - 1) return setIndex(index + 1)
        return void run()
      }
      if (key.ctrl && key.name === 'r') return void run()
      return
    }
    if (phase.kind === 'result') {
      if (key.name === 'escape') return setPhase({ kind: 'form' })
      if (key.name === 'j') return setPhase({ ...phase, showJson: !phase.showJson })
      if (key.name === 'r' || key.name === 'return' || key.name === 'enter') return void run()
      return
    }
    if (phase.kind === 'plan') {
      if (phase.showJson) {
        if (key.name === 'escape' || key.name === 'j') return setPhase({ ...phase, showJson: false })
        return
      }
      if (key.name === 'escape') return setPhase({ kind: 'form' })
      if (key.name === 'j') return setPhase({ ...phase, showJson: true })
      if (key.name === 'return' || key.name === 'enter' || key.name === 'y') return sign(phase.plan)
      return
    }
    if (phase.kind === 'sent') {
      if (key.name === 'escape' || key.name === 'return' || key.name === 'enter') return app.pop()
    }
  })

  const hints = phase.kind === 'form'
    ? [
        { key: '↑↓', label: 'field' },
        {
          key: 'enter',
          label: field?.kind === 'token'
            ? 'browse tokens'
            : index < fields.length - 1 ? 'next' : isTx ? 'build plan' : 'run',
        },
        { key: 'ctrl+r', label: 'run' },
        { key: 'esc', label: 'back' },
      ]
    : phase.kind === 'result'
      ? [{ key: '↑↓', label: 'scroll' }, { key: 'j', label: phase.showJson ? 'readable' : 'json' }, { key: 'r', label: 'rerun' }, { key: 'esc', label: 'back' }]
      : phase.kind === 'plan'
        ? phase.showJson
          ? [{ key: '↑↓', label: 'scroll' }, { key: 'esc', label: 'back to plan' }]
          : [{ key: 'enter', label: 'sign & broadcast' }, { key: 'j', label: 'raw plan' }, { key: 'esc', label: 'back' }]
        : phase.kind === 'sent'
          ? [{ key: 'enter', label: 'done' }]
          : [{ key: '', label: 'working...' }]

  return (
    <ScreenFrame title={title} hints={hints}>
      {phase.kind === 'form' ? (
        <box flexGrow={1} minHeight={0}>
          <scrollbox flexGrow={1} minHeight={0}>
            {fields.map((item, at) => (
              <FieldRow
                key={item.name}
                field={item}
                value={values[item.name]}
                active={at === index}
                editable={!app.dialogOpen}
                onInput={(value) => setValue(item.name, value)}
              />
            ))}
          </scrollbox>
          <box height={1} flexShrink={0} paddingLeft={1}>
            <text fg={theme.textMuted}>{field?.help ?? field?.placeholder ?? ''}</text>
          </box>
          {isTx ? (
            <box height={1} flexShrink={0} paddingLeft={1}>
              <text fg={theme.warning}>⚠ review the plan before signing — early beta, use at your own risk</text>
            </box>
          ) : null}
        </box>
      ) : phase.kind === 'running' ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <Spinner label={phase.label} />
        </box>
      ) : phase.kind === 'result' && phase.showJson ? (
        <JsonView data={phase.data} focused={!app.dialogOpen} />
      ) : phase.kind === 'result' ? (
        <HumanResultView action={props.action} data={phase.data} focused={!app.dialogOpen} />
      ) : phase.kind === 'plan' && phase.showJson ? (
        <JsonView data={phase.plan.result} focused={!app.dialogOpen} />
      ) : phase.kind === 'plan' ? (
        <box flexGrow={1} minHeight={0} gap={1}>
          <box border borderStyle="rounded" borderColor={theme.borderActive} paddingLeft={1} paddingRight={1}>
            {phase.plan.summary.split('\n').map((line, at) => (
              <text key={at} fg={at === 0 ? theme.primary : theme.text} attributes={at === 0 ? TextAttributes.BOLD : undefined}>{line}</text>
            ))}
          </box>
          <box paddingLeft={1}>
            {phase.plan.steps.map((step, at) => (
              <text key={at} fg={theme.textMuted}>
                {`${at + 1}. ${step.role === 'approval' ? 'approve' : 'execute'} → `}
                <span fg={theme.text}>{step.transaction.to}</span>
              </text>
            ))}
          </box>
          <box paddingLeft={1}>
            <text fg={theme.warning}>Signing sends real transactions on chain {app.chain}.</text>
          </box>
        </box>
      ) : phase.kind === 'broadcast' ? (
        <box flexGrow={1} minHeight={0} gap={1}>
          <Spinner label="Signing and broadcasting..." />
          <scrollbox flexGrow={1} minHeight={0} stickyScroll stickyStart="bottom">
            {log.map((line, at) => (
              <text key={at} fg={theme.text}>{line}</text>
            ))}
          </scrollbox>
        </box>
      ) : (
        <box flexGrow={1} minHeight={0} gap={1}>
          <text fg={theme.success} attributes={TextAttributes.BOLD}>✓ Sent and confirmed</text>
          <box paddingLeft={1}>
            {phase.hashes.map((hash) => (
              <text key={hash} fg={theme.text} selectable>{hash}</text>
            ))}
          </box>
        </box>
      )}
    </ScreenFrame>
  )
}
