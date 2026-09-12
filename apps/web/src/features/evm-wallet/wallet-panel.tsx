import { useEffect, useRef, useState } from 'react'
import { Schema } from 'effect'
import { useUser } from '@clerk/tanstack-react-start'
import { useWallet } from '@crossmint/client-sdk-react-ui'
import { WalletNotAvailableError } from '@crossmint/wallets-sdk'
import { crossmintAdapter, crossmintChains } from '@beegreat/evm/crossmint'
import { BridgeMessage, decodePlan, forgetPairing, readPairing } from './bridge'
import type { SmartTransaction } from '@beegreat/evm/crossmint'
import { Button } from '~/components/ui/button'

const alias = 'evm-toolkit'
const chains = {
  1: 'ethereum',
  8453: 'base',
  84532: 'base-sepolia',
  11155111: 'ethereum-sepolia',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygon',
} as const
type ChainId = keyof typeof chains
function supportedChain(id: number): id is ChainId {
  return id in chains
}

export function WalletPanel() {
  const { user } = useUser()
  const { wallet, getWallet, createWallet, createPasskeySigner } = useWallet()
  const [chainId, setChainId] = useState<ChainId>(8453)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [ready, setReady] = useState(false)
  const [review, setReview] = useState<SmartTransaction | null>(null)
  const [signers, setSigners] = useState<
    Array<{ id: string; type: string; status: string }>
  >([])
  const socket = useRef<WebSocket | null>(null)
  const approval = useRef<((approved: boolean) => void) | null>(null)
  const expected = useRef<string | undefined>(undefined)
  const currentWallet = useRef(wallet)
  currentWallet.current = wallet
  const requestBusy = useRef(false)
  const email =
    user?.primaryEmailAddress?.verification.status === 'verified'
      ? user.primaryEmailAddress.emailAddress
      : undefined
  const run = async (action: () => void | Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.slice(0, 300)
          : 'Wallet request failed.',
      )
    } finally {
      setBusy(false)
    }
  }
  const refreshSigners = async () => {
    if (!wallet) return
    const list = await wallet.signers()
    setSigners(
      list.map((signer) => ({
        id: signer.locator,
        type: signer.type,
        status: signer.status,
      })),
    )
  }
  useEffect(() => {
    const pairing = readPairing()
    if (!pairing) return
    const ws = new WebSocket(`ws://127.0.0.1:${pairing.port}/bridge`)
    socket.current = ws
    const seen = new Set<string>()
    ws.onopen = () =>
      ws.send(JSON.stringify({ kind: 'auth', token: pairing.token }))
    ws.onclose = () => {
      setConnected(false)
      setReady(false)
      approval.current?.(false)
      setReview(null)
    }
    ws.onerror = () =>
      setError(
        'Cannot reach the toolkit. Reconnect from your terminal and allow local network access in this browser.',
      )
    ws.onmessage = async (event) => {
      const decoded = Schema.decodeUnknownOption(
        Schema.fromJsonString(BridgeMessage),
      )(event.data)
      if (decoded._tag === 'None') {
        ws.close()
        return
      }
      const message = decoded.value
      if (message.kind === 'ready') {
        if (!supportedChain(message.chainId)) {
          setError('Crossmint does not support this toolkit network.')
          ws.close()
          return
        }
        expected.current = message.expected
        setChainId(message.chainId)
        setReady(true)
        return
      }
      if (seen.has(message.id)) return
      seen.add(message.id)
      const respond = (value: object) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ ...value, id: message.id }))
      }
      let signing = false
      try {
        if (requestBusy.current) throw new Error('Another request is pending.')
        requestBusy.current = true
        setBusy(true)
        const active = currentWallet.current
        if (
          !active ||
          active.address.toLowerCase() !== message.account.toLowerCase() ||
          active.chain !== crossmintChains.get(message.chainId)
        )
          throw new Error('Wallet or network differs from the toolkit request.')
        const adapter = crossmintAdapter(active, message.chainId)
        let result: unknown
        if (message.method === 'evm_crossmintPrepare') {
          const plan = decodePlan(message.params[0])
          if (plan.expiresAt <= Date.now())
            throw new Error('Transaction plan expired.')
          await active.useSigner({ type: 'passkey' })
          result = await adapter.prepare(plan)
        } else if (message.method === 'evm_crossmintStatus') {
          const id = Schema.decodeUnknownSync(Schema.String)(message.params[0])
          result = await adapter.status(id)
        } else if (message.method === 'evm_crossmintApprove') {
          const id = Schema.decodeUnknownSync(Schema.String)(message.params[0])
          const plan = decodePlan(message.params[1])
          const tx = await adapter.status(id)
          if (
            tx.chainId !== plan.chainId ||
            tx.account.toLowerCase() !== plan.account.toLowerCase() ||
            tx.to.toLowerCase() !== plan.to.toLowerCase() ||
            tx.data.toLowerCase() !== plan.data.toLowerCase() ||
            tx.value !== plan.value ||
            plan.expiresAt <= Date.now()
          )
            throw new Error(
              'Transaction differs from the approved plan or has expired.',
            )
          setReview(tx)
          const accepted = await new Promise<boolean>((resolve) => {
            approval.current = resolve
          })
          approval.current = null
          setReview(null)
          if (
            !accepted ||
            ws.readyState !== WebSocket.OPEN ||
            plan.expiresAt <= Date.now()
          )
            throw new Error('Transaction approval cancelled or expired.')
          signing = true
          await active.useSigner({ type: 'passkey' })
          await adapter.approve(id, plan)
          result = null
        } else
          throw new Error('This request is not supported by the smart wallet.')
        respond({ kind: 'result', result })
      } catch (cause) {
        respond({
          kind: 'error',
          rejected: !signing,
          message:
            cause instanceof Error
              ? cause.message.slice(0, 300)
              : 'Wallet request failed.',
        })
      } finally {
        requestBusy.current = false
        setBusy(false)
      }
    }
    return () => {
      approval.current?.(false)
      ws.close()
      socket.current = null
    }
  }, [])

  const disconnect = () => {
    forgetPairing()
    socket.current?.close()
    setConnected(false)
    setReady(false)
  }
  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3">
        Network{' '}
        <select
          className="rounded-md border p-2"
          value={chainId}
          disabled={ready || Boolean(wallet)}
          onChange={(event) => {
            const id = Number(event.target.value)
            if (supportedChain(id)) setChainId(id)
          }}
        >
          {Object.entries(chains).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {!wallet ? (
        <div className="space-y-3">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                try {
                  await getWallet({ chain: chains[chainId], alias })
                  setMissing(false)
                } catch (cause) {
                  if (cause instanceof WalletNotAvailableError) setMissing(true)
                  else throw cause
                }
              })
            }
          >
            Open my wallet
          </Button>
          {missing && (
            <>
              <p>
                No toolkit wallet exists on this network. Create a passkey
                wallet with email recovery. Your existing BeeGreat wallet stays
                available in BeeGreat.
              </p>
              <Button
                disabled={busy || !email}
                onClick={() =>
                  void run(async () => {
                    if (!email)
                      throw new Error(
                        'Verify your email in your BeeGreat account first.',
                      )
                    const signer = await createPasskeySigner(
                      'BeeGreat EVM wallet',
                    )
                    const created = await createWallet({
                      chain: chains[chainId],
                      alias,
                      recovery: { type: 'email', email },
                      signers: [signer],
                    })
                    if (!created)
                      throw new Error(
                        'Wallet creation did not finish. Use Open my wallet before trying again.',
                      )
                    await created.useSigner({ type: 'passkey', id: signer.id })
                    setMissing(false)
                  })
                }
              >
                Create wallet with passkey
              </Button>
              {!email && (
                <p>Verify an email in your account before creating a wallet.</p>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <p className="break-all font-mono text-sm">{wallet.address}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || connected || !ready}
              onClick={() =>
                void run(() => {
                  if (
                    expected.current &&
                    expected.current.toLowerCase() !==
                      wallet.address.toLowerCase()
                  )
                    throw new Error(
                      'This is a different wallet from the one selected in the toolkit.',
                    )
                  if (
                    wallet.chain !== chains[chainId] ||
                    socket.current?.readyState !== WebSocket.OPEN
                  )
                    throw new Error('Reconnect from your terminal.')
                  socket.current.send(
                    JSON.stringify({
                      kind: 'connected',
                      address: wallet.address,
                      peer: 'BeeGreat smart wallet',
                    }),
                  )
                  setConnected(true)
                })
              }
            >
              {connected ? 'Connected to toolkit' : 'Connect to toolkit'}
            </Button>
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
          {!ready && (
            <p>
              Run <code>evm wallet connect --smart</code> to connect this
              browser to your terminal.
            </p>
          )}
          <div className="space-y-3 border-t pt-5">
            <h2 className="font-medium">Wallet access</h2>
            <p className="text-sm">
              Google and account passkeys sign you into BeeGreat. Your wallet
              passkey approves transactions. Email verification authorizes a
              replacement wallet passkey.
            </p>
            <p className="text-sm">
              Recovery:{' '}
              {wallet.recovery.map((method) => method.type).join(', ')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || Boolean(review)}
                onClick={() =>
                  void run(async () => {
                    const recovery = wallet.recovery.find(
                      (method) =>
                        method.type === 'email' || method.type === 'phone',
                    )
                    if (!recovery)
                      throw new Error(
                        'This wallet has no email or phone recovery method configured.',
                      )
                    await wallet.useSigner(recovery)
                    const signer = await createPasskeySigner(
                      'BeeGreat EVM replacement passkey',
                    )
                    await wallet.addSigner(signer)
                    await wallet.useSigner({ type: 'passkey', id: signer.id })
                    await refreshSigners()
                  })
                }
              >
                Add or recover wallet passkey
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(refreshSigners)}
              >
                Show wallet signers
              </Button>
            </div>
            {signers.map((signer, index) => (
              <div
                key={signer.id}
                className="flex items-center justify-between gap-3 border-b py-2"
              >
                <span>
                  {signer.type} {index + 1}, {signer.status}
                </span>
                {signer.type === 'passkey' && (
                  <Button
                    variant="outline"
                    disabled={busy || Boolean(review)}
                    onClick={() =>
                      void run(async () => {
                        if (
                          signers.filter(
                            (item) =>
                              item.type === 'passkey' &&
                              (item.status === 'success' ||
                                item.status === 'active'),
                          ).length < 2
                        )
                          throw new Error(
                            'Add and verify a replacement passkey before removing this one.',
                          )
                        await wallet.removeSigner({
                          type: 'passkey',
                          locator: signer.id,
                        })
                        await refreshSigners()
                      })
                    }
                  >
                    Remove passkey {index + 1}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {review && (
        <section
          className="space-y-3 rounded-md border p-4"
          aria-label="Review transaction"
        >
          <h2 className="font-medium">Approve transaction</h2>
          <dl className="space-y-2 break-all text-sm">
            <dt>Network</dt>
            <dd>{crossmintChains.get(review.chainId)}</dd>
            <dt>To</dt>
            <dd className="font-mono">{review.to}</dd>
            <dt>Value in wei</dt>
            <dd>{review.value}</dd>
            <dt>Calldata</dt>
            <dd className="max-h-48 overflow-auto font-mono">{review.data}</dd>
            <dt>Fee payer</dt>
            <dd>{review.feeMode}</dd>
          </dl>
          <div className="flex gap-2">
            <Button onClick={() => approval.current?.(true)}>
              Approve with passkey
            </Button>
            <Button variant="outline" onClick={() => approval.current?.(false)}>
              Reject
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
